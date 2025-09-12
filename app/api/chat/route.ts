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

// Lightweight web search helper for citations (Tavily > Brave > DuckDuckGo)
// Cache last picks per user for follow-up details (best-effort, per-instance)
const lastPicksByUser = new Map<string, any[]>();

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
      const tools: Record<string, any> = {
        get_top_markets: tool({
          description:
            'Fetch current Polymarket events ranked by liquidity-weighted upside. Uses /events filters; defaults to current (closed=false, end_date_min=now).',
          parameters: z.object({
            limit: z.coerce.number().int().min(1).max(50).default(10),
            offset: z.coerce.number().int().min(0).default(0),
            order: z.string().optional(),
            ascending: z.coerce.boolean().optional(),
            id: z.array(z.coerce.number().int()).optional(),
            slug: z.array(z.string()).optional(),
            tag_id: z.coerce.number().int().optional(),
            exclude_tag_id: z.array(z.coerce.number().int()).optional(),
            related_tags: z.coerce.boolean().optional(),
            featured: z.coerce.boolean().optional(),
            cyom: z.coerce.boolean().optional(),
            include_chat: z.coerce.boolean().optional(),
            include_template: z.coerce.boolean().optional(),
            recurrence: z.string().optional(),
            start_date_min: z.string().optional(),
            start_date_max: z.string().optional(),
            end_date_min: z.string().optional(),
            end_date_max: z.string().optional(),
            closed: z.coerce.boolean().optional(),
            // Local heuristic knobs
            limitPicks: z.coerce.number().int().min(1).max(25).default(8),
            maxDaysToEnd: z.coerce.number().int().min(1).max(365).default(180),
            minConsensus: z.coerce.number().min(0.5).max(0.99).default(0.7),
            minLiquidityLocal: z.coerce.number().min(0).default(1500),
            maxSpreadLocal: z.coerce.number().min(0).max(0.5).default(0.04),
            includeAmbiguous: z.coerce.boolean().default(false),
            // Research controls
            research: z.coerce.boolean().default(true),
            researchPicks: z.coerce.number().int().min(1).max(10).default(5),
            researchUsesPerPick: z.coerce.number().int().min(1).max(5).default(2)
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
              research,
              researchPicks,
              researchUsesPerPick,
              ...fetchFilters
            } = args || {};
            // Apply sensible server-side defaults for current events
            const filters = {
              closed: false,
              // some /events deployments don't accept end_date_min → omit by default
              // end_date_min: nowIso,
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
              let resultPicks = picks.slice(0, limitPicks ?? 8);

              // Evaluator step: if too few picks, relax constraints once
              try {
                const desired = limitPicks ?? 8;
                if (resultPicks.length < desired) {
                  const relaxedPicks: any[] = [];
                  const relaxedMaxDays = Math.max(365, (maxDaysToEnd ?? 180) * 2);
                  const relaxedMinLiq = Math.max(0, (minLiquidityLocal ?? 1500) * 0.5);
                  const relaxedMaxSpread = Math.max(0.08, (maxSpreadLocal ?? 0.04) * 1.75);
                  const relaxedMinCons = Math.max(0.55, (minConsensus ?? 0.7) - 0.1);

                  for (const m of markets) {
                    const daysToEnd = m.endsAt ? (Date.parse(m.endsAt) - now) / 86400000 : 365;
                    if (Number.isFinite(daysToEnd)) {
                      if (daysToEnd < 0.5 || daysToEnd > relaxedMaxDays) continue;
                    }
                    const liquidity2 = m.liquidity ?? 0;
                    if (liquidity2 < relaxedMinLiq) continue;

                    const spread2 =
                      m.bestAsk && m.bestBid && m.bestAsk > 0 && m.bestBid > 0
                        ? clamp(m.bestAsk - m.bestBid, 0, 1)
                        : 0.1;
                    if (spread2 > relaxedMaxSpread) continue;

                    const fR2 = clarityHeuristic(m.title);
                    if (!(includeAmbiguous ?? false) && fR2 < 0.25) continue;

                    const consensus2 = clamp(
                      typeof m.lastPrice === 'number' ? m.lastPrice : m.bestBid ?? 0.0
                    );
                    if (consensus2 < relaxedMinCons) continue;

                    const fT2 = clamp(
                      1 - (Number.isFinite(daysToEnd) ? daysToEnd / relaxedMaxDays : 0)
                    );
                    const fL2 = logistic(liquidity2);
                    const fSpr2 = clamp(1 - clamp(spread2, 0, 0.25) / 0.25);
                    const fAct2 = logistic(m.volume24h ?? 0);
                    const fStab2 = stabilityProxy(spread2, m.volume24h ?? 0);

                    const score2 = clamp(
                      0.35 * consensus2 +
                        0.2 * fT2 +
                        0.2 * (0.7 * fL2 + 0.3 * fSpr2) +
                        0.15 * (0.6 * fStab2 + 0.4 * fAct2) +
                        0.1 * fR2
                    );

                    const extremeDecay2 = consensus2 > 0.9 || consensus2 < 0.1 ? 0.5 : 1.0;
                    const bump2 = (0.015 + 0.02 * fStab2) * extremeDecay2;
                    const pStar2 = clamp(consensus2 + bump2, consensus2, 0.985);
                    const edge2 = +(pStar2 - consensus2).toFixed(4);
                    const sizeSuggestion2 = +kellyFraction(consensus2, pStar2).toFixed(4);

                    relaxedPicks.push({
                      id: m.id,
                      title: m.title,
                      url: m.url,
                      bestBid: m.bestBid ?? null,
                      bestAsk: m.bestAsk ?? null,
                      lastPrice: m.lastPrice ?? null,
                      liquidity: liquidity2,
                      volume24h: m.volume24h ?? 0,
                      score: +score2.toFixed(4),
                      pm: +consensus2.toFixed(4),
                      pStar: +pStar2.toFixed(4),
                      edge: edge2,
                      sizeSuggestion: sizeSuggestion2,
                      daysToEnd: Number.isFinite(daysToEnd)
                        ? Math.max(0, Math.round(daysToEnd))
                        : null,
                      reasons: [
                        `consensus=${consensus2.toFixed(2)}`,
                        `edge=+${(edge2 * 100).toFixed(1)}pp`,
                        `daysToEnd=${
                          Number.isFinite(daysToEnd) ? Math.max(0, Math.round(daysToEnd)) : 'n/a'
                        }`,
                        `liquidity≈${Math.round(liquidity2).toLocaleString()}`,
                        `vol24h≈${Math.round(m.volume24h ?? 0).toLocaleString()}`,
                        `spread≈${spread2.toFixed(3)}`,
                        `clarity≈${fR2.toFixed(2)}`
                      ]
                    });
                  }

                  relaxedPicks.sort((a, b) => b.score - a.score);
                  const seen = new Set(resultPicks.map((p: any) => String(p.id)));
                  for (const rp of relaxedPicks) {
                    if (resultPicks.length >= desired) break;
                    if (seen.has(String(rp.id))) continue;
                    resultPicks.push(rp);
                    seen.add(String(rp.id));
                  }
                }
              } catch {}

              // Research enrichment hints: provide queries for orchestrator to run web_search in parallel
              if (research) {
                const topK = resultPicks.slice(0, researchPicks ?? 5);
                for (const p of topK) {
                  const queries = [
                    p.title,
                    `${p.title} recent news`,
                    `${p.title} market odds`,
                    `${p.title} site:polymarket.com`
                  ];
                  (p as any).researchQueries = queries.slice(0, researchUsesPerPick ?? 2);
                }
              }
              try {
                if (normalizedUserId) {
                  lastPicksByUser.set(normalizedUserId, resultPicks);
                }
              } catch {}
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
        }),
        get_market_details: tool({
          description:
            'Return details for one of the last suggested markets without refetching. Identify by id, index (1-based), or title substring.',
          parameters: z.object({
            id: z.string().optional(),
            index: z.coerce.number().int().min(1).optional(),
            titleContains: z.string().optional()
          }),
          execute: async ({
            id,
            index,
            titleContains
          }: {
            id?: string;
            index?: number;
            titleContains?: string;
          }) => {
            const picks = normalizedUserId ? lastPicksByUser.get(normalizedUserId) ?? [] : [];
            if (!picks || picks.length === 0) {
              return {
                error: 'no_cached_picks',
                message: 'No cached picks. Ask for top markets first.'
              };
            }
            let match: any | undefined;
            if (id) {
              match = picks.find((p) => String(p.id) === String(id));
            }
            if (!match && typeof index === 'number') {
              match = picks[index - 1];
            }
            if (!match && titleContains) {
              const q = titleContains.toLowerCase();
              match = picks.find((p) =>
                String(p.title ?? '')
                  .toLowerCase()
                  .includes(q)
              );
            }
            if (!match) {
              return { error: 'not_found', message: 'No matching market in last results.' };
            }
            // Try to fetch the single event for richer details using the slug in the URL
            const base = process.env.POLYMARKET_API_BASE || 'https://gamma-api.polymarket.com';
            let details: any | null = null;
            try {
              const urlStr: string | undefined = match.url;
              const slug =
                urlStr && urlStr.includes('/event/')
                  ? urlStr.split('/event/')[1]?.split('?')[0]
                  : undefined;
              if (slug) {
                const url = new URL(`${base}/events`);
                url.searchParams.set('slug', slug);
                url.searchParams.set('limit', '1');
                const res = await fetch(url, {
                  headers: { accept: 'application/json' },
                  cache: 'no-store'
                });
                if (res.ok) {
                  const events = (await res.json()) as any[];
                  const ev = Array.isArray(events) ? events[0] : null;
                  const markets: any[] = ev?.markets ?? [];
                  const m = markets.find((mm) => String(mm?.id) === String(match.id));
                  if (m) {
                    const parseNums = (s?: string | null) => {
                      if (!s) return [] as number[];
                      try {
                        const a = JSON.parse(s);
                        return Array.isArray(a)
                          ? a.map((x: any) => (typeof x === 'number' ? x : Number(x)))
                          : [];
                      } catch {
                        return [];
                      }
                    };
                    const parseStrs = (s?: string | null) => {
                      if (!s) return [] as string[];
                      try {
                        const a = JSON.parse(s);
                        return Array.isArray(a) ? a.map(String) : [];
                      } catch {
                        return [];
                      }
                    };
                    details = {
                      event: {
                        id: ev?.id,
                        title: ev?.title,
                        category: ev?.category,
                        startDate: ev?.startDate,
                        endDate: ev?.endDate,
                        slug
                      },
                      market: {
                        id: m.id,
                        question: m.question,
                        description: m.description,
                        bestBid: m.bestBid ?? null,
                        bestAsk: m.bestAsk ?? null,
                        liquidityNum: m.liquidityNum ?? null,
                        liquidity: m.liquidity ?? null,
                        volumeNum: m.volumeNum ?? null,
                        volume24hr: m.volume24hr ?? null,
                        outcomes: parseStrs(m.outcomes),
                        outcomePrices: parseNums(m.outcomePrices),
                        endDate: m.endDate,
                        startDate: m.startDate,
                        marketMakerAddress: m.marketMakerAddress ?? null,
                        fee: m.fee ?? null
                      }
                    };
                  }
                }
              }
            } catch {}

            const summary = {
              id: match.id,
              title: match.title,
              url: match.url,
              bestBid: match.bestBid,
              bestAsk: match.bestAsk,
              lastPrice: match.lastPrice,
              liquidity: match.liquidity,
              volume24h: match.volume24h,
              score: match.score,
              pm: match.pm,
              pStar: match.pStar,
              edge: match.edge,
              sizeSuggestion: match.sizeSuggestion,
              daysToEnd: match.daysToEnd,
              reasons: match.reasons
            };
            const researchQueries = [
              summary.title,
              `${summary.title} recent news`,
              `${summary.title} market odds`,
              `${summary.title} site:polymarket.com`
            ].filter(Boolean);
            return { market: summary, details, researchQueries };
          }
        }),
        propose_trade_intent: tool({
          description:
            'Structure a proposed trade intent for a Polymarket order. This does not execute any trade; it only returns a validated plan.',
          parameters: z.object({
            marketId: z.string().describe('Polymarket market id from last picks'),
            side: z.enum(['yes', 'no']).describe('Order side: yes/no'),
            budgetUSDC: z.coerce
              .number()
              .positive()
              .max(1000000)
              .describe('Max USDC to allocate for this intent'),
            limitPrice: z.coerce
              .number()
              .min(0)
              .max(1)
              .describe('Max buy price or min sell price (0-1)'),
            maxSlippage: z.coerce
              .number()
              .min(0)
              .max(0.2)
              .default(0.02)
              .describe('Allowed slippage (0-0.2)'),
            autopilot: z.coerce.boolean().default(false),
            notes: z.string().optional()
          }),
          execute: async (args: any) => {
            const createdAt = new Date().toISOString();
            const normalized = {
              marketId: String(args.marketId),
              side: args.side === 'no' ? 'no' : 'yes',
              budgetUSDC: Number.isFinite(+args.budgetUSDC) ? +(+args.budgetUSDC).toFixed(2) : 0,
              limitPrice: Number.isFinite(+args.limitPrice) ? +(+args.limitPrice).toFixed(4) : 0,
              maxSlippage: Number.isFinite(+args.maxSlippage)
                ? +(+args.maxSlippage).toFixed(4)
                : 0.02,
              autopilot: Boolean(args.autopilot),
              notes: typeof args.notes === 'string' ? args.notes : undefined
            };
            return {
              intent: { ...normalized, createdAt },
              disclaimer:
                'No onchain execution performed. This is a structured plan for review and future execution.'
            };
          }
        }),
        set_budget: tool({
          description:
            'Set or update weekly budget (cents) and reset remaining for the current period.',
          parameters: z.object({ amountCents: z.coerce.number().int().min(0) }),
          execute: async ({ amountCents }: { amountCents: number }) => {
            if (!normalizedUserId) return { error: 'missing_user' };
            const nowIso = new Date().toISOString();
            const { error: upsertErr } = await supabaseAdmin.from('budgets').upsert({
              user_id: normalizedUserId,
              weekly_limit_cents: amountCents,
              remaining_cents: amountCents,
              period_start: nowIso,
              updated_at: nowIso
            });
            if (upsertErr) return { error: upsertErr.message };
            return { ok: true, weekly_limit_cents: amountCents };
          }
        }),
        get_budget: tool({
          description: 'Get current weekly budget and remaining (cents).',
          parameters: z.object({}),
          execute: async () => {
            if (!normalizedUserId) return { error: 'missing_user' };
            const { data, error } = await supabaseAdmin
              .from('budgets')
              .select('weekly_limit_cents, remaining_cents, period_start, updated_at')
              .eq('user_id', normalizedUserId)
              .maybeSingle();
            if (error) return { error: error.message };
            return data ?? { weekly_limit_cents: 0, remaining_cents: 0 };
          }
        }),
        charge_budget: tool({
          description: 'Charge budget by an amount (cents). Fails if insufficient remaining.',
          parameters: z.object({ amountCents: z.coerce.number().int().min(1) }),
          execute: async ({ amountCents }: { amountCents: number }) => {
            if (!normalizedUserId) return { error: 'missing_user' };
            const { data, error } = await supabaseAdmin
              .from('budgets')
              .select('remaining_cents')
              .eq('user_id', normalizedUserId)
              .maybeSingle();
            if (error) return { error: error.message };
            const remaining = data?.remaining_cents ?? 0;
            if (remaining < amountCents) return { error: 'insufficient_budget' };
            const nowIso = new Date().toISOString();
            const { error: updErr } = await supabaseAdmin
              .from('budgets')
              .update({ remaining_cents: remaining - amountCents, updated_at: nowIso })
              .eq('user_id', normalizedUserId);
            if (updErr) return { error: updErr.message };
            return { ok: true, remaining_cents: remaining - amountCents };
          }
        }),
        refund_budget: tool({
          description: 'Refund budget by an amount (cents).',
          parameters: z.object({ amountCents: z.coerce.number().int().min(1) }),
          execute: async ({ amountCents }: { amountCents: number }) => {
            if (!normalizedUserId) return { error: 'missing_user' };
            const { data, error } = await supabaseAdmin
              .from('budgets')
              .select('remaining_cents, weekly_limit_cents')
              .eq('user_id', normalizedUserId)
              .maybeSingle();
            if (error) return { error: error.message };
            const remaining = data?.remaining_cents ?? 0;
            const limit = data?.weekly_limit_cents ?? 0;
            const newRemaining = Math.min(limit, remaining + amountCents);
            const nowIso = new Date().toISOString();
            const { error: updErr } = await supabaseAdmin
              .from('budgets')
              .update({ remaining_cents: newRemaining, updated_at: nowIso })
              .eq('user_id', normalizedUserId);
            if (updErr) return { error: updErr.message };
            return { ok: true, remaining_cents: newRemaining };
          }
        }),
        place_order: tool({
          description:
            'Record an order (no onchain execution). Charges budget and stores order stub.',
          parameters: z.object({
            marketId: z.string(),
            side: z.enum(['yes', 'no']),
            price: z.coerce.number().min(0).max(1),
            size: z.coerce.number().positive(),
            feeRateBps: z.coerce.number().int().min(0).max(1000).default(0)
          }),
          execute: async ({ marketId, side, price, size }: any) => {
            if (!normalizedUserId) return { error: 'missing_user' };
            const costCents = Math.round(size * price * 100);
            const charge = await (tools as any).charge_budget.execute({ amountCents: costCents });
            if (charge?.error) return { error: charge.error };
            const { error: insErr } = await supabaseAdmin.from('orders').insert({
              user_id: normalizedUserId,
              market_id: marketId,
              side,
              price,
              size,
              status: 'created'
            });
            if (insErr) {
              await (tools as any).refund_budget
                .execute({ amountCents: costCents })
                .catch(() => {});
              return { error: insErr.message };
            }
            return { ok: true, charged_cents: costCents };
          }
        })
        // duplicate removed
      };
      // Web search temporarily disabled
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
            'You are an onchain AI assistant for prediction markets.\n\n' +
            '- Route intent:\n' +
            '  • If the user asks to find markets, call get_top_markets.\n' +
            '  • If the user asks “why” or for details on a pick, call get_market_details.\n' +
            '- Market picking: Use get_top_markets heuristics. If results are too few, the tool may relax constraints once (evaluator retry).\n' +
            '- Research and thesis: Web search is currently disabled; focus on on-chain signals and market stats only.\n' +
            '- When a user asks for details about a market, summarize key stats and thesis without external citations.\n' +
            '- Safety: Do not claim to place trades. If asked to trade, ask for budget/limits and, if needed, call propose_trade_intent to structure the plan.\n' +
            '- Style: Be concise, numbers first, then brief rationale.',
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
