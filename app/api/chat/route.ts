// AgentKit removed: using AI SDK only
import { streamText, Message as VercelMessage, StreamTextResult } from 'ai';
import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { getPolymarketClient } from '@/lib/polymarket/client';
// Zora custom actions removed
import supabaseAdmin from '@/lib/supabaseAdmin';
// import { zora } from 'viem/chains';

// Define the types for our API request body
interface RequestBody {
  messages: VercelMessage[];
  userId?: string; // Privy User ID
  walletId?: string; // Privy Wallet ID (Address)
}

// Helper to create a simple text stream
function createPlainTextStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    }
  });
}

export async function POST(req: Request) {
  let parentDbId: string | null = null;
  let genericErrorMessage =
    'Sorry, I encountered an issue processing that request. Please try again.'; // Default error

  const { messages, userId, walletId }: RequestBody = await req.json();
  const normalizedUserId = userId ? userId.toLowerCase() : undefined;

  // Ensure the user exists to satisfy FK constraints, in case client-side sync hasn't completed
  if (normalizedUserId) {
    try {
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('wallet_address')
        .eq('wallet_address', normalizedUserId)
        .maybeSingle();

      if (fetchError) {
        console.error('🤖 Chat API Route: Error looking up user before insert:', fetchError);
        return new Response(JSON.stringify({ error: 'User lookup failed' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!existing) {
        const { error: insertUserError } = await supabaseAdmin.from('users').insert({
          wallet_address: normalizedUserId,
          last_login: new Date().toISOString()
        });
        if (insertUserError) {
          console.error(
            '🤖 Chat API Route: Error creating user before chat insert:',
            insertUserError
          );
          return new Response(JSON.stringify({ error: 'User creation failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }
    } catch (ensureErr) {
      console.error('🤖 Chat API Route: Exception ensuring user exists:', ensureErr);
      return new Response(JSON.stringify({ error: 'Failed to ensure user exists' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // --- Save User Message --- Check for Non-Nullability
  const userMessage = messages[messages.length - 1];
  if (userMessage && userMessage.role === 'user' && normalizedUserId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('chat_history')
        .insert({
          user_id: normalizedUserId,
          message: userMessage.content,
          sender: 'user'
        })
        .select('id')
        .single();

      if (error || !data?.id) {
        console.error('🤖 Chat API Route: Error saving user message or retrieving ID:', error);
        // If user message fails to save, stop processing
        return new Response(JSON.stringify({ error: 'Failed to save user message' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        parentDbId = data.id;
        console.log(`🤖 Saved user message with DB ID: ${parentDbId}`);
      }
    } catch (dbError) {
      console.error('🤖 Chat API Route: Exception saving user message:', dbError);
      return new Response(JSON.stringify({ error: 'Failed to save user message' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } else {
    console.warn(
      '🤖 Chat API Route: Last message not from user or userId missing, cannot proceed.'
    );
    // Cannot proceed without a user message and ID to link AI response
    return new Response(JSON.stringify({ error: 'Invalid request state' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  // --- End Save User Message --- Ensure userMessageId is non-null before proceeding

  try {
    // --- Attempt AI Interaction with Tools --- Moved AgentKit setup inside this block
    // Check if ALL required conditions for tool usage are met
    const allConditionsMet = false; // AgentKit removed; always use fallback path

    if (allConditionsMet) {
      // Unused: AgentKit path removed
      return new Response(JSON.stringify({ error: 'Tools disabled' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Fallback: stream conversational response with AI SDK tools
      const tools = {
        get_top_markets: {
          description:
            'Fetch top Polymarket markets ranked by liquidity-weighted upside. Optional filters: limit, minLiquidity.',
          parameters: z
            .object({
              limit: z.number().int().min(1).max(50).optional(),
              minLiquidity: z.number().min(0).optional()
            })
            .optional(),
          execute: async (args: { limit?: number; minLiquidity?: number } = {}) => {
            const client = getPolymarketClient();
            const markets = await client.fetchMarkets();
            const filtered =
              typeof args.minLiquidity === 'number'
                ? markets.filter((m) => (m.liquidity ?? 0) >= args.minLiquidity!)
                : markets;
            const limit = args.limit ?? 10;
            return filtered.slice(0, limit);
          }
        }
      } as const;
      try {
        const result = streamText({
          model: anthropic('claude-3-7-sonnet-20250219'),
          system:
            'You are an onchain AI assistant. Use provided tools for market discovery. Avoid claiming onchain execution.',
          messages,
          tools,
          providerOptions: {
            anthropic: {
              thinking: { type: 'enabled', budgetTokens: 12000 }
            } satisfies AnthropicProviderOptions
          },
          onFinish: async (event) => {
            if (typeof event.text === 'string' && event.text.length > 0) {
              if (normalizedUserId && parentDbId) {
                try {
                  const { error: saveError } = await supabaseAdmin.from('chat_history').insert({
                    user_id: normalizedUserId,
                    message: event.text,
                    sender: 'ai',
                    parent_message_id: parentDbId
                  });
                  if (saveError) throw saveError;
                } catch (dbError: any) {
                  console.error(
                    '💥 Chat API Route: DB error saving AI message (fallback):',
                    dbError.message
                  );
                }
              } else {
                console.error(
                  '💥 Chat API Route: Cannot save AI message (fallback) - userId or parentDbId missing.'
                );
              }
            } else {
              console.warn('🤖 Chat API Route: Fallback stream finished but text empty.');
            }
          }
        });
        return result.toDataStreamResponse();
      } catch (fallbackErr: any) {
        console.error('🤖 Chat API Route: Fallback streaming error:', fallbackErr);
        // Save generic error
        if (normalizedUserId && parentDbId) {
          try {
            await supabaseAdmin.from('chat_history').insert({
              user_id: normalizedUserId,
              message: genericErrorMessage,
              sender: 'ai',
              parent_message_id: parentDbId
            });
          } catch (dbErr) {
            console.error('🤖 Chat API Route: Failed to save fallback error message:', dbErr);
          }
        }
        return new Response(JSON.stringify({ error: genericErrorMessage }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  } catch (setupError: any) {
    // Catch errors from initial AgentKit setup IF it happens within the 'if (canUseTools)' block
    console.error('🤖 Chat API Route Top Level Error (AgentKit Setup?):', setupError);
    // Attempt to save generic error linked to user message if possible
    if (normalizedUserId && parentDbId) {
      try {
        await supabaseAdmin.from('chat_history').insert({
          user_id: normalizedUserId,
          message: genericErrorMessage, // Save generic error here too
          sender: 'ai',
          parent_message_id: parentDbId
        });
      } catch (finalDbError) {
        console.error('🤖 Chat API Route: Failed to save final setup error message:', finalDbError);
      }
    }
    // Return a non-streamed generic error to the client
    return new Response(
      JSON.stringify({ error: 'Failed to process chat request due to a setup error.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
