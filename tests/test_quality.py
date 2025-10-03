from renderer.models import Edge, Node
from renderer.quality import QualityAnalyzer


def test_quality_metrics():
    nodes = [
        Node(id="n1", label="Root", trust=0.9),
        Node(id="n2", label="Child", trust=0.6, ambiguous=True),
        Node(id="n3", label="Isolated", trust=0.4),
    ]
    edges = [
        Edge(id="e1", source="n1", target="n2"),
        Edge(id="e2", source="n2", target="n1"),
    ]
    analyzer = QualityAnalyzer()
    report = analyzer.evaluate(nodes, edges)
    assert report.ambiguous_nodes == ["n2"]
    assert report.isolated_nodes == ["n3"]
    assert any(cycle[0] == "n1" for cycle in report.cycles)
    assert report.trust_summary["min"] == 0.4
    assert report.trust_summary["count"] == 3.0
