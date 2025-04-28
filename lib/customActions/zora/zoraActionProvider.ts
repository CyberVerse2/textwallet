import { ActionProvider, CreateAction, EvmWalletProvider, Network } from "@coinbase/agentkit";
import { z } from 'zod';
import { Address, createPublicClient, createWalletClient, custom, http, Hex } from 'viem';
import { base } from 'viem/chains';
import { createCoin as createZoraCoinSDK } from "@zoralabs/coins-sdk"; // Renamed import for clarity
import { zoraCreateCoinSchema } from './schemas'; // Import schema
import type { ZoraCreateCoinInput } from './schemas'; // Import type separately

/**
 * Action provider specifically for creating Zora coins.
 */
class ZoraActionProvider extends ActionProvider<EvmWalletProvider> {
    // Constructor sets the namespace
    constructor() {
        super("zora", []); // Namespace "zora"
    }

    // Decorate the action method
    @CreateAction({
        name: "createCoin", // Action name used by the agent
        description: "Creates a new Zora coin based on provided parameters (name, symbol, uri, payoutRecipient, platformReferrer, initialPurchaseWei). Returns a success message with transaction hash and coin address, or an error message.",
        schema: zoraCreateCoinSchema, // Use the Zod schema for input validation
    })
    // Action method implementation
    // First parameter is the injected wallet provider, second is the validated input args
    async createCoin(wallet: EvmWalletProvider, args: ZoraCreateCoinInput): Promise<string> {
        try {
            console.log('Attempting to create Zora coin with args:', args);

            // --- Privy/WalletProvider Integration ---
            const accountAddress = await wallet.getAddress() as Address | undefined;
            if (!accountAddress) {
                throw new Error('Could not retrieve address from the wallet provider. Ensure the wallet is connected and configured correctly.');
            }
            console.log(`Using account address: ${accountAddress}`);

            // Cast to any as base EvmWalletProvider doesn't guarantee this method
            const eipProvider = await (wallet as any).getEip1193Provider();
            if (!eipProvider) {
                throw new Error('Could not retrieve the EIP-1193 provider from the wallet provider.');
            }
            console.log('EIP-1193 provider retrieved.');
            // --- End Integration ---

            // Create Viem Public Client
            const publicClient = createPublicClient({
                chain: base,
                // Consider using a dedicated RPC URL from environment variables for production
                transport: http(process.env.BASE_RPC_URL || undefined),
            });
            console.log('Viem Public Client created.');

            // Create Viem Wallet Client using WalletProvider details
            const walletClient = createWalletClient({
                account: accountAddress,
                chain: base,
                transport: custom(eipProvider)
            });
            console.log('Viem Wallet Client created.');

            // Prepare parameters for the Zora SDK call
            const coinParams = {
                name: args.name,
                symbol: args.symbol,
                uri: args.uri,
                // Default to connected wallet address if not provided in args
                payoutRecipient: (args.payoutRecipient ?? accountAddress) as Address,
                platformReferrer: args.platformReferrer as Address | undefined,
                // Use optional value from schema, defaulting to 0n
                initialPurchaseWei: args.initialPurchaseWei ?? 0n,
            };
            console.log('Coin parameters prepared:', coinParams);

            // Call the actual Zora SDK function
            const result = await createZoraCoinSDK(coinParams, walletClient, publicClient);
            console.log('Zora SDK createCoin successful:', result);

            // Return success message
            return `Successfully created Zora coin '${args.name}'. Transaction hash: ${result.hash}, Coin address: ${result.address}`;

        } catch (error: any) {
            console.error(`Error creating Zora coin:`, error);
            // Return error message
            const message = error instanceof Error ? error.message : JSON.stringify(error);
            return `Error creating Zora coin: ${message || 'Unknown error'}`;
        }
    }

    // Indicate support for the network (optional, defaults might work)
    // This explicitly states it works for Base (id 8453)
    supportsNetwork = (network: Network) => network.chainId === base.id.toString();
}

// Export a function that creates an instance of the provider
export const zoraActionProvider = (): ZoraActionProvider => new ZoraActionProvider();
