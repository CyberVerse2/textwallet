import { NextResponse } from 'next/server';
import { _createServerWalletLogic } from '@/lib/server-wallet'; 

// API Route Handler
export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Call the imported logic
    const result = await _createServerWalletLogic(userId);

    if ('error' in result) {
      // Use the status from the result if available, otherwise default to 500
      const status = result.status || 500;
      // Ensure the error object passed to NextResponse.json is serializable
      const errorDetails = result.error instanceof Error ? result.error.message : JSON.stringify(result.error);
      return NextResponse.json(
          { error: 'Failed to create server wallet', details: errorDetails },
          { status: status }
      );
    }

    return NextResponse.json({ address: result.address });

  } catch (error: any) {
    console.error('Error in POST /api/create-server-wallet:', error);
    // Handle potential JSON parsing errors or other unexpected issues
    const errorMessage = error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json(
      { error: 'Failed to process request', details: errorMessage },
      { status: 500 }
    );
  }
}
