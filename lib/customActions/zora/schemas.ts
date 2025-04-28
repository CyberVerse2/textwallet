import { z } from 'zod';
import { isAddress, Address } from 'viem';

/**
 * Input schema for the Zora coin creation action.
 */
export const ZoraActionSchema = z.object({
  // Parameters matching the refactored createMyCoin function
  name: z.string().describe("The name of the coin (e.g., 'My Awesome Coin')"),
  symbol: z.string().describe("The trading symbol for the coin (e.g., 'MAC')"),
  uri: z.string().describe('Metadata URI (an IPFS URI is recommended)'),
  payoutRecipient: z.string().refine(isAddress, { message: "Invalid payoutRecipient address"}).describe('Address that receives creator earnings'),
  platformReferrer: z.string().refine(isAddress, { message: "Invalid platformReferrer address"}).optional().describe('Optional platform referrer address'),
  initialPurchaseWei: z.bigint().describe('Initial purchase amount in wei (use 0n for no initial purchase)'), 
  // Added default description for bigint as it's required now by createMyCoin
}).strict().describe('Input parameters for creating a Zora coin.');

// Define input type if needed elsewhere
export type ZoraActionInput = z.infer<typeof ZoraActionSchema>;
