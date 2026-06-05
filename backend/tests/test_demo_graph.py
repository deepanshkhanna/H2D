"""Contract tests: the demo graph must validate against the EvidenceGraph model."""

from app.models import EvidenceGraph


def test_demo_graph_validates_against_model(demo_graph_raw):
    graph = EvidenceGraph.model_validate(demo_graph_raw)
    assert len(graph.nodes) > 0
    assert len(graph.edges) > 0


def test_demo_graph_edges_reference_existing_nodes(demo_graph_raw):
    graph = EvidenceGraph.model_validate(demo_graph_raw)
    node_ids = {n.id for n in graph.nodes}
    for edge in graph.edges:
        assert edge.source in node_ids, f"dangling source {edge.source}"
        assert edge.target in node_ids, f"dangling target {edge.target}"


def test_confidence_values_are_normalized(demo_graph_raw):
    graph = EvidenceGraph.model_validate(demo_graph_raw)
    for node in graph.nodes:
        assert 0.0 <= node.confidence <= 1.0
    for edge in graph.edges:
        assert 0.0 <= edge.confidence <= 1.0
