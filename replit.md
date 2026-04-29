# Spacze AI Agent

## Overview

A full AI-powered development assistant — Spacze AI Agent is a conversational IDE that lets users create, scaffold, debug, and manage software projects through natural language. Built as a full-stack pnpm monorepo.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/spacze) at path "/"
- **API framework**: Express 5 (artifacts/api-server) at path "/api"
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (gpt-5.1, gpt-image-1)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

1. **AI Chat Agent** — Conversational AI coding assistant with streaming SSE responses, multi-turn conversations
2. **Project Scaffolding** — Natural language → full project code generation (React, Next.js, Flask, Django, Express, etc.)
3. **IDE Workspace** — File tree + code viewer + inline AI generation and debug panels
4. **Debugging** — Paste errors, get AI-powered root cause analysis and fixes (streaming)
5. **Asset Generation** — AI image generation for icons and visual assets
6. **Dashboard** — Project stats, recent activity, quick-start CTAs

## Database Schema

- `conversations` — AI chat threads
- `messages` — Messages in each conversation (user + assistant roles)
- `projects` — AI-generated project scaffolds with status tracking
- `project_files` — Individual code files per project with language detection

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Environment Variables

- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Replit AI Integrations proxy URL (auto-set)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Replit AI Integrations key (auto-set)
- `DATABASE_URL` — PostgreSQL connection string (auto-set)

## Routes

- `/` — Dashboard
- `/chat` — Conversations list
- `/chat/:id` — Chat thread with streaming AI
- `/projects` — Projects list
- `/projects/new` — New project creation + AI scaffolding
- `/projects/:id` — Project workspace (file tree + editor + AI panel)
