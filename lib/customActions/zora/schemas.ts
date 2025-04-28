import { z } from "zod";

/**
 * Input schema for ZoraAction's zora_action action.
 */
export const ZoraActionSchema = z
  .object({
    payload: z.string().describe("The payload to send to the action provider"),
  })
  .strip()
  .describe("Instructions for zora_action");
