/**
 * Tests for the global error-handling middleware (error-handler.ts).
 *
 * Two layers:
 *  1. Unit — invoke the middleware directly with mock req/res/next objects.
 *  2. Integration — fire real HTTP requests through the Express app via
 *     supertest, with DB and OpenAI mocked, to verify the middleware is wired
 *     correctly and that routes surface the right status codes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ZodError, ZodIssueCode } from "zod";
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middlewares/error-handler";

// ─── Layer 1: unit tests ──────────────────────────────────────────────────────

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return { method: "GET", url: "/test", ...overrides } as Request;
}

const noop: NextFunction = vi.fn();

describe("errorHandler middleware — unit", () => {
  it("returns 400 with structured issues for a ZodError", () => {
    const zodErr = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: "number",
        received: "string",
        path: ["id"],
        message: "Expected number, received string",
      },
    ]);

    const res = makeRes();
    errorHandler(zodErr, makeReq(), res, noop);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Validation failed",
      issues: [{ path: ["id"], message: "Expected number, received string" }],
    });
  });

  it("omits raw input values from the 400 response", () => {
    const zodErr = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: "string",
        received: "number",
        path: ["title"],
        message: "Expected string, received number",
      },
    ]);

    const res = makeRes();
    errorHandler(zodErr, makeReq(), res, noop);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // The response must not contain any 'received' or raw input details.
    expect(JSON.stringify(body)).not.toContain("received");
  });

  it("returns 500 with a generic message for a non-Zod error", () => {
    const res = makeRes();
    errorHandler(new Error("db connection refused"), makeReq(), res, noop);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  it("returns 500 for thrown strings", () => {
    const res = makeRes();
    errorHandler("something went wrong", makeReq(), res, noop);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });

  it("returns 500 for null/undefined errors", () => {
    const res = makeRes();
    errorHandler(null, makeReq(), res, noop);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("surfaces multiple Zod issues in a single response", () => {
    const zodErr = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: "string",
        received: "undefined",
        path: ["name"],
        message: "Required",
      },
      {
        code: ZodIssueCode.invalid_type,
        expected: "string",
        received: "undefined",
        path: ["framework"],
        message: "Required",
      },
    ]);

    const res = makeRes();
    errorHandler(zodErr, makeReq(), res, noop);

    const body = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(body.issues).toHaveLength(2);
    expect(body.issues[0].path).toEqual(["name"]);
    expect(body.issues[1].path).toEqual(["framework"]);
  });
});

// ─── Layer 2: HTTP integration via supertest ──────────────────────────────────
//
// We mock heavy dependencies so app.ts can be imported without a live DB or
// OpenAI key, then fire real HTTP requests to verify end-to-end wiring.

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

describe("errorHandler middleware — HTTP integration", () => {
  beforeEach(() => {
    process.env["CORS_ALLOWED_ORIGINS"] = "https://app.example.com";
  });

  afterEach(() => {
    delete process.env["CORS_ALLOWED_ORIGINS"];
    vi.resetModules();
  });

  async function getApp() {
    const { default: app } = await import("../app.js");
    return app;
  }

  it("returns 400 (not 500) when a route receives an invalid body", async () => {
    const { default: request } = await import("supertest");
    const app = await getApp();

    // POST /api/openai/conversations requires { title: string }.
    // Sending an empty body triggers ZodError inside the route handler.
    const res = await request(app)
      .post("/api/openai/conversations")
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Validation failed" });
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it("returns 400 when a numeric route param is not a valid number", async () => {
    const { default: request } = await import("supertest");
    const app = await getApp();

    const res = await request(app).get("/api/openai/conversations/not-a-number");

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Validation failed" });
  });

  it("does not leak stack traces or internal error details on 400", async () => {
    const { default: request } = await import("supertest");
    const app = await getApp();

    const res = await request(app)
      .post("/api/projects")
      .set("Content-Type", "application/json")
      .send({ name: 123 }); // name must be a string

    expect(res.status).toBe(400);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("stack");
    expect(body).not.toContain("at ");
  });
});
