"""SQLite-backed persistence layer for collaborative graph sessions."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import asdict
from datetime import UTC, datetime
from typing import Dict, Iterable, Iterator, List, Optional, Tuple

from .models import Edge, GraphVersion, Node


class GraphPersistence:
    """Persists graphs and their version history."""

    def __init__(self, path: str = ":memory:") -> None:
        self._path = path
        self._conn = sqlite3.connect(
            path,
            detect_types=sqlite3.PARSE_DECLTYPES,
            check_same_thread=False,
            uri=path.startswith("file:"),
        )
        self._conn.row_factory = sqlite3.Row
        self._init_db()

    @contextmanager
    def _cursor(self) -> Iterator[sqlite3.Cursor]:
        cursor = self._conn.cursor()
        try:
            yield cursor
            self._conn.commit()
        finally:
            cursor.close()

    def _init_db(self) -> None:
        with self._cursor() as cur:
            cur.executescript(
                """
                CREATE TABLE IF NOT EXISTS graphs (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS graph_versions (
                    graph_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    author_session TEXT,
                    created_at TEXT NOT NULL,
                    quality_json TEXT NOT NULL,
                    PRIMARY KEY (graph_id, version),
                    FOREIGN KEY (graph_id) REFERENCES graphs(id)
                );

                CREATE TABLE IF NOT EXISTS graph_nodes (
                    graph_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    node_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    PRIMARY KEY (graph_id, version, node_id),
                    FOREIGN KEY (graph_id, version) REFERENCES graph_versions(graph_id, version)
                );

                CREATE TABLE IF NOT EXISTS graph_edges (
                    graph_id TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    edge_id TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    PRIMARY KEY (graph_id, version, edge_id),
                    FOREIGN KEY (graph_id, version) REFERENCES graph_versions(graph_id, version)
                );
                """
            )

    def register_graph(self, graph_id: str) -> None:
        with self._cursor() as cur:
            cur.execute(
                "INSERT OR IGNORE INTO graphs(id, created_at) VALUES (?, ?)",
                (graph_id, datetime.now(UTC).isoformat().replace("+00:00", "Z")),
            )

    def latest_version(self, graph_id: str) -> Optional[GraphVersion]:
        with self._cursor() as cur:
            cur.execute(
                "SELECT version FROM graph_versions WHERE graph_id = ? ORDER BY version DESC LIMIT 1",
                (graph_id,),
            )
            row = cur.fetchone()
            if not row:
                return None
            return self.load_version(graph_id, int(row["version"]))

    def load_version(self, graph_id: str, version: int) -> GraphVersion:
        with self._cursor() as cur:
            cur.execute(
                """
                SELECT author_session, created_at, quality_json
                FROM graph_versions
                WHERE graph_id = ? AND version = ?
                """,
                (graph_id, version),
            )
            header = cur.fetchone()
            if header is None:
                raise KeyError(f"graph {graph_id} version {version} does not exist")

            cur.execute(
                """
                SELECT payload_json FROM graph_nodes
                WHERE graph_id = ? AND version = ?
                """,
                (graph_id, version),
            )
            nodes = [Node(**json.loads(row["payload_json"])) for row in cur.fetchall()]

            cur.execute(
                """
                SELECT payload_json FROM graph_edges
                WHERE graph_id = ? AND version = ?
                """,
                (graph_id, version),
            )
            edges = [Edge(**json.loads(row["payload_json"])) for row in cur.fetchall()]

        return GraphVersion(
            graph_id=graph_id,
            version=version,
            nodes=nodes,
            edges=edges,
            created_at=datetime.fromisoformat(header["created_at"].replace("Z", "+00:00")),
            author_session=header["author_session"],
            quality=json.loads(header["quality_json"]),
        )

    def save_version(
        self,
        graph_id: str,
        nodes: Iterable[Node],
        edges: Iterable[Edge],
        author_session: Optional[str],
        quality: Optional[Dict[str, object]] = None,
    ) -> GraphVersion:
        self.register_graph(graph_id)
        latest = self.latest_version(graph_id)
        next_version = 1 if latest is None else latest.version + 1
        created_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        quality_json = json.dumps(quality or {})

        with self._cursor() as cur:
            cur.execute(
                """
                INSERT INTO graph_versions(graph_id, version, author_session, created_at, quality_json)
                VALUES (?, ?, ?, ?, ?)
                """,
                (graph_id, next_version, author_session, created_at, quality_json),
            )

            node_rows = [
                (graph_id, next_version, node.id, json.dumps(asdict(node)))
                for node in nodes
            ]
            if node_rows:
                cur.executemany(
                    "INSERT INTO graph_nodes(graph_id, version, node_id, payload_json) VALUES (?, ?, ?, ?)",
                    node_rows,
                )

            edge_rows = [
                (graph_id, next_version, edge.id, json.dumps(asdict(edge)))
                for edge in edges
            ]
            if edge_rows:
                cur.executemany(
                    "INSERT INTO graph_edges(graph_id, version, edge_id, payload_json) VALUES (?, ?, ?, ?)",
                    edge_rows,
                )

        return GraphVersion(
            graph_id=graph_id,
            version=next_version,
            nodes=list(nodes),
            edges=list(edges),
            created_at=datetime.fromisoformat(created_at.replace("Z", "+00:00")),
            author_session=author_session,
            quality=json.loads(quality_json),
        )

    def history(self, graph_id: str, limit: Optional[int] = None) -> List[GraphVersion]:
        with self._cursor() as cur:
            query = "SELECT version FROM graph_versions WHERE graph_id = ? ORDER BY version DESC"
            if limit is not None:
                query += " LIMIT ?"
                cur.execute(query, (graph_id, limit))
            else:
                cur.execute(query, (graph_id,))
            versions = [int(row["version"]) for row in cur.fetchall()]
        return [self.load_version(graph_id, version) for version in versions]

    def prune(self, graph_id: str, keep_last: int = 10) -> None:
        with self._cursor() as cur:
            cur.execute(
                "SELECT version FROM graph_versions WHERE graph_id = ? ORDER BY version DESC",
                (graph_id,),
            )
            rows = [int(row["version"]) for row in cur.fetchall()]
            stale = rows[keep_last:]
            for version in stale:
                cur.execute(
                    "DELETE FROM graph_nodes WHERE graph_id = ? AND version = ?",
                    (graph_id, version),
                )
                cur.execute(
                    "DELETE FROM graph_edges WHERE graph_id = ? AND version = ?",
                    (graph_id, version),
                )
                cur.execute(
                    "DELETE FROM graph_versions WHERE graph_id = ? AND version = ?",
                    (graph_id, version),
                )

    def close(self) -> None:
        self._conn.close()


class InMemorySessionStore:
    """Tracks WebSocket sessions similarly to a Redis structure."""

    def __init__(self) -> None:
        self._sessions: Dict[str, Dict[str, object]] = {}

    def upsert(self, session_id: str, payload: Dict[str, object]) -> None:
        stored = self._sessions.setdefault(session_id, {})
        stored.update(payload)

    def remove(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)

    def get(self, session_id: str) -> Optional[Dict[str, object]]:
        return self._sessions.get(session_id)

    def all(self) -> List[Tuple[str, Dict[str, object]]]:
        return list(self._sessions.items())
