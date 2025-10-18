import { NextRequest, NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/supabaseAdmin';
import { getOrder, type OrderDetails } from '@/lib/polymarket/trading';

// Helper to fetch market details by market ID
async function fetchMarketByMarketId(marketId: string) {
  try {
    const url = `https://gamma-api.polymarket.com/markets/${marketId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });

    if (!response.ok) return null;
    const market = await response.json();

    return {
      id: market.id,
      title: market.question || market.title,
      url: market.url || `https://polymarket.com/event/${market.slug}`,
      outcomes: market.outcomes || [],
      endDate: market.endDate || market.end_date
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = String(searchParams.get('userId') || '').toLowerCase();
    if (!userId) return NextResponse.json({ error: 'missing_user' }, { status: 400 });

    // Get orders from our database and aggregate by market
    const { data: orders, error } = await supabaseAdmin
      .from('orders')
      .select('polymarket_order_id, market_id, side, size, price, status, created_at')
      .eq('user_id', userId)
      .not('polymarket_order_id', 'is', null)
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!orders || orders.length === 0) {
      return NextResponse.json({ positions: [] }, { status: 200 });
    }

    // Aggregate orders by market_id and side
    const marketPositions = new Map<
      string,
      {
        marketId: string;
        side: string;
        totalSize: number;
        avgPrice: number;
        orderCount: number;
        latestOrderId: string;
        latestCreatedAt: string;
        orders: any[];
      }
    >();

    for (const order of orders) {
      const key = `${order.market_id}-${order.side}`;
      if (!marketPositions.has(key)) {
        marketPositions.set(key, {
          marketId: order.market_id,
          side: order.side,
          totalSize: 0,
          avgPrice: 0,
          orderCount: 0,
          latestOrderId: order.polymarket_order_id,
          latestCreatedAt: order.created_at,
          orders: []
        });
      }

      const position = marketPositions.get(key)!;
      position.totalSize += Number(order.size || 0);
      position.avgPrice =
        (position.avgPrice * position.orderCount + Number(order.price || 0)) /
        (position.orderCount + 1);
      position.orderCount += 1;
      position.orders.push(order);

      // Keep track of the latest order
      if (new Date(order.created_at) > new Date(position.latestCreatedAt)) {
        position.latestOrderId = order.polymarket_order_id;
        position.latestCreatedAt = order.created_at;
      }
    }

    // Convert to positions array and fetch supporting details
    const positions = [];
    const marketCache = new Map<string, any>();

    for (const [key, position] of marketPositions) {
      try {
        // Get market details using marketId (with caching)
        let market = marketCache.get(position.marketId);
        if (!market) {
          console.log(`[Positions API] Fetching market details for marketId: ${position.marketId}`);
          market = await fetchMarketByMarketId(position.marketId);
          if (market) {
            marketCache.set(position.marketId, market);
            console.log(`[Positions API] Market details received:`, {
              id: market.id,
              title: market.title,
              url: market.url
            });
          } else {
            console.warn(
              `[Positions API] Failed to fetch market details for marketId: ${position.marketId}`
            );
          }
        }

        // Skip this position if market details are not available
        if (!market) {
          console.warn(
            `[Positions API] Skipping position due to missing market details: ${position.marketId}`
          );
          continue;
        }

        // Get order details from Polymarket using the latest order ID
        console.log(
          `[Positions API] Fetching order details for orderId: ${position.latestOrderId}`
        );
        const orderResult = await getOrder(position.latestOrderId);
        if (!orderResult.ok || !orderResult.order) {
          console.warn(`[Positions API] Failed to get order details:`, orderResult.error);
          continue;
        }
        const orderDetails = orderResult.order;
        console.log(`[Positions API] Order details received:`, {
          id: orderDetails.id,
          status: orderDetails.status,
          outcome: orderDetails.outcome,
          type: orderDetails.type
        });

        positions.push({
          // Position summary from database aggregation
          marketId: position.marketId,
          side: position.side,
          totalSize: position.totalSize,
          avgPrice: position.avgPrice,
          orderCount: position.orderCount,
          latestCreatedAt: position.latestCreatedAt,

          // Supporting details from Polymarket
          latestOrderId: orderDetails.id,
          assetId: orderDetails.asset_id,
          outcome: orderDetails.outcome,
          latestOrderStatus: orderDetails.status,
          latestOrderType: orderDetails.type,
          latestOrderExpiration: orderDetails.expiration,

          // Market information
          market: {
            id: market.id,
            title: market.title,
            url: market.url,
            outcomes: market.outcomes,
            endDate: market.endDate
          }
        });
      } catch (e) {
        console.error('Error processing position:', key, e);
        // Skip this position if there's an error
      }
    }

    return NextResponse.json({ positions }, { status: 200 });
  } catch (e: any) {
    console.error('Positions API error:', e);
    return NextResponse.json({ error: e?.message || 'positions_failed' }, { status: 500 });
  }
}
