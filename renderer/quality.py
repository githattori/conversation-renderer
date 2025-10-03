"""Graph quality inspection utilities."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Set

from .models import Edge, Node


@dataclass
class QualityReport:
    ambiguous_nodes: List[str]
    isolated_nodes: List[str]
    cycles: List[List[str]]
    trust_summary: Dict[str, float]

    def to_dict(self) -> Dict[str, object]:
        return {
            "ambiguous_nodes": self.ambiguous_nodes,
            "isolated_nodes": self.isolated_nodes,
            "cycles": self.cycles,
            "trust_summary": self.trust_summary,
        }


class QualityAnalyzer:
    """Calculates quality metrics for a graph snapshot."""

    def evaluate(self, nodes: Iterable[Node], edges: Iterable[Edge]) -> QualityReport:
        node_index = {node.id: node for node in nodes}
        adjacency: Dict[str, Set[str]] = {node_id: set() for node_id in node_index}
        reverse: Dict[str, Set[str]] = {node_id: set() for node_id in node_index}
        for edge in edges:
            if edge.source not in node_index or edge.target not in node_index:
                continue
            adjacency[edge.source].add(edge.target)
            reverse[edge.target].add(edge.source)
        ambiguous_nodes = [node_id for node_id, node in node_index.items() if node.ambiguous]
        isolated_nodes = [
            node_id
            for node_id in node_index
            if not adjacency[node_id] and not reverse[node_id]
        ]
        cycles = self._detect_cycles(adjacency)
        trust_values = [node.trust for node in node_index.values()]
        trust_summary = {
            "count": float(len(trust_values)),
            "min": float(min(trust_values)) if trust_values else 0.0,
            "max": float(max(trust_values)) if trust_values else 0.0,
            "avg": float(sum(trust_values) / len(trust_values)) if trust_values else 0.0,
        }
        return QualityReport(
            ambiguous_nodes=sorted(ambiguous_nodes),
            isolated_nodes=sorted(isolated_nodes),
            cycles=cycles,
            trust_summary=trust_summary,
        )

    def _detect_cycles(self, adjacency: Dict[str, Set[str]]) -> List[List[str]]:
        visited: Set[str] = set()
        stack: Set[str] = set()
        order: List[str] = []
        result: List[List[str]] = []

        def dfs(node_id: str) -> None:
            visited.add(node_id)
            stack.add(node_id)
            order.append(node_id)
            for neighbour in adjacency[node_id]:
                if neighbour not in visited:
                    dfs(neighbour)
                elif neighbour in stack:
                    cycle = order[order.index(neighbour) :] + [neighbour]
                    result.append(cycle)
            stack.remove(node_id)
            order.pop()

        for node_id in adjacency:
            if node_id not in visited:
                dfs(node_id)
        return result


__all__ = ["QualityAnalyzer", "QualityReport"]
