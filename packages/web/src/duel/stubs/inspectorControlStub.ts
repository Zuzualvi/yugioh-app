/**
 * W1 stub — InspectorControl (implemented by W3).
 *
 * No-ops. The board renders without a functioning inspector until W3 lands.
 *
 * DELETE this file and its import sites when the real W3 InspectorControl
 * lands on the integration branch.
 */
import type { InspectorControl } from "../contracts";

export const inspectorControlStub: InspectorControl = {
  inspectCard: () => {},
  inspectPile: () => {},
  close: () => {},
};
