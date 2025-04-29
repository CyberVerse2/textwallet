import {
  ActionProvider,
  CreateAction,
  Network,
  WalletProvider,
  EvmWalletProvider
} from '@coinbase/agentkit';
import { z } from 'zod';
import {
  Address,
  createPublicClient,
  createWalletClient,
  custom,
  http,
  WalletClient,
  PublicClient
} from 'viem';
import { base, mainnet } from 'viem/chains';
import { createCoin as createZoraCoinSDK, validateMetadataJSON } from '@zoralabs/coins-sdk';
import { zoraCreateCoinSchema } from './schemas';
import type { ZoraCreateCoinInput } from './schemas';
import { uploadJsonToPinata } from '../../ipfs';
import { useWallets } from '@privy-io/react-auth';
import { Hex } from '@privy-io/server-auth';
import { Interface } from 'ethers';
import factoryArtifact from '@zoralabs/protocol-deployments';
const ZoraFactoryABI = factoryArtifact.abi;

/**
 * Action provider specifically for creating Zora coins.
 */
class ZoraActionProvider extends ActionProvider<EvmWalletProvider> {
  constructor() {
    // Define the provider name and an empty actions array (actions defined via @CreateAction)
    super('zora', []); // Provide empty array as second argument
  }

  @CreateAction({
    name: 'createCoin',
    description:
      'Uploads coin metadata (name, description, image) to IPFS via Pinata, then creates a new Zora coin based on provided parameters (name, symbol, description, image, payoutRecipient, platformReferrer, initialPurchaseWei). Returns a success message with transaction hash and coin address, or an error message.',
    schema: zoraCreateCoinSchema
  })
  async createCoin(
    args: ZoraCreateCoinInput,
    evmWalletProvider: EvmWalletProvider
  ): Promise<string> {
    const wallet = evmWalletProvider;
    const walletClient = createWalletClient({
      account: wallet.address as Hex,
      chain: base,
      transport: custom(provider)
    });
    const publicClient = createPublicClient({
      chain: base,
      transport: custom(provider)
    });
    console.log('🚀 ZoraActionProvider.createCoin: Entered function with args:', args);

    try {
      console.log('Attempting to create Zora coin with args:', args);

      const metadataJson = {
        name: args.name,
        description: args.description,
        image: args.image
      };
      console.log('Constructed metadata JSON:', validateMetadataJSON(metadataJson));

      console.log('Uploading metadata to Pinata...');
      const metadataUri = await uploadJsonToPinata(metadataJson, {
        name: `${args.symbol}-metadata`
      });
      console.log('Metadata uploaded. URI:', metadataUri);

      const coinParams = {
        name: args.name,
        symbol: args.symbol,
        uri: metadataUri,
        payoutRecipient: (args.payoutRecipient ?? wallet.address) as Address,
        platformReferrer: args.platformReferrer as Address | undefined,
        initialPurchaseWei: args.initialPurchaseWei ?? 0n
      };
      console.log('Coin parameters prepared for SDK:', coinParams);

      const result = await createZoraCoinSDK(coinParams, walletClient, publicClient);
      console.log('Zora SDK createCoin successful:', result);

      console.log('✅ ZoraActionProvider.createCoin: Successfully created coin. Receipt:', result);
      const resultString = `Successfully created Zora coin '${args.name}'. Transaction hash: ${result.hash}, Coin address: ${result.address}`;
      console.log('✅ ZoraActionProvider.createCoin: Returning success string:', resultString);
      return resultString;
    } catch (error: any) {
      console.error('💥 ZoraActionProvider.createCoin: Caught error:', error); // Log the full error
      const errorMessage = error.message || 'Unknown error';
      const prefix = errorMessage.startsWith('Shim:') ? '' : 'SDK Error: ';
      const errorString = `Error creating Zora coin: ${prefix}${errorMessage}`;
      console.log('💥 ZoraActionProvider.createCoin: Returning error string:', errorString);
      return errorString;
    }
  }

  supportsNetwork = (network: Network) => {
    return network.chainId === base.id.toString();
  };
}

export const zoraActionProvider = (): ZoraActionProvider => new ZoraActionProvider();
