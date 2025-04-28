import { customActionProvider, EvmWalletProvider } from "@coinbase/agentkit";
import { ZoraActionSchema } from "./schemas";
import { z } from "zod";

/**
 * Creates a ZoraActionProvider action provider.
 * To create multiple actions, pass in an array of actions to createActionProvider.
 */
export const zoraActionProvider = () =>
  customActionProvider<EvmWalletProvider>({
    name: "zora_action",
    description: `This tool will perform a ZoraActionProvider operation.`,
    schema: ZoraActionSchema,
    invoke: async (wallet: EvmWalletProvider, args: z.infer<typeof ZoraActionSchema>) => {
      try {
        // Do work here
        return `Successfully performed zora_action and returned the response`;
      } catch (error) {
          return `Error performing zora_action: Error: ${error}`;
        }
      },
  });
