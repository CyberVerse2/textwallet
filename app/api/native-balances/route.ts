import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { Alchemy, Network, Utils } from "alchemy-sdk";

// Helper function to fetch ETH price from Diadata
async function getEthPrice(): Promise<number | null> {
  const url = 'https://api.diadata.org/v1/assetQuotation/Ethereum/0x0000000000000000000000000000000000000000';
  try {
    // Fetch fresh price, disable caching for server-side route
    const response = await fetch(url, { cache: 'no-store' }); 
    if (!response.ok) {
      throw new Error(`Diadata API error! status: ${response.status}`);
    }
    const data = await response.json();
    const ethPrice = data?.Price;
    if (typeof ethPrice !== 'number') {
        throw new Error('Invalid price format received from Diadata');
    }
    return ethPrice;
  } catch (error) {
    console.error('Error fetching ETH price:', error);
    return null; // Return null if price fetch fails
  }
}

// Define the structure for the native balance response
export interface NativeBalance {
    contractAddress: null; 
    symbol: string;        
    name: string;           
    logo: string | null;    
    balance: string;        
    formattedBalance: string;
    usdValue: number | null;
    networkName: string;    
    isNative: true;         
}

// Define the networks to query
const networks = [
  { name: 'Ethereum', network: Network.ETH_MAINNET, logo: 'https://token.metaswap.codefi.network/assets/networkLogos/ethereum.svg' }, 
  { name: 'Optimism', network: Network.OPT_MAINNET, logo: 'https://token.metaswap.codefi.network/assets/networkLogos/optimism.svg' },
  { name: 'Arbitrum One', network: Network.ARB_MAINNET, logo: 'https://token.metaswap.codefi.network/assets/networkLogos/arbitrum.svg' },
  { name: 'Polygon PoS', network: Network.MATIC_MAINNET, logo: 'https://token.metaswap.codefi.network/assets/networkLogos/polygon.svg' },
  { name: 'Base', network: Network.BASE_MAINNET, logo: 'https://token.metaswap.codefi.network/assets/networkLogos/base.svg' },
  { name: 'Zora', network: Network.ZORA_MAINNET, logo: 'https://token.metaswap.codefi.network/assets/networkLogos/zora.svg' }, 
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  if (!address) {
    return NextResponse.json({ error: 'Address query parameter is required' }, { status: 400 });
  }

  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    console.error('ALCHEMY_API_KEY environment variable not set.');
    return NextResponse.json({ error: 'Server configuration error: API key missing' }, { status: 500 });
  }
 
  const ethPrice = await getEthPrice();
 
  // Log if price fetch failed, but proceed
  if (ethPrice === null) {
    console.warn('Proceeding without ETH price for USD value calculation.');
  }

  const balances: NativeBalance[] = [];
  const promises = [];

  for (const net of networks) {
    const settings = {
      apiKey: apiKey,
      network: net.network,
      connectionInfoOverrides: {
        skipFetchSetup: true
      } // Use the Alchemy SDK Network enum
    };
    const alchemy = new Alchemy(settings);

    // Create a promise for each network's balance fetch
    promises.push(
      alchemy.core.getBalance(address, 'latest')
        .then(balanceInWei => {
          if (balanceInWei && balanceInWei.gt(0)) { // Only add if balance is greater than 0
            const balanceInEth = Utils.formatEther(balanceInWei);
            balances.push({
              contractAddress: null,
              symbol: 'ETH',
              name: 'Ethereum', // Keep name consistent for ETH
              logo: net.logo || null,
              balance: balanceInEth,
              formattedBalance: balanceInEth, // Use raw ETH value
              usdValue: null, // Not calculated in this version
              networkName: net.name,
              isNative: true,
            });
          }
        })
        .catch(error => {
          console.error(`Error fetching balance for ${net.name}:`, error);
          // Continue even if one network fails
        })
    );
  }

  // Wait for all balance fetches to complete
  await Promise.all(promises);

  // Calculate USD values if price is available
  if (ethPrice !== null) {
    balances.forEach(balance => {
      try {
        const balanceValue = parseFloat(balance.balance); 
        balance.usdValue = balanceValue * ethPrice;
      } catch (parseError) {
        console.error(`Error parsing balance string for USD calculation: ${balance.balance}`, parseError);
        balance.usdValue = null; // Set USD value to null if parsing fails
      }
    });
  }

  // Sort the final balances by USD value (descending), then by network name (ascending)
  balances.sort((a, b) => {
    const valueA = a.usdValue ?? -Infinity; // Treat null as very small
    const valueB = b.usdValue ?? -Infinity;

    if (valueB !== valueA) {
      return valueB - valueA; // Sort by USD value descending
    }
    return a.networkName.localeCompare(b.networkName); // Fallback sort
  });
  return NextResponse.json(balances);
}
