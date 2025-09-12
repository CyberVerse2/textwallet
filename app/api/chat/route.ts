// AgentKit removed: using AI SDK only
import {
  streamText,
  Message as VercelMessage,
  StreamTextResult,
  tool,
  convertToCoreMessages
} from 'ai';
import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { getPolymarketClient } from '@/lib/polymarket/client';
// Zora custom actions removed
import supabaseAdmin from '@/lib/supabaseAdmin';
// import { zora } from 'viem/chains';

// ---------- Local scoring helpers (adapted from events strategy) ----------
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const logistic = (x: number, k = 0.002) => 1 / (1 + Math.exp(-k * x));
const SUBJECTIVE_HINTS = [
  'vibe',
  'vibes',
  'attractive',
  'coolest',
  'funniest',
  'best-looking',
  'sexiest',
  'memes',
  'subjective',
  'opinion',
  'favorite',
  'favourite',
  'most interesting',
  'hottest take'
];
function clarityHeuristic(title?: string, description?: string) {
  const t = `${title ?? ''} ${description ?? ''}`.toLowerCase();
  if (SUBJECTIVE_HINTS.some((h) => t.includes(h))) return 0;
  let s = 0.4;
  if (
    /\b(official|government|court|sec|census|election|match|tournament|conference|deadline|on-chain|oracle)\b/.test(
      t
    )
  )
    s += 0.3;
  if (/will (.*) (before|by|on) [a-z]{3,9} \d{1,2},? \d{4}/i.test(t)) s += 0.2;
  if (/\bsource:|resolution|criteria|judge|data\b/.test(t)) s += 0.1;
  return clamp(s, 0, 1);
}
function stabilityProxy(spread?: number, vol24h?: number) {
  const s = 1 - clamp(spread ?? 0.06, 0, 0.2) / 0.2;
  const v = logistic(vol24h ?? 0);
  return clamp(0.6 * s + 0.4 * v);
}
function kellyFraction(pm: number, pStar: number) {
  const b = (1 - pm) / pm;
  const f = (b * pStar - (1 - pStar)) / b;
  return clamp(0.5 * f, 0, 0.05); // half-kelly, cap 5%
}

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
  const coreMessages = Array.isArray(messages) ? convertToCoreMessages(messages) : [];
  const normalizedUserId = userId ? userId.toLowerCase() : undefined;
  try {
    console.log('🤖 Chat API Route: Incoming request', {
      userId: normalizedUserId,
      totalMessages: Array.isArray(messages) ? messages.length : 0,
      lastMessage:
        Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : null
    });
  } catch {}

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
        get_top_markets: tool({
          description:
            'Fetch current Polymarket events ranked by liquidity-weighted upside. Uses /events filters; defaults to current (closed=false, end_date_min=now).',
          parameters: z.object({
            limit: z.coerce.number().int().min(1).max(50).default(10),
            offset: z.coerce.number().int().min(0).default(0),
            order: z.string().optional(),
            ascending: z.coerce.boolean().optional(),
            id: z.array(z.union([z.string(), z.coerce.number()])).optional(),
            slug: z.array(z.string()).optional(),
            clob_token_ids: z.array(z.string()).optional(),
            condition_ids: z.array(z.string()).optional(),
            market_maker_address: z.array(z.string()).optional(),
            liquidity_num_min: z.coerce.number().optional(),
            liquidity_num_max: z.coerce.number().optional(),
            volume_num_min: z.coerce.number().optional(),
            volume_num_max: z.coerce.number().optional(),
            start_date_min: z.string().optional(),
            start_date_max: z.string().optional(),
            end_date_min: z.string().optional(),
            end_date_max: z.string().optional(),
            tag_id: z.coerce.number().optional(),
            related_tags: z.coerce.boolean().optional(),
            cyom: z.coerce.boolean().optional(),
            uma_resolution_status: z.string().optional(),
            game_id: z.string().optional(),
            sports_market_types: z.array(z.string()).optional(),
            rewards_min_size: z.coerce.number().optional(),
            question_ids: z.array(z.string()).optional(),
            include_tag: z.coerce.boolean().optional(),
            closed: z.coerce.boolean().optional(),
            // Local heuristic knobs
            limitPicks: z.coerce.number().int().min(1).max(25).default(8),
            maxDaysToEnd: z.coerce.number().int().min(1).max(90).default(21),
            minConsensus: z.coerce.number().min(0.5).max(0.99).default(0.7),
            minLiquidityLocal: z.coerce.number().min(0).default(1500),
            maxSpreadLocal: z.coerce.number().min(0).max(0.5).default(0.04),
            includeAmbiguous: z.coerce.boolean().default(false)
          }),
          execute: async (args: any) => {
            const startedAt = Date.now();
            const nowIso = new Date().toISOString();
            const {
              limitPicks,
              maxDaysToEnd,
              minConsensus,
              minLiquidityLocal,
              maxSpreadLocal,
              includeAmbiguous,
              ...fetchFilters
            } = args || {};
            // Apply sensible server-side defaults for current events
            const filters = {
              closed: false,
              // some /events deployments don't accept end_date_min → omit by default
              // end_date_min: nowIso,
              order: fetchFilters.order ?? 'liquidity_num',
              ascending: fetchFilters.ascending ?? false,
              ...fetchFilters
            };
            console.log('🧰 get_top_markets START', { filters, startedAt });
            try {
              const client = getPolymarketClient();
              const markets = await client.fetchMarkets(filters);
              const now = Date.now();
              const picks: any[] = [];

              for (const m of markets) {
                const daysToEnd = m.endsAt ? (Date.parse(m.endsAt) - now) / 86400000 : 365;
                if (Number.isFinite(daysToEnd)) {
                  if (daysToEnd < 1 || daysToEnd > (maxDaysToEnd ?? 21)) continue;
                }
                const liquidity = m.liquidity ?? 0;
                if (liquidity < (minLiquidityLocal ?? 1500)) continue;

                const spread =
                  m.bestAsk && m.bestBid && m.bestAsk > 0 && m.bestBid > 0
                    ? clamp(m.bestAsk - m.bestBid, 0, 1)
                    : 0.06;
                if (spread > (maxSpreadLocal ?? 0.04)) continue;

                const fR = clarityHeuristic(m.title);
                if (!(includeAmbiguous ?? false) && fR < 0.3) continue;

                // Consensus probability proxy
                const consensus = clamp(
                  typeof m.lastPrice === 'number' ? m.lastPrice : m.bestBid ?? 0.0
                );
                if (consensus < (minConsensus ?? 0.7)) continue;

                const fT = clamp(
                  1 - (Number.isFinite(daysToEnd) ? daysToEnd / (maxDaysToEnd ?? 21) : 0)
                );
                const fL = logistic(liquidity);
                const fSpr = clamp(1 - clamp(spread, 0, 0.2) / 0.2);
                const fAct = logistic(m.volume24h ?? 0);
                const fStab = stabilityProxy(spread, m.volume24h ?? 0);

                const score = clamp(
                  0.4 * consensus +
                    0.2 * fT +
                    0.2 * (0.7 * fL + 0.3 * fSpr) +
                    0.1 * (0.6 * fStab + 0.4 * fAct) +
                    0.1 * fR
                );

                // Stability‑tied conservative bump (max ~+5pp), with decay near extremes
                const extremeDecay = consensus > 0.85 || consensus < 0.15 ? 0.5 : 1.0;
                const bump = (0.02 + 0.03 * fStab) * extremeDecay;
                const pStar = clamp(consensus + bump, consensus, 0.98);
                const edge = +(pStar - consensus).toFixed(4);
                const sizeSuggestion = +kellyFraction(consensus, pStar).toFixed(4);

                picks.push({
                  id: m.id,
                  title: m.title,
                  url: m.url,
                  bestBid: m.bestBid ?? null,
                  bestAsk: m.bestAsk ?? null,
                  lastPrice: m.lastPrice ?? null,
                  liquidity,
                  volume24h: m.volume24h ?? 0,
                  score: +score.toFixed(4),
                  pm: +consensus.toFixed(4),
                  pStar: +pStar.toFixed(4),
                  edge,
                  sizeSuggestion,
                  daysToEnd: Number.isFinite(daysToEnd) ? Math.max(0, Math.round(daysToEnd)) : null,
                  reasons: [
                    `consensus=${consensus.toFixed(2)}`,
                    `edge=+${(edge * 100).toFixed(1)}pp`,
                    `daysToEnd=${
                      Number.isFinite(daysToEnd) ? Math.max(0, Math.round(daysToEnd)) : 'n/a'
                    }`,
                    `liquidity≈${Math.round(liquidity).toLocaleString()}`,
                    `vol24h≈${Math.round(m.volume24h ?? 0).toLocaleString()}`,
                    `spread≈${spread.toFixed(3)}`,
                    `clarity≈${fR.toFixed(2)}`
                  ]
                });
              }

              picks.sort((a, b) => b.score - a.score);
              const resultPicks = picks.slice(0, limitPicks ?? 8);
              const durationMs = Date.now() - startedAt;
              console.log('🧰 get_top_markets DONE', {
                count: resultPicks.length,
                sample: resultPicks[0] ?? null,
                durationMs
              });
              return { picks: resultPicks };
            } catch (e: any) {
              const durationMs = Date.now() - startedAt;
              console.error('🧰 get_top_markets ERROR', {
                error: e?.message || String(e),
                durationMs
              });
              return { picks: [] };
            }
          }
        })
      } as const;
      try {
        if (!process.env.ANTHROPIC_API_KEY) {
          console.error('🤖 Chat API Route: Missing ANTHROPIC_API_KEY');
          return new Response(JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        const result = streamText({
          model: anthropic('claude-3-7-sonnet-20250219'),
          system:
            'You are an onchain AI assistant. Use provided tools for market discovery. Avoid claiming onchain execution.',
          messages: coreMessages,
          tools,
          toolCallStreaming: true,
          maxSteps: 4,
          onStepFinish: async (event) => {
            try {
              console.log('🪜 onStepFinish', {
                stepType: (event as any).stepType,
                toolCalls: (event as any).toolCalls?.map((c: any) => ({
                  name: c.toolName,
                  args: c.args
                })),
                toolResults: (event as any).toolResults?.map((r: any) => ({
                  name: r.toolName,
                  ok: r.result != null
                })),
                text:
                  typeof (event as any).text === 'string'
                    ? (event as any).text.slice(0, 300)
                    : undefined
              });
            } catch {}
          },
          providerOptions: {
            anthropic: {
              thinking: { type: 'enabled', budgetTokens: 12000 }
            } satisfies AnthropicProviderOptions
          },
          onFinish: async (event) => {
            if (typeof event.text === 'string' && event.text.length > 0) {
              console.log('🧠 AI onFinish length:', event.text.length);
              console.log('🧠 AI onFinish text:', event.text);
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
        return new Response(
          JSON.stringify({
            error: genericErrorMessage,
            detail: String(fallbackErr?.message || fallbackErr)
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
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
