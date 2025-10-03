import base64

from renderer.exporters import ExportService
from renderer.models import Edge, GraphVersion, Node


def build_version():
    nodes = [
        Node(id="n1", label="Root", trust=0.9),
        Node(id="n2", label="Child", trust=0.7, ambiguous=True),
    ]
    edges = [Edge(id="e1", source="n1", target="n2", label="rel")]
    return GraphVersion(graph_id="g1", version=1, nodes=nodes, edges=edges)


def test_mermaid_output_contains_nodes():
    version = build_version()
    exporter = ExportService()
    mermaid = exporter.to_mermaid(version)
    assert "n1[Root]" in mermaid
    assert "n1 -->|rel| n2" in mermaid


def test_markdown_output_has_rows():
    version = build_version()
    exporter = ExportService()
    md = exporter.to_markdown(version)
    assert "| n1 | Root |" in md
    assert "| e1 | n1 | n2 | rel" in md


def test_svg_generation():
    version = build_version()
    exporter = ExportService()
    svg = exporter.to_svg(version)
    assert svg.startswith("<svg")
    assert "trust:" in svg


def test_png_generation_and_bundle():
    version = build_version()
    exporter = ExportService()
    png_bytes = exporter.to_png(version)
    assert png_bytes.startswith(b"\x89PNG")
    bundle = exporter.bundle(version)
    assert base64.b64decode(bundle["png_base64"]).startswith(b"\x89PNG")
    assert bundle["metadata"]["graph_id"] == "g1"
