import {
  AgentKit,
  AgentKitOptions,
  erc721ActionProvider,
  PrivyEvmWalletConfig,
  PrivyEvmWalletProvider,
  pythActionProvider,
  walletActionProvider
} from '@coinbase/agentkit';
import { getVercelAITools } from '@coinbase/agentkit-vercel-ai-sdk';
import { streamText, Message as VercelMessage } from 'ai';
import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { zoraActionProvider } from '@/lib/customActions/zora/zoraActionProvider';
import supabaseAdmin from '@/lib/supabaseAdmin';

// Define the types for our API request body
interface RequestBody {
  messages: VercelMessage[];
  userId?: string; // Privy User ID
  walletId?: string; // Privy Wallet ID (Address)
}

export async function POST(req: Request) {
  let userMessageId: string | null = null; // Variable to hold the user message ID

  try {
    const { messages, userId, walletId }: RequestBody = await req.json();

    // --- Save User Message --- 
    const userMessage = messages[messages.length - 1];
    if (userMessage && userMessage.role === 'user' && userId) {
      try {
        const { data, error } = await supabaseAdmin
          .from('chat_history')
          .insert({
            user_id: userId,
            message: userMessage.content,
            sender: 'user',
          })
          .select('id') // Select the ID of the inserted row
          .single(); // Expect a single row back

        if (error) {
          console.error('🤖 Chat API Route: Error saving user message:', error);
          // Decide if you want to proceed without saving or throw an error
        } else if (data) {
          userMessageId = data.id; // Store the ID
          console.log(`🤖 Saved user message with ID: ${userMessageId}`);
        }
      } catch (dbError) {
        console.error('🤖 Chat API Route: Exception saving user message:', dbError);
      }
    } else {
        console.warn('🤖 Chat API Route: Last message not from user or userId missing, skipping user message save.');
    }
    // --- End Save User Message ---

    // Check if Privy environment variables are set
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
        const wallet = walletActionProvider()
        const zora = zoraActionProvider()

        const agentKitConfig: AgentKitOptions = {
          walletProvider,
          actionProviders: [erc721, pyth, wallet, zora]
        };

        // Add CDP API keys if present
        if (process.env.CDP_API_KEY_NAME && process.env.CDP_API_KEY_PRIVATE_KEY) {
          agentKitConfig.cdpApiKeyName = process.env.CDP_API_KEY_NAME;
          agentKitConfig.cdpApiKeyPrivateKey = process.env.CDP_API_KEY_PRIVATE_KEY;
        }

        // Instantiate AgentKit with the config
        const agentKit = await AgentKit.from(agentKitConfig); // Use from()
        // Pass the AgentKit instance to the Vercel AI SDK
        const tools = getVercelAITools(agentKit);

        // Generate a response with wallet access using Claude with streaming
        const result = await streamText({
          model: anthropic('claude-3-5-sonnet-20240620'),
          messages,
          tools,
        });

        // Process the stream and get the final text
        let finalCompletion = '';
        for await (const part of result.textStream) {
            finalCompletion += part;
        }

        // --- Save AI Message After Stream Completion (Wallet Case) ---
        if (userId && userMessageId) { // Check if we have necessary IDs
          try {
            const { error: aiSaveError } = await supabaseAdmin
              .from('chat_history')
              .insert({
                user_id: userId,
                message: finalCompletion, // Save the full completed text
                sender: 'ai',
                parent_message_id: userMessageId, // Link to the user message ID
              });

            if (aiSaveError) {
              console.error('🤖 Chat API Route: Error saving AI message post-stream (wallet):', aiSaveError);
            } else {
              console.log(`🤖 Saved AI message post-stream (wallet), linked to user message ID: ${userMessageId}`);
            }
          } catch (dbError) {
            console.error('🤖 Chat API Route: Exception saving AI message post-stream (wallet):', dbError);
          }
        } else {
          console.warn('🤖 Chat API Route: userId or userMessageId missing, skipping AI message save post-stream (wallet).');
        }
        // --- End Save AI Message ---

        // Return the streamed response
        return result.toDataStreamResponse();

      } catch (walletError) {
        // If wallet initialization fails, log the error and fall back to regular chat
        console.error('🤖 Chat API Route: Wallet initialization failed:', walletError);
        // Fallback: Initialize AgentKit without wallet provider
        const agentKitConfigFallback: AgentKitOptions = {
            actionProviders: [], // No wallet-dependent actions in fallback
        };
        const agentKitFallback = await AgentKit.from(agentKitConfigFallback); // Use from()
        const toolsFallback = getVercelAITools(agentKitFallback);

        // --- Execute streamText with fallback tools (Wallet Error) ---
        const resultFallback = await streamText({
          model: anthropic('claude-3-5-sonnet-20240620'),
          messages,
          tools: toolsFallback,
        });

        // Process the fallback stream
        let finalCompletionFallback = '';
        for await (const part of resultFallback.textStream) {
            finalCompletionFallback += part;
        }

        // --- Save AI Message After Stream Completion (Wallet Error Fallback) ---
        if (userId && userMessageId) {
          try {
            const { error: aiSaveError } = await supabaseAdmin
              .from('chat_history')
              .insert({
                user_id: userId,
                message: finalCompletionFallback,
                sender: 'ai',
                parent_message_id: userMessageId,
              });
            if (aiSaveError) {
              console.error('🤖 Chat API Route: Error saving AI message (wallet error fallback):', aiSaveError);
            } else {
              console.log(`🤖 Saved AI message (wallet error fallback), linked to user ID: ${userMessageId}`);
            }
          } catch (dbError) {
            console.error('🤖 Chat API Route: Exception saving AI message (wallet error fallback):', dbError);
          }
        } else {
          console.warn('🤖 Chat API Route: userId/userMessageId missing, skipping AI save (wallet error fallback).');
        }
        // --- End Save AI Message ---

        return resultFallback.toDataStreamResponse();
      }
    } else {
      // If Privy keys aren't set, proceed without wallet functionality
      console.warn('🤖 Chat API Route: Privy environment variables not set. Proceeding without wallet functionality.');
      const agentKitConfigFallback: AgentKitOptions = {
            actionProviders: [], // No wallet-dependent actions in fallback
      };
      const agentKitFallback = await AgentKit.from(agentKitConfigFallback); // Use from()
      const toolsFallback = getVercelAITools(agentKitFallback); // Use fallback AgentKit

      // --- Execute streamText with fallback tools (No Privy Keys) ---
       const resultFallback = await streamText({
          model: anthropic('claude-3-5-sonnet-20240620'),
          messages,
          tools: toolsFallback,
        });

        // Process the fallback stream
        let finalCompletionFallback = '';
        for await (const part of resultFallback.textStream) {
            finalCompletionFallback += part;
        }

        // --- Save AI Message After Stream Completion (No Privy Keys Fallback) ---
        if (userId && userMessageId) {
          try {
            const { error: aiSaveError } = await supabaseAdmin
              .from('chat_history')
              .insert({
                user_id: userId,
                message: finalCompletionFallback,
                sender: 'ai',
                parent_message_id: userMessageId,
              });
            if (aiSaveError) {
              console.error('🤖 Chat API Route: Error saving AI message (no privy keys fallback):', aiSaveError);
            } else {
              console.log(`🤖 Saved AI message (no privy keys fallback), linked to user ID: ${userMessageId}`);
            }
          } catch (dbError) {
            console.error('🤖 Chat API Route: Exception saving AI message (no privy keys fallback):', dbError);
          }
        } else {
          console.warn('🤖 Chat API Route: userId/userMessageId missing, skipping AI save (no privy keys fallback).');
        }
        // --- End Save AI Message ---

        return resultFallback.toDataStreamResponse();
    }
  } catch (error) {
    // Catch errors from JSON parsing or initial setup
    console.error('🤖 Chat API Route Top Level Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to process chat request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
