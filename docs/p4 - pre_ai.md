# Pre-AI Assessment Page (`CasePage.vue`) Guide

This guide outlines the creation of `src/pages/CasePage.vue` for the pre-AI assessment phase.

## Core Functionality

-   **Route Parameter**: Utilize `caseId` from the route (`/case/:id`).
-   **Data Fetching**: On component mount, fetch:
    -   Case details: `/api/cases/{id}`
    -   Case images: `/api/images/case/{id}`
    -   Case metadata: `/api/case_metadata/case/{id}`
    -   Management strategies: `/api/management_strategies/`

## UI Display

-   **Case Images**: Use PrimeVue `Carousel` to display images.
-   **Metadata**: Present gender, age, history, etc., in a PrimeVue `Panel` (collapsible preferred).

## Form Inputs (Pre-AI)

Use PrimeVue components for the following fields:

1.  **Top 3 Ranked Diagnoses**: Three `InputText` fields. Values should be submitted in ranked order.
2.  **Confidence Score**: `Slider` (1-5 scale) for the top diagnosis.
3.  **Management Strategy**: `Dropdown` populated from `/api/management_strategies/`.
    -   Include an optional `InputText` or `Textarea` for additional notes.
4.  **Certainty Score**: `Slider` (1-5 scale) for the chosen management strategy.

## Submission Logic ("Next" Button)

1.  **Create Assessment Record**:
    -   `POST` to `/api/assessments/` with payload:
        ```json
        {
          "is_post_ai": false,
          "user_id": <current_user_id_from_store>,
          "case_id": <current_case_id_from_route>,
          "assessable_image_score": <optional_score_if_applicable>,
          "confidence_level_top1": <value_from_confidence_slider>,
          "management_confidence": <value_from_confidence_slider>, // Or a separate slider if design differs
          "certainty_level": <value_from_certainty_slider>
        }
        ```
    -   Capture the `assessment_id` from the response.

2.  **Submit Ranked Diagnoses**:
    -   `POST` to `/api/diagnoses/` with an array:
        ```json
        [
          { "assessment_id": <assessment_id>, "diagnosis_id": <id_for_rank_1>, "rank": 1 },
          { "assessment_id": <assessment_id>, "diagnosis_id": <id_for_rank_2>, "rank": 2 },
          { "assessment_id": <assessment_id>, "diagnosis_id": <id_for_rank_3>, "rank": 3 }
        ]
        ```
        *(Note: `diagnosis_id` might require a lookup or be based on pre-defined terms initially.)*

3.  **Submit Management Plan**:
    -   `POST` to `/api/management_plans/` with payload:
        ```json
        {
          "assessment_id": <assessment_id>,
          "strategy_id": <selected_id_from_dropdown>,
          "free_text": <optional_notes_value>
        }
        ```

## Post-Submission Actions

-   Invoke `caseStore.markCaseComplete(caseId, 'pre')` (or similar action to update progress).
-   Navigate to the next case using `caseStore.goToNextCase()` which should resolve to `/case/:nextId` or `/complete` if all done.

## Additional Considerations

-   **Form Validation**: Implement client-side validation using PrimeVue's built-in features or a library like Vuelidate.
-   **Drafting**: Save temporary form inputs to `localStorage` to prevent data loss on accidental closure or crash. Clear drafts on successful submission.