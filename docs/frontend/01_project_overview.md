# Project Overview

## Purpose of Clarity
Clarity AI Docs is an enterprise-grade, self-auditing contract intelligence platform. It is designed to ingest massive volumes of legal documents, process them through a retrieval-augmented generation (RAG) pipeline, and allow users to query their corporate knowledge base with verifiable accuracy. The frontend serves as the primary interface for this intelligence, balancing consumer-grade aesthetics with enterprise functionality.

## Frontend Philosophy
The frontend follows a "developer-first" dark mode aesthetic, mirroring high-end products like Linear, Vercel, and GitHub. 
It's built for extreme responsiveness, prioritizing zero-layout shift and fluid transitions. We treat the frontend not just as a visual layer, but as a rich, stateful client application that must remain perfectly synchronized with a heavy AI backend.

## Design Philosophy & UI Inspiration
The UI heavily leverages **Glassmorphism**, deep dark tones (`#05070B`, `#0F1117`), and vibrant glowing accents (primarily Purples and Emeralds). 
- **Inspiration**: Stripe (for meticulous micro-interactions), Cursor (for developer-focused density), Framer (for motion), and OpenAI Platform (for data presentation). 
- Every interaction must feel premium, snappy, and cohesive. We do not use harsh borders; instead, we rely on subtle border opacities (`rgba(255,255,255,0.06)`) and ambient glows.

## Architecture Goals
- **High Modularity**: Separating core UI components (`src/components/ds`) from complex business logic.
- **Type Safety**: End-to-end TypeScript enforcement. We do not use `any`.
- **Optimistic UI**: React Query mutations ensure instant feedback. Users should never feel like they are waiting on a server unless a loading state is explicitly designed for drama (e.g., Document Ingestion).
- **Contextual State**: Avoiding massive global stores (like Redux) in favor of contextual providers (Workspace, Auth, UI, Command).

## Major Frontend Principles
1. **Server/Client Separation:** We leverage Next.js App Router to dictate clear boundaries. Pages are mostly Server Components serving as layout shells, while the interactive tabs are Client Components.
2. **Contextual Domains:** State is kept local to its domain. The entire app revolves around the `activeWorkspace`.
3. **Motion First:** Every enter/exit interaction is animated using Framer Motion. Elements do not simply "appear"; they fade and slide in.

## Technology Choices & Tradeoffs
- **Next.js 15 (App Router):** Chosen for layout persistence and SSR capabilities. *Tradeoff*: Hydration mismatches can occur if client/server states drift, handled via strict `'use client'` boundaries.
- **Tailwind CSS:** For rapid, token-based styling. *Tradeoff*: HTML class lists can become long, mitigated via `cn()` utility and component abstraction.
- **Framer Motion:** For orchestrating complex layout animations and micro-interactions. *Tradeoff*: Adds to bundle size, but deemed necessary for the premium feel.
- **React Query (TanStack Query):** For caching and async state management. *Tradeoff*: Requires careful query invalidation management over simple `useEffect` fetching.
- **Clerk:** For robust, secure authentication without building a custom identity provider.
