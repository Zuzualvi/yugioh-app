import react from "@vitejs/plugin-react";
import type { Connect, ViteDevServer } from "vite";
import { defineConfig } from "vite";

/**
 * Mock API middleware — stands in for the real Spec-10 backend during
 * development and Playwright testing.  The real server uses the same
 * endpoint shapes (Spec 13) so swapping is a proxy-config change only.
 */
function mockApiPlugin() {
  return {
    name: "mock-api",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(
        "/api",
        (
          req: Connect.IncomingMessage,
          res: import("http").ServerResponse,
          next: Connect.NextFunction,
        ) => {
          // Lazy-import so the mock module is never bundled into the client build.
          import("./src/mock/server.js")
            .then(({ handleRequest }) => {
              handleRequest(req, res).catch(() => next());
            })
            .catch(() => next());
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), mockApiPlugin()],
});
