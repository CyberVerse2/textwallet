import { ActionProvider, CreateAction, PrivyEvmWalletProvider, Network } from '@coinbase/agentkit';
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
import { base } from 'viem/chains';
import { createCoin as createZoraCoinSDK, validateMetadataJSON } from '@zoralabs/coins-sdk';
import { zoraCreateCoinSchema } from './schemas';
import type { ZoraCreateCoinInput } from './schemas';
import { uploadJsonToPinata } from '../../ipfs';

interface AgentContext {
  accountAddress?: Address;
  walletClient?: WalletClient;
  publicClient?: PublicClient;
}

/**
 * Action provider specifically for creating Zora coins.
 */
class ZoraActionProvider extends ActionProvider<PrivyEvmWalletProvider> {
  constructor() {
    super('zora', []);
  }

  @CreateAction({
    name: 'createCoin',
    description:
      'Uploads coin metadata (name, description, image) to IPFS via Pinata, then creates a new Zora coin based on provided parameters (name, symbol, description, image, payoutRecipient, platformReferrer, initialPurchaseWei). Returns a success message with transaction hash and coin address, or an error message.',
    schema: zoraCreateCoinSchema
  })
  async createCoin(
    args: ZoraCreateCoinInput,
    context: AgentContext
  ): Promise<string> {
    const { accountAddress, walletClient, publicClient } = context;

    try {
      console.log('Attempting to create Zora coin with args:', args);

      if (!accountAddress) {
        throw new Error(
          'Could not retrieve address from the AgentContext. Ensure the wallet is configured correctly in the API route.'
        );
      }
      console.log(`Using account address: ${accountAddress}`);

      if (!walletClient || !publicClient) {
        throw new Error('WalletClient or PublicClient not provided in AgentContext.');
      }
      console.log('Using WalletClient and PublicClient from AgentContext.');

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
        payoutRecipient: (args.payoutRecipient ?? accountAddress) as Address,
        platformReferrer: args.platformReferrer as Address | undefined,
        initialPurchaseWei: args.initialPurchaseWei ?? 0n
      };
      console.log('Coin parameters prepared for SDK:', coinParams);

      const result = await createZoraCoinSDK(coinParams, walletClient, publicClient);
      console.log('Zora SDK createCoin successful:', result);

      return `Successfully created Zora coin '${args.name}'. Transaction hash: ${result.hash}, Coin address: ${result.address}`;
    } catch (error: any) {
      console.error(`Error creating Zora coin:`, error);
      const errorMessage = error.message || 'Unknown error';
      const prefix = errorMessage.startsWith('Shim:') ? '' : 'SDK Error: ';
      return `Error creating Zora coin: ${prefix}${errorMessage}`;
    }
  }

  supportsNetwork = (network: Network) => {
    return network.chainId === base.id.toString();
  };
}

export const zoraActionProvider = (): ZoraActionProvider => new ZoraActionProvider();
