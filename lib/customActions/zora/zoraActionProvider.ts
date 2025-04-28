import { ActionProvider, CreateAction, EvmWalletProvider, Network } from "@coinbase/agentkit";
import { z } from 'zod';
import { Address, createPublicClient, createWalletClient, custom, http, Hex, TransactionRequest } from 'viem';
import { base } from 'viem/chains';
import { createCoin as createZoraCoinSDK, validateMetadataJSON } from "@zoralabs/coins-sdk"; // Renamed import for clarity
import { zoraCreateCoinSchema } from './schemas'; // Import schema
import type { ZoraCreateCoinInput } from './schemas'; // Import type separately

// --- Helper: EIP-1193 Shim for AgentKit Wallet --- 
const createEip1193ProviderShim = (agentKitWallet: EvmWalletProvider) => {
    return {
        // Implement the EIP-1193 request method
        async request({ method, params }: { method: string; params?: any[] }): Promise<any> {
            console.log(`Shim: Received request: method=${method}, params=${JSON.stringify(params)}`);
            const accountAddress = await agentKitWallet.getAddress();
            if (!accountAddress) {
                throw new Error("Shim: Could not get account address from AgentKit wallet.");
            }

            switch (method) {
                case 'eth_requestAccounts':
                case 'eth_accounts':
                    return [accountAddress];

                case 'eth_chainId':
                    // TODO: Reliably get chainId from agentKitWallet if possible
                    const chainIdHex = `0x${base.id.toString(16)}`;
                    console.log(`Shim: Returning chainId: ${chainIdHex} (${base.id})`);
                    return chainIdHex;

                case 'personal_sign':
                    if (!params || params.length < 2 || typeof params[0] !== 'string' || typeof params[1] !== 'string') {
                        throw new Error('Shim: Invalid parameters for personal_sign');
                    }
                    const messageToSign = params[0]; // Viem passes [hexMessage, address]
                    console.log(`Shim: Calling agentKitWallet.signMessage for personal_sign`);
                    // Assuming agentKitWallet.signMessage expects the raw message string or hex
                    return await agentKitWallet.signMessage(messageToSign);

                case 'eth_signTypedData_v4':
                     if (!params || params.length < 2 || typeof params[1] !== 'string') {
                        throw new Error('Shim: Invalid parameters for eth_signTypedData_v4');
                    }
                    // Viem passes [address, typedDataJsonString]
                    const typedData = JSON.parse(params[1]);
                    console.log(`Shim: Calling agentKitWallet.signTypedData`);
                    // Assuming agentKitWallet.signTypedData takes the structured object
                    return await agentKitWallet.signTypedData(typedData);

                case 'eth_sendTransaction':
                    if (!params || params.length < 1 || typeof params[0] !== 'object') {
                        throw new Error('Shim: Invalid parameters for eth_sendTransaction');
                    }
                    const tx = params[0] as TransactionRequest;
                    // Ensure `from` matches the wallet's address or add it if missing
                    tx.from = accountAddress as Address;
                    console.log(`Shim: Calling agentKitWallet.sendTransaction with tx:`, tx);
                    // Assuming agentKitWallet.sendTransaction takes a Viem-compatible TransactionRequest
                    return await agentKitWallet.sendTransaction(tx);

                default:
                    console.warn(`Shim: Unsupported EIP-1193 method: ${method}`);
                    throw new Error(`Unsupported EIP-1193 method: ${method}`);
            }
        }
    };
};
// --- End Helper ---

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
        description: "Creates a new Zora coin based on provided parameters (name, symbol, description, uri, image, payoutRecipient, platformReferrer, initialPurchaseWei). Returns a success message with transaction hash and coin address, or an error message.",
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

            // Create the EIP-1193 shim
            const eipProviderShim = createEip1193ProviderShim(wallet);
            console.log('EIP-1193 provider shim created.');
            // --- End Integration ---

            // Create Viem Public Client
            const publicClient = createPublicClient({
                chain: base,
                // Consider using a dedicated RPC URL from environment variables for production
                transport: http(process.env.BASE_RPC_URL || undefined),
            });
            console.log('Viem Public Client created.');

            // Create Viem Wallet Client using the SHIM via custom transport
            const walletClient = createWalletClient({
                account: accountAddress,
                chain: base,
                transport: custom(eipProviderShim) // Use the shim here
            });
            console.log('Viem Wallet Client created using shim.');

            // Prepare parameters for the Zora SDK call
            const coinParams = {
              name: args.name,
              symbol: args.symbol,
              // Pass the metadata JSON URI to the SDK
              uri: args.uri,
              // Default to connected wallet address if not provided in args
              payoutRecipient: (args.payoutRecipient ?? accountAddress) as Address,
              platformReferrer: args.platformReferrer as Address | undefined,
              //   Use optional value from schema, defaulting to 0n
              initialPurchaseWei: args.initialPurchaseWei ?? 0n
            };
            console.log('Coin parameters prepared:', coinParams);

            // Call the actual Zora SDK function
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
    }
}

// Export a function that creates an instance of the provider
export const zoraActionProvider = (): ZoraActionProvider => new ZoraActionProvider();
