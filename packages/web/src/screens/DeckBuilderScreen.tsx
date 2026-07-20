import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { searchCards } from "../api/cards";
import { createDeck, exportDeck, getDeck, importDeck, updateDeck } from "../api/decks";
import { CardInspector } from "../components/CardInspector";
import { CardTile } from "../components/CardTile";
import { maxCopies } from "../components/LegalityBadge";
import { useToast } from "../context/ToastContext";
import type {
  Banlist,
  CardDTO,
  CardSearchParams,
  DeckValidation,
  Violation,
} from "../types/contracts";

type FrameFilter = CardDTO["frame"] | "";
type BanlistFilter = Banlist | "";

// ─── Deck state helpers ───────────────────────────────────────────────────────

type Zone = "main" | "extra" | "side";

interface DeckState {
  name: string;
  main: number[];
  extra: number[];
  side: number[];
}

/** Count copies of a card across all zones, respecting aliasOf. */
function countCopies(
  passcode: number,
  main: number[],
  extra: number[],
  side: number[],
  cards: Map<number, CardDTO>,
): number {
  const card = cards.get(passcode);
  const basePasscode = card?.aliasOf ?? passcode;
  let count = 0;
  for (const p of [...main, ...extra, ...side]) {
    const c = cards.get(p);
    const base = c?.aliasOf ?? p;
    if (base === basePasscode) count++;
  }
  return count;
}

/** Compute live validity state from zone counts + cards. */
function computeValidity(
  main: number[],
  extra: number[],
  side: number[],
  cards: Map<number, CardDTO>,
): { legal: boolean; issues: string[] } {
  const issues: string[] = [];

  if (main.length < 40) issues.push(`Main: ${main.length} / 40–60`);
  else if (main.length > 60) issues.push(`Main: ${main.length} / max 60`);

  if (extra.length > 15) issues.push(`Extra: ${extra.length} / max 15`);
  if (side.length > 15) issues.push(`Side: ${side.length} / max 15`);

  // Copy counts
  const copyMap = new Map<number, number>();
  for (const p of [...main, ...extra, ...side]) {
    const c = cards.get(p);
    const base = c?.aliasOf ?? p;
    copyMap.set(base, (copyMap.get(base) ?? 0) + 1);
  }
  for (const [base, count] of copyMap) {
    const c = cards.get(base);
    if (!c) continue;
    const limit = maxCopies(c.banlist);
    if (count > limit) {
      issues.push(`${c.name}: ${count} copies (max ${limit})`);
    }
  }

  return { legal: issues.length === 0, issues };
}

// ─── Filters ─────────────────────────────────────────────────────────────────

const FRAME_OPTIONS = [
  { value: "", label: "All types" },
  { value: "normal", label: "Normal" },
  { value: "effect", label: "Effect" },
  { value: "ritual", label: "Ritual" },
  { value: "fusion", label: "Fusion" },
  { value: "synchro", label: "Synchro" },
  { value: "spell", label: "Spell" },
  { value: "trap", label: "Trap" },
];

const BANLIST_OPTIONS = [
  { value: "", label: "Any banlist" },
  { value: "forbidden", label: "Forbidden" },
  { value: "limited", label: "Limited" },
  { value: "semi", label: "Semi-Limited" },
  { value: "unlimited", label: "Unlimited" },
];

const ATTRIBUTE_OPTIONS = [
  { value: "", label: "Any attribute" },
  { value: "DARK", label: "DARK" },
  { value: "LIGHT", label: "LIGHT" },
  { value: "EARTH", label: "EARTH" },
  { value: "WATER", label: "WATER" },
  { value: "FIRE", label: "FIRE" },
  { value: "WIND", label: "WIND" },
  { value: "DIVINE", label: "DIVINE" },
];

// ─── Main component ───────────────────────────────────────────────────────────

export function DeckBuilderScreen() {
  const { id: deckId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const isNew = !deckId;

  // ── Deck state ────────────────────────────────────────────────────────────
  const [deck, setDeck] = useState<DeckState>({
    name: "New Deck",
    main: [],
    extra: [],
    side: [],
  });
  const [deckLoading, setDeckLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // ── Card catalog (cards we've seen) ──────────────────────────────────────
  const [cardCache, setCardCache] = useState<Map<number, CardDTO>>(new Map());

  const addToCache = useCallback((cards: CardDTO[]) => {
    setCardCache((prev) => {
      const next = new Map(prev);
      for (const c of cards) next.set(c.passcode, c);
      return next;
    });
  }, []);

  // ── Search & filter state ─────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFrame, setFilterFrame] = useState<FrameFilter>("");
  const [filterAttr, setFilterAttr] = useState("");
  const [filterBanlist, setFilterBanlist] = useState<BanlistFilter>("");
  const [filterText, setFilterText] = useState("");
  const [page, setPage] = useState(1);

  const [results, setResults] = useState<CardDTO[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Inspector ─────────────────────────────────────────────────────────────
  const [inspectCard, setInspectCard] = useState<CardDTO | null>(null);
  const [inspectIndex, setInspectIndex] = useState<number>(-1);

  // ── Import modal ──────────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState<{
    validation: DeckValidation;
    issues: Violation[];
  } | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // ── Mobile deck sheet ─────────────────────────────────────────────────────
  const [deckSheetOpen, setDeckSheetOpen] = useState(false);

  // ── Active zone for adding (only "side" requires explicit choice) ─────────
  const [addZone, setAddZone] = useState<Zone>("main");

  // ── hydrateDeckCards — fetch missing passcodes into cache ─────────────────
  const hydrateDeckCards = useCallback(
    async (passcodes: number[]) => {
      const unique = [...new Set(passcodes)];
      const missing = unique.filter((p) => !cardCache.has(p));
      if (missing.length === 0) return;
      const res = await searchCards({ passcodes: missing });
      addToCache(res.cards);
    },
    [cardCache, addToCache],
  );

  // ── Load existing deck ────────────────────────────────────────────────────
  useEffect(() => {
    if (isNew) return;
    setDeckLoading(true);
    getDeck(deckId!)
      .then((d) => {
        setDeck({ name: d.name, main: d.main, extra: d.extra, side: d.side });
        const allPasscodes = [...new Set([...d.main, ...d.extra, ...d.side])];
        if (allPasscodes.length === 0) return;
        return searchCards({ passcodes: allPasscodes }).then((res) => {
          addToCache(res.cards);
        });
      })
      .catch(() => addToast("Failed to load deck", "error"))
      .finally(() => setDeckLoading(false));
  }, [deckId, isNew, addToCache, addToast]);

  // ── Search ────────────────────────────────────────────────────────────────
  const doSearch = useCallback(
    async (params: CardSearchParams) => {
      setSearchLoading(true);
      try {
        const res = await searchCards(params);
        setResults(res.cards);
        setTotalResults(res.total);
        addToCache(res.cards);
      } catch {
        addToast("Search failed", "error");
      } finally {
        setSearchLoading(false);
      }
    },
    [addToCache, addToast],
  );

  // Trigger search when filters change (debounced for text fields)
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(
      () => {
        const params: CardSearchParams = {
          page,
          pageSize: 60,
          ...(searchQuery ? { q: searchQuery } : {}),
          ...(filterFrame ? { frame: filterFrame } : {}),
          ...(filterAttr ? { attribute: filterAttr } : {}),
          ...(filterBanlist ? { banlist: filterBanlist } : {}),
          ...(filterText ? { text: filterText } : {}),
        };
        void doSearch(params);
      },
      searchQuery || filterText ? 300 : 0,
    );
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchQuery, filterFrame, filterAttr, filterBanlist, filterText, page, doSearch]);

  // ── Validity (live, client-side) ──────────────────────────────────────────
  const validity = useMemo(
    () => computeValidity(deck.main, deck.extra, deck.side, cardCache),
    [deck.main, deck.extra, deck.side, cardCache],
  );

  // ── Add card ──────────────────────────────────────────────────────────────
  const addCard = useCallback(
    (card: CardDTO, zone?: Zone) => {
      const total = countCopies(card.passcode, deck.main, deck.extra, deck.side, cardCache);
      const max = maxCopies(card.banlist);
      if (total >= max) return; // silent enforcement

      const destZone = zone ?? (card.isExtraDeck ? "extra" : addZone);

      setDeck((prev) => ({
        ...prev,
        [destZone]: [...prev[destZone], card.passcode],
      }));
    },
    [deck, cardCache, addZone],
  );

  // ── Remove card ───────────────────────────────────────────────────────────
  const removeCard = useCallback((passcode: number, zone: Zone) => {
    setDeck((prev) => {
      const arr = prev[zone];
      const idx = arr.lastIndexOf(passcode);
      if (idx === -1) return prev;
      return {
        ...prev,
        [zone]: [...arr.slice(0, idx), ...arr.slice(idx + 1)],
      };
    });
  }, []);

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const body = { name: deck.name, main: deck.main, extra: deck.extra, side: deck.side };
      const saved = isNew ? await createDeck(body) : await updateDeck(deckId!, body);

      addToast(
        saved.validation.legal
          ? `"${deck.name}" saved (Edison-legal)`
          : `"${deck.name}" saved as invalid draft`,
        saved.validation.legal ? "success" : "info",
      );

      if (isNew) {
        navigate(`/builder/${saved.id}`, { replace: true });
      }
    } catch {
      addToast("Failed to save deck", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExport() {
    try {
      const ydkText = await exportDeck(deck.name, deck.main, deck.extra, deck.side);
      const blob = new Blob([ydkText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${deck.name.replace(/[^a-z0-9]/gi, "_")}.ydk`;
      a.click();
      URL.revokeObjectURL(url);
      addToast("Exported .ydk", "success");
    } catch {
      addToast("Export failed", "error");
    }
  }

  // ── Import ────────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!importText.trim()) return;
    setImportLoading(true);
    try {
      const result = await importDeck(importText);
      setDeck((prev) => ({
        ...prev,
        name: result.name ?? prev.name,
        main: result.main,
        extra: result.extra,
        side: result.side,
      }));
      setImportResult({
        validation: result.validation,
        issues: result.validation.violations,
      });
      const importedPasscodes = [...result.main, ...result.extra, ...result.side];
      await hydrateDeckCards(importedPasscodes);
      if (result.validation.violations.length === 0) {
        setShowImport(false);
        addToast("Deck imported successfully", "success");
      }
    } catch {
      addToast("Import failed", "error");
    } finally {
      setImportLoading(false);
    }
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    setShowImport(true);
    e.target.value = "";
  }

  // ── Inspector helpers ─────────────────────────────────────────────────────
  function openInspect(card: CardDTO, idx: number) {
    setInspectCard(card);
    setInspectIndex(idx);
  }

  function closeInspect() {
    setInspectCard(null);
    setInspectIndex(-1);
  }

  function inspectNext() {
    const next = (inspectIndex + 1) % results.length;
    const card = results[next];
    if (card) {
      setInspectCard(card);
      setInspectIndex(next);
    }
  }

  function inspectPrev() {
    const prev = (inspectIndex - 1 + results.length) % results.length;
    const card = results[prev];
    if (card) {
      setInspectCard(card);
      setInspectIndex(prev);
    }
  }

  // ── Computed deck stats ───────────────────────────────────────────────────
  const deckStats = useMemo(() => {
    let monsters = 0,
      spells = 0,
      traps = 0;
    for (const p of deck.main) {
      const c = cardCache.get(p);
      if (!c) continue;
      if (c.frame === "spell") spells++;
      else if (c.frame === "trap") traps++;
      else monsters++;
    }
    return { monsters, spells, traps };
  }, [deck.main, cardCache]);

  const pageSize = 60;
  const totalPages = Math.ceil(totalResults / pageSize);

  if (deckLoading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span className="loading-spinner" aria-label="Loading deck" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-0)",
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header
        style={{
          background: "var(--bg-1)",
          borderBottom: "1px solid var(--border)",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <Link
          to="/decks"
          className="btn btn-ghost btn-icon"
          style={{ textDecoration: "none", flexShrink: 0 }}
          aria-label="Back to My Decks"
        >
          ←
        </Link>

        {/* Deck name — inline edit */}
        <input
          type="text"
          value={deck.name}
          onChange={(e) => setDeck((prev) => ({ ...prev, name: e.target.value }))}
          aria-label="Deck name"
          style={{
            flex: 1,
            minWidth: 120,
            maxWidth: 240,
            fontWeight: 600,
            fontSize: "1rem",
            background: "var(--bg-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "6px 10px",
            color: "var(--text-0)",
          }}
        />

        {/* Validity chip */}
        <span
          className={`validity-chip ${validity.legal ? "valid" : validity.issues.length > 0 ? "invalid" : "warning"}`}
          aria-live="polite"
          aria-label={
            validity.legal ? "Deck is Edison-legal" : `Deck has ${validity.issues.length} issue(s)`
          }
          data-testid="validity-chip"
        >
          {validity.legal ? "✓ Legal" : `⚠ ${validity.issues[0] ?? "Invalid"}`}
        </span>

        <div style={{ display: "flex", gap: 6, marginLeft: "auto", flexWrap: "wrap" }}>
          {/* Import file picker */}
          <label
            className="btn btn-secondary"
            style={{ cursor: "pointer" }}
            aria-label="Import .ydk file"
          >
            Import .ydk
            <input
              type="file"
              accept=".ydk,text/plain"
              onChange={handleFileImport}
              style={{ display: "none" }}
              aria-hidden="true"
            />
          </label>

          <button
            className="btn btn-secondary"
            onClick={handleExport}
            disabled={deck.main.length + deck.extra.length + deck.side.length === 0}
          >
            Export .ydk
          </button>

          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? "Saving…" : "💾 Save"}
          </button>
        </div>
      </header>

      {/* ── Body: three-column on desktop, stacked on mobile ─────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* ── LEFT: Filters ─────────────────────────────────────────────── */}
        <aside
          style={{
            width: 180,
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            padding: "12px 12px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
          aria-label="Card filters"
          className="filters-sidebar"
        >
          <FilterSection label="Type">
            <select
              value={filterFrame}
              onChange={(e) => {
                setFilterFrame(e.target.value as FrameFilter);
                setPage(1);
              }}
              aria-label="Filter by card type"
              style={{ width: "100%", padding: "8px" }}
            >
              {FRAME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection label="Attribute">
            <select
              value={filterAttr}
              onChange={(e) => {
                setFilterAttr(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by attribute"
              style={{ width: "100%", padding: "8px" }}
            >
              {ATTRIBUTE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection label="Banlist">
            <select
              value={filterBanlist}
              onChange={(e) => {
                setFilterBanlist(e.target.value as BanlistFilter);
                setPage(1);
              }}
              aria-label="Filter by banlist status"
              style={{ width: "100%", padding: "8px" }}
            >
              {BANLIST_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </FilterSection>

          <FilterSection label="Effect text">
            <input
              type="search"
              value={filterText}
              onChange={(e) => {
                setFilterText(e.target.value);
                setPage(1);
              }}
              placeholder="Keywords…"
              aria-label="Search by effect text"
            />
          </FilterSection>

          {/* Add-to zone selector (only matters for non-monsters) */}
          <FilterSection label="Add to zone">
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(["main", "side"] as Zone[]).map((z) => (
                <label
                  key={z}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    minHeight: 44,
                    fontSize: "0.9375rem",
                  }}
                >
                  <input
                    type="radio"
                    name="addZone"
                    value={z}
                    checked={addZone === z}
                    onChange={() => setAddZone(z)}
                    style={{ width: "auto" }}
                  />
                  {z.charAt(0).toUpperCase() + z.slice(1)}
                </label>
              ))}
            </div>
          </FilterSection>

          {/* Deck stats */}
          <FilterSection label="Deck stats">
            <div style={{ fontSize: "0.8125rem", color: "var(--text-1)", lineHeight: 1.8 }}>
              <div>Monsters: {deckStats.monsters}</div>
              <div>Spells: {deckStats.spells}</div>
              <div>Traps: {deckStats.traps}</div>
            </div>
          </FilterSection>
        </aside>

        {/* ── CENTER: Search + Results ───────────────────────────────────── */}
        <main
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Search bar */}
          <div
            style={{
              padding: "10px 12px",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg-1)",
            }}
          >
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search cards by name…"
              aria-label="Search cards by name"
              data-testid="card-search"
              style={{ fontSize: "1rem" }}
            />
          </div>

          {/* Results */}
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            {searchLoading && (
              <div style={{ display: "flex", justifyContent: "center", padding: 32 }}>
                <span className="loading-spinner" aria-label="Searching" />
              </div>
            )}

            {!searchLoading && (
              <>
                <p
                  style={{
                    color: "var(--text-2)",
                    fontSize: "0.8125rem",
                    marginBottom: 10,
                  }}
                  aria-live="polite"
                >
                  {totalResults} cards
                  {totalPages > 1 && ` · Page ${page} of ${totalPages}`}
                </p>
                <div className="card-grid" data-testid="card-grid">
                  {results.map((card, idx) => {
                    const count = countCopies(
                      card.passcode,
                      deck.main,
                      deck.extra,
                      deck.side,
                      cardCache,
                    );
                    return (
                      <CardTile
                        key={card.passcode}
                        card={card}
                        copyCount={count}
                        onInspect={() => openInspect(card, idx)}
                        onAdd={() => addCard(card)}
                      />
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      justifyContent: "center",
                      padding: "16px 0",
                    }}
                  >
                    <button
                      className="btn btn-secondary"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      ← Prev
                    </button>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        fontSize: "0.9375rem",
                        color: "var(--text-1)",
                      }}
                    >
                      {page} / {totalPages}
                    </span>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </main>

        {/* ── RIGHT: Deck zones ──────────────────────────────────────────── */}
        <aside
          style={{
            width: 260,
            flexShrink: 0,
            borderLeft: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
          aria-label="Deck zones"
          className="deck-sidebar"
        >
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "10px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <DeckZone
              label="Main Deck"
              zone="main"
              passcodes={deck.main}
              cards={cardCache}
              min={40}
              max={60}
              onRemove={(p) => removeCard(p, "main")}
              onInspect={(card) => openInspect(card, results.indexOf(card))}
            />
            <DeckZone
              label="Extra Deck"
              zone="extra"
              passcodes={deck.extra}
              cards={cardCache}
              min={0}
              max={15}
              note="Fusion & Synchro only"
              onRemove={(p) => removeCard(p, "extra")}
              onInspect={(card) => openInspect(card, results.indexOf(card))}
            />
            <DeckZone
              label="Side Deck"
              zone="side"
              passcodes={deck.side}
              cards={cardCache}
              min={0}
              max={15}
              onRemove={(p) => removeCard(p, "side")}
              onInspect={(card) => openInspect(card, results.indexOf(card))}
            />

            {/* Violations from saved state */}
            {!validity.legal && validity.issues.length > 0 && (
              <div
                style={{
                  background: "rgba(224,82,82,0.08)",
                  border: "1px solid rgba(224,82,82,0.3)",
                  borderRadius: 8,
                  padding: 10,
                }}
                aria-live="polite"
                data-testid="validity-violations"
              >
                <p
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--invalid)",
                    marginBottom: 6,
                  }}
                >
                  Issues ({validity.issues.length})
                </p>
                <ul style={{ listStyle: "none", fontSize: "0.8125rem", color: "var(--text-1)" }}>
                  {validity.issues.map((issue, i) => (
                    <li key={i} style={{ padding: "2px 0" }}>
                      ⚠ {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Mobile bottom sheet toggle ─────────────────────────────────────── */}
      <div className="mobile-deck-toggle">
        <button
          className="btn btn-secondary"
          onClick={() => setDeckSheetOpen((v) => !v)}
          aria-expanded={deckSheetOpen}
          aria-controls="mobile-deck-sheet"
          style={{ width: "100%", borderRadius: 0, justifyContent: "space-between" }}
          data-testid="deck-sheet-toggle"
        >
          <span>{deckSheetOpen ? "▾" : "▴"} DECK</span>
          <span style={{ display: "flex", gap: 10, fontSize: "0.875rem" }}>
            <span>
              Main <strong data-testid="main-count">{deck.main.length}</strong>
              {deck.main.length < 40 ? " ⚠" : ""}
            </span>
            <span>
              Extra <strong data-testid="extra-count">{deck.extra.length}</strong>
            </span>
            <span>
              Side <strong data-testid="side-count">{deck.side.length}</strong>
            </span>
          </span>
        </button>

        {deckSheetOpen && (
          <div
            id="mobile-deck-sheet"
            style={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: "65dvh",
              background: "var(--bg-1)",
              borderTop: "1px solid var(--border)",
              overflowY: "auto",
              zIndex: 50,
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <DeckZone
              label="Main Deck"
              zone="main"
              passcodes={deck.main}
              cards={cardCache}
              min={40}
              max={60}
              onRemove={(p) => removeCard(p, "main")}
              onInspect={(card) => openInspect(card, results.indexOf(card))}
            />
            <DeckZone
              label="Extra Deck"
              zone="extra"
              passcodes={deck.extra}
              cards={cardCache}
              min={0}
              max={15}
              note="Fusion & Synchro only"
              onRemove={(p) => removeCard(p, "extra")}
              onInspect={(card) => openInspect(card, results.indexOf(card))}
            />
            <DeckZone
              label="Side Deck"
              zone="side"
              passcodes={deck.side}
              cards={cardCache}
              min={0}
              max={15}
              onRemove={(p) => removeCard(p, "side")}
              onInspect={(card) => openInspect(card, results.indexOf(card))}
            />
          </div>
        )}
      </div>

      {/* ── Card Inspector overlay ────────────────────────────────────────── */}
      {inspectCard && (
        <CardInspector
          card={inspectCard}
          onClose={closeInspect}
          onAdd={() => addCard(inspectCard)}
          onRemove={() => {
            const zone = deck.main.includes(inspectCard.passcode)
              ? "main"
              : deck.extra.includes(inspectCard.passcode)
                ? "extra"
                : "side";
            removeCard(inspectCard.passcode, zone);
          }}
          copyCount={countCopies(inspectCard.passcode, deck.main, deck.extra, deck.side, cardCache)}
          maxCopy={maxCopies(inspectCard.banlist)}
          onNext={results.length > 1 ? inspectNext : undefined}
          onPrev={results.length > 1 ? inspectPrev : undefined}
        />
      )}

      {/* ── Import modal ──────────────────────────────────────────────────── */}
      {showImport && (
        <ImportModal
          text={importText}
          onTextChange={setImportText}
          onImport={handleImport}
          onClose={() => {
            setShowImport(false);
            setImportText("");
            setImportResult(null);
          }}
          loading={importLoading}
          result={importResult}
        />
      )}
    </div>
  );
}

// ─── DeckZone component ───────────────────────────────────────────────────────

interface DeckZoneProps {
  label: string;
  zone: Zone;
  passcodes: number[];
  cards: Map<number, CardDTO>;
  min: number;
  max: number;
  note?: string;
  onRemove: (passcode: number) => void;
  onInspect: (card: CardDTO) => void;
}

function DeckZone({
  label,
  zone,
  passcodes,
  cards,
  min,
  max,
  note,
  onRemove,
  onInspect,
}: DeckZoneProps) {
  const count = passcodes.length;
  const isOk = count >= min && count <= max;
  const isEmpty = count === 0;

  // Count grouped by passcode
  const grouped = useMemo(() => {
    const map = new Map<number, { card: CardDTO | undefined; count: number }>();
    for (const p of passcodes) {
      if (map.has(p)) {
        map.get(p)!.count++;
      } else {
        map.set(p, { card: cards.get(p), count: 1 });
      }
    }
    return Array.from(map.entries());
  }, [passcodes, cards]);

  const chipClass = isEmpty
    ? "validity-chip warning"
    : !isOk
      ? "validity-chip invalid"
      : "validity-chip valid";

  return (
    <div>
      {/* Zone header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
          gap: 6,
        }}
      >
        <div>
          <span
            style={{
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: "var(--text-2)",
            }}
          >
            {label}
          </span>
          {note && (
            <span style={{ fontSize: "0.65rem", color: "var(--text-2)", marginLeft: 6 }}>
              ({note})
            </span>
          )}
        </div>
        <span
          className={chipClass}
          aria-live="polite"
          aria-label={`${label}: ${count} cards`}
          data-testid={`${zone}-count`}
        >
          {count} / {min === 0 ? `≤${max}` : `${min}–${max}`}
        </span>
      </div>

      {/* Card list */}
      {grouped.length === 0 ? (
        <p style={{ color: "var(--text-2)", fontSize: "0.8125rem", padding: "4px 0" }}>Empty</p>
      ) : (
        <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
          {grouped.map(([passcode, { card, count: cnt }]) => (
            <DeckCard
              key={passcode}
              passcode={passcode}
              card={card}
              count={cnt}
              onRemove={() => onRemove(passcode)}
              onInspect={() => card && onInspect(card)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── DeckCard row ─────────────────────────────────────────────────────────────

interface DeckCardProps {
  passcode: number;
  card: CardDTO | undefined;
  count: number;
  onRemove: () => void;
  onInspect: () => void;
}

function DeckCard({ passcode, card, count, onRemove, onInspect }: DeckCardProps) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 0",
        borderBottom: "1px solid var(--bg-2)",
      }}
    >
      {/* Name — tap to inspect */}
      <button
        onClick={onInspect}
        style={{
          flex: 1,
          textAlign: "left",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: card ? "var(--text-0)" : "var(--text-2)",
          fontSize: "0.8125rem",
          padding: "2px 0",
          minHeight: 36,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
        aria-label={`Inspect ${card?.name ?? passcode}`}
      >
        <span
          style={{
            background: "var(--bg-3)",
            color: "var(--text-1)",
            padding: "1px 5px",
            borderRadius: 4,
            fontSize: "0.6875rem",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          ×{count}
        </span>
        <span style={{ lineHeight: 1.3 }}>{card?.name ?? `#${passcode}`}</span>
      </button>

      {/* Remove button */}
      <button
        className="btn btn-ghost btn-icon"
        onClick={onRemove}
        aria-label={`Remove ${card?.name ?? passcode} from deck`}
        style={{ minWidth: 36, minHeight: 36, fontSize: "0.875rem", padding: "6px" }}
      >
        −
      </button>
    </li>
  );
}

// ─── FilterSection ────────────────────────────────────────────────────────────

function FilterSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="section-title" style={{ marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ─── Import modal ─────────────────────────────────────────────────────────────

interface ImportModalProps {
  text: string;
  onTextChange: (t: string) => void;
  onImport: () => void;
  onClose: () => void;
  loading: boolean;
  result: { validation: DeckValidation; issues: Violation[] } | null;
}

function ImportModal({ text, onTextChange, onImport, onClose, loading, result }: ImportModalProps) {
  return (
    <div
      className="overlay-backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Import .ydk file"
    >
      <div className="overlay-panel" style={{ maxWidth: 560 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>Import .ydk</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <p style={{ color: "var(--text-1)", fontSize: "0.9375rem", marginBottom: 12 }}>
          Paste your .ydk file contents or use the file picker in the header.
        </p>

        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={"#main\n89631139\n...\n#extra\n...\n!side\n..."}
          rows={10}
          style={{
            resize: "vertical",
            fontFamily: "var(--font-mono)",
            fontSize: "0.875rem",
            marginBottom: 12,
          }}
          aria-label="Paste .ydk file content here"
        />

        {/* Validation report */}
        {result && (
          <div style={{ marginBottom: 12 }} aria-live="assertive" data-testid="import-report">
            {result.issues.length === 0 ? (
              <p style={{ color: "var(--valid)", fontWeight: 600 }}>
                ✓ No issues found — deck is Edison-legal
              </p>
            ) : (
              <div>
                <p
                  style={{
                    color: "var(--invalid)",
                    fontWeight: 700,
                    marginBottom: 8,
                  }}
                >
                  ⚠ {result.issues.length} issue(s) found:
                </p>
                <ul
                  style={{
                    listStyle: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    maxHeight: 200,
                    overflowY: "auto",
                    background: "var(--bg-2)",
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  {result.issues.map((v, i) => (
                    <li key={i} style={{ fontSize: "0.8125rem", color: "var(--text-1)" }}>
                      {v.line && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            color: "var(--text-2)",
                            marginRight: 6,
                          }}
                        >
                          L{v.line}
                        </span>
                      )}
                      <span style={{ color: "var(--invalid)", marginRight: 4 }}>[{v.code}]</span>
                      {v.message}
                    </li>
                  ))}
                </ul>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-2)", marginTop: 8 }}>
                  The deck was loaded but is marked as invalid. Fix the issues then save.
                </p>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={onImport}
            disabled={!text.trim() || loading}
            aria-busy={loading}
          >
            {loading ? "Importing…" : "Import"}
          </button>
        </div>
      </div>
    </div>
  );
}
