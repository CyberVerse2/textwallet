import { NextResponse } from 'next/server';
import { formatUnits } from 'ethers'; // Import ethers utility
import type { EnrichedTokenBalance } from "../../token-list"; // Import the type
import { Alchemy, Network, Utils, type TokenBalance } from "alchemy-sdk"; // Import TokenBalance type
// import { CHAIN_CONFIG } from '../../../lib/chain-config'; // Temporarily commented out - file not found

// Define USDC contract address on Base network
const USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Simple map for known token metadata (expand as needed)
const KNOWN_TOKEN_METADATA: { [address: string]: { name: string; symbol: string; decimals: number; logo?: string } } = {
  [USDC_BASE_ADDRESS.toLowerCase()]: { // Use lowercase address for case-insensitive matching
    name: 'USD Coin',
    symbol: 'USDC',
    decimals: 6,
    logo: 'https://token.metaswap.codefi.network/assets/tokens/usdc/logo.svg' // Assuming this URL pattern works
  }
};

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

    // DEBUG: Log the raw response from Alchemy Data API
    console.log('[API Tokens Route] Raw Alchemy Data API Response:', JSON.stringify(responseData, null, 2));

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
      processedTokens = rawTokens.map((token: TokenBalance) => {
        // Ensure we only process successful token balance fetches
        if (token.error) {
          console.warn(`API Route: Error fetching balance for token ${token.contractAddress}: ${token.error}`);
          return null;
        }

        // Validate essential data
        if (!token.contractAddress || typeof token.tokenBalance !== 'string') {
          console.warn(`API Route: Skipping token due to missing contract address or balance.`);
          return null;
        }

        // DEBUG: Log raw token object received from Alchemy
        console.log('[API Tokens Route] Processing Raw Token:', JSON.stringify(token, null, 2));

        const balanceRaw = token.tokenBalance;
        const contractAddressLower = token.contractAddress?.toLowerCase();

        // Get metadata from known map or use placeholders
        let name: string | undefined = 'Unknown Token';
        let symbol: string | undefined = '???';
        let decimals: number = 18; // Default
        let logo: string | undefined = undefined;

        if (contractAddressLower && KNOWN_TOKEN_METADATA[contractAddressLower]) {
          // DEBUG: Log successful lookup
          console.log(`[API Tokens Route] Found known metadata for address: ${contractAddressLower}`);
          const knownMeta = KNOWN_TOKEN_METADATA[contractAddressLower];
          name = knownMeta.name;
          symbol = knownMeta.symbol;
          decimals = knownMeta.decimals;
          logo = knownMeta.logo;
        } else if (contractAddressLower) {
          // DEBUG: Log failed lookup
          console.log(`[API Tokens Route] No known metadata found for address: ${contractAddressLower}`);
        } // else: use placeholders defined above

        // Filter out spam tokens
        const nameLower = name?.toLowerCase() || '';
        const symbolLower = symbol?.toLowerCase() || '';
        if (SPAM_KEYWORDS.some(keyword => nameLower.includes(keyword) || symbolLower.includes(keyword))) {
          console.log(`Filtering potential spam token: ${name} - ${symbol}`);
          return null;
        }

        // Format balance using ethers
        const formattedBalance = formatUnits(balanceRaw, decimals);

        // --- Calculate USD value (Placeholder - requires price source) ---
        let usdValue: number | null = null;
        const usdPricePerToken: number | null = null; // TODO: Implement price fetching if needed
        if (usdPricePerToken !== null) {
          const balanceNumber = parseFloat(formattedBalance);
          if (!isNaN(balanceNumber)) {
            usdValue = balanceNumber * usdPricePerToken;
            totalCalculatedUsdValue += usdValue; // Accumulate total value
          }
        }

        // Create the enriched object
        const enrichedToken = {
          network: 'Unknown', // Placeholder - Network info location TBD from logs
          contractAddress: token.contractAddress,
          balanceRaw: token.tokenBalance,
          formattedBalance: formattedBalance,
          name: name,
          symbol: symbol,
          decimals: decimals,
          logo: logo, // Use constructed fallback URL or undefined
          usdPricePerToken: usdPricePerToken,
          usdValue: usdValue, // Use calculated USD value
        } as EnrichedTokenBalance; // Assert type here

        // DEBUG: Log the final enriched token object before returning from map
        console.log('[API Tokens Route] Enriched Token:', JSON.stringify(enrichedToken, null, 2));

        return enrichedToken;
      }).filter((token): token is EnrichedTokenBalance => token !== null); // Filter out null values
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
