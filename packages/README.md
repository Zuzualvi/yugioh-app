# packages/

Each directory here is an npm workspace package. All packages share the root
TypeScript config (`tsconfig.base.json`) and tooling (ESLint, Prettier,
Vitest, dependency-cruiser).

| Package     | Allowed deps      | Purpose                                        |
| ----------- | ----------------- | ---------------------------------------------- |
| `contracts` | external only     | Shared types + Zod schemas — the wire contract |
| `engine`    | contracts         | ocgcore adapter interface                      |
| `server`    | contracts, engine | WebSocket / HTTP backend                       |
| `web`       | contracts         | Vite + React frontend                          |

The dependency direction is enforced by `npm run arch:check`.
See `AGENTS.md` at the repo root for the full rulebook.
