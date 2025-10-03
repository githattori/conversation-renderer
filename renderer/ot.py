"""Operational transform utilities for collaborative editing."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, Iterable, List, Optional, Tuple

from .models import Edge, GraphVersion, Node, index_edges, index_nodes
from .quality import QualityAnalyzer
from .storage import GraphPersistence, InMemorySessionStore


class OperationType(str, Enum):
    ADD_NODE = "add_node"
    UPDATE_NODE = "update_node"
    REMOVE_NODE = "remove_node"
    ADD_EDGE = "add_edge"
    UPDATE_EDGE = "update_edge"
    REMOVE_EDGE = "remove_edge"
    RENAME_GRAPH = "rename_graph"


@dataclass
class GraphOperation:
    """A single OT operation coming from a client."""

    type: OperationType
    payload: Dict[str, object]
    session_id: str
    version: int


class OperationConflict(Exception):
    pass


def _apply_operation(
    nodes: Dict[str, Node],
    edges: Dict[str, Edge],
    operation: GraphOperation,
) -> Tuple[Dict[str, Node], Dict[str, Edge]]:
    op = operation
    data = op.payload
    if op.type == OperationType.ADD_NODE:
        node = Node(**data)
        nodes[node.id] = node
    elif op.type == OperationType.UPDATE_NODE:
        node_id = str(data["id"])
        if node_id not in nodes:
            raise OperationConflict(f"node {node_id} missing for update")
        existing = nodes[node_id]
        updates = {**existing.to_dict(), **data}
        nodes[node_id] = Node(**updates)
    elif op.type == OperationType.REMOVE_NODE:
        node_id = str(data["id"])
        nodes.pop(node_id, None)
        # remove edges connected to node
        for edge_id, edge in list(edges.items()):
            if edge.source == node_id or edge.target == node_id:
                edges.pop(edge_id, None)
    elif op.type == OperationType.ADD_EDGE:
        edge = Edge(**data)
        if edge.source not in nodes or edge.target not in nodes:
            raise OperationConflict("edge endpoints must exist")
        edges[edge.id] = edge
    elif op.type == OperationType.UPDATE_EDGE:
        edge_id = str(data["id"])
        if edge_id not in edges:
            raise OperationConflict(f"edge {edge_id} missing for update")
        existing = edges[edge_id]
        updates = {**existing.to_dict(), **data}
        edges[edge_id] = Edge(**updates)
    elif op.type == OperationType.REMOVE_EDGE:
        edge_id = str(data["id"])
        edges.pop(edge_id, None)
    elif op.type == OperationType.RENAME_GRAPH:
        # graph rename handled at metadata layer; ignore here
        pass
    else:
        raise ValueError(f"unsupported operation {op.type}")
    return nodes, edges


class CollaborationEngine:
    """Coordinates OT operations, persistence and quality checks."""

    def __init__(
        self,
        persistence: GraphPersistence,
        sessions: Optional[InMemorySessionStore] = None,
        quality_analyzer: Optional[QualityAnalyzer] = None,
    ) -> None:
        self.persistence = persistence
        self.sessions = sessions or InMemorySessionStore()
        self.quality = quality_analyzer or QualityAnalyzer()

    def current_graph(self, graph_id: str) -> GraphVersion:
        latest = self.persistence.latest_version(graph_id)
        if latest is None:
            return self.persistence.save_version(graph_id, [], [], None)
        return latest

    def apply(self, graph_id: str, operation: GraphOperation) -> GraphVersion:
        base = self.current_graph(graph_id)
        if operation.version != base.version:
            raise OperationConflict(
                f"version mismatch (expected {base.version}, got {operation.version})"
            )

        nodes = index_nodes(base.nodes)
        edges = index_edges(base.edges)
        nodes, edges = _apply_operation(nodes, edges, operation)

        nodes_list = sorted(nodes.values(), key=lambda node: node.id)
        edges_list = sorted(edges.values(), key=lambda edge: edge.id)
        quality = self.quality.evaluate(nodes_list, edges_list)
        stored = self.persistence.save_version(
            graph_id,
            nodes_list,
            edges_list,
            author_session=operation.session_id,
            quality=quality.to_dict(),
        )
        self.sessions.upsert(operation.session_id, {"graph_id": graph_id, "version": stored.version})
        return stored

    def bulk_apply(self, graph_id: str, operations: Iterable[GraphOperation]) -> GraphVersion:
        latest = self.current_graph(graph_id)
        nodes = index_nodes(latest.nodes)
        edges = index_edges(latest.edges)
        version = latest.version
        author_session: Optional[str] = None
        for op in operations:
            if op.version != version:
                raise OperationConflict(
                    f"operation version mismatch: expected {version} got {op.version}"
                )
            nodes, edges = _apply_operation(nodes, edges, op)
            version += 1
            author_session = op.session_id
        nodes_list = sorted(nodes.values(), key=lambda node: node.id)
        edges_list = sorted(edges.values(), key=lambda edge: edge.id)
        quality = self.quality.evaluate(nodes_list, edges_list)
        stored = self.persistence.save_version(
            graph_id,
            nodes_list,
            edges_list,
            author_session=author_session,
            quality=quality.to_dict(),
        )
        return stored

    def active_sessions(self) -> List[Dict[str, object]]:
        return [
            {"session_id": session_id, **payload}
            for session_id, payload in self.sessions.all()
        ]


__all__ = [
    "CollaborationEngine",
    "GraphOperation",
    "OperationType",
    "OperationConflict",
]
