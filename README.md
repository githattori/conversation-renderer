# Conversation Renderer

This project provides a backend-focused toolkit for managing collaborative graph data. It includes:

- **SQLite persistence** for graph session history with `graph_vN` style versioning.
- **Operational transform engine** for coordinating concurrent node and edge operations.
- **Quality analysis** that surfaces ambiguous nodes, isolated nodes, cycles, and trust metrics.
- **Export pipeline** that generates Mermaid diagrams, Markdown summaries, SVGs, and PNG images.

## Installation

```bash
pip install -r requirements-dev.txt
```

### Environment variables

If you would like to augment entity extraction with a hosted large language model, provide the following environment variables before starting the API service:

| Variable | Purpose |
| --- | --- |
| `DIAGRAM_LLM_API_KEY` | API key for the diagram extraction model (e.g. OpenAI). |
| `DIAGRAM_LLM_BASE_URL` | Optional. Override the base URL for the LLM API (defaults to `https://api.openai.com/v1`). |
| `DIAGRAM_LLM_MODEL` | Optional. Override the model name (defaults to `gpt-4o-mini`). |

Once an API key is present, the `LLMEntityExtractor` located in `services/api/src/llm/entityExtractor.ts` sends a JSON-schema constrained request to the OpenAI Responses API (`/responses`) and returns the decomposed step list. The service layer (`services/api/src/service.ts`) prefers this LLM output and only falls back to the heuristic extractor if the call is unavailable or fails.

When these values are absent the service falls back to the built-in heuristic pipeline so tests and offline development continue to function.

## Running Tests

```bash
pytest
```

## Usage Example

```python
from renderer import (
    CollaborationEngine,
    ExportService,
    GraphOperation,
    GraphPersistence,
    OperationType,
)

persistence = GraphPersistence()
engine = CollaborationEngine(persistence)
exporter = ExportService()

graph_id = "example"
base = engine.current_graph(graph_id)
engine.apply(
    graph_id,
    GraphOperation(
        type=OperationType.ADD_NODE,
        payload={"id": "n1", "label": "Root", "trust": 0.9},
        session_id="s1",
        version=base.version,
    ),
)
latest = persistence.latest_version(graph_id)
print(exporter.to_mermaid(latest))
```
