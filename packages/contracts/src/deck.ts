import { z } from "zod";

// ---------------------------------------------------------------------------
// Deck types — Spec 13 §3 (field names LOCKED)
// ---------------------------------------------------------------------------

export interface Violation {
  code: string; // from the fixed set below
  message: string;
  passcode?: number;
  zone?: "main" | "extra" | "side";
  line?: number;
}

/** Fixed violation code set — Spec 13 §3 */
export type ViolationCode =
  | "main_size"
  | "extra_size"
  | "side_size"
  | "copy_limit"
  | "banlist_forbidden"
  | "banlist_limit"
  | "out_of_pool"
  | "wrong_zone"
  | "unknown_passcode"
  | "parse_error";

export interface DeckValidation {
  legal: boolean;
  counts: { main: number; extra: number; side: number };
  violations: Violation[]; // empty iff legal
}

export interface DeckSummary {
  id: string;
  name: string;
  isValid: boolean;
  counts: { main: number; extra: number; side: number };
  updatedAt: string;
}

export interface Deck {
  id: string;
  name: string;
  ownerId: string;
  main: number[];
  extra: number[];
  side: number[];
  validation: DeckValidation;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const ViolationSchema = z.object({
  code: z.string(),
  message: z.string(),
  passcode: z.number().int().positive().optional(),
  zone: z.enum(["main", "extra", "side"]).optional(),
  line: z.number().int().nonnegative().optional(),
});

export const DeckValidationSchema = z.object({
  legal: z.boolean(),
  counts: z.object({
    main: z.number().int().nonnegative(),
    extra: z.number().int().nonnegative(),
    side: z.number().int().nonnegative(),
  }),
  violations: z.array(ViolationSchema),
});

export const DeckSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  isValid: z.boolean(),
  counts: z.object({
    main: z.number().int().nonnegative(),
    extra: z.number().int().nonnegative(),
    side: z.number().int().nonnegative(),
  }),
  updatedAt: z.string(),
});

export const DeckSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  main: z.array(z.number().int().positive()),
  extra: z.array(z.number().int().positive()),
  side: z.array(z.number().int().positive()),
  validation: DeckValidationSchema,
  updatedAt: z.string(),
});

export const DeckBodySchema = z.object({
  name: z.string().min(1).max(128),
  main: z.array(z.number().int().positive()),
  extra: z.array(z.number().int().positive()),
  side: z.array(z.number().int().positive()),
});

export type DeckBody = z.infer<typeof DeckBodySchema>;

export const DeckExportBodySchema = z.object({
  name: z.string().max(128).optional(),
  main: z.array(z.number().int().positive()),
  extra: z.array(z.number().int().positive()),
  side: z.array(z.number().int().positive()),
});

export type DeckExportBody = z.infer<typeof DeckExportBodySchema>;

export const DeckImportResultSchema = z.object({
  name: z.string(),
  main: z.array(z.number().int().positive()),
  extra: z.array(z.number().int().positive()),
  side: z.array(z.number().int().positive()),
  validation: DeckValidationSchema,
});

export type DeckImportResult = z.infer<typeof DeckImportResultSchema>;
