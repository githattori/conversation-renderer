"""Datamodels shared across the collaborative renderer backend."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Dict, Iterable, List, Optional


@dataclass(frozen=True)
class Node:
    """A graph node."""

    id: str
    label: str
    trust: float = 1.0
    ambiguous: bool = False

    def to_dict(self) -> Dict[str, object]:
        return {
            "id": self.id,
            "label": self.label,
            "trust": self.trust,
            "ambiguous": self.ambiguous,
        }


@dataclass(frozen=True)
class Edge:
    """A graph edge."""

    id: str
    source: str
    target: str
    label: str = ""
    weight: float = 1.0

    def to_dict(self) -> Dict[str, object]:
        return {
            "id": self.id,
            "source": self.source,
            "target": self.target,
            "label": self.label,
            "weight": self.weight,
        }


@dataclass
class GraphVersion:
    """A captured version of a graph, including change metadata."""

    graph_id: str
    version: int
    nodes: List[Node] = field(default_factory=list)
    edges: List[Edge] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    author_session: Optional[str] = None
    quality: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {
            "graph_id": self.graph_id,
            "version": self.version,
            "nodes": [node.to_dict() for node in self.nodes],
            "edges": [edge.to_dict() for edge in self.edges],
            "created_at": self.created_at.isoformat().replace("+00:00", "Z"),
            "author_session": self.author_session,
            "quality": self.quality,
        }

    @staticmethod
    def from_dict(payload: Dict[str, object]) -> "GraphVersion":
        return GraphVersion(
            graph_id=str(payload["graph_id"]),
            version=int(payload["version"]),
            nodes=[Node(**node) for node in payload.get("nodes", [])],
            edges=[Edge(**edge) for edge in payload.get("edges", [])],
            created_at=datetime.fromisoformat(payload["created_at"].replace("Z", "+00:00")),
            author_session=payload.get("author_session"),
            quality=payload.get("quality", {}),
        )


def index_nodes(nodes: Iterable[Node]) -> Dict[str, Node]:
    return {node.id: node for node in nodes}


def index_edges(edges: Iterable[Edge]) -> Dict[str, Edge]:
    return {edge.id: edge for edge in edges}
