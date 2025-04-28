import { NextResponse } from 'next/server';
import { formatUnits } from 'ethers'; // Import ethers utility
import type { EnrichedTokenBalance } from "../../token-list"; // Import the type
import { Alchemy, Network, Utils, type TokenBalance } from "alchemy-sdk"; // Import TokenBalance type
import { CHAIN_CONFIG } from '../../../lib/chain-config'; // Use relative path

// Define USDC contract address on Base network
const USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Spam keywords (lowercase) - adjust as needed
const SPAM_KEYWORDS = [
  'claim', 'airdrop', 'reward', '.xyz', '.vip', '.app', '.io', '.net', '.org', // TLDs often used in spam
  'www.', 'http', // URLs
  'bonus', 'giveaway', 'free', '$', // Suspicious terms (the $ might be too broad)
  '!', // Often used in spam names
  // Add specific known spam symbols/names if identified
];

// Helper function to check for spam keywords in name or symbol
function isPotentiallySpam(name?: string, symbol?: string): boolean {
  if (!name && !symbol) return false; // No text to check
  const textToCheck = (`${name || ''} ${symbol || ''}`).toLowerCase();
  return SPAM_KEYWORDS.some(keyword => textToCheck.includes(keyword));
}

// Helper function to safely get USD price
function getUsdPrice(tokenPrices: any[]): number | null {
  if (!tokenPrices || tokenPrices.length === 0) return null;
  const usdPriceObj = tokenPrices.find(p => p.currency?.toLowerCase() === 'usd');
  return usdPriceObj?.value ? parseFloat(usdPriceObj.value) : null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerAddress = searchParams.get('address');

  if (!ownerAddress) {
    return NextResponse.json({ error: 'Wallet address is required' }, { status: 400 });
  }

  if (!process.env.ALCHEMY_API_KEY) {
    console.error('ALCHEMY_API_KEY environment variable not set.');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Configuration for the /assets/tokens/by-address endpoint
  const apiKey = process.env.ALCHEMY_API_KEY;
  const alchemyUrl = `https://api.g.alchemy.com/data/v1/${apiKey}/assets/tokens/by-address`;

  // Define networks to query
  const networks = [
    'eth-mainnet',    // Ethereum (Alchemy ID)
    'opt-mainnet',    // Optimism (Alchemy ID)
    'arb-mainnet',    // Arbitrum One (Alchemy ID)
    'matic-mainnet',  // Polygon PoS (Alchemy ID)
    'base-mainnet',   // Base (Alchemy ID)
    'zora-mainnet',   // Zora (Alchemy ID)
  ];

  const requestBody = {
    addresses: [
      {
        address: ownerAddress,
        networks: networks
      }
    ],
    withMetadata: true,
    withPrices: true
  };

  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  };

  try {
    console.log(`API Route: Attempting fetch to ${alchemyUrl} for ${ownerAddress}...`);
    const response = await fetch(alchemyUrl, options);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`Alchemy Data API HTTP Error: ${response.status} ${response.statusText}`, errorBody);
      throw new Error(`Alchemy Data API request failed with status: ${response.status}`);
    }

    const responseData = await response.json(); // Renamed to avoid conflict with 'data' below

    // Check for API-level errors
    if (!responseData || responseData.error) {
      console.error('Alchemy Data API Error:', responseData?.error || 'Unknown API error');
      throw new Error(responseData?.error?.message || 'Alchemy Data API returned an error');
    }

    // --- Data Extraction & Processing based on sample response ---
    let processedTokens: EnrichedTokenBalance[] = [];
    let totalCalculatedUsdValue = 0;

    // Access the tokens array within the 'data' field
    const rawTokens = responseData?.data?.tokens;

    if (rawTokens && Array.isArray(rawTokens)) {
      processedTokens = rawTokens.map((token: any): EnrichedTokenBalance | null => {
        const metadata = token.tokenMetadata;
        const decimals = metadata?.decimals;
        const balanceRaw = token.tokenBalance;
        const name = metadata?.name;
        const symbol = metadata?.symbol;
        const usdPricePerToken = getUsdPrice(token.tokenPrices);

        // --- Filtering ---
        // 1. Skip if essential data missing or zero balance
        if (!metadata || typeof decimals !== 'number' || !balanceRaw || balanceRaw === '0x0000000000000000000000000000000000000000000000000000000000000000') {
          // console.log(`Skipping token (missing data/zero balance): ${symbol || name || token.tokenAddress}`);
          return null; // Skip this token
        }

        // 2. Skip potential spam tokens
        if (isPotentiallySpam(name, symbol)) {
          console.log(`Filtering potential spam token: ${symbol || name}`);
          return null;
        }

        // 3. Optional: Skip tokens with no price? (Could filter legit tokens too)
        // if (usdPricePerToken === null) return null;

        // --- Formatting & Calculation ---
        let formattedBalance = '0';
        let usdValue = null;

        try {
          // Format balance using ethers
          formattedBalance = formatUnits(balanceRaw, decimals);
          const balanceValue = parseFloat(formattedBalance);

          // Calculate USD value for this specific token holding
          if (usdPricePerToken !== null && !isNaN(balanceValue)) {
            usdValue = balanceValue * usdPricePerToken;
            if (!isNaN(usdValue)) {
              totalCalculatedUsdValue += usdValue; // Add to overall total
            } else {
              usdValue = null; // Ensure NaN doesn't sneak through
            }
          }
        } catch (formatError) {
          console.warn(`Could not format/calculate value for ${symbol || token.tokenAddress}:`, formatError);
          // Keep formattedBalance as '0' and usdValue as null
        }

        return {
          network: token.network,
          contractAddress: token.tokenAddress,
          balanceRaw: balanceRaw,
          formattedBalance: formattedBalance, // Use calculated formatted balance
          name: name,
          symbol: symbol,
          decimals: decimals,
          logo: metadata.logo,
          usdPricePerToken: usdPricePerToken,
          usdValue: usdValue, // Use calculated USD value
        };
      }).filter((token): token is EnrichedTokenBalance => token !== null); // Filter out nulls

      // --- Sorting --- Sort by USD value descending
      processedTokens.sort((a, b) => {
        const valueA = a.usdValue ?? -1; // Treat null/undefined USD value as lowest
        const valueB = b.usdValue ?? -1;
        return valueB - valueA; // Sort descending by USD value
      });
    }

    console.log(`API Route: Fetch successful. Processed ${processedTokens.length} non-spam tokens. Total Value: ${totalCalculatedUsdValue}`);

    // Log details specifically for USDC if found
    // Find raw USDC by contract address (case-insensitive comparison)
    const usdcTokenRaw = rawTokens.find((t: TokenBalance) => 
      !t.error && t.contractAddress?.toLowerCase() === USDC_BASE_ADDRESS.toLowerCase()
    );
    if (usdcTokenRaw) {
      console.log('[API Tokens Route] Raw USDC Data from Alchemy:', JSON.stringify(usdcTokenRaw, null, 2));
    }
    const usdcTokenEnriched = processedTokens.find((t: EnrichedTokenBalance) => t.contractAddress?.toLowerCase() === USDC_BASE_ADDRESS.toLowerCase());
    if (usdcTokenEnriched) {
      console.log('[API Tokens Route] Enriched USDC Data before sending:', JSON.stringify(usdcTokenEnriched, null, 2));
    } else if (usdcTokenRaw) {
      console.log('[API Tokens Route] USDC was found in raw data but not in enriched data (likely filtered as spam).');
    }

    return NextResponse.json({ 
      tokens: processedTokens, // Return the processed tokens
      totalUsdValue: totalCalculatedUsdValue // Return the calculated total value
    });

  } catch (error: any) {
    console.error("Alchemy Data API Fetch Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to fetch token balances via Alchemy Data API' }, { status: 500 });
  }
}
