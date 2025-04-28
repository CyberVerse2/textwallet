import { z } from 'zod';
import { Address } from 'viem';

/**
 * Input schema for ZoraAction's zora_action action.
 */
export const ZoraActionSchema = z
  .object({
    payload: z.string().describe('The payload to send to the action provider'),
    name: z.string().describe("The name of the coin (e.g., 'My Awesome Coin')"),
    symbol: z.string().describe("The trading symbol for the coin (e.g., 'MAC')"),
    uri: z.string().describe('Metadata URI (an IPFS URI is recommended)'),
    owners: z
      .array(z.custom<Address>())
      .optional()
      .describe('Optional array of owner addresses, defaults to [payoutRecipient]'),
    tickLower: z
      .number()
      .optional()
      .describe('Optional tick lower for Uniswap V3 pool, defaults to -199200'),
    payoutRecipient: z.custom<Address>().describe('Address that receives creator earnings'),
    platformReferrer: z
      .custom<Address>()
      .optional()
      .describe('Optional platform referrer address, earns referral fees'),
    initialPurchaseWei: z.bigint().optional().describe('Optional initial purchase amount in wei')
  })
  .strip()
  .describe('Instructions for zora_action');
