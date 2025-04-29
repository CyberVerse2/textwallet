import { ActionProvider, CreateAction, PrivyEvmWalletConfig, Network } from '@coinbase/agentkit';
import { z } from 'zod';
import {
  Address,
  createPublicClient,
  createWalletClient,
  custom,
  http,
  Hex,
  TransactionRequest
} from 'viem';
import { base } from 'viem/chains';
import { createCoin as createZoraCoinSDK, validateMetadataJSON } from '@zoralabs/coins-sdk'; // Renamed import for clarity
import { zoraCreateCoinSchema } from './schemas'; // Import schema
import type { ZoraCreateCoinInput } from './schemas'; // Import type separately
import { uploadJsonToPinata } from '../../ipfs'; // Import the Pinata upload helper
import { PrivyEvmWalletProvider } from '@coinbase/agentkit';

/**
 * Action provider specifically for creating Zora coins.
 */
class ZoraActionProvider extends ActionProvider<PrivyEvmWalletProvider> {
  // Constructor sets the namespace
  constructor() {
    super('zora', []); // Namespace "zora"
  }

  // Decorate the action method
  @CreateAction({
    name: 'createCoin', // Action name used by the agent
    description:
      'Uploads coin metadata (name, description, image) to IPFS via Pinata, then creates a new Zora coin based on provided parameters (name, symbol, description, image, payoutRecipient, platformReferrer, initialPurchaseWei). Returns a success message with transaction hash and coin address, or an error message.',
    schema: zoraCreateCoinSchema // Use the Zod schema for input validation
  })
  // Action method implementation
  // First parameter is the injected wallet provider, second is the validated input args
  async createCoin(wallet: PrivyEvmWalletProvider, args: ZoraCreateCoinInput): Promise<string> {
    try {
      console.log('Attempting to create Zora coin with args:', args);

      // --- Privy/WalletProvider Integration ---
      const accountAddress = (await wallet.getAddress()) as Address | undefined;
      if (!accountAddress) {
        throw new Error(
          'Could not retrieve address from the wallet provider. Ensure the wallet is connected and configured correctly.'
        );
      }
      console.log(`Using account address: ${accountAddress}`);

      // --- Get Ethereum Provider Directly ---

        const provider = await wallet.exportWallet()
        console.log(provider)
      if (!provider) {
        throw new Error(
          'Could not retrieve Ethereum provider from the wallet provider.'
        );
      }
      console.log('Ethereum provider obtained.');

      // --- Create Viem Clients ---
      // Public client for reading data
      const publicClient = createPublicClient({
        chain: base, // Assuming Base chain
        transport: http(base.rpcUrls.default.http[0]), // Use default Base RPC
      });
      console.log('Viem Public Client created.');

      // Wallet client for signing transactions, using the direct provider
      const walletClient = createWalletClient({
        account: accountAddress,
        chain: base, // Ensure chain is consistent
        transport: custom(provider), // Use the provider obtained from PrivyEvmWalletProvider
      });
      console.log('Viem Wallet Client created using provider.');

      // --- Metadata Handling ---
      // 1. Construct Metadata JSON
      const metadataJson = {
        name: args.name,
        description: args.description,
        image: args.image // Use the image URI provided by the user
      };
      console.log('Constructed metadata JSON:', validateMetadataJSON(metadataJson));

      // 2. Upload Metadata JSON to Pinata/IPFS
      console.log('Uploading metadata to Pinata...');
      const metadataUri = await uploadJsonToPinata(metadataJson, {
        name: `${args.symbol}-metadata`
      });
      console.log('Metadata uploaded. URI:', metadataUri);

      // 3. Prepare parameters for the Zora SDK call
      const coinParams = {
        name: args.name,
        symbol: args.symbol,
        // Pass the metadata JSON URI generated from Pinata upload
        uri: metadataUri,
        // Default to connected wallet address if not provided in args
        payoutRecipient: (args.payoutRecipient ?? accountAddress) as Address,
        platformReferrer: args.platformReferrer as Address | undefined,
        // Use 1 wei as the default instead of 0, in case 0 causes a revert
        initialPurchaseWei: args.initialPurchaseWei ?? 0n
      };
      console.log('Coin parameters prepared for SDK:', coinParams);

      // 4. Call the actual Zora SDK function
      const result = await createZoraCoinSDK(coinParams, walletClient, publicClient);
      console.log('Zora SDK createCoin successful:', result);

      // Return success message
      return `Successfully created Zora coin '${args.name}'. Transaction hash: ${result.hash}, Coin address: ${result.address}`;
    } catch (error: any) {
      console.error(`Error creating Zora coin:`, error);
      // Check if the error is from the shim or SDK
      const errorMessage = error.message || 'Unknown error';
      const prefix = errorMessage.startsWith('Shim:') ? '' : 'SDK Error: ';
      // Return error message
      return `Error creating Zora coin: ${prefix}${errorMessage}`;
    }
  }

  // Indicate support for the network (optional, defaults might work)
  // This explicitly states it works for Base (id 8453)
  supportsNetwork = (network: Network) => {
    return network.chainId === base.id.toString();
  };
}

// Export a function that creates an instance of the provider
export const zoraActionProvider = (): ZoraActionProvider => new ZoraActionProvider();
