import os
import tempfile

from renderer.models import Edge, Node
from renderer.storage import GraphPersistence


def test_save_and_history():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "graphs.db")
        persistence = GraphPersistence(path)
        nodes = [Node(id="n1", label="Root"), Node(id="n2", label="Child")]
        edges = [Edge(id="e1", source="n1", target="n2", label="connects")]
        version1 = persistence.save_version("graph", nodes, edges, author_session="s1")
        assert version1.version == 1

        nodes.append(Node(id="n3", label="Another"))
        version2 = persistence.save_version("graph", nodes, edges, author_session="s2")
        assert version2.version == 2

        history = persistence.history("graph")
        assert [v.version for v in history] == [2, 1]

        latest = persistence.latest_version("graph")
        assert latest.version == 2
        assert len(latest.nodes) == 3


def test_prune_removes_old_versions():
    persistence = GraphPersistence()
    nodes = [Node(id=f"n{i}", label=str(i)) for i in range(3)]
    edges = []
    for version in range(6):
        persistence.save_version("g", nodes, edges, author_session=f"s{version}")
    persistence.prune("g", keep_last=3)
    history = persistence.history("g")
    assert [v.version for v in history] == [6, 5, 4]
