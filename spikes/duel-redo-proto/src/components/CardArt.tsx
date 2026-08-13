import { useEffect, useState } from "react";

const BASE = "https://api.zuhayr.io/images";

/**
 * Card art. Public static JPEGs, no auth, no backend delta.
 *
 * Two things this must get right, both of which have bitten before:
 *  - an unknown passcode returns a JSON 404 BODY, not an image, so HTTP 200 is
 *    not proof a JPEG arrived. `onError` on the <img> is the real test, because
 *    the decoder is what rejects a JSON body.
 *  - the load deadline is BOUNDED. An unbounded placeholder is its own failure:
 *    a request that never resolves leaves a permanent grey rectangle where a card
 *    should be. At the deadline the tile falls back to the text identity, which
 *    was never dependent on the image in the first place.
 */
export function CardArt({
  code,
  className,
  deadlineMs = 4000,
  broken = false,
}: {
  code: number;
  className?: string;
  deadlineMs?: number;
  broken?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");

  useEffect(() => {
    setState("loading");
    if (!code || broken) {
      setState("failed");
      return;
    }
    const t = window.setTimeout(() => setState((s) => (s === "loading" ? "failed" : s)), deadlineMs);
    return () => window.clearTimeout(t);
  }, [code, deadlineMs, broken]);

  if (!code || broken || state === "failed") return null;
  return (
    <img
      className={`cardart ${state === "ok" ? "ok" : "loading"} ${className ?? ""}`}
      src={`${BASE}/${code}.jpg`}
      alt=""
      aria-hidden="true"
      onLoad={() => setState("ok")}
      onError={() => setState("failed")}
    />
  );
}
