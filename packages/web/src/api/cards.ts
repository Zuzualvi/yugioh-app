import type { CardDTO, CardSearch, CardListResponse } from "@yugioh-app/contracts";
import { get } from "./client";

export type { CardDTO, CardSearch, CardListResponse };

export function searchCards(params: Partial<CardSearch>): Promise<CardListResponse> {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== "" && val !== null) {
      qs.set(key, String(val));
    }
  }
  const query = qs.toString();
  return get<CardListResponse>(`/api/cards${query ? `?${query}` : ""}`);
}

export function getCard(passcode: number): Promise<CardDTO> {
  return get<CardDTO>(`/api/cards/${passcode}`);
}
