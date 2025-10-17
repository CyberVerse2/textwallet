// AgentKit removed: using AI SDK only
import {
  streamText,
  UIMessage as VercelMessage,
  StreamTextResult,
  tool,
  convertToModelMessages
} from 'ai';

import { openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { getPolymarketClient } from '@/lib/polymarket/client';
// Zora custom actions removed
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getServerWalletAddress, getUsdcAddress } from '@/lib/cdp';
import { spendFromPermission } from '@/lib/base/spend';
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

  const body = (await req.json()) as Partial<RequestBody>;
  const messages: VercelMessage[] = Array.isArray(body.messages)
    ? (body.messages as VercelMessage[])
    : [];
  const userId = body.userId;
  const walletId = body.walletId;
  try {
    const bodyPreview = {
      userId,
      walletId,
      messagesCount: Array.isArray(body.messages) ? body.messages.length : 0,
      messagesPreview: Array.isArray(body.messages)
        ? body.messages.map((m) => ({
            role: (m as any).role,
            hasParts: Array.isArray((m as any).parts),
            text: Array.isArray((m as any).parts)
              ? (m as any).parts
                  .filter((p: any) => p && p.type === 'text')
                  .map((p: any) => String(p.text ?? ''))
                  .join(' ')
                  .slice(0, 200)
              : String((m as any).content ?? '').slice(0, 200)
          }))
        : []
    };
    console.log('🧾 Chat API Route: Request body parsed', bodyPreview);
  } catch {}
  const coreMessages = messages.length > 0 ? convertToModelMessages(messages) : [];
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
  const userMessage: VercelMessage | undefined =
    Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : undefined;
  if (userMessage && userMessage.role === 'user' && normalizedUserId) {
    const userText = (() => {
      try {
        const parts = (userMessage as any).parts as Array<{ type: string; text?: string }> | null;
        if (!Array.isArray(parts)) return '';
        return parts
          .map((p) => (p && p.type === 'text' ? String(p.text ?? '') : ''))
          .join(' ')
          .trim();
      } catch {
        return '';
      }
    })();
    try {
      const { data, error } = await supabaseAdmin
        .from('chat_history')
        .insert({
          user_id: normalizedUserId,
          message: userText,
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
      let stepIndexCounter = 0;
      const defineTool: any = tool as any;
      const tools: Record<string, any> = {
        get_orders: defineTool({
          description:
            'Fetch recent orders for the current user. Returns list sorted by newest first.',
          inputSchema: z.object({
            limit: z.number().int().min(1).max(100).optional(),
            status: z.enum(['created', 'posted', 'filled', 'cancelled']).optional()
          }),
          execute: async ({ limit, status }: { limit?: number; status?: string }) => {
            try {
              console.log('🛠️ TOOL get_orders START', {
                userId: normalizedUserId,
                limit,
                status
              });
            } catch {}
            if (!normalizedUserId) return { error: 'missing_user' };
            const q = supabaseAdmin
              .from('orders')
              .select('id, market_id, side, price, size, status, created_at, polymarket_order_id')
              .eq('user_id', normalizedUserId)
              .order('created_at', { ascending: false })
              .limit(limit ?? 20);
            if (status) q.eq('status', status);
            const { data, error } = await q;
            try {
              console.log('🛠️ TOOL get_orders DONE', {
                ok: !error,
                count: data?.length ?? 0,
                error: error?.message
              });
            } catch {}
            if (error) return { error: error.message };
            return { orders: data ?? [] };
          }
        }),
        get_top_markets: defineTool({
          description:
            'Fetch current Polymarket events ranked by liquidity-weighted upside. Uses /events filters; defaults to current (closed=false, end_date_min=now).',
          inputSchema: z.object({}),
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

              picks.sort((a, b) => {
                // Featured first
                const feat = (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
                if (feat !== 0) return feat;
                // Then liquidity, then 24h volume, then score
                const liq = (b.liquidity ?? 0) - (a.liquidity ?? 0);
                if (liq !== 0) return liq;
                const vol = (b.volume24h ?? 0) - (a.volume24h ?? 0);
                if (vol !== 0) return vol;
                return (b.score ?? 0) - (a.score ?? 0);
              });
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

                  relaxedPicks.sort((a, b) => {
                    const feat = (b.featured ? 1 : 0) - (a.featured ? 1 : 0);
                    if (feat !== 0) return feat;
                    const liq = (b.liquidity ?? 0) - (a.liquidity ?? 0);
                    if (liq !== 0) return liq;
                    const vol = (b.volume24h ?? 0) - (a.volume24h ?? 0);
                    if (vol !== 0) return vol;
                    return (b.score ?? 0) - (a.score ?? 0);
                  });
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
        get_market_details: defineTool({
          description:
            'Return details for one of the last suggested markets without refetching. Identify by id, index (1-based), or title substring.',
          inputSchema: z.object({
            id: z.string().optional(),
            index: z.number().int().min(1).optional(),
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
                    const outcomes = parseStrs(m.outcomes);
                    const clobTokenIds = parseStrs(m.clobTokenIds);
                    // Map outcome token IDs for convenience
                    let yesToken: string | undefined;
                    let noToken: string | undefined;
                    for (let i = 0; i < outcomes.length; i++) {
                      const label = String(outcomes[i] || '').toLowerCase();
                      if (label === 'yes') yesToken = clobTokenIds[i];
                      if (label === 'no') noToken = clobTokenIds[i];
                    }
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
                        outcomes,
                        outcomePrices: parseNums(m.outcomePrices),
                        clobTokenIds,
                        tokenIds: { yes: yesToken, no: noToken },
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
        set_budget: defineTool({
          description:
            'Set or update weekly budget (cents) and reset remaining for the current period.',
          inputSchema: z.object({ amountCents: z.number().int().min(0) }),
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
        grant_spend_permission: defineTool({
          description: 'Grant spend permission until a specific ISO timestamp.',
          inputSchema: z.object({ expiresAt: z.string() }),
          execute: async ({ expiresAt }: { expiresAt: string }) => {
            if (!normalizedUserId) return { error: 'missing_user' };
            const time = Date.parse(expiresAt);
            if (!Number.isFinite(time)) return { error: 'invalid_expiresAt' };
            const { error: updErr } = await supabaseAdmin
              .from('budgets')
              .update({ permission_expires_at: new Date(time).toISOString() })
              .eq('user_id', normalizedUserId);
            if (updErr) return { error: updErr.message };
            return { ok: true };
          }
        }),
        revoke_spend_permission: defineTool({
          description: 'Revoke spend permission immediately.',
          inputSchema: z.object({}),
          execute: async () => {
            if (!normalizedUserId) return { error: 'missing_user' };
            const { error: updErr } = await supabaseAdmin
              .from('budgets')
              .update({ permission_expires_at: null })
              .eq('user_id', normalizedUserId);
            if (updErr) return { error: updErr.message };
            return { ok: true };
          }
        }),
        get_budget: defineTool({
          description: 'Get current weekly budget and remaining (cents).',
          inputSchema: z.object({}),
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
        charge_budget: defineTool({
          description: 'Charge budget by an amount (cents). Fails if insufficient remaining.',
          inputSchema: z.object({ amountCents: z.number().int().min(1) }),
          execute: async ({ amountCents }: { amountCents: number }) => {
            if (!normalizedUserId) return { error: 'missing_user' };
            const { data, error } = await supabaseAdmin
              .from('budgets')
              .select('remaining_cents, permission_expires_at')
              .eq('user_id', normalizedUserId)
              .maybeSingle();
            if (error) return { error: error.message };
            const remaining = data?.remaining_cents ?? 0;
            const exp = data?.permission_expires_at ? Date.parse(data.permission_expires_at) : null;
            if (!exp || Date.now() > exp) return { error: 'permission_expired' };
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
        refund_budget: defineTool({
          description: 'Refund budget by an amount (cents).',
          inputSchema: z.object({ amountCents: z.number().int().min(1) }),
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
        place_order: defineTool({
          description:
            'Place a Polymarket order with JIT escrow: charge budget, pull Base USDC via spend permission, then post order on Polygon.',
          inputSchema: z.object({
            tokenID: z.string(),
            side: z.enum(['yes', 'no']),
            price: z.number().min(0).max(1),
            size: z.number().positive(),
            tickSize: z.number().positive().optional(),
            negRisk: z.boolean().optional(),
            feeRateBps: z.number().int().min(0).max(1000).optional()
          }),
          execute: async ({ tokenID, side, price, size, tickSize, negRisk, feeRateBps }: any) => {
            if (!normalizedUserId) return { error: 'missing_user' };
            const amountUSD = size * price;
            const costCents = Math.round(amountUSD * 100);
            try {
              console.log('🛒 place_order START', {
                userId: normalizedUserId,
                tokenID,
                side,
                price,
                size,
                tickSize,
                negRisk,
                feeRateBps,
                amountUSD,
                costCents
              });
            } catch {}
            // Check permission and budget
            const { data: b, error: bErr } = await supabaseAdmin
              .from('budgets')
              .select('remaining_cents, permission_expires_at')
              .eq('user_id', normalizedUserId)
              .maybeSingle();
            if (bErr) return { error: bErr.message };
            const remaining = b?.remaining_cents ?? 0;
            const exp = b?.permission_expires_at ? Date.parse(b.permission_expires_at) : null;
            try {
              console.log('📊 budget_status', {
                userId: normalizedUserId,
                remaining_cents: remaining,
                permission_expires_at: b?.permission_expires_at,
                permission_expires_ms: exp,
                now_ms: Date.now()
              });
            } catch {}
            if (!exp || Date.now() > exp) {
              try {
                console.warn('⏰ permission_expired', {
                  userId: normalizedUserId,
                  permission_expires_at: b?.permission_expires_at,
                  now: new Date().toISOString()
                });
              } catch {}
              return { error: 'permission_expired' };
            }
            if (remaining < costCents) {
              try {
                console.warn('💸 insufficient_budget', {
                  userId: normalizedUserId,
                  remaining_cents: remaining,
                  cost_cents: costCents
                });
              } catch {}
              return { error: 'insufficient_budget' };
            }
            // Deduct budget
            const nowIso = new Date().toISOString();
            const { error: updErr } = await supabaseAdmin
              .from('budgets')
              .update({ remaining_cents: remaining - costCents, updated_at: nowIso })
              .eq('user_id', normalizedUserId);
            if (updErr) return { error: updErr.message };
            try {
              console.log('✅ budget_deducted', {
                userId: normalizedUserId,
                before_cents: remaining,
                after_cents: remaining - costCents
              });
            } catch {}

            // Pull Base USDC via spend permission (amount is dollar notional)
            try {
              const usdcUnits = BigInt(Math.round(amountUSD * 1_000_000));
              try {
                console.log('🔐 spendFromPermission ATTEMPT', {
                  userId: normalizedUserId,
                  usdc_units: usdcUnits.toString()
                });
              } catch {}
              const spend = await spendFromPermission(normalizedUserId, usdcUnits);
              if (!spend.ok) throw new Error(spend.error || 'spend_failed');
              try {
                console.log('🔐 spendFromPermission SUCCESS', {
                  userId: normalizedUserId,
                  result: { ok: spend.ok }
                });
              } catch {}
            } catch (e: any) {
              try {
                console.error('❌ spendFromPermission ERROR', {
                  userId: normalizedUserId,
                  message: e?.message,
                  stack: e?.stack
                });
              } catch {}
              await supabaseAdmin
                .from('budgets')
                .update({ remaining_cents: remaining, updated_at: nowIso })
                .eq('user_id', normalizedUserId);
              return { error: e?.message || 'spend_failed' };
            }

            // Post a Polymarket MARKET order (FOK) using the dollar amount
            try {
              try {
                console.log('📤 postMarketOrder ATTEMPT', {
                  tokenID,
                  side,
                  amountUSD,
                  feeRateBps,
                  priceHint: price
                });
              } catch {}
              const { postMarketOrder } = await import('@/lib/polymarket/trading');
              const res = await postMarketOrder({
                tokenID,
                side,
                amountUSD,
                feeRateBps,
                price: price
              });
              if (!res.ok) throw new Error(res.error || 'order_failed');
              await supabaseAdmin.from('orders').insert({
                user_id: normalizedUserId,
                market_id: tokenID,
                side,
                price,
                size: amountUSD,
                polymarket_order_id: String(
                  (res.order as any)?.orderId ||
                    (res.order as any)?.id ||
                    (res.order as any)?.postResponse?.id ||
                    ''
                ),
                status: 'posted'
              });
              try {
                console.log('✅ postMarketOrder SUCCESS', {
                  userId: normalizedUserId,
                  orderId:
                    (res.order as any)?.orderId ||
                    (res.order as any)?.id ||
                    (res.order as any)?.postResponse?.id ||
                    ''
                });
              } catch {}
              return { ok: true, order: res.order };
            } catch (e: any) {
              try {
                console.error('❌ postMarketOrder ERROR', {
                  userId: normalizedUserId,
                  message: e?.message,
                  stack: e?.stack
                });
              } catch {}
              return { error: e?.message || 'order_failed' };
            }
          }
        }),
        place_market_order: defineTool({
          description:
            'Place a Polymarket market order (FOK) with JIT escrow: charge budget in USD, pull Base USDC, then post market order using amountUSD.',
          inputSchema: z.object({
            tokenID: z.string(),
            side: z.enum(['yes', 'no']),
            amountUSD: z.number().positive(),
            feeRateBps: z.number().int().min(0).max(1000).optional(),
            priceHint: z.number().min(0).max(1).optional()
          }),
          execute: async ({ tokenID, side, amountUSD, feeRateBps, priceHint }: any) => {
            if (!normalizedUserId) return { error: 'missing_user' };
            const amountCents = Math.round(amountUSD * 100);
            try {
              console.log('🛒 place_market_order START', {
                userId: normalizedUserId,
                tokenID,
                side,
                amountUSD,
                feeRateBps,
                priceHint
              });
            } catch {}
            // Check permission and budget
            const { data: b, error: bErr } = await supabaseAdmin
              .from('budgets')
              .select('remaining_cents, permission_expires_at')
              .eq('user_id', normalizedUserId)
              .maybeSingle();
            if (bErr) return { error: bErr.message };
            const remaining = b?.remaining_cents ?? 0;
            const exp = b?.permission_expires_at ? Date.parse(b.permission_expires_at) : null;
            if (!exp || Date.now() > exp) return { error: 'permission_expired' };
            if (remaining < amountCents) return { error: 'insufficient_budget' };
            // Deduct budget
            const nowIso = new Date().toISOString();
            const { error: updErr } = await supabaseAdmin
              .from('budgets')
              .update({ remaining_cents: remaining - amountCents, updated_at: nowIso })
              .eq('user_id', normalizedUserId);
            if (updErr) return { error: updErr.message };
            try {
              console.log('✅ budget_deducted_market', {
                userId: normalizedUserId,
                before_cents: remaining,
                after_cents: remaining - amountCents
              });
            } catch {}

            // Pull Base USDC via spend permission
            try {
              const usdcUnits = BigInt(Math.round(amountUSD * 1_000_000));
              try {
                console.log('🔐 spendFromPermission ATTEMPT (market)', {
                  userId: normalizedUserId,
                  usdc_units: usdcUnits.toString()
                });
              } catch {}
              const { spendFromPermission } = await import('@/lib/base/spend');
              const spend = await spendFromPermission(normalizedUserId, usdcUnits);
              if (!spend.ok) throw new Error(spend.error || 'spend_failed');
              try {
                console.log('🔐 spendFromPermission SUCCESS (market)', {
                  userId: normalizedUserId,
                  result: { ok: spend.ok }
                });
              } catch {}
            } catch (e: any) {
              try {
                console.error('❌ spendFromPermission ERROR (market)', {
                  userId: normalizedUserId,
                  message: e?.message,
                  stack: e?.stack
                });
              } catch {}
              await supabaseAdmin
                .from('budgets')
                .update({ remaining_cents: remaining, updated_at: nowIso })
                .eq('user_id', normalizedUserId);
              return { error: e?.message || 'spend_failed' };
            }

            // Post the market order FOK
            try {
              const { postMarketOrder } = await import('@/lib/polymarket/trading');
              const res = await postMarketOrder({
                tokenID,
                side,
                amountUSD,
                feeRateBps,
                price: priceHint
              });
              if (!res.ok) throw new Error(res.error || 'order_failed');
              await supabaseAdmin.from('orders').insert({
                user_id: normalizedUserId,
                market_id: tokenID,
                side,
                price: priceHint ?? null,
                size: amountUSD,
                polymarket_order_id: String((res.order as any)?.id || ''),
                status: 'posted'
              });
              return { ok: true, order: res.order };
            } catch (e: any) {
              return { error: e?.message || 'order_failed' };
            }
          }
        }),
        request_spend_permission_prompt: defineTool({
          description:
            'Ask the client to show a spend-permission confirmation UI with a weekly budget. Returns UI metadata for the client to render.',
          inputSchema: z.object({
            budgetUSD: z.number().positive(),
            periodDays: z.number().int().min(1).optional()
          }),
          execute: async ({ budgetUSD, periodDays }: { budgetUSD: number; periodDays: number }) => {
            const spender = await getServerWalletAddress();
            const tokenAddress = getUsdcAddress('base');
            return {
              ui: {
                kind: 'request_spend_permission',
                budgetUSD,
                periodDays,
                token: 'BaseUSDC',
                message: `Set your weekly budget to $${budgetUSD} and enable spend permissions for ${periodDays} days?`,
                buttons: [
                  {
                    label: 'Confirm',
                    value: 'confirm',
                    onConfirm: {
                      actions: [
                        { type: 'set_budget', amountCents: Math.round(budgetUSD * 100) },
                        {
                          type: 'trigger_spend_permission',
                          spender,
                          chainId: 8453,
                          tokenAddress
                        }
                      ]
                    }
                  },
                  { label: 'Reject', value: 'reject' }
                ]
              }
            };
          }
        }),
        trigger_spend_permission: defineTool({
          description:
            'Instruct the client to initiate a Base spend-permission signing flow. Returns spender/token details.',
          inputSchema: z.object({}),
          execute: async () => {
            const spender = await getServerWalletAddress();
            const tokenAddress = getUsdcAddress('base');
            return {
              ui: {
                kind: 'trigger_spend_permission',
                spender,
                chainId: 8453,
                tokenAddress,
                message: 'Opening Base spend-permission flow…'
              }
            };
          }
        })
        // duplicate removed
      };
      // Web search temporarily disabled
      try {
        if (!process.env.OPENAI_API_KEY) {
          console.error('🤖 Chat API Route: Missing OPENAI_API_KEY');
          return new Response(JSON.stringify({ error: 'Server is missing OPENAI_API_KEY' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        try {
          console.log('🤖 Chat API Route: Tools configured', Object.keys(tools));
        } catch {}
        try {
          const uiMessagesPreview = messages.map((m) => ({
            role: (m as any).role,
            text: Array.isArray((m as any).parts)
              ? (m as any).parts
                  .filter((p: any) => p && p.type === 'text')
                  .map((p: any) => String(p.text ?? ''))
                  .join(' ')
                  .slice(0, 200)
              : String((m as any).content ?? '').slice(0, 200)
          }));
          console.log('🛰️ OpenAI request preview', {
            model: 'gpt-4o-2024-11-20',
            tools: Object.keys(tools),
            uiMessagesCount: uiMessagesPreview.length,
            uiMessagesPreview
          });
        } catch {}
        const result = streamText({
          model: openai('gpt-4o-2024-11-20'),
          system:
            'You are an onchain AI assistant for prediction markets.\n\n' +
            '- Route intent:\n' +
            '  • If the user asks to find markets, call get_top_markets.\n' +
            '  • If the user asks “why” or for details on a pick, call get_market_details.\n' +
            '  • If the user asks about their order history or recent trades, call get_orders.\n' +
            '- Market picking: Use get_top_markets heuristics. If results are too few, the tool may relax constraints once (evaluator retry).\n' +
            '- Research and thesis: Web search is currently disabled; focus on on-chain signals and market stats only.\n' +
            '- When a user asks for details about a market, summarize key stats and thesis without external citations.\n' +
            '- Spend permissions & budget UX: If place_order or charge_budget returns permission_expired or insufficient_budget, do NOT proceed. First ask: “What weekly budget should I set?” After the user replies with a dollar amount, call request_spend_permission_prompt(budgetUSD) so the client can render Confirm/Reject.\n' +
            '[ACTION:REQUEST_SPEND_PERMISSION budgetUSD=<number> periodDays=7 token=BaseUSDC] Confirm | Reject' +
            '\n' +
            '- If the user replies Confirm with a dollar amount (e.g., $500), first call set_budget (amountCents), then instruct the client to request spend permission by emitting the exact line: \n' +
            '[ACTION:TRIGGER_SPEND_PERMISSION]' +
            '\n' +
            '- Token IDs: When preparing a trade, derive tokenID from the event market’s clobTokenIds. Use tokenIds.yes for side=yes, tokenIds.no for side=no. If missing, fetch the single event by slug and parse outcomes/clobTokenIds.\n' +
            '- After the client completes spend permission (they will re-try or say done), retry the pending order once.\n' +
            '- Safety: Do not claim to place trades. If asked to trade, ask for budget/limits and, if needed, call propose_trade_intent to structure the plan.\n' +
            '- Style: Be concise, numbers first, then brief rationale.',
          messages: coreMessages,
          tools,
          // toolCallStreaming: true,
          // maxSteps: 8,
          // maxTokens: 1500,
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
                  hasOutput: r.output != null
                })),
                text:
                  typeof (event as any).text === 'string'
                    ? (event as any).text.slice(0, 300)
                    : undefined
              });
              // Avoid persisting intermediate text deltas to prevent duplicates.
            } catch {}
          },
          // No providerOptions required for default OpenAI usage
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
                    parent_message_id: parentDbId,
                    step_index: 9999
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
        return result.toUIMessageStreamResponse({
          onError: (err: any) => {
            try {
              console.error('🧵 Chat stream error:', {
                message: err?.message || String(err),
                name: err?.name,
                stack: err?.stack,
                url: (err as any)?.url,
                statusCode: (err as any)?.statusCode,
                requestBodyValues: (err as any)?.requestBodyValues.input,
                responseBody: (err as any)?.responseBody
              });
            } catch {}
            return 'An error occurred.';
          }
        });
      } catch (fallbackErr: any) {
        try {
          console.error('🤖 Chat API Route: Fallback streaming error:', {
            message: fallbackErr?.message || String(fallbackErr),
            name: fallbackErr?.name,
            url: fallbackErr?.url,
            statusCode: fallbackErr?.statusCode,
            requestBodyValues: fallbackErr?.requestBodyValues,
            responseBody: fallbackErr?.responseBody,
            stack: fallbackErr?.stack
          });
        } catch {
          console.error('🤖 Chat API Route: Fallback streaming error:', fallbackErr);
        }
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
