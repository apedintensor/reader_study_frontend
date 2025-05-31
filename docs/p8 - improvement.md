# UI/UX Improvement Suggestions

This document outlines key areas for UI/UX enhancements based on initial feedback and observations.

1.  **Assessment Form State Reset**:
    -   **Issue**: After submitting a case assessment, the form fields retain their previous values when navigating to a new case or a different phase (Pre/Post AI) of the same case.
    -   **Recommendation**: Ensure that the assessment form state (all input fields, selections, sliders) is programmatically cleared or reset to default values upon successful submission and before loading data for a new assessment instance.

2.  **Case Metadata Display**:
    -   **Issue**: Case metadata is currently displayed using bullet points within a potentially non-expandable container.
    -   **Recommendation**: 
        -   Refactor the metadata display to use a more structured layout, perhaps a PrimeVue `Fieldset` or a series of labeled data points rather than bullet points.
        -   Ensure the container (e.g., PrimeVue `Panel`) is easily expandable/collapsible if it contains extensive information, or defaults to an expanded state if the information is critical and concise.

3.  **Confidence/Certainty Input Method**:
    -   **Issue**: The 1-5 scale sliders for confidence and certainty might not be the most intuitive or quickest input method for all users.
    -   **Recommendation**: Replace the `Slider` components with PrimeVue `SelectButton` components. Configure `SelectButton` with options representing the 1-5 scale (e.g., `[{label: '1', value: 1}, ..., {label: '5', value: 5}]`). This provides clear, clickable targets.

4.  **Default Route and Homepage Removal**:
    -   **Issue**: The application may have an unnecessary `HomePage.vue` or an initial route that isn't the main dashboard.
    -   **Recommendation**:
        -   Set `DashboardPage.vue` as the default route (e.g., path: `/` or `/dashboard`) for authenticated users.
        -   Implement a navigation guard in `router/index.ts` that redirects unauthenticated users attempting to access any protected route (including the dashboard) to the `LoginPage.vue`.
        -   The `HomePage.vue` component can likely be removed if its functionality is absorbed by the dashboard or login redirection logic.

5.  **Assessment Page Layout Optimization**:
    -   **Issue**: The assessment page (`CasePage.vue`) may require excessive vertical scrolling, especially with multiple sections (images, metadata, Pre-AI form, AI output, Post-AI form).
    -   **Recommendation**:
        -   Redesign the page layout to better utilize horizontal space. Consider a multi-column layout using PrimeFlex grid system (e.g., `p-grid`, `p-col-*`).
        -   Group related items to appear in the same row or in adjacent columns to minimize scrolling. For example:
            -   Case images and metadata could be in a top row, side-by-side if space allows.
            -   Pre-AI and Post-AI forms could be presented in tabs (`TabView`) or an accordion (`Accordion`) to show only one active form at a time, or side-by-side if the screen width is sufficient.
        -   Aim for a more compact and information-dense presentation without appearing cluttered.
