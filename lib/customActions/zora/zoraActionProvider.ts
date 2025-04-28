import { customActionProvider, EvmWalletProvider } from "@coinbase/agentkit";
import { ZoraActionSchema, ZoraActionInput } from "./schemas"; 
import { z } from "zod";
// Import viem clients and helpers
import { createPublicClient, createWalletClient, custom, http, Address } from 'viem';
import { base } from 'viem/chains'; // Assuming Base mainnet for Zora coin creation
// Import the specific function needed from utils
import { createMyCoin } from '@/lib/utils'; // Adjust path if necessary

/**
 * Action provider specifically for creating Zora coins.
 */
export const zoraActionProvider = () =>
  customActionProvider<EvmWalletProvider>({ 
    name: "create_zora_coin", // Specific name for the action
    description: `Creates a new Zora coin based on provided parameters (name, symbol, uri, payoutRecipient, initialPurchaseWei).`, // Specific description
    schema: ZoraActionSchema, // Use the simplified schema for coin creation
    invoke: async (wallet: EvmWalletProvider, args: ZoraActionInput) => { 
      try {
        console.log('Attempting to create Zora coin with args:', args);

        // --- Privy Integration --- 
        // Assume 'wallet' is configured with Privy and provides necessary properties.
        // We use 'as any' because the base EvmWalletProvider type might not expose these directly.

        // 1. Get Account Address from Privy Provider
        const accountAddress = (wallet as any).address as Address | undefined;
        if (!accountAddress) {
          throw new Error('Could not retrieve address from the Privy wallet provider. Ensure the wallet is connected and configured correctly.');
        }
        console.log(`Using account address: ${accountAddress}`);

        // 2. Get EIP-1193 Provider from Privy Provider
        const eipProvider = (wallet as any).provider;
        if (!eipProvider) {
            throw new Error('Could not retrieve the EIP-1193 provider from the Privy wallet provider.');
        }
        console.log('EIP-1193 provider retrieved.');
        // --- End Privy Integration ---

        // Create Public Client (moved inside invoke)
        const publicClient = createPublicClient({
            chain: base,
            transport: http(),
        });
        console.log('Viem Public Client created.');

        // Create Wallet Client using Privy details
        const walletClient = createWalletClient({
          account: accountAddress, // Use the address from Privy
          chain: base, 
          transport: custom(eipProvider) // Use the EIP-1193 provider from Privy
        });
        console.log('Viem Wallet Client created.');

        // Prepare parameters for createMyCoin, ensuring Address types
        const coinParams = {
          name: args.name,
          symbol: args.symbol,
          uri: args.uri,
          payoutRecipient: args.payoutRecipient as Address,
          platformReferrer: args.platformReferrer as Address | undefined, // Optional
          initialPurchaseWei: args.initialPurchaseWei,
        };

        // Call the utility function
        const result = await createMyCoin(coinParams, walletClient, publicClient);

        // Format success response
        return `Successfully created Zora coin '${args.name}'. Transaction hash: ${result.hash}, Coin address: ${result.address}`;

      } catch (error: any) {
        console.error(`Error creating Zora coin:`, error);
        return `Error creating Zora coin: ${error.message || 'Unknown error'}`;
      }
    },
  });
