import { customActionProvider, EvmWalletProvider } from '@coinbase/agentkit';
import { ZoraActionSchema } from './schemas';
import { z } from 'zod';
import { createCoin } from '@zoralabs/coins-sdk';
import { Address } from 'viem';

/**
 * Creates a ZoraActionProvider action provider.
 * To create multiple actions, pass in an array of actions to createActionProvider.
 */
export const zoraActionProvider = () =>
  customActionProvider<EvmWalletProvider>({
    name: 'zora_action',
    description: `This tool will perform a ZoraActionProvider operation.`,
    schema: ZoraActionSchema,
    invoke: async (wallet: EvmWalletProvider, args: z.infer<typeof ZoraActionSchema>) => {
      try {
        const coinParams = {
          name: 'My Awesome Coin',
          symbol: 'MAC',
          uri: 'ipfs://bafybeigoxzqzbnxsn35vq7lls3ljxdcwjafxvbvkivprsodzrptpiguysy',
          payoutRecipient: '0xYourAddress' as Address,
          platformReferrer: '0xOptionalPlatformReferrerAddress' as Address,
          initialPurchaseWei: 0
        };

        async function createMyCoinWithPrivy() {
          const provider = await setupProvider();
          const walletClient = await createPrivyWalletClient(
            provider,
            provider.selectedAddress as Hex
          );
          const result = await createCoin(coinParams, walletClient, publicClient);

          console.log('Transaction hash:', result.hash);
          console.log('Coin address:', result.address);
          console.log('Deployment details:', result.deployment);

          return result;
        }

        return `Successfully performed zora_action and returned the response`;
      } catch (error) {
        return `Error performing zora_action: Error: ${error}`;
      }
    }
  });
