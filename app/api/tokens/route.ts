import { NextResponse } from 'next/server';
import { formatUnits } from 'ethers'; // Import ethers utility
import type { EnrichedTokenBalance } from "../../token-list"; // Import the type
import { Alchemy, Network, Utils, type TokenBalance } from "alchemy-sdk"; // Import TokenBalance type

// Define USDC contract address on Base network
const USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Simple map for known token metadata (expand as needed)
const KNOWN_TOKEN_LOGOS: { [address: string]: string } = {
  [USDC_BASE_ADDRESS.toLowerCase()]: 'https://token.metaswap.codefi.network/assets/tokens/usdc/logo.svg'
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

  const apiKey = process.env.ALCHEMY_API_KEY;
  const alchemyUrl = `https://api.g.alchemy.com/data/v1/${apiKey}/assets/tokens/by-address`;

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

    const responseData = await response.json();

    const rawTokens = responseData?.data?.tokens;

    if (!rawTokens) {
      console.error('Alchemy Data API Error: No tokens array in response');
      return NextResponse.json({ tokens: [], totalUsdValue: 0, error: 'Failed to fetch token balances' }, { status: 500 });
    }

    let processedTokens: EnrichedTokenBalance[] = [];
    let totalCalculatedUsdValue = 0;

    if (rawTokens && Array.isArray(rawTokens)) {
      processedTokens = rawTokens.map((token: TokenBalance) => {
        if (token.error) {
          console.warn(`API Route: Error fetching balance for token ${token.contractAddress}: ${token.error}`);
          return null;
        }

        const balanceRaw = token.tokenBalance;
        const contractAddress = token.contractAddress;

        if (!contractAddress || typeof balanceRaw !== 'string' || balanceRaw === '0x0') {
          return null; // Skip zero balances or invalid data
        }

        const contractAddressLower = contractAddress.toLowerCase();

        let name: string | undefined = 'Unknown Token';
        let symbol: string | undefined = '???';
        let decimals: number = 18; // Default
        let logo: string | undefined = token.logo ?? undefined; // Use API logo if present

        if (!logo && KNOWN_TOKEN_LOGOS[contractAddressLower]) {
          logo = KNOWN_TOKEN_LOGOS[contractAddressLower]; // Use hardcoded logo as fallback
        }

        if (token.name) name = token.name;
        if (token.symbol) symbol = token.symbol;
        if (typeof token.decimals === 'number') decimals = token.decimals;

        const nameLower = name?.toLowerCase() || '';
        const symbolLower = symbol?.toLowerCase() || '';
        if (SPAM_KEYWORDS.some(keyword => nameLower.includes(keyword) || symbolLower.includes(keyword))) {
          console.log(`Filtering potential spam token: ${name} - ${symbol}`);
          return null;
        }

        const formattedBalance = formatUnits(balanceRaw, decimals);

        let usdValue: number | null = null;
        const usdPricePerToken: number | null = null; // TODO: Implement price fetching if needed

        if (usdPricePerToken !== null) {
          const balanceNumber = parseFloat(formattedBalance);
          if (!isNaN(balanceNumber)) {
            usdValue = balanceNumber * usdPricePerToken;
            totalCalculatedUsdValue += usdValue; // Accumulate total value
          }
        }

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

        return enrichedToken;
      }).filter((token): token is EnrichedTokenBalance => token !== null); // Filter out null values
    }

    console.log(`API Route: Fetch successful. Processed ${processedTokens.length} non-spam tokens. Total Value: ${totalCalculatedUsdValue}`);

    return NextResponse.json({ tokens: processedTokens, totalUsdValue }, { status: 200 });
  } catch (error: any) {
    console.error("Alchemy Data API Fetch Error:", error);
    return NextResponse.json({ error: error.message || 'Failed to fetch token balances via Alchemy Data API' }, { status: 500 });
  }
}
