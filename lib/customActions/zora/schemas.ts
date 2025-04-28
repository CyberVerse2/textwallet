import { z } from 'zod';
import { isAddress, Address } from 'viem';

/**
 * Input schema for the Zora coin creation action.
 */
export const zoraCreateCoinSchema = z.object({
  // Parameters matching the refactored createMyCoin function
  name: z.string().describe("The name of the coin (e.g., 'My Awesome Coin')"),
  symbol: z.string().describe("The trading symbol for the coin (e.g., 'MAC')"),
  description: z.string().describe('A description for the coin. This is also required in the metadata JSON file at the URI.'),
  uri: z.string().url().describe('Required: URI of the JSON metadata file (e.g., IPFS or HTTPS). This file must contain name, description, and image fields.'),
  image: z.string().url().describe('Required: URI for the coin image (e.g., IPFS or HTTPS). Must match the image URI inside the metadata JSON file.'),
  payoutRecipient: z.string().refine(isAddress, { message: "Invalid payoutRecipient address"}).optional().describe('Address that receives creator earnings (defaults to connected wallet if omitted)'),
  platformReferrer: z.string().refine(isAddress, { message: "Invalid platformReferrer address"}).optional().describe('Optional platform referrer address'),
  initialPurchaseWei: z.bigint().optional().describe('Optional initial purchase amount in wei (defaults to 0 if not provided)'),
  // Made optional to align better with SDK intent
}).strict().describe('Input parameters for creating a Zora coin.');

// Define input type if needed elsewhere
export type ZoraCreateCoinInput = z.infer<typeof zoraCreateCoinSchema>;
