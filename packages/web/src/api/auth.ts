import type { User } from "@yugioh-app/contracts";
import { del, get, post } from "./client";

export function login(displayName: string, password: string): Promise<{ user: User }> {
  return post<{ user: User }>("/api/auth/login", { displayName, password });
}

export function redeemInvite(
  inviteCode: string,
  displayName: string,
  password: string,
): Promise<{ user: User }> {
  return post<{ user: User }>("/api/auth/redeem-invite", {
    inviteCode,
    displayName,
    password,
  });
}

export function logout(): Promise<void> {
  return del<void>("/api/auth/logout");
}

export function getMe(): Promise<{ user: User }> {
  return get<{ user: User }>("/api/me");
}
