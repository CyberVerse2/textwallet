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
import { streamText, Message as VercelMessage, StreamTextResult } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { zoraActionProvider } from '@/lib/customActions/zora/zoraActionProvider';
import supabaseAdmin from '@/lib/supabaseAdmin';

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
    },
  });
}

export async function POST(req: Request) {
  let parentDbId: string | null = null;
  let finalCompletion = ''; // Hold the final AI text or generic error
  let streamResult: StreamTextResult<any, any> | null = null; // Hold the successful stream result
  let hadStreamError = false;
  let genericErrorMessage = "Sorry, I encountered an issue processing that request. Please try again."; // Default error

  const { messages, userId, walletId }: RequestBody = await req.json();

  // --- Save User Message --- Check for Non-Nullability
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
        .select('id')
        .single();

      if (error || !data?.id) {
        console.error('🤖 Chat API Route: Error saving user message or retrieving ID:', error);
        // If user message fails to save, stop processing
        return new Response(JSON.stringify({ error: 'Failed to save user message' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      } else {
        parentDbId = data.id;
        console.log(`🤖 Saved user message with DB ID: ${parentDbId}`);
      }
    } catch (dbError) {
      console.error('🤖 Chat API Route: Exception saving user message:', dbError);
      return new Response(JSON.stringify({ error: 'Failed to save user message' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  } else {
    console.warn(
      '🤖 Chat API Route: Last message not from user or userId missing, cannot proceed.'
    );
    // Cannot proceed without a user message and ID to link AI response
    return new Response(JSON.stringify({ error: 'Invalid request state' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  // --- End Save User Message --- Ensure userMessageId is non-null before proceeding

  try {
    // --- Attempt AI Interaction with Tools --- Moved AgentKit setup inside this block
    // Check if ALL required conditions for tool usage are met
    const canUseTools =
      process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
      process.env.NEXT_PUBLIC_PRIVY_APP_SECRET &&
      userId &&
      walletId &&
      process.env.PRIVY_AUTHORIZATION_KEY_ID &&
      process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY;

    if (canUseTools) {
      // Setup AgentKit and tools ONLY if conditions met
      const walletConfig: PrivyEvmWalletConfig = {
        appId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
        appSecret: process.env.NEXT_PUBLIC_PRIVY_APP_SECRET!,
        walletId,
        chainId: process.env.PRIVY_CHAIN_ID || '8453',
        authorizationKeyId: process.env.PRIVY_AUTHORIZATION_KEY_ID!,
        authorizationPrivateKey: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY!
      }; // Added type annotation
      const walletProvider = await PrivyEvmWalletProvider.configureWithWallet(walletConfig);
      const erc721 = erc721ActionProvider();
      const pyth = pythActionProvider();
      const walletAct = walletActionProvider(); // Renamed wallet variable
      const zora = zoraActionProvider();

      const agentKitConfig: AgentKitOptions = {
        walletProvider,
        actionProviders: [erc721, pyth, walletAct, zora]
        // Add CDP keys if needed
      };
      const agentKit = await AgentKit.from(agentKitConfig);
      const tools = getVercelAITools(agentKit);

      try {
        // --- Execute streamText with Tools --- ONLY Call Path
        streamResult = streamText({
          model: anthropic('claude-3-7-sonnet-20250219'),
          messages,
          tools
        });

        // Process the stream and get the final text
        for await (const part of streamResult.textStream) {
          finalCompletion += part;
        }
        console.log("🤖 Stream processing with tools successful.");

      } catch (streamOrToolError: any) {
        console.error('🤖 Chat API Route: Error during streamText or tool execution:', streamOrToolError);
        hadStreamError = true;
        finalCompletion = genericErrorMessage; // Use default generic error
        streamResult = null; // Invalidate original stream result
      }
    } else {
      // Conditions for tool usage NOT met - Treat as an error, DO NOT call streamText
      console.error('🤖 Chat API Route: Configuration incomplete for tool usage. Required IDs or ENV VARS missing.');
      hadStreamError = true;
      genericErrorMessage = "Sorry, I cannot perform actions requiring wallet access due to configuration issues."; // More specific error
      finalCompletion = genericErrorMessage;
      streamResult = null;
    }

    // --- Save AI Message (Success or Generic Error) --- Now Outside Nested Try/Catch
    // This now runs after either a successful tool stream, a failed tool stream, OR a config failure
    if (userId && parentDbId) { // userMessageId is guaranteed non-null if we reached here
      try {
        const { error: aiSaveError } = await supabaseAdmin.from('chat_history').insert({
          user_id: userId, // userId is also guaranteed non-null here
          message: finalCompletion, // Saves success, tool error, or config error msg
          sender: 'ai',
          parent_message_id: parentDbId
        });

        if (aiSaveError) {
          console.error('🤖 Chat API Route: Error saving AI message/error:', aiSaveError);
          // Log failure but maybe don't abort the response to user?
        } else {
          console.log(`🤖 Saved AI message/error, linked to user ID: ${parentDbId}`);
        }
      } catch (dbError) {
        console.error('🤖 Chat API Route: Exception saving AI message/error:', dbError);
      }
    }
    // --- End Save AI Message ---

    // --- Return Response --- Conditional based on error flag
    if (!hadStreamError && streamResult) {
      // Success Case: Return the original AI stream
      return streamResult.toDataStreamResponse();
    } else {
      // Error Case (Tool fail OR Config fail): Stream back the generic error message
      const errorStream = createPlainTextStream(finalCompletion); // Use finalCompletion which holds the specific error msg
      return new Response(errorStream, {
        status: 200, // Still 200 OK, but content indicates an issue
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Transfer-Encoding': 'chunked' }, // Added Transfer-Encoding
      });
    }

  } catch (setupError: any) {
    // Catch errors from initial AgentKit setup IF it happens within the 'if (canUseTools)' block
    console.error('🤖 Chat API Route Top Level Error (AgentKit Setup?):', setupError);
    // Attempt to save generic error linked to user message if possible
    if (userId && parentDbId) {
      try {
        await supabaseAdmin.from('chat_history').insert({
          user_id: userId,
          message: genericErrorMessage, // Save generic error here too
          sender: 'ai',
          parent_message_id: parentDbId
        });
      } catch (finalDbError) {
        console.error("🤖 Chat API Route: Failed to save final setup error message:", finalDbError);
      }
    }
    // Return a non-streamed generic error to the client
    return new Response(JSON.stringify({ error: 'Failed to process chat request due to a setup error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
