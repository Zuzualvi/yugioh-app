import { z } from "zod";

// ---------------------------------------------------------------------------
// Card DTO — Spec 13 §1 (field names LOCKED)
// ---------------------------------------------------------------------------

export type Banlist = "forbidden" | "limited" | "semi" | "unlimited";

export interface CardDTO {
  passcode: number; // 8-digit; cards.cdb id / .ydk id
  name: string;
  frame: "normal" | "effect" | "ritual" | "fusion" | "synchro" | "spell" | "trap";
  isExtraDeck: boolean; // true iff Fusion or Synchro; Ritual is FALSE (Main)
  race: string; // monster type or spell/trap kind; "" if n/a
  attribute: string | null; // "DARK"… ; null for spell/trap
  level: number | null; // null for spell/trap
  atk: number | null;
  def: number | null;
  desc: string; // full card/effect text
  banlist: Banlist; // resolved from the Edison lflist
  aliasOf: number | null; // base passcode this counts as (alt-art/pre-errata), else null
  imageId: number; // passcode to use for the image file
}

// ---------------------------------------------------------------------------
// Card-catalog artifact — Spec 13 §2
// ---------------------------------------------------------------------------

export interface CardCatalog {
  format: "edison-2010-03";
  generatedAt: string; // ISO-8601
  count: number; // == cards.length; ~3681
  cards: CardDTO[]; // sorted ascending by passcode
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const BanlistSchema = z.enum(["forbidden", "limited", "semi", "unlimited"]);

export const CardDTOSchema = z.object({
  passcode: z.number().int().positive(),
  name: z.string(),
  frame: z.enum(["normal", "effect", "ritual", "fusion", "synchro", "spell", "trap"]),
  isExtraDeck: z.boolean(),
  race: z.string(),
  attribute: z.string().nullable(),
  level: z.number().int().nullable(),
  atk: z.number().int().nullable(),
  def: z.number().int().nullable(),
  desc: z.string(),
  banlist: BanlistSchema,
  aliasOf: z.number().int().nullable(),
  imageId: z.number().int().positive(),
});

export const CardCatalogSchema = z.object({
  format: z.literal("edison-2010-03"),
  generatedAt: z.string(),
  count: z.number().int().nonnegative(),
  cards: z.array(CardDTOSchema),
});

// ---------------------------------------------------------------------------
// Card search query params — Spec 13 §3
// ---------------------------------------------------------------------------

export const CardSearchSchema = z.object({
  q: z.string().optional(),
  frame: z.enum(["normal", "effect", "ritual", "fusion", "synchro", "spell", "trap"]).optional(),
  race: z.string().optional(),
  attribute: z.string().optional(),
  level: z.coerce.number().int().optional(),
  atkMin: z.coerce.number().int().optional(),
  atkMax: z.coerce.number().int().optional(),
  defMin: z.coerce.number().int().optional(),
  defMax: z.coerce.number().int().optional(),
  banlist: BanlistSchema.optional(),
  text: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(120).default(60),
  passcodes: z.preprocess((val) => {
    if (typeof val !== "string" || val.trim() === "") return undefined;
    return val.split(",").map((s) => Number(s.trim()));
  }, z.array(z.number().int().positive()).optional()),
});

export type CardSearch = z.infer<typeof CardSearchSchema>;

export const CardListResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  cards: z.array(CardDTOSchema),
});

export type CardListResponse = z.infer<typeof CardListResponseSchema>;
