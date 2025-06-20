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
│   └── style.css         # Global styles
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

-   User registration and JWT-based authentication.
-   Dashboard for case overview and progress tracking.
-   Multi-stage case assessment (Pre-AI and Post-AI).
-   Dynamic display of case images and metadata.
-   AI prediction visualization.
-   Session persistence and resume functionality.
-   Responsive UI using PrimeVue and PrimeFlex.

## API Integration

The frontend interacts with a backend API for data fetching and submission.
-   API endpoint rules and conventions are documented in [API Endpoint Rules](./docs/API_ENDPOINT_RULES.md).
-   The OpenAPI specification can be found in [openapi.json](./docs/openapi.json).
-   The Axios client is configured in `src/api/index.ts`.

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

This project is licensed under the MIT License. See the `LICENSE` file for details (if one exists, otherwise specify).
