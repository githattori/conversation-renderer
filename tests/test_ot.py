import pytest

from renderer.ot import CollaborationEngine, GraphOperation, OperationConflict, OperationType
from renderer.storage import GraphPersistence, InMemorySessionStore


def build_engine():
    persistence = GraphPersistence()
    sessions = InMemorySessionStore()
    engine = CollaborationEngine(persistence, sessions)
    return engine


def test_apply_add_node_and_edge():
    engine = build_engine()
    base_version = engine.current_graph("g1")
    op_node = GraphOperation(
        type=OperationType.ADD_NODE,
        payload={"id": "a", "label": "A"},
        session_id="s1",
        version=base_version.version,
    )
    version_after_node = engine.apply("g1", op_node)
    assert version_after_node.version == base_version.version + 1
    assert len(version_after_node.nodes) == 1

    op_edge = GraphOperation(
        type=OperationType.ADD_EDGE,
        payload={"id": "e1", "source": "a", "target": "a", "label": "self"},
        session_id="s1",
        version=version_after_node.version,
    )
    version_after_edge = engine.apply("g1", op_edge)
    assert len(version_after_edge.edges) == 1
    assert version_after_edge.quality["isolated_nodes"] == []


def test_conflicting_versions_raise():
    engine = build_engine()
    base_version = engine.current_graph("g2")
    op = GraphOperation(
        type=OperationType.ADD_NODE,
        payload={"id": "x", "label": "X"},
        session_id="s2",
        version=base_version.version + 1,
    )
    with pytest.raises(OperationConflict):
        engine.apply("g2", op)


def test_bulk_apply():
    engine = build_engine()
    base_version = engine.current_graph("g3")
    ops = [
        GraphOperation(
            type=OperationType.ADD_NODE,
            payload={"id": "n1", "label": "Node 1"},
            session_id="s3",
            version=base_version.version,
        ),
        GraphOperation(
            type=OperationType.ADD_NODE,
            payload={"id": "n2", "label": "Node 2"},
            session_id="s3",
            version=base_version.version + 1,
        ),
        GraphOperation(
            type=OperationType.ADD_EDGE,
            payload={"id": "e1", "source": "n1", "target": "n2", "label": "link"},
            session_id="s3",
            version=base_version.version + 2,
        ),
    ]
    final_version = engine.bulk_apply("g3", ops)
    assert final_version.version == base_version.version + 1
    assert len(final_version.nodes) == 2
    assert final_version.quality["isolated_nodes"] == []
