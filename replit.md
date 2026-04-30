# Spacze AI Agent

A conversational IDE that lets users create, scaffold, debug, and run software projects through natural language. Built as a full-stack pnpm monorepo.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24 / **TypeScript**: 5.9
- **Frontend**: React + Vite (`artifacts/spacze`) served at `/`
- **API**: Express 5 (`artifacts/api-server`) served at `/api`
- **Database**: PostgreSQL 16 + Drizzle ORM
- **AI**: OpenAI-compatible API via OpenRouter (configurable)
- **Validation**: Zod, drizzle-zod
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec`)

## Features

1. **AI Chat** — Multi-turn conversations with streaming SSE responses
2. **Project Scaffolding** — Natural language → full project code generation (React, Next.js, Flask, Django, Express, etc.)
3. **IDE Workspace** — File tree, code editor, inline AI generate/debug/run panels
4. **Debugging** — Paste errors, get AI-powered root cause analysis and fixes
5. **Run Simulation** — AI-simulated terminal execution output for any generated project
6. **Image Generation** — AI image generation for icons and visual assets (requires direct OpenAI key)
7. **Dashboard** — Project stats, recent activity, quick-start CTAs

## Getting Started

### Prerequisites

- Node.js 24+
- pnpm
- Docker (for local PostgreSQL)

### Environment variables

| Variable | Description |
|---|---|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenRouter API key — get one free at [openrouter.ai/keys](https://openrouter.ai/keys) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | API base URL (default: `https://openrouter.ai/api/v1`) |
| `AI_CHAT_MODEL` | Model to use (default: `google/gemma-3-27b-it:free`) |
| `DATABASE_URL` | PostgreSQL connection string |

On Ona/Gitpod, set `AI_INTEGRATIONS_OPENAI_API_KEY` as an environment secret — it is injected automatically at startup.

### Running locally

```bash
pnpm install
# Start Postgres, API server, and frontend via Ona automations,
# or manually:
docker run --rm -e POSTGRES_USER=spacze -e POSTGRES_PASSWORD=spacze -e POSTGRES_DB=spacze -p 5432:5432 postgres:16-alpine
pnpm --filter @workspace/db push
pnpm --filter @workspace/api-server dev   # http://localhost:8080
pnpm --filter @workspace/spacze dev       # http://localhost:5173
```

## Key Commands

```bash
pnpm run typecheck                          # typecheck all packages
pnpm run build                              # typecheck + build all packages
pnpm --filter @workspace/api-spec codegen  # regenerate API hooks and Zod schemas
pnpm --filter @workspace/db push           # push DB schema (dev only)
pnpm --filter @workspace/api-server test   # run API server tests
```

## Database Schema

| Table | Purpose |
|---|---|
| `conversations` | AI chat threads |
| `messages` | Messages per conversation (user + assistant) |
| `projects` | AI-generated project scaffolds with status tracking |
| `project_files` | Individual code files per project |

## Routes

| Path | Description |
|---|---|
| `/` | Dashboard |
| `/chat` | Conversations list |
| `/chat/:id` | Chat thread with streaming AI |
| `/projects` | Projects list |
| `/projects/new` | New project creation + AI scaffolding |
| `/projects/:id` | Project workspace (file tree + editor + AI panel) |
