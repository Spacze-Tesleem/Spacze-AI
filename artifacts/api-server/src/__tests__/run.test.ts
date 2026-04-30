/**
 * Tests for POST /api/projects/:id/run
 *
 * Covers:
 *  - 404 when the project does not exist
 *  - 422 when the project has no files
 *  - 400 when the route param is not a valid number (Zod validation)
 *  - Successful SSE stream: correct headers, streamed content, and done event
 *  - Optional entryFile forwarded without error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Shared mock state ────────────────────────────────────────────────────────
// Tests mutate these to simulate different DB states.

const mockProject = {
  id: 1,
  name: "Test App",
  description: "A test project",
  framework: "express",
  status: "ready",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFiles = [
  {
    id: 10,
    projectId: 1,
    path: "src/index.ts",
    content: 'import express from "express";\nconst app = express();\napp.listen(3000);',
    language: "typescript",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Mutable references so individual tests can override them.
let projectResult: typeof mockProject | null = mockProject;
let filesResult: typeof mockFiles = mockFiles;

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockImplementation(() => Promise.resolve(filesResult)),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    query: {
      conversations: { findFirst: vi.fn().mockResolvedValue(null) },
      projects: {
        findFirst: vi.fn().mockImplementation(() => Promise.resolve(projectResult)),
      },
      projectFiles: { findFirst: vi.fn().mockResolvedValue(null) },
    },
  },
  conversations: {},
  messages: {},
  projects: {},
  projectFiles: {},
}));

// Simulate a streaming response: two content chunks then done.
const mockStreamChunks = [
  { choices: [{ delta: { content: "> node src/index.ts\n" } }] },
  { choices: [{ delta: { content: "Server listening on port 3000\n" } }] },
];

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async () => mockStreamChunks),
      },
    },
  },
}));

vi.mock("@workspace/integrations-openai-ai-server/image", () => ({
  generateImageBuffer: vi.fn().mockResolvedValue(Buffer.from("")),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getApp() {
  const { default: app } = await import("../app.js");
  return app;
}

/** Collect all SSE events from a supertest response into an array of parsed objects. */
function parseSSEBody(text: string): Array<Record<string, unknown>> {
  return text
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice(6).trim()));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/projects/:id/run", () => {
  beforeEach(() => {
    process.env["CORS_ALLOWED_ORIGINS"] = "https://app.example.com";
    projectResult = mockProject;
    filesResult = mockFiles;
  });

  afterEach(() => {
    delete process.env["CORS_ALLOWED_ORIGINS"];
    vi.resetModules();
  });

  it("returns 404 when the project does not exist", async () => {
    projectResult = null;
    const { default: request } = await import("supertest");
    const app = await getApp();

    const res = await request(app).post("/api/projects/999/run").send({});

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: "Project not found" });
  });

  it("returns 422 when the project has no files", async () => {
    filesResult = [];
    const { default: request } = await import("supertest");
    const app = await getApp();

    const res = await request(app).post("/api/projects/1/run").send({});

    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ error: "Project has no files to run" });
  });

  it("returns 400 when the route param is not a valid number", async () => {
    const { default: request } = await import("supertest");
    const app = await getApp();

    const res = await request(app).post("/api/projects/not-a-number/run").send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Validation failed" });
  });

  it("streams text/event-stream with content chunks and a done event", async () => {
    const { default: request } = await import("supertest");
    const app = await getApp();

    const res = await request(app)
      .post("/api/projects/1/run")
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);

    const events = parseSSEBody(res.text);

    // At least one content event
    const contentEvents = events.filter((e) => typeof e.content === "string");
    expect(contentEvents.length).toBeGreaterThan(0);

    // Last event must be { done: true }
    const lastEvent = events[events.length - 1];
    expect(lastEvent).toMatchObject({ done: true });
  });

  it("includes the project name in the first streamed line", async () => {
    const { default: request } = await import("supertest");
    const app = await getApp();

    const res = await request(app).post("/api/projects/1/run").send({});

    const events = parseSSEBody(res.text);
    const firstContent = events.find((e) => typeof e.content === "string")?.content as string;
    expect(firstContent).toContain(mockProject.name);
  });

  it("accepts an optional entryFile without error", async () => {
    const { default: request } = await import("supertest");
    const app = await getApp();

    const res = await request(app)
      .post("/api/projects/1/run")
      .set("Content-Type", "application/json")
      .send({ entryFile: "src/index.ts" });

    expect(res.status).toBe(200);
    const events = parseSSEBody(res.text);
    expect(events.some((e) => e.done === true)).toBe(true);
  });

  it("rejects an unknown body field without crashing (extra fields are stripped)", async () => {
    const { default: request } = await import("supertest");
    const app = await getApp();

    // Zod strips unknown keys by default; the request should still succeed
    const res = await request(app)
      .post("/api/projects/1/run")
      .set("Content-Type", "application/json")
      .send({ entryFile: "src/index.ts", unknownField: "ignored" });

    expect(res.status).toBe(200);
  });
});
