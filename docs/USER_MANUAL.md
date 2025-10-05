# Conversation Renderer - User Manual

## Prerequisites
- Python 3.10+
- Node.js 20+ and npm

## Quick Start
1. Clone and enter the repo.
2. Backend TypeScript compile (ensures server sources are valid):
   - At repo root:
     - `npm ci`
     - `npm run build`
3. Web app build and preview:
   - `cd apps/web`
   - `npm ci`
   - `npm run build`
   - `npm run preview -- --port 5173`
   - Open `http://localhost:5173`.

## Python Toolkit (renderer/)
- Install dev dependencies: `pip install -r requirements-dev.txt`
- Run tests: `pytest`

## Backend API (Fastify)
- Dev server (from repo root): `npm run dev`
  - Default: `http://localhost:3333`

### REST Endpoints
- POST `/v1/sessions`
  - Body: `{ "role": "analyst" | "facilitator" | "planner" }` (optional; default `analyst`)
  - 201 Response: `{ id, role, createdAt }`

- POST `/v1/messages`
  - Body: `{ sessionId: string, content: string, metadata?: object }`
  - 200 Response: `{ diagram: { format, dsl, layout, confidence }, conflicts: string[], diff, systemPrompt }`

- GET `/v1/messages/stream` (WebSocket)
  - Send JSON: `{ sessionId, content }`
  - Receive events:
    - `{"type":"diagram.update","contract":{...},"diff":{...}}`
    - `{"type":"error","message":"..."}`

- POST `/v1/diagram/format`
  - Body: `{ sessionId: string, format: "mermaid" | "mindmap" }`
  - 200 Response: Diagram contract in requested format

- POST `/v1/export`
  - Body: `{ sessionId: string }`
  - 200 Response: `{ session, history, contract }`

## Web App (apps/web)
- Dev server: `npm run dev` (Vite)
- Build: `npm run build`
- Preview: `npm run preview -- --port 5173`

### UI Overview
- Chat Panel: enter instructions to generate/update diagrams.
- Preview Panel: renders Mermaid or Mindmap view and layout.
- History Panel: shows message history for the current session.
- Command Palette: quick actions and formatting.

## Typical Workflow
1. Create a session via API or use the web UI to start.
2. Submit a message describing steps/entities; the system extracts entities, infers diagram type, and generates a contract.
3. Iterate: send more messages to refine; conflicts and diffs are shown.
4. Optionally reformat (`/v1/diagram/format`) and export (`/v1/export`).

## Troubleshooting
- TypeScript build errors: run `npm run build` at repo root; fix any type errors reported under `services/api`.
- Large web bundle warning: safe to ignore for local usage; consider code splitting for production.
- Port conflicts: change `PORT` env for API or pass `--port` to preview.

## License
See `README.md`.
