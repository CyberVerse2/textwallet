/**
 * Utility functions for interacting with IPFS via Pinata.
 */

/**
 * Uploads a JSON object to IPFS using the Pinata API.
 *
 * @param jsonData - The JSON object to upload.
 * @param pinataMetadata - Optional metadata for Pinata (e.g., { name: 'My Coin Metadata' }).
 * @returns The full IPFS URI (ipfs://CID).
 * @throws If Pinata API keys are missing or the upload fails.
 */
export async function uploadJsonToPinata(jsonData: object, pinataMetadata?: object): Promise<string> {
    const apiKey = process.env.PINATA_API_KEY;
    const secretApiKey = process.env.PINATA_SECRET_API_KEY;

    if (!apiKey || !secretApiKey) {
        throw new Error('Pinata API Key or Secret API Key is missing from environment variables.');
    }

    const url = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

    const body = JSON.stringify({
        pinataContent: jsonData,
        ...(pinataMetadata && { pinataMetadata }), // Add metadata if provided
        // pinataOptions: { cidVersion: 1 } // Optional: Use CID v1
    });

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'pinata_api_key': apiKey,
                'pinata_secret_api_key': secretApiKey,
            },
            body: body,
        });

        if (!response.ok) {
            const errorData = await response.text(); // Get error text
            throw new Error(`Pinata API Error (${response.status}): ${errorData}`);
        }

        const result = await response.json();

        if (!result.IpfsHash) {
            throw new Error('Pinata API response did not include IpfsHash.');
        }

        const ipfsUri = `ipfs://${result.IpfsHash}`;
        console.log('Successfully pinned JSON to Pinata:', ipfsUri);
        return ipfsUri;

    } catch (error) {
        console.error('Error uploading JSON to Pinata:', error);
        if (error instanceof Error) {
            throw new Error(`Failed to upload JSON to Pinata: ${error.message}`);
        }
        throw new Error('An unknown error occurred during Pinata upload.');
    }
}
