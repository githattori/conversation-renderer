# Implementation Plan for Persistence, Collaborative Editing, Export, Quality Inspection, and Testing

## 1. Persistence Layer for Sessions and Graph Versions

### Goals
- Persist collaborative session metadata, participants, and active document versions.
- Maintain historical versions of graph documents in the `graph_vN` format with lineage tracking.

### Proposed Stack
- **Primary Database:** PostgreSQL (supports JSONB, strong consistency, and SQL tooling).
- **Caching & Session Coordination:** Redis for ephemeral session state, pub/sub notifications, and rate limiting.

### Schema Overview
| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `workspaces` | Logical grouping of graphs/projects. | `id`, `name`, `created_at` |
| `graphs` | Current graph metadata. | `id`, `workspace_id`, `slug`, `title`, `created_at`, `updated_at` |
| `graph_versions` | Immutable snapshots (`graph_vN`). | `id`, `graph_id`, `version`, `payload (JSONB)`, `created_by`, `created_at`, `hash` |
| `sessions` | Collaborative editing sessions. | `id`, `graph_id`, `status`, `started_at`, `ended_at` |
| `session_participants` | Session membership & presence. | `id`, `session_id`, `user_id`, `joined_at`, `left_at` |
| `operations` | Audit log of OT operations. | `id`, `session_id`, `client_id`, `sequence`, `operation (JSONB)`, `applied_at` |

### Versioning Strategy
- Use monotonic version integers `graph_vN` aligned with `graph_versions.version`.
- On commit, flush queued OT operations to construct a new canonical graph state stored in JSONB.
- Retain `hash` for version integrity and export reproducibility checks.

### Redis Usage
- Store active session descriptors keyed by `session:{session_id}` with TTL.
- Maintain per-session operation queues and broadcast channels.
- Mirror presence state for latency-sensitive reads while persisting deltas to Postgres.

### Migration & Tooling
- Define migrations using `sqlx` (Rust) or `Prisma` (TypeScript) depending on backend implementation.
- Seed scripts to bootstrap demo data.

## 2. OT-Based Collaborative Editing Engine over WebSocket

### Architecture
- WebSocket gateway (Node.js/TypeScript with `ws` or Fastify, or Rust with `axum` + `tokio-tungstenite`).
- Operational Transformation (OT) core handling graph-specific operations:
  - `AddNode`, `UpdateNode`, `DeleteNode`
  - `AddEdge`, `UpdateEdge`, `DeleteEdge`
  - `UpdateLabel`, `UpdateMetadata`

### Protocol
- Clients connect with session token -> authenticate via Redis session state.
- Messages:
  - `join`, `leave`
  - `operation` (contains `clientId`, `seq`, `baseVersion`, `ops[]`)
  - `ack`, `error`, `presence`, `heartbeat`
- Server maintains per-session document state and transformation pipeline:
  1. Validate operation preconditions (exists, no conflicts).
  2. Transform against concurrent operations using OT.
  3. Apply to in-memory state, append to Redis queue, persist to `operations` table.
  4. Broadcast transformed op to all clients (excluding sender).

### Conflict Handling
- Use revision numbers from `graph_versions` as base version.
- Maintain per-client sequence numbers to avoid duplicate processing.
- On divergence, request resync by pushing latest snapshot.

### Scalability Considerations
- Sticky sessions or shared Redis message bus for horizontal scaling.
- Periodic compaction: fold operations into new graph versions.

## 3. Export Rendering Pipeline

### Outputs
- **Mermaid Code:** Convert graph model to Mermaid flowchart syntax.
- **PNG/SVG:** Use headless renderer (e.g., `@mermaid-js/mermaid-cli` or `puppeteer` + mermaid API).
- **Markdown:** Generate descriptive markdown embedding Mermaid code and metadata tables.

### Service Design
- HTTP endpoints: `/export/:graphId?(version=)`. Query selects latest or specific version.
- Pipeline steps:
  1. Fetch graph snapshot from `graph_versions`.
  2. Normalize into internal representation.
  3. Generate Mermaid code.
  4. Render image assets in isolated worker (Dockerized) to guarantee reproducibility.
  5. Cache rendered artifacts keyed by `graph_id:version:format` with checksum.
- Include integrity headers (ETag) for caching and reproducibility.

### Reproducibility
- Version-lock rendering toolchain (Mermaid CLI version) and fonts.
- Store renderer metadata in `export_jobs` table for auditing.

## 4. Quality Inspection Integration

### Checks
1. **Confidence Display:** Extend graph schema with `confidence` field; UI overlays numeric/textual indicator.
2. **Ambiguous Nodes:** Mark nodes with `ambiguity=true`; renderer draws dashed outlines.
3. **Isolated Nodes:** Backend analysis to find nodes with `degree=0`.
4. **Cycle Detection:** Apply DFS/Tarjan to detect cycles; surface warnings.

### Backend Workflow
- Add analysis service triggered on version commit or on-demand.
- Store inspection results in `graph_quality_reports` table with JSON payload summarizing findings.
- Provide API endpoint `/graphs/:id/quality` returning current status and suggestions.

### Frontend Integration
- Subscribe to quality updates via OT channel or REST polling.
- Render badges, highlight ambiguous nodes, provide warning list.
- Allow manual override/acknowledgement.

## 5. Testing & Automation Strategy

### Load Testing
- Scenario: 5 concurrent editors applying mixed CRUD operations for 10 minutes.
- Tooling: k6 or Locust with WebSocket support.
- Metrics: median/95th latency for op ack (SLO target), server CPU/memory, Redis throughput.

### Integration Tests
- Simulate collaborative session end-to-end:
  - Start session, apply operations, ensure OT convergence.
  - Persist version and verify export reproducibility hash.

### CI/CD Automation
- GitHub Actions workflow steps:
  1. Lint & unit tests (backend + frontend).
  2. Integration tests with ephemeral Postgres/Redis via services.
  3. Load test smoke (short k6 run) on nightly schedule.
  4. Artifact upload of export outputs for regression comparison.

### Observability & Alerts
- Emit metrics for OT latency, export duration, quality warnings count.
- Configure alerts when SLOs breached or export hash drift detected.

## Next Steps
1. Scaffold backend service (choose framework) with DB migrations.
2. Implement OT engine with property-based tests.
3. Build export workers and integrate quality inspection pipeline.
4. Finalize CI workflow and monitoring dashboards.

