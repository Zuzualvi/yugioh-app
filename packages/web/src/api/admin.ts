import { post } from "./client";

export function createInvite(): Promise<{ inviteCode: string; expiresAt: string }> {
  return post<{ inviteCode: string; expiresAt: string }>("/api/admin/invites");
}
