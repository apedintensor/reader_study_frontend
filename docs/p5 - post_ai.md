# Post-AI Assessment (`CasePage.vue`) Enhancements

This guide details updating `CasePage.vue` to incorporate the Post-AI assessment phase, which follows the Pre-AI assessment for a given case.

## Phase Detection Logic

-   Determine if the current case (identified by `caseId` from route) has its Pre-AI assessment completed. This status should be available from `caseStore` (e.g., `caseStore.isPreAIComplete(caseId)`).
-   If Pre-AI is complete, render the Post-AI assessment section.

## Post-AI Section UI

1.  **Fetch AI Output**:
    -   Call `GET /api/ai_outputs/case/{id}` to retrieve AI predictions for the current case.

2.  **Display AI Predictions**:
    -   Present the Top 5 AI predictions. Recommended PrimeVue components:
        -   `Chart` (e.g., bar chart for confidence scores).
        -   `DataTable` or a series of `ProgressBar` components.
    -   Each prediction display should include: `prediction.name`, `rank`, and `confidence_score`.

## Post-AI Form

-   Render a form similar to the Pre-AI assessment, but clearly label inputs to indicate they are for updated assessments (e.g., "Updated Diagnosis 1", "Updated Confidence Score").
-   Reuse PrimeVue components:
    -   Three `InputText` fields for updated diagnoses.
    -   Two `Slider` components (updated confidence and certainty, 1-5 scale).
    -   `Dropdown` for updated management strategy (populated from `/api/management_strategies/`).
    -   Optional `InputText` or `Textarea` for additional notes on the updated management strategy.
-   **Additional Input**: Include a field for AI usefulness (e.g., a `SelectButton` or `Dropdown` with options like "Very useful", "Somewhat useful", "Not useful").

## Submission Logic ("Next" Button - Post-AI)

1.  **Create Assessment Record (Post-AI)**:
    -   `POST` to `/api/assessments/` with payload:
        ```json
        {
          "is_post_ai": true,
          "user_id": <current_user_id_from_store>,
          "case_id": <current_case_id_from_route>,
          "change_diagnosis_after_ai": <boolean_based_on_form_changes>,
          "change_management_after_ai": <boolean_based_on_form_changes>,
          "ai_usefulness": <value_from_ai_usefulness_input>,
          "confidence_level_top1": <value_from_updated_confidence_slider>,
          "management_confidence": <value_from_updated_confidence_slider>, // Or separate if design differs
          "certainty_level": <value_from_updated_certainty_slider>
        }
        ```
    -   Capture the `assessment_id` from the response.

2.  **Submit Updated Ranked Diagnoses**:
    -   `POST` to `/api/diagnoses/` (similar structure to Pre-AI, using the new `assessment_id`).

3.  **Submit Updated Management Plan**:
    -   `POST` to `/api/management_plans/` (similar structure to Pre-AI, using the new `assessment_id`).

## Post-Submission Actions (Post-AI)

-   Invoke `caseStore.markCaseComplete(caseId, 'post')` (or similar to update progress for Post-AI phase).
-   Navigate to the next case (`caseStore.goToNextCase()`) or to the completion page (`/complete`) if all cases are done.

## UI/UX Considerations

-   **Layout**: Consider displaying Pre-AI and Post-AI forms/summaries side-by-side or using `TabView` for toggling between them if space is limited.
-   **Drafting**: Cache Post-AI form data in `localStorage` before submission to prevent data loss.
-   **Transitions**: Optionally, add subtle transition animations between Pre-AI and Post-AI phases for a smoother user experience.
-   **Clarity**: Ensure clear visual distinction between Pre-AI inputs/data and Post-AI inputs/data.