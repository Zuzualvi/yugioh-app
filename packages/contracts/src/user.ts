import { z } from "zod";

// ---------------------------------------------------------------------------
// User — Spec 13 §3 (field names LOCKED)
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  displayName: string;
  role: "admin" | "member";
}

export const UserSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  role: z.enum(["admin", "member"]),
});

// ---------------------------------------------------------------------------
// Auth request/response schemas
// ---------------------------------------------------------------------------

export const RedeemInviteBodySchema = z.object({
  inviteCode: z.string().min(1),
  displayName: z.string().min(1).max(64),
  password: z.string().min(8),
});

export type RedeemInviteBody = z.infer<typeof RedeemInviteBodySchema>;

export const LoginBodySchema = z.object({
  displayName: z.string().min(1),
  password: z.string().min(1),
});

export type LoginBody = z.infer<typeof LoginBodySchema>;
