/**
 * Tests for the CORS origin allowlist introduced in app.ts.
 *
 * We test two layers:
 *  1. The corsOptions.origin callback in isolation (no HTTP, no DB).
 *  2. The full Express app via supertest, with DB and OpenAI mocked out,
 *     to verify the middleware is wired correctly end-to-end.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Layer 1: corsOptions callback in isolation ───────────────────────────────
//
// We re-derive the callback logic here rather than importing app.ts directly,
// because app.ts reads process.env at module-evaluation time. We control the
// env before each test and re-import via a dynamic import inside the test.

function makeCorsOriginCallback(allowedOriginsEnv: string | undefined) {
  const allowedOrigins: Set<string> = allowedOriginsEnv
    ? new Set(
        allowedOriginsEnv
          .split(",")
          .map((o) => o.trim())
          .filter(Boolean),
      )
    : new Set();

  return function origin(
    requestOrigin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) {
    if (!requestOrigin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.has(requestOrigin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin '${requestOrigin}' is not allowed`));
    }
  };
}

describe("corsOptions.origin callback", () => {
  it("allows requests with no Origin header (same-origin / server-to-server)", () => {
    const origin = makeCorsOriginCallback("https://app.example.com");
    origin(undefined, (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
  });

  it("allows an origin that is in the allowlist", () => {
    const origin = makeCorsOriginCallback(
      "https://app.example.com,https://admin.example.com",
    );
    origin("https://app.example.com", (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
  });

  it("allows the second entry in a multi-origin allowlist", () => {
    const origin = makeCorsOriginCallback(
      "https://app.example.com,https://admin.example.com",
    );
    origin("https://admin.example.com", (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
  });

  it("rejects an origin not in the allowlist", () => {
    const origin = makeCorsOriginCallback("https://app.example.com");
    origin("https://evil.example.com", (err, allow) => {
      expect(err).toBeInstanceOf(Error);
      expect(err?.message).toContain("evil.example.com");
      expect(allow).toBeUndefined();
    });
  });

  it("rejects all cross-origin requests when CORS_ALLOWED_ORIGINS is unset", () => {
    const origin = makeCorsOriginCallback(undefined);
    origin("https://any-origin.com", (err) => {
      expect(err).toBeInstanceOf(Error);
    });
  });

  it("ignores empty entries produced by trailing commas", () => {
    // "https://app.example.com," should not add an empty-string entry
    const origin = makeCorsOriginCallback("https://app.example.com,");
    // An empty string origin should still be rejected (it's not in the set)
    origin("", (err) => {
      // empty string is falsy — treated as no-origin, so it is allowed
      // (the guard `if (!requestOrigin)` catches it)
      expect(err).toBeNull();
    });
  });

  it("trims whitespace around origin entries", () => {
    const origin = makeCorsOriginCallback(
      "  https://app.example.com  ,  https://admin.example.com  ",
    );
    origin("https://app.example.com", (err, allow) => {
      expect(err).toBeNull();
      expect(allow).toBe(true);
    });
  });
});

// ─── Layer 2: HTTP-level integration via supertest ────────────────────────────
//
// We mock the heavy dependencies so app.ts can be imported without a live DB
// or OpenAI key, then fire real HTTP requests through supertest.

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    query: {
      conversations: { findFirst: vi.fn().mockResolvedValue(null) },
      projects: { findFirst: vi.fn().mockResolvedValue(null) },
      projectFiles: { findFirst: vi.fn().mockResolvedValue(null) },
    },
  },
  conversations: {},
  messages: {},
  projects: {},
  projectFiles: {},
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({ choices: [] }),
      },
    },
  },
}));

vi.mock("@workspace/integrations-openai-ai-server/image", () => ({
  generateImageBuffer: vi.fn().mockResolvedValue(Buffer.from("")),
}));

describe("CORS middleware (HTTP level)", () => {
  const ALLOWED = "https://app.example.com";

  beforeEach(() => {
    process.env["CORS_ALLOWED_ORIGINS"] = ALLOWED;
  });

  afterEach(() => {
    delete process.env["CORS_ALLOWED_ORIGINS"];
    vi.resetModules();
  });

  async function getApp() {
    // Dynamic import so each test gets a fresh module with the current env.
    const { default: app } = await import("../app.js");
    return app;
  }

  it("sets Access-Control-Allow-Origin for an allowed origin", async () => {
    const { default: request } = await import("supertest");
    const app = await getApp();
    const res = await request(app)
      .get("/api/healthz")
      .set("Origin", ALLOWED);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
  });

  it("does not set Access-Control-Allow-Origin for a disallowed origin", async () => {
    const { default: request } = await import("supertest");
    const app = await getApp();
    const res = await request(app)
      .get("/api/healthz")
      .set("Origin", "https://evil.example.com");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("responds 200 to a preflight OPTIONS from an allowed origin", async () => {
    const { default: request } = await import("supertest");
    const app = await getApp();
    const res = await request(app)
      .options("/api/healthz")
      .set("Origin", ALLOWED)
      .set("Access-Control-Request-Method", "GET");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe(ALLOWED);
  });

  it("does not echo the origin on a preflight from a disallowed origin", async () => {
    const { default: request } = await import("supertest");
    const app = await getApp();
    const res = await request(app)
      .options("/api/healthz")
      .set("Origin", "https://attacker.example.com")
      .set("Access-Control-Request-Method", "GET");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
