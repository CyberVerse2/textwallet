import { anthropic, AnthropicProviderOptions } from '@ai-sdk/anthropic';
import { streamText, Message } from 'ai';

export async function POST(req: Request) {
  console.log('🤖 Chat API Route: Request received', new Date().toISOString());

  try {
    const requestBody = await req.json();
    let { messages } = requestBody;
    
    console.log('🤖 Chat API Route: Messages received', {
      count: messages.length,
      format: messages.length > 0 ? 
        `role: ${messages[messages.length - 1]?.role}, content available: ${!!messages[messages.length - 1]?.content}` : 
        'none'
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
      
      console.log('🤖 Chat API Route: Fixed messages format:', {
        count: messages.length,
        sample: messages.length > 0 ? 
          `role: ${messages[messages.length - 1]?.role}, content available: ${!!messages[messages.length - 1]?.content}` : 
          'none'
      });
    }

    // Ensure ANTHROPIC_API_KEY is available
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('🤖 Chat API Route: Missing ANTHROPIC_API_KEY environment variable');
      throw new Error('ANTHROPIC_API_KEY is not set');
    }

    console.log('🤖 Chat API Route: Calling Claude 3.5 Sonnet...');
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

    // Create a response with logging
    const response = result.toDataStreamResponse();

    console.log('🤖 Chat API Route: Response object created, streaming back to client');

    // We can't hook into all streaming events directly due to SDK limitations
    // but we'll log the completion of the request when the client disconnects
    setTimeout(() => {
      console.log('🤖 Chat API Route: Stream started');
    }, 500);

    return response;
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
