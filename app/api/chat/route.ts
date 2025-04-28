import {
  AgentKit,
  AgentKitOptions,
  erc721ActionProvider,
  PrivyEvmWalletConfig,
  PrivyEvmWalletProvider,
  pythActionProvider
} from '@coinbase/agentkit';
import { getVercelAITools } from '@coinbase/agentkit-vercel-ai-sdk';
import { streamText, Message as VercelMessage } from 'ai';
import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';

// Define the types for our API request body
interface RequestBody {
  messages: VercelMessage[];
  useWallet?: boolean;
  userId?: string | null;
  walletId?: string;
}

export async function POST(req: Request) {
  try {
    const { messages, userId, walletId }: RequestBody = await req.json();

    // Default to using server wallet
    if (process.env.NEXT_PUBLIC_PRIVY_APP_ID && process.env.NEXT_PUBLIC_PRIVY_APP_SECRET) {
      try {
        // Check if we have a valid userId and walletId
        if (!userId) {
          throw new Error('Missing userId for wallet operations');
        }
        if (!walletId) {
          throw new Error('Missing walletId for wallet operations');
        }

        // Ensure environment variables exist
        const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
        const appSecret = process.env.NEXT_PUBLIC_PRIVY_APP_SECRET;
        const authKeyId = process.env.PRIVY_AUTHORIZATION_KEY_ID;
        const authPrivateKey = process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY;

        if (!appId || !appSecret) {
          throw new Error('Missing Privy App ID or Secret');
        }

        // Explicitly check for authorization keys if they are expected
        if (!authKeyId) {
          throw new Error('Missing PRIVY_AUTHORIZATION_KEY_ID environment variable');
        }
        if (!authPrivateKey) {
          throw new Error('Missing PRIVY_AUTHORIZATION_PRIVATE_KEY environment variable');
        }

        // Create wallet config with our user-specific server wallet
        const walletConfig = {
          appId,
          appSecret,
          // Use Base mainnet
          chainId: process.env.PRIVY_CHAIN_ID || '8453',
          walletId: walletId,
          userId: userId,
          authorizationKeyId: authKeyId,
          authorizationPrivateKey: authPrivateKey
        };

        // Configure AgentKit with server wallet
        const walletProvider = await PrivyEvmWalletProvider.configureWithWallet(walletConfig);

        const erc721 = erc721ActionProvider();
        const pyth = pythActionProvider();
        
        const agentKitConfig: AgentKitOptions = {
          walletProvider,
          actionProviders: [erc721, pyth]
        };

        // Add CDP API keys if present
        if (process.env.CDP_API_KEY_NAME && process.env.CDP_API_KEY_PRIVATE_KEY) {
          agentKitConfig.cdpApiKeyName = process.env.CDP_API_KEY_NAME;
          agentKitConfig.cdpApiKeyPrivateKey = process.env.CDP_API_KEY_PRIVATE_KEY;
        }

        const agentKit = await AgentKit.from(agentKitConfig);
        const tools = getVercelAITools(agentKit);

        // Get wallet address (from Privy provider)
        const privyManagedWalletAddress = await walletProvider.getAddress();

        // Generate a response with server wallet access using Claude with streaming
        const result = await streamText({
          model: anthropic('claude-3-7-sonnet-20250219'),
          system:
            'You are an onchain AI assistant with access to a server wallet. You can perform blockchain operations through the provided tools. Always explain what you are doing and why.',
          messages,
          tools,
          maxSteps: 10,
          providerOptions: {
            anthropic: {
              thinking: { type: 'enabled', budgetTokens: 12000 }
            } satisfies AnthropicProviderOptions
          }
        });

        // Return the streamed response
        return result.toDataStreamResponse();
      } catch (walletError) {
        // If wallet initialization fails, log the error and fall back to regular chat
        console.error('🤖 Chat API Route: Wallet initialization failed:', walletError);
      }
    }
  } catch (error) {
    // Handle general errors
    console.error('🤖 Chat API Route Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
