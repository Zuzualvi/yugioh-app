import type { Deck, DeckBody, DeckImportResult, DeckSummary } from "@yugioh-app/contracts";
import { del, get, post, put } from "./client";

export function listDecks(): Promise<{ decks: DeckSummary[] }> {
  return get<{ decks: DeckSummary[] }>("/api/decks");
}

export function createDeck(body: DeckBody): Promise<Deck> {
  return post<Deck>("/api/decks", body);
}

export function getDeck(id: string): Promise<Deck> {
  return get<Deck>(`/api/decks/${id}`);
}

export function updateDeck(id: string, body: DeckBody): Promise<Deck> {
  return put<Deck>(`/api/decks/${id}`, body);
}

export function deleteDeck(id: string): Promise<void> {
  return del<void>(`/api/decks/${id}`);
}

export function duplicateDeck(id: string): Promise<Deck> {
  return post<Deck>(`/api/decks/${id}/duplicate`);
}

export function importDeck(ydkText: string): Promise<DeckImportResult> {
  return post<DeckImportResult>("/api/decks/import", ydkText, "text/plain");
}

export function exportDeck(
  name: string | undefined,
  main: number[],
  extra: number[],
  side: number[],
): Promise<string> {
  return post<string>("/api/decks/export", { name, main, extra, side });
}
