# Reader Study Web Application - Frontend

This project is the frontend for a web-based application designed for conducting reader studies. It allows users (readers) to register, log in, view medical cases, provide assessments (Pre-AI and Post-AI), and track their progress. The application features a modern UI built with Vue 3 and PrimeVue 4.x.

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup and Installation](#setup-and-installation)
- [Running the Application](#running-the-application)
- [Running Tests](#running-tests)
- [Key Features](#key-features)
- [API Integration](#api-integration)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Project Overview

The Reader Study Web Application aims to provide a seamless experience for medical professionals participating in reader studies. It includes functionalities for user authentication, case presentation, multi-stage assessments (before and after AI-generated insights), and progress management.

For a detailed overview, please refer to the [Project Overview Document](./docs/PROJECT_OVERVIEW.md).

## Tech Stack

-   **Framework**: Vue 3
-   **Build Tool**: Vite
-   **UI Library**: PrimeVue 4.x (Styled Mode with Aura Theme)
-   **State Management**: Pinia
-   **Routing**: Vue Router
-   **Language**: TypeScript
-   **HTTP Client**: Axios
-   **End-to-End Testing**: Cypress
-   **Styling**: PrimeFlex utility classes

## Project Structure

The project follows a standard Vue 3 + Vite structure:

```
├── cypress/              # End-to-end tests
├── docs/                 # Project documentation, guides, API specs
├── public/               # Static assets
├── src/                  # Main application source code
│   ├── api/              # API client configuration (Axios)
│   ├── assets/           # Static assets like images, fonts
│   ├── components/       # Reusable Vue components
│   ├── pages/            # Route-level Vue components (views)
│   ├── router/           # Vue Router configuration
│   ├── stores/           # Pinia state management stores
│   ├── App.vue           # Root Vue component
│   ├── main.ts           # Application entry point
│   └── base.css          # Global base (structure/reset only)
├── .gitignore
├── cypress.config.ts     # Cypress configuration
├── index.html            # Main HTML file
├── package.json          # Project dependencies and scripts
├── README.md             # This file
├── tsconfig.json         # TypeScript configuration
└── vite.config.ts        # Vite configuration
```

## Prerequisites

-   Node.js (v16 or later recommended)
-   npm (or yarn/pnpm)

## Setup and Installation

1.  **Clone the repository**:
    ```pwsh
    git clone https://github.com/apedintensor/reader_study_frontend.git
    cd frontend
    ```

2.  **Install dependencies**:
    Open a terminal in the project root (`frontend` directory) and run:
    ```pwsh
    npm install
    ```

## Running the Application

To start the development server:

```pwsh
npm run dev
```

This will typically start the application on `http://localhost:5173` (or another port if 5173 is in use).

## Running Tests

This project uses Cypress for end-to-end testing.

1.  **Open Cypress Test Runner** (interactive mode):
    ```pwsh
    npm run cypress:open
    ```
    or
    ```pwsh
    npx cypress open
    ```

2.  **Run Cypress tests headlessly** (e.g., for CI):
    ```pwsh
    npm run cypress:run
    ```
    or
    ```pwsh
    npx cypress run
    ```

Test files are located in the `cypress/e2e` directory. For more details on testing, refer to the [Testing Guide](./docs/p7%20-%20test.md).

## Key Features

Core workflow now revolves around short “Game” rounds (10-case blocks) instead of ad‑hoc per‑case navigation.

- User registration and JWT-based authentication
- Game-driven assessment flow: Start / Resume 10‑case rounds
- Dual-phase assessment (Pre‑AI & Post‑AI) with deltas (Top1 / Top3 accuracy changes)
- On‑demand game reports (fetched only when expanded) with per‑case ground truth vs predictions
- Peer Accuracy metrics (aggregated comparison group) grouped alongside Your Accuracy
- Global Game Progress card powered by `/api/game/progress` (total, completed, remaining)
- Diagnosis term autocomplete with fuzzy local ranking (Fuse.js) + backend suggestion endpoint
- AI prediction visualization and comparison tables
- Resume incomplete game & continue where you left off
- Responsive, dark‑friendly UI using PrimeVue 4 + PrimeFlex utilities
- Strict endpoint prefixing & centralized Axios client with auth token injection

### Recent Additions / Changes

| Area | Update |
|------|--------|
| Terminology | “Block” renamed to “Game” across UI and code comments |
| Progress | Local aggregation replaced by authoritative `/api/game/progress` endpoint |
| Reports | Lazy (on‑expand) fetch with lightweight retry polling until ready |
| Diagnosis Search | Added `/api/diagnosis_terms/suggest` integration + Fuse.js fuzzy highlighting |
| UI Simplification | Removed legacy landing & available cases tables for a focused dashboard |
| Accuracy Display | Consolidated Top3 correctness: any of the three matching GT is a single tick |
| Deployment | Docker multi-stage build (Node build → Nginx serve) tuned for immutable static assets |

## API Integration

All frontend calls MUST include the `/api` prefix (see `docs/API_ENDPOINT_RULES.md`). The Axios client (`src/api/index.ts`) manages:

- Base origin resolution (env → fallback) – do **not** include `/api` in the env var
- Auth bearer token injection from localStorage
- Request / response logging (console)

Primary endpoints in current workflow (subset):

| Purpose | Method | Path |
|---------|--------|------|
| Game progress summary | GET | `/api/game/progress` |
| List historical game reports | GET | `/api/game/reports` |
| Single game report | GET | `/api/game/report/{block}` |
| Advance / start next assignment | POST | `/api/game/next` or `/api/game/start` (backend variant) |
| Diagnosis term list | GET | `/api/diagnosis_terms/` |
| Diagnosis suggestions (search) | GET | `/api/diagnosis_terms/suggest?q=...` |
| Cases | GET | `/api/cases/` |
| Submit assessment (new model) | POST | `/api/assessments/` (if using new schema) |

Refer to `docs/openapi.json` for the full surface.

### Environment Configuration (API Base URL)

The Axios client auto-detects the backend origin using this priority order:

1. `VITE_API_BASE_URL` (preferred) – e.g. `https://your-backend.example.com`
2. `VITE_API_BASE_URL_PROD` (legacy fallback)
3. Development: empty string `''` so that the Vite dev proxy handles `/api/*`
4. Production safety fallback: `https://reader-study.fly.dev`

Rules:
- Do NOT append `/api` to the value you set in the environment variable.
- Frontend code must continue to call endpoints with the `/api` prefix (see `docs/API_ENDPOINT_RULES.md`).
- In local development you normally do NOT set `VITE_API_BASE_URL`; leaving it unset preserves the proxy behavior defined in `vite.config.ts`.

Set the variable on Fly.io (PowerShell example):

```pwsh
fly secrets set VITE_API_BASE_URL=https://your-backend-domain
```

After updating a Fly secret, trigger a new deployment (Fly restarts machines automatically on secret change).

### Diagnosis Autocomplete Behavior

1. Debounced query normalization (lowercase, diacritic strip, whitespace collapse)
2. Backend suggestion fetch `/api/diagnosis_terms/suggest?q=...`
3. Local Fuse.js fuzzy ranking + match highlighting
4. Graceful fallback: if Fuse yields no hits, top N raw results surface

If search seems to fail in production:
- Confirm `VITE_API_BASE_URL` is set (no `/api` suffix)
- Ensure CSP `connect-src` in `nginx.conf` permits backend origin (currently `'self' https:`); add explicit host if needed
- Verify network calls show 200 OK for `/api/diagnosis_terms/suggest`

## Deployment (Fly.io)

Multi-stage Docker build:

1. Build stage installs deps (`npm ci`), compiles TypeScript, runs Vite build
2. Prunes devDependencies (`npm prune --omit=dev`)
3. Final Nginx image serves `/dist` static output

Key files:
- `Dockerfile` – build pipeline
- `nginx.conf` – SPA fallback + aggressive caching for hashed assets + CSP
- `fly.toml` – Fly app config

Deploy sequence:
```pwsh
# (optional) set / update API base origin
fly secrets set VITE_API_BASE_URL=https://your-backend.example

# build & release
fly deploy
```

Cache invalidation: `index.html` is marked `no-cache`; hashed assets are immutable for 1 year.

## Documentation

This project includes comprehensive documentation to guide development and understanding:

-   [Project Initialization (p0 - init.md)](./docs/p0%20-%20init.md)
-   [Vue Router Setup (p1 - route.md)](./docs/p1%20-%20route.md)
-   [JWT Authentication (p2 - auth.md)](./docs/p2%20-%20auth.md)
-   [Pinia State Management (p3 - store.md)](./docs/p3%20-%20store.md)
-   [Pre-AI Assessment (p4 - pre_ai.md)](./docs/p4%20-%20pre_ai.md)
-   [Post-AI Assessment (p5 - post_ai.md)](./docs/p5%20-%20post_ai.md)
-   [Session Resume & Navigation (p6 - pause_resume.md)](./docs/p6%20-%20pause_resume.md)
-   [Cypress Testing (p7 - test.md)](./docs/p7%20-%20test.md)
-   [UI/UX Improvements (p8 - improvement.md)](./docs/p8%20-%20improvement.md)
-   [PrimeVue 4 UI Enhancement Plan (p9 - ui_remake.md)](./docs/p9%20-%20ui_remake.md)

## Contributing

Contributions are welcome! Please follow these general guidelines:
1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Commit your changes with clear and descriptive messages.
4.  Push your branch and submit a pull request.
5.  Ensure your code adheres to the project's coding standards and all tests pass.

## License

MIT