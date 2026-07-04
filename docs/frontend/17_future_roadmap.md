# Future Roadmap

Suggested logical improvements for the next iteration (Phase 15+).

## 1. Real-time Updates (WebSockets)
Replace React Query polling with real-time WebSocket events. When a document finishes indexing on the backend, the backend should emit an event to instantly update the Document Pipeline Table without polling.

## 2. Virtualization
As enterprises upload thousands of documents, the `DocumentPipelineTable` and `DocumentList` will become sluggish. Implement `@tanstack/react-virtual` to only render the rows visible on the screen.

## 3. Light Mode Theme
Leverage the CSS variable system (`var(--color-bg-surface)`) built in Phase 14 to introduce a Light Mode. This will require defining a new set of variables under a `[data-theme="light"]` selector in `globals.css`.

## 4. Advanced Component Library (Radix UI)
Gradually swap out custom, hand-rolled accessibility logic for Radix UI primitives (e.g., for Dropdowns, Dialogs, and Selects) to ensure flawless screen reader support and focus management.
