import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { streamText, Message, generateText } from 'ai';

// Handle AgentKit imports when needed instead of at the top level
export async function POST(req: Request) {
  console.log('🤖 Chat API Route: Request received', new Date().toISOString());

  try {
    const requestBody = await req.json();
    let { messages, userWalletId } = requestBody;
    const useOnchainTools = !!userWalletId;
    
    console.log('🤖 Chat API Route: Messages received', {
      count: messages.length,
      format: messages.length > 0 ? 
        `role: ${messages[messages.length - 1]?.role}, content available: ${!!messages[messages.length - 1]?.content}` : 
        'none',
      useOnchainTools,
      userWalletId: userWalletId ? `${userWalletId.slice(0, 6)}...${userWalletId.slice(-4)}` : 'none'
    });

    // Validate message format
    if (!Array.isArray(messages)) {
      throw new Error('Invalid messages format: messages must be an array');
    }
    
    if (messages.length > 0 && (!messages[0].role || !messages[0].content)) {
      console.warn('🤖 Chat API Route: Messages may have incorrect format, attempting to fix...');
      
      // Try to fix incorrectly formatted messages from the context
      messages = messages.map((msg: any): Message => {
        // If using the old format with sender/text
        if (msg.sender && msg.text) {
          return {
            id: msg.id || Math.random().toString(36).substring(2, 15),
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
          };
        }
        // Already in the correct format
        else if (msg.role && msg.content) {
          return msg;
        }
        // Unrecognized format
        else {
          console.error('🤖 Chat API Route: Unrecognized message format', msg);
          throw new Error('Invalid message format');
        }
      });
    }

    // Ensure ANTHROPIC_API_KEY is available
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }

    // Check if we should use wallet features
    if (useOnchainTools) {
      try {
        // Validate required environment variables
        if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID || !process.env.NEXT_PUBLIC_PRIVY_APP_SECRET) {
          throw new Error('PRIVY_APP_ID and PRIVY_APP_SECRET environment variables must be set');
        }

        console.log('🔐 Setting up delegated wallet provider for address:', userWalletId);
        
        // Dynamically import AgentKit to avoid initialization issues
        const { AgentKit, PrivyEvmDelegatedEmbeddedWalletProvider } = await import('@coinbase/agentkit');
        const { getVercelAITools } = await import('@coinbase/agentkit-vercel-ai-sdk');
        
        // Configure the wallet provider with the user's delegated wallet
        const walletConfig = {
          appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
          appSecret: process.env.NEXT_PUBLIC_PRIVY_APP_SECRET,
          chainId: process.env.PRIVY_CHAIN_ID || '84532', // Base Sepolia by default
          walletId: userWalletId, // Use the user's delegated wallet ID
          walletType: "embedded" as const // Required by the type definition
        };
        
        // Set up the delegated wallet provider
        const walletProvider = await PrivyEvmDelegatedEmbeddedWalletProvider.configureWithWallet(walletConfig);
        console.log('🔐 Privy delegated wallet provider configured successfully');
        
        // Initialize AgentKit with the wallet provider
        const agentKitConfig: any = { walletProvider };
        
        // Add CDP API keys if available
        if (process.env.CDP_API_KEY_NAME && process.env.CDP_API_KEY_PRIVATE_KEY) {
          agentKitConfig.cdpApiKeyName = process.env.CDP_API_KEY_NAME;
          agentKitConfig.cdpApiKeyPrivateKey = process.env.CDP_API_KEY_PRIVATE_KEY;
        }
        
        const agentKit = await AgentKit.from(agentKitConfig);
        const tools = await getVercelAITools(agentKit);
        
        console.log('🤖 Chat API Route: Generating response with wallet access...');
        
        // Generate a response with wallet access using Claude
        const result = await generateText({
          model: anthropic('claude-3-7-sonnet-20250219'),
          system: 'You are an onchain AI assistant with access to a wallet. You can perform blockchain operations through the provided tools. Always explain what you are doing and why.',
          messages,
          tools,
          maxSteps: 10,
          providerOptions: {
            anthropic: {
              thinking: { type: 'enabled', budgetTokens: 12000 }
            } satisfies AnthropicProviderOptions
          }
        });
        
        // Return the result as a text stream
        return new Response(result.text, {
          headers: { 'Content-Type': 'text/plain' }
        });
      } catch (error) {
        console.error('🤖 Chat API Route ERROR with wallet operations:', error);
        throw new Error(`Failed to initialize wallet: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    } else {
      // Standard chat without wallet access
      const result = streamText({
        model: anthropic('claude-3-7-sonnet-20250219'),
        messages,
        providerOptions: {
          anthropic: {
            thinking: { type: 'enabled', budgetTokens: 12000 }
          } satisfies AnthropicProviderOptions
        }
      });

      console.log('🤖 Chat API Route: Stream created, sending to client...');
      
      const response = result.toDataStreamResponse();
      
      setTimeout(() => {
        console.log('🤖 Chat API Route: Stream started');
      }, 500);

      return response;
    }
  } catch (error) {
    console.error('🤖 Chat API Route ERROR:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to process chat request',
        message: error instanceof Error ? error.message : 'Unknown error',
        time: new Date().toISOString()
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
