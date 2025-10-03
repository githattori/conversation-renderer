"""Graph export utilities for various output formats."""

from __future__ import annotations

import base64
import io
import math
from typing import Dict, Iterable, Tuple

from PIL import Image, ImageDraw, ImageFont

from .models import GraphVersion, Node


class ExportService:
    """Renders graph versions into multiple formats suitable for export."""

    def __init__(self) -> None:
        self._font = self._load_font()

    def _load_font(self) -> ImageFont.FreeTypeFont:
        try:
            return ImageFont.truetype("DejaVuSans.ttf", 14)
        except Exception:
            return ImageFont.load_default()

    def to_mermaid(self, version: GraphVersion) -> str:
        lines = ["graph LR"]
        for node in version.nodes:
            lines.append(f"    {node.id}[{node.label}]")
        for edge in version.edges:
            label = f"|{edge.label}|" if edge.label else ""
            lines.append(f"    {edge.source} -->{label} {edge.target}")
        return "\n".join(lines)

    def to_markdown(self, version: GraphVersion) -> str:
        header = "| Node | Label | Trust | Ambiguous |\n|---|---|---|---|"
        node_rows = [
            f"| {node.id} | {node.label} | {node.trust:.2f} | {'yes' if node.ambiguous else 'no'} |"
            for node in version.nodes
        ]
        edge_header = "\n\n| Edge | Source | Target | Label | Weight |\n|---|---|---|---|---|"
        edge_rows = [
            f"| {edge.id} | {edge.source} | {edge.target} | {edge.label or ''} | {edge.weight:.2f} |"
            for edge in version.edges
        ]
        return "\n".join([header, *node_rows, edge_header, *edge_rows])

    def to_svg(self, version: GraphVersion) -> str:
        positions = self._layout(version.nodes)
        width, height = 800, 600
        svg_parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}">',
            '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#333" /></marker></defs>',
        ]
        for edge in version.edges:
            if edge.source not in positions or edge.target not in positions:
                continue
            sx, sy = positions[edge.source]
            tx, ty = positions[edge.target]
            svg_parts.append(
                f'<line x1="{sx}" y1="{sy}" x2="{tx}" y2="{ty}" stroke="#555" stroke-width="2" marker-end="url(#arrow)" />'
            )
            if edge.label:
                mx, my = (sx + tx) / 2, (sy + ty) / 2
                svg_parts.append(
                    f'<text x="{mx}" y="{my - 5}" font-size="12" text-anchor="middle" fill="#333">{edge.label}</text>'
                )
        for node in version.nodes:
            x, y = positions[node.id]
            radius = 30
            stroke = "#ff9800" if node.ambiguous else "#1976d2"
            dash = "4 2" if node.ambiguous else ""
            svg_parts.append(
                f'<circle cx="{x}" cy="{y}" r="{radius}" fill="#e3f2fd" stroke="{stroke}" stroke-width="2" stroke-dasharray="{dash}" />'
            )
            svg_parts.append(
                f'<text x="{x}" y="{y}" font-size="12" text-anchor="middle" dominant-baseline="middle">{node.label}</text>'
            )
            svg_parts.append(
                f'<text x="{x}" y="{y + radius + 12}" font-size="10" text-anchor="middle" fill="#555">trust: {node.trust:.2f}</text>'
            )
        svg_parts.append("</svg>")
        return "".join(svg_parts)

    def to_png(self, version: GraphVersion) -> bytes:
        positions = self._layout(version.nodes)
        width, height = 800, 600
        image = Image.new("RGB", (width, height), (255, 255, 255))
        draw = ImageDraw.Draw(image)
        for edge in version.edges:
            if edge.source not in positions or edge.target not in positions:
                continue
            sx, sy = positions[edge.source]
            tx, ty = positions[edge.target]
            draw.line((sx, sy, tx, ty), fill=(100, 100, 100), width=3)
            if edge.label:
                mx, my = (sx + tx) / 2, (sy + ty) / 2
                draw.text((mx, my - 10), edge.label, fill=(60, 60, 60), font=self._font, anchor="mm")
        for node in version.nodes:
            x, y = positions[node.id]
            radius = 30
            bbox = (x - radius, y - radius, x + radius, y + radius)
            color = (255, 193, 7) if node.ambiguous else (25, 118, 210)
            draw.ellipse(bbox, outline=color, width=3, fill=(227, 242, 253))
            draw.text((x, y), node.label, fill=(0, 0, 0), font=self._font, anchor="mm")
            draw.text((x, y + radius + 12), f"trust {node.trust:.2f}", fill=(80, 80, 80), font=self._font, anchor="mm")
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

    def bundle(self, version: GraphVersion) -> Dict[str, object]:
        png_bytes = self.to_png(version)
        return {
            "mermaid": self.to_mermaid(version),
            "markdown": self.to_markdown(version),
            "svg": self.to_svg(version),
            "png_base64": base64.b64encode(png_bytes).decode("ascii"),
            "metadata": {
                "graph_id": version.graph_id,
                "version": version.version,
                "quality": version.quality,
            },
        }

    def _layout(self, nodes: Iterable[Node]) -> Dict[str, Tuple[float, float]]:
        nodes_list = list(nodes)
        count = max(1, len(nodes_list))
        width, height = 800, 600
        radius = min(width, height) * 0.35
        center_x, center_y = width / 2, height / 2
        positions: Dict[str, Tuple[float, float]] = {}
        for index, node in enumerate(nodes_list):
            angle = (2 * math.pi * index) / count if count > 1 else 0
            x = center_x + radius * math.cos(angle)
            y = center_y + radius * math.sin(angle)
            positions[node.id] = (x, y)
        return positions


__all__ = ["ExportService"]
