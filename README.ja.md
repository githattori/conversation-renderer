# Conversation Renderer（会話レンダラー）

このプロジェクトは、協調編集型のグラフデータを管理するためのバックエンド中心のツールキットです。主な機能は以下のとおりです。

- `graph_vN` 形式によるバージョニングを備えたグラフセッション履歴の SQLite 永続化
- ノード／エッジ操作の同時実行を調停するオペレーショナル・トランスフォーム（OT）エンジン
- 曖昧なノード、孤立ノード、サイクル、信頼度指標などを可視化する品質分析
- Mermaid 図、Markdown 要約、SVG、PNG 画像を生成するエクスポートパイプライン

## インストール

```bash
pip install -r requirements-dev.txt
```

### 環境変数

エンティティ抽出をホスト型の大規模言語モデル（LLM）で補強したい場合は、API サービス起動前に以下の環境変数を設定してください。

| 変数 | 用途 |
| --- | --- |
| `DIAGRAM_LLM_API_KEY` | 図抽出モデル（例: OpenAI）の API キー |
| `DIAGRAM_LLM_BASE_URL` | 任意。LLM API のベース URL の上書き（既定: `https://api.openai.com/v1`） |
| `DIAGRAM_LLM_MODEL` | 任意。モデル名の上書き（既定: `gpt-4o-mini`） |

これらが未設定の場合でも、サービスは組み込みのヒューリスティックなパイプラインにフォールバックするため、テストやオフライン開発は継続可能です。

## テストの実行

```bash
pytest
```

## 使い方例（Python）

```python
from renderer import (
    CollaborationEngine,
    ExportService,
    GraphOperation,
    GraphPersistence,
    OperationType,
)

persistence = GraphPersistence()
engine = CollaborationEngine(persistence)
exporter = ExportService()

graph_id = "example"
base = engine.current_graph(graph_id)
engine.apply(
    graph_id,
    GraphOperation(
        type=OperationType.ADD_NODE,
        payload={"id": "n1", "label": "Root", "trust": 0.9},
        session_id="s1",
        version=base.version,
    ),
)
latest = persistence.latest_version(graph_id)
print(exporter.to_mermaid(latest))
```
