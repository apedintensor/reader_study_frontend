# Session Resume and Case Navigation Guide

This guide outlines enhancements to `caseStore` and UI components to support session persistence, progress tracking, and flexible case navigation.

## `caseStore.ts` Enhancements

1.  **Track Progress State**:
    -   Maintain a progress object for each case, storing its ID and completion status for both Pre-AI and Post-AI phases.
        ```typescript
        interface CaseProgress {
          caseId: number;
          preCompleted: boolean;
          postCompleted: boolean;
        }
        // In store state:
        // progress: {} as Record<number, CaseProgress>
        ```

2.  **Persist Progress**:
    -   Save the entire progress map to `localStorage` whenever a case's status is updated (e.g., after submitting a Pre-AI or Post-AI assessment).
    -   Use a dedicated `localStorage` key (e.g., `CASE_PROGRESS_KEY`).

3.  **Load Progress on Startup**:
    -   Implement a `loadProgressFromCache()` action (or similar) called when the store is initialized or the app starts.
    -   This action should read the progress map from `localStorage` and populate the store's state.

4.  **Identify Next Incomplete Case**:
    -   Add a getter or action, e.g., `getNextIncompleteCase()`, that determines the next case the user should be directed to.
        -   Logic: Find the first case where `preCompleted` is `false`.
        -   If all `preCompleted` are `true`, find the first case where `postCompleted` is `false`.
        -   If all cases are fully completed, this can return `null` or a special indicator.

## `DashboardPage.vue` Enhancements

1.  **Display Case Progress**:
    -   Use a PrimeVue `DataTable` or a grid of `Panel` components to list all available cases.
    -   For each case, display:
        -   Case ID (or a user-friendly label).
        -   Pre-AI completion status (e.g., using PrimeVue `Tag` or an icon).
        -   Post-AI completion status.

2.  **"Start/Resume" Functionality**:
    -   Include a prominent "Start/Resume" button.
    -   When clicked, this button should navigate the user to the route of the case identified by `caseStore.getNextIncompleteCase()`.
    -   If all cases are complete, it might navigate to a `/complete` page or disable itself.

3.  **Direct Case Navigation** (Optional but Recommended):
    -   Implement a PrimeVue `Dropdown`, `Sidebar` with `PanelMenu`, or a list of links allowing users to jump directly to any specific case via its route (e.g., `/case/:id`).

## UI and UX Suggestions

-   **Visual Cues**: Use distinct styling (colors, icons) in the dashboard list to differentiate between pending, in-progress, and completed cases.
-   **Navigation Control**: If implementing direct navigation, disable or visually indicate that a user cannot jump to the Post-AI phase of a case if its Pre-AI phase is not yet completed. A toast message can also inform the user.

## Business Logic for Resuming

-   **Default Navigation**: When the app loads or the user visits the dashboard:
    -   Automatically determine the next appropriate case using the logic in `getNextIncompleteCase()`.
    -   The "Start/Resume" button should reflect this.
-   **Non-Sequential Access**: Users should be allowed to navigate to any case they have access to, provided the Pre-AI phase is completed before accessing Post-AI for that specific case.

## Important Considerations

-   **Data Integrity**: Form submissions are the single source of truth for updating completion status. Local progress tracking should reflect successful submissions.
-   **User Experience**: Provide clear feedback to the user about their current progress and next steps. If a user attempts an invalid navigation (e.g., Post-AI before Pre-AI), a PrimeVue `Toast` or `Dialog` should explain why.

