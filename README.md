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
