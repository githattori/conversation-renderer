# Current Limitations

The present repository does not yet contain executable source code for the requested features. The documents here capture the proposed architecture and testing plan required to implement:

1. Persistent storage of collaborative sessions and `graph_vN` history using Redis and a relational database.
2. An OT-based collaborative editing engine operating over WebSockets for real-time graph CRUD synchronization.
3. Export rendering endpoints that output Mermaid, PNG, SVG, and Markdown representations of graph states.
4. Cross-layer quality inspection including confidence indicators, ambiguous node styling, and structural validation (isolated nodes, cycles).
5. Automated load and integration testing pipelines covering multi-user sessions, latency SLOs, and export reproducibility.

Additional engineering effort is required to translate these plans into production-ready services and user interfaces.
