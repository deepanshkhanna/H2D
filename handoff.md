# OpsPilot AI: Next Agent Handoff Instructions

Welcome to the project! This document outlines where we left off, what has been completed, and what remains to be done.

---

## 🚀 Project Overview
**OpsPilot AI** is an AI-powered freight forensics platform designed to ingest shipping evidence (invoices, BOLs, carrier logs, damage photos), reconstruct timelines, correlate links between entities, identify contradictions, and output forensic reports with risk scores.

*   **Frontend**: React (TanStack Router, Tailwind) running at `http://localhost:8080`
*   **Backend**: FastAPI running at `http://localhost:8000`

---

## 📈 Current Status & Progress

We have successfully resolved key backend intelligence issues and restructured the frontend layout to meet high-end UI expectations:

### 1. Backend Forensic Corrections
*   **Financial Impact Calculation**: Fixed extraction logic in [gemini.py](file:///c:/project/hackdelhi/backend/app/ai/gemini.py) so unit prices do not overwrite total invoice values. Shortages are now correctly calculated: `shortage_units * (total_invoice / billed_units)` (e.g., 20 units missing equals ₹48,000 instead of the previous erroneous ₹480).
*   **Evidence Strength Calibration**: Raised baseline scores in [correlator.py](file:///c:/project/hackdelhi/backend/app/pipeline/correlator.py) so confirmed and probable links evaluate to realistic confidence values. The final evidence strength score is now `1.0` (active) instead of a static `0.0`.
*   **Contradiction Link Mapping**: Implemented chronology conflict identification (e.g., complaint date predating invoice date in Case C) and visual damage contradictions (e.g., reported packaging damage but package photo is intact in Case A).

### 2. Frontend Restructuring & Visual polish
*   **Evidence Graph Relocation**: Moved the SVG Evidence Graph out of the cramped 360px sticky sidebar column into a full-width section below the main forensic metrics.
*   **Evidence Graph Enhancement**:
    *   Enlarged node radii and labels (labels are now readable and wrapped at 22 chars instead of 14).
    *   Added descriptive subtype badges under each node (e.g., `document`, `location`).
    *   Constructed a clear legend for node types (documents, events, parties, physical items) and edge states (confirmed vs probable).
*   **High-Tech Animations**:
    *   Created `edge-glow` keyframe animations and pulsing SVG linear gradients in [styles.css](file:///c:/project/hackdelhi/frontend/src/styles.css).
    *   Added an animated `edge-flow` moving dashed line for active/confirmed links to symbolize data flow.
    *   Injected a scanner sweep effect (`graph-scanline`) on the graph container.
*   **Sidebar Layout**: The right sidebar is now dedicated exclusively to the Risk Score and Risk Factors, with `max-h-[calc(100vh-6rem)] overflow-y-auto` added to ensure it is fully scrollable and sticky on shorter viewports. Playback and Audit Trail have been relocated below the graph.

---

## 🛠️ Verification & Test Suite

1.  **Backend Tests**: All 36 backend tests pass perfectly:
    ```powershell
    cd backend
    venv\Scripts\pytest
    ```
2.  **Frontend Build**: The production build compiles with zero errors:
    ```powershell
    cd frontend
    npm run build
    ```
3.  **Intelligence Audit Verification**: The simulation script [run_intelligence_audit.py](file:///c:/project/hackdelhi/backend/tests/run_intelligence_audit.py) tests Case A, B, and C outputs:
    ```powershell
    cd backend
    venv\Scripts\python tests/run_intelligence_audit.py
    ```
    *   **Caveat**: If the local environment hits Gemini API rate limits/quota exhaustion (429 errors), the script falls back to mock outputs which yield identical root causes for Case A and B. This triggers an assertion failure (`assert cause_a != cause_b`). If this happens, verify your `GEMINI_API_KEY` or wait for the quota window to reset.
4.  **Manual Upload Verification (Case 1)**: Verified the upload pipeline by manually uploading the files in `C:\project\hackdelhi\testdoc\case1` (`Invoice Number.pdf`, `complaint.eml`, `smashed.jpg`). All pipeline stages (Ingestion, Parsing, Vision Parse, Extraction, Normalization, Correlation, Risk Modeler, Graph Gen) completed successfully with zero errors.

---

## 📂 Key Files & References

*   **Frontend Routes & Views**:
    *   [demo.tsx](file:///c:/project/hackdelhi/frontend/src/routes/demo.tsx) — Main demo dashboard component, layout configuration, and `EvidenceGraphView` component.
    *   [styles.css](file:///c:/project/hackdelhi/frontend/src/styles.css) — Custom Tailwind utility extensions, animations, scrollbars, and neon glows.
*   **Backend Reasoning Engine**:
    *   [correlator.py](file:///c:/project/hackdelhi/backend/app/pipeline/correlator.py) — Entity linking, temporal correlation, contradiction generation.
    *   [gemini.py](file:///c:/project/hackdelhi/backend/app/ai/gemini.py) — Structured entity extractors and fallbacks.
    *   [risk.py](file:///c:/project/hackdelhi/backend/app/pipeline/risk.py) — Risk scoring parameters and formulas.

---

## 📝 Next Steps for the Next Agent

1.  **Inspect the Restructured UI**:
    *   Launch the app and navigate to `http://localhost:8080/demo`.
    *   Click **"Load Pre-built Demo Case"** and check the new full-width Evidence Graph.
    *   Verify the flowing/pulsing blue edge lines and ensure the graph and legend look extremely polished and premium.
2.  **Audit the Dashboard & Fix Layout Bugs**:
    *   Perform a general audit of the results view: check spacing, typography, colors, borders, and margins.
    *   Look for potential overlaps, clipping, or unpolished elements.
    *   Ensure all animations (`animate-fade-in`, scanlines, active edge pulses) render smoothly.
3.  **Commit the Working Progress**:
    *   Run `git status` to review modified files.
    *   Stage and commit current changes to keep the workspace clean.
