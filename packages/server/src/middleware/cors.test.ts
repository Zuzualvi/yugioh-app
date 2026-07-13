import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { corsMiddleware, allowedOriginsFromEnv } from "./cors.js";

function buildApp(origins: string[]) {
  const app = express();
  app.use(corsMiddleware(origins));
  app.get("/test", (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return app;
}

describe("allowedOriginsFromEnv", () => {
  it("returns empty array when env var is unset", () => {
    delete process.env["CORS_ALLOWED_ORIGINS"];
    expect(allowedOriginsFromEnv()).toEqual([]);
  });

  it("parses comma-separated origins and trims whitespace", () => {
    process.env["CORS_ALLOWED_ORIGINS"] = " https://a.example.com , https://b.example.com ";
    expect(allowedOriginsFromEnv()).toEqual(["https://a.example.com", "https://b.example.com"]);
    delete process.env["CORS_ALLOWED_ORIGINS"];
  });

  it("drops empty entries", () => {
    process.env["CORS_ALLOWED_ORIGINS"] = "https://a.example.com,,";
    expect(allowedOriginsFromEnv()).toEqual(["https://a.example.com"]);
    delete process.env["CORS_ALLOWED_ORIGINS"];
  });
});

describe("corsMiddleware", () => {
  const ALLOWED = "https://app.example.com";
  const OTHER = "https://evil.example.com";

  it("sets CORS headers for an allowed origin", async () => {
    const app = buildApp([ALLOWED]);
    const res = await request(app).get("/test").set("Origin", ALLOWED);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
    expect(res.headers["vary"]).toContain("Origin");
    expect(res.headers["access-control-allow-methods"]).toBe("GET,POST,PUT,DELETE,OPTIONS");
    expect(res.headers["access-control-allow-headers"]).toBe("Content-Type");
    expect(res.headers["access-control-max-age"]).toBe("600");
  });

  it("echoes the exact allowed origin (not *)", async () => {
    const app = buildApp([ALLOWED]);
    const res = await request(app).get("/test").set("Origin", ALLOWED);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });

  it("sets NO CORS headers for a disallowed origin", async () => {
    const app = buildApp([ALLOWED]);
    const res = await request(app).get("/test").set("Origin", OTHER);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(res.headers["access-control-allow-methods"]).toBeUndefined();
    expect(res.headers["access-control-allow-headers"]).toBeUndefined();
  });

  it("responds 204 to OPTIONS preflight for an allowed origin", async () => {
    const app = buildApp([ALLOWED]);
    const res = await request(app).options("/test").set("Origin", ALLOWED);
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("responds 204 to OPTIONS even for a disallowed origin (no CORS headers)", async () => {
    const app = buildApp([ALLOWED]);
    const res = await request(app).options("/test").set("Origin", OTHER);
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("passes through requests with no Origin header untouched", async () => {
    const app = buildApp([ALLOWED]);
    const res = await request(app).get("/test");
    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
  });

  it("never emits Access-Control-Allow-Origin: *", async () => {
    // Even with empty allowlist
    const app = buildApp([]);
    const res = await request(app).get("/test").set("Origin", ALLOWED);
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
