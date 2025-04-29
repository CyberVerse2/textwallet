import {
  AgentKit,
  AgentKitOptions,
  alchemyTokenPricesActionProvider,
  erc721ActionProvider,
  FlaunchActionProvider,
  PrivyEvmWalletConfig,
  PrivyEvmWalletProvider,
  pythActionProvider,
  walletActionProvider
} from '@coinbase/agentkit';
import { getVercelAITools } from '@coinbase/agentkit-vercel-ai-sdk';
import { streamText, Message as VercelMessage, StreamTextResult } from 'ai';
import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { zoraActionProvider } from '@/lib/customActions/zora/zoraActionProvider';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { zora } from 'viem/chains';

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

  // --- Save User Message --- Check for Non-Nullability
  const userMessage = messages[messages.length - 1];
  if (userMessage && userMessage.role === 'user' && userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('chat_history')
        .insert({
          user_id: userId,
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
    const allConditionsMet = userId && parentDbId && process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.NEXT_PUBLIC_PRIVY_APP_SECRET && process.env.PRIVY_AUTHORIZATION_KEY_ID && process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY;

    if (allConditionsMet) {
      // Setup AgentKit and tools ONLY if conditions met
      const walletConfig: PrivyEvmWalletConfig = {
        appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
        appSecret: process.env.NEXT_PUBLIC_PRIVY_APP_SECRET!,
        walletId,
        chainId: process.env.PRIVY_CHAIN_ID || '8453',
        authorizationKeyId: process.env.PRIVY_AUTHORIZATION_KEY_ID!,
        authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!
      }; // Added type annotation
      const walletProvider = await PrivyEvmWalletProvider.configureWithWallet(walletConfig);
      const erc721 = erc721ActionProvider();
      const pyth = pythActionProvider();
      const walletAct = walletActionProvider();
      const flaunch = new FlaunchActionProvider({
        pinataJwt: process.env.PINATA_JWT// Required for IPFS uploads
      });// Renamed wallet variable
      // const zora = zoraActionProvider();
      const alchemy = alchemyTokenPricesActionProvider({
        apiKey: process.env.ALCHEMY_API_KEY
      });

      const agentKitConfig: AgentKitOptions = {
        walletProvider,
        actionProviders: [erc721, pyth, walletAct, alchemy, flaunch]
        // Add CDP keys if needed
      };
      const agentKit = await AgentKit.from(agentKitConfig);
      const tools = getVercelAITools(agentKit);

      try {
        // --- Execute streamText with Tools and return response directly ---
        const result = streamText({
          model: anthropic('claude-3-7-sonnet-20250219'),
          system:
            'You are an onchain AI assistant with access to a server wallet. You can perform blockchain operations through the provided tools. Always explain what you are doing and why.',
          toolCallStreaming: true,
          messages,
          tools,
          maxSteps: 10,
          providerOptions: {
            anthropic: {
              thinking: { type: 'enabled', budgetTokens: 12000 }
            } satisfies AnthropicProviderOptions
          },
          onFinish: async (event) => { 


            // Check if event.text exists and is a non-empty string before accessing it
            if (typeof event.text === 'string' && event.text.length > 0) {
              console.log(`🤖 Chat API Route: Stream finished. Final text property found. Length: ${event.text.length}`);
              // Proceed with saving only if text exists
              if (userId && parentDbId) {
                try {
                  const { error: saveError } = await supabaseAdmin.from('chat_history').insert({
                    user_id: userId,
                    message: event.text, // Save the final text from the event object
                    sender: 'ai',
                    parent_message_id: parentDbId
                  });
                  if (saveError) throw saveError;
                  console.log(`🤖 Chat API Route: Saved successful AI message to DB for user ${userId}, parent ${parentDbId}`);
                } catch (dbError: any) {
                   console.error("💥 Chat API Route: DB error saving AI message in onFinish:", dbError.message);
                }
              } else {
                console.error("💥 Chat API Route: Cannot save AI message in onFinish - userId or parentDbId missing.");
              }
            } else {
               // Log if event.text wasn't found or was empty
               console.warn("🤖 Chat API Route: Stream finished, but event.text was empty or not found in the event object. Skipping save based on .text.");
            }
          }
        });

        // Immediately return the Vercel AI SDK response object
        // This handles streaming text, tool calls, and tool results to the client
        return result.toDataStreamResponse();
      } catch (streamOrToolError: any) {
        // Errors from streamText setup or initial call
        console.error(
          '🤖 Chat API Route: Error during streamText setup/initiation:',
          streamOrToolError
        );
        // Directly save the initiation error message here
        if (userId && parentDbId) {
            try {
                const { error: initiationSaveError } = await supabaseAdmin.from('chat_history').insert({
                  user_id: userId,
                  message: genericErrorMessage, // Save the generic error message
                  sender: 'ai',
                  parent_message_id: parentDbId
                });
                if (initiationSaveError) throw initiationSaveError;
                console.log(`🤖 Chat API Route: Saved AI initiation error message to DB for user ${userId}, parent ${parentDbId}`);
            } catch (dbError: any) {
                console.error("💥 Chat API Route: DB error saving AI initiation error message:", dbError.message);
            }
        } else {
             console.error("💥 Chat API Route: Cannot save AI initiation error message - userId or parentDbId missing.");
        }
        // Return an error response to the client
        return new Response(JSON.stringify({ error: genericErrorMessage }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Conditions for tool usage NOT met - Treat as an error, DO NOT call streamText
      console.error(
        '🤖 Chat API Route: Configuration incomplete for tool usage. Required IDs or ENV VARS missing.'
      );
      genericErrorMessage =
        'Sorry, I cannot perform actions requiring wallet access due to configuration issues.'; // More specific error
      // Directly save the config error message here
      if (userId && parentDbId) {
          try {
              const { error: configSaveError } = await supabaseAdmin.from('chat_history').insert({
                user_id: userId,
                message: genericErrorMessage, // Save the config error message
                sender: 'ai',
                parent_message_id: parentDbId
              });
              if (configSaveError) throw configSaveError;
               console.log(`🤖 Chat API Route: Saved AI config error message to DB for user ${userId}, parent ${parentDbId}`);
          } catch (dbError: any) {
              console.error("💥 Chat API Route: DB error saving AI config error message:", dbError.message);
          }
      } else {
           console.error("💥 Chat API Route: Cannot save AI config error message - userId or parentDbId missing.");
      }
      // Return an error response to the client
      return new Response(JSON.stringify({ error: genericErrorMessage }), {
        status: 500, 
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (setupError: any) {
    // Catch errors from initial AgentKit setup IF it happens within the 'if (canUseTools)' block
    console.error('🤖 Chat API Route Top Level Error (AgentKit Setup?):', setupError);
    // Attempt to save generic error linked to user message if possible
    if (userId && parentDbId) {
      try {
        await supabaseAdmin.from('chat_history').insert({
          user_id: userId,
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
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
