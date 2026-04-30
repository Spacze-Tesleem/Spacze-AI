# AGENTS.md Improvement Spec

Audit of the repository's agent-facing documentation and tooling as of 2026-04-30.
Covers `AGENTS.md` (newly created), `.ona/automations.yaml`, `replit.md`, and the absence of any `.cursor/rules/` or `.ona/skills/` files.

---

## What's good

| Area | Detail |
|---|---|
| `replit.md` | Accurate stack overview, env-var table, route map, and DB schema. Good starting point for the new `AGENTS.md`. |
| `automations.yaml` | All three services have `ready` probes; `dbPush` correctly declares `dependsOn: [installDeps]`. |
| `pnpm-workspace.yaml` | `minimumReleaseAge: 1440` supply-chain guard is documented inline with a clear rationale. |
| API design | Single OpenAPI spec drives codegen for both Zod schemas and React hooks — one source of truth. |
| Error handling | Global error handler normalises Zod errors to `400` and never leaks stack traces; well-tested. |
| Test structure | Three test files cover CORS, error handling, and the `/run` SSE endpoint with both unit and HTTP-integration layers. |
| ESM consistency | All packages declare `"type": "module"` and use `.js` import extensions correctly. |

---

## What's missing

### 1. No `AGENTS.md` existed
There was no agent-facing guide. Agents had to infer conventions from `replit.md` (a Replit-specific file) and scattered `package.json` scripts. **Fixed** — `AGENTS.md` has been created.

### 2. No skill files
There are no `.ona/skills/` or `.cursor/rules/` files. Repetitive agent workflows (e.g. "add an endpoint", "change the DB schema", "run codegen") are not encoded anywhere reusable.

### 3. No frontend test setup
`@workspace/spacze` has no test runner configured. Non-trivial hooks and page logic (streaming SSE consumption, project workspace state machine) are untested.

### 4. `openapi.yaml` missing the `/projects/:id/run` endpoint
`POST /api/projects/:id/run` is implemented and tested but absent from `lib/api-spec/openapi.yaml`. The generated client and Zod schemas therefore have no `runProjectCode` hook or `RunProjectCodeBody` schema — agents adding frontend callers will not find them.

### 5. No lint / format enforcement
`prettier` is a dev dependency at the root but there is no `lint` script, no `.prettierrc`, and no pre-commit hook. Agents have no way to know the expected formatting and cannot auto-fix style issues.

### 6. `dev` script rebuilds on every start
`artifacts/api-server` `"dev"` script runs `pnpm run build && pnpm run start` — a full esbuild compile before each start. There is no watch mode. Agents iterating on the API will not get hot-reload and may not realise a rebuild is needed after each change.

### 7. No `CORS_ALLOWED_ORIGINS` guidance for local dev
The env-var table in `replit.md` omits `CORS_ALLOWED_ORIGINS`. Agents setting up a local frontend-to-API connection will hit CORS errors with no documented fix.

### 8. `scripts/post-merge.sh` is undocumented
The script exists and is referenced nowhere. Agents don't know when it runs or why.

### 9. No `updatedAt` trigger on DB writes
`projects.updatedAt` and `projectFiles.updatedAt` are set manually in route handlers (`updatedAt: new Date()`). There is no DB-level trigger or Drizzle hook. Agents adding new update paths will forget this and produce stale timestamps.

---

## What's wrong

### 1. `openapi.yaml` path ordering causes a routing conflict
`/projects/stats` is declared **after** `/projects/{id}` in the spec. Express registers routes in order, so `GET /api/projects/stats` is matched by the `/:id` handler first (with `id = "stats"`), which then fails Zod's `parseInt` validation and returns `400` instead of the stats payload. The spec ordering does not affect Express (routes are registered in source order in `projects.ts`), but it is misleading and will cause incorrect client codegen ordering.

### 2. `GenerateProjectCodeBody` marks `prompt` as required in the spec but optional in the route
`openapi.yaml` lists `prompt` under `required: [prompt]` for `GenerateProjectCodeBody`. The route handler uses `body.prompt || project.description` — treating it as optional. The generated Zod schema will reject requests that omit `prompt`, breaking the "regenerate with original description" flow.

### 3. `replit.md` is the de-facto agent doc but is Replit-specific
The file is named and structured for Replit's agent system. It will be ignored or misread by non-Replit agents. Now that `AGENTS.md` exists, `replit.md` should either be removed or reduced to a pointer.

### 4. `api-server` dev mode has no watch
As noted above — `"dev": "pnpm run build && pnpm run start"` does not watch for file changes. The automation service will start the server once and never restart it. Agents making API changes during a live session will silently be running stale code.

---

## Concrete improvement tasks

### P0 — Correctness

**T1: Fix `GenerateProjectCodeBody.prompt` in the OpenAPI spec**
- File: `lib/api-spec/openapi.yaml`
- Change: Remove `prompt` from the `required` array of `GenerateProjectCodeBody`.
- Then run `pnpm --filter @workspace/api-spec codegen` to regenerate schemas.

**T2: Add `POST /projects/:id/run` to the OpenAPI spec**
- File: `lib/api-spec/openapi.yaml`
- Add the path, `RunProjectCodeBody` schema (`entryFile?: string`), and SSE response.
- Add `RunProjectCodeParams` and `RunProjectCodeBody` to the components.
- Run codegen after.

**T3: Move `/projects/stats` before `/projects/{id}` in the spec**
- File: `lib/api-spec/openapi.yaml`
- Reorder so `GET /projects/stats` appears before `GET /projects/{id}` to match Express registration order and avoid misleading codegen.

### P1 — Developer experience

**T4: Add watch mode to the API server dev script**
- File: `artifacts/api-server/package.json`
- Replace `"dev": "pnpm run build && pnpm run start"` with a script that uses `esbuild --watch` + `node --watch` (or a tool like `tsx watch`) so the server restarts on file changes.
- Update `.ona/automations.yaml` `api-server.commands.start` accordingly.

**T5: Add Prettier config and a format script**
- File: root `package.json` + new `.prettierrc.json`
- Add `"format": "prettier --write ."` and `"format:check": "prettier --check ."` scripts.
- Document in `AGENTS.md` under "Code conventions".

**T6: Add `CORS_ALLOWED_ORIGINS` to the env-var table in `replit.md` and `AGENTS.md`**
- Already done in `AGENTS.md`. Mirror the fix in `replit.md`.

**T7: Document `scripts/post-merge.sh`**
- Add a comment block at the top of the script explaining it is a git post-merge hook.
- Add a one-liner to `AGENTS.md` under "Key commands".

### P2 — Test coverage

**T8: Add frontend test setup**
- Add Vitest (browser mode or jsdom) to `@workspace/spacze`.
- Write at least one test for the SSE streaming hook used in `chat-thread.tsx` and `project-workspace.tsx`.

**T9: Add route-level tests for `projects.ts` CRUD endpoints**
- The existing tests cover `/run`, CORS, and error handling.
- Missing: `POST /projects`, `GET /projects/:id`, `DELETE /projects/:id`, `PUT /projects/:id/files/:fileId`, `GET /projects/stats`.

### P3 — Maintenance

**T10: Reduce `replit.md` to a pointer**
- Once `AGENTS.md` is the canonical source, replace the body of `replit.md` with:
  ```
  See [AGENTS.md](./AGENTS.md) for the full agent guide.
  ```
- This prevents the two files from drifting out of sync.

**T11: Add a Drizzle `$onUpdate` hook for `updatedAt`**
- Files: `lib/db/src/schema/projects.ts`, `lib/db/src/schema/messages.ts`, `lib/db/src/schema/conversations.ts`
- Use Drizzle's `.$onUpdate(() => new Date())` column option so `updatedAt` is set automatically on every update, removing the manual `updatedAt: new Date()` calls scattered across route handlers.

---

## Priority order

| Priority | Task | Effort |
|---|---|---|
| P0 | T1 Fix `prompt` required/optional mismatch | 5 min |
| P0 | T2 Add `/run` to OpenAPI spec + codegen | 20 min |
| P0 | T3 Reorder `/stats` before `/{id}` in spec | 2 min |
| P1 | T4 API server watch mode | 30 min |
| P1 | T5 Prettier config + format scripts | 10 min |
| P1 | T6 CORS env var in `replit.md` | 2 min |
| P1 | T7 Document `post-merge.sh` | 5 min |
| P2 | T8 Frontend test setup | 2–4 h |
| P2 | T9 CRUD route tests | 1–2 h |
| P3 | T10 Reduce `replit.md` | 5 min |
| P3 | T11 Drizzle `$onUpdate` for `updatedAt` | 20 min |
