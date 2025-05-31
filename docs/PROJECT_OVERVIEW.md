# 📘 AI-Assisted Skin Diagnosis Reader Study Platform

## 🌟 Project Overview

This is a comprehensive web-based clinical reader study platform designed to evaluate how AI assistance affects clinician decision-making in dermatological diagnosis. Healthcare professionals assess skin condition cases in two distinct phases: first without AI assistance (Pre-AI), then with AI-generated suggestions (Post-AI). The platform measures changes in diagnostic accuracy, confidence levels, and management strategy selection to provide valuable insights for medical AI research.

## 🎯 Core Objectives

- **Measure AI Impact**: Track how AI suggestions influence diagnostic decisions
- **Capture Confidence Changes**: Monitor clinician confidence before and after AI exposure  
- **Evaluate Management Strategies**: Assess how AI affects treatment plan selection
- **Ensure Data Quality**: Robust data collection with local caching and API synchronization

---

## 🏗️ Technology Stack

### Frontend
- **Vue 3** with Composition API for reactive UI
- **Vite** for fast development and building
- **PrimeVue 4.x** for comprehensive UI components
- **Pinia** for centralized state management
- **Vue Router** for client-side navigation
- **Axios** for HTTP requests with interceptors
- **TypeScript** for type safety
- **Cypress** for end-to-end testing

### Backend (Provided)
- **FastAPI** with automatic OpenAPI documentation
- **JWT Authentication** via `fastapi-users`
- **PostgreSQL** database with SQLAlchemy ORM
- **Comprehensive REST API** for all data operations

---

## 📁 Folder Structure (Enforced)

```
/src
  /components         → Reusable PrimeVue components
  /pages              → Route-specific views (LoginPage.vue, CasePage.vue, etc.)
  /router             → Vue Router setup
  /stores             → Pinia stores (userStore, caseStore)
  /api                → Axios API abstraction
  /utils              → LocalStorage caching, formatters
  /assets             → Static images
/tests                → Cypress tests
```

---

## ⚖️ UX & Workflow Rules (Guardrails)

### 🧭 Case Navigation

* Reader sees one case at a time (sequential flow)
* They can skip any case and return later
* Users can resume where they left off
* Each case has 2 stages: **Pre-AI** and **Post-AI**
* Case is marked complete only when both phases are submitted

### 🧪 Pre-AI Form Inputs

* Top 3 ranked diagnosis (text)
* Confidence score (1–5 slider)
* Management strategy (dropdown + optional free-text)
* Certainty score (1–5)

### 🤖 Post-AI Phase

* Show Top-5 AI predictions (bar chart with rank + confidence)
* Repeat the form inputs above, prefixed with “Updated”
* AI output from `/ai_outputs/case/{id}`

---

## 🔒 Authentication Logic

* Login via `/auth/jwt/login`, save `access_token` to `localStorage`
* On app init, check for token → if missing or invalid, redirect to `/login`
* No refresh token → user must re-login on expiry

---

## 📀 State & Caching Logic

* User state stored in `userStore`, synced with localStorage
* Case progress tracked in `caseStore`
* On “Next” click:

  * Save assessment via `/assessments/`
  * Save diagnoses via `/diagnoses/`
  * Save management plan via `/management_plans/`
* Save responses locally as backup using `localStorage`
* When resuming, try to load from local first, then from API

---

## 📤 API Access & Assumptions

* Use Axios wrapper for all API calls
* Token is passed via `Authorization: Bearer {token}`
* Use API endpoints:

  * `/cases/`, `/cases/{id}`
  * `/images/case/{id}`
  * `/case_metadata/case/{id}`
  * `/ai_outputs/case/{id}`
  * `/assessments/`, `/diagnoses/`, `/management_plans/`
* Use `user_id` from `/auth/users/me` to associate responses

---

## 🧪 Testing Guardrails

* Cypress tests should cover:

  * Signup → Profile → Dashboard
  * Case flow (pre/post-AI)
  * Resume flow
  * Skipping a case
  * LocalStorage fallback
* Cypress can use mock case and user data

---

## 🔧 Design & Component Guidelines

* Use **PrimeVue** for all UI (Form inputs, Buttons, Carousels, Charts)
* Use **PrimeIcons** for visual cues
* Use **PrimeFlex** grid utilities for layout
* Prefer reusable form field components where possible
* Form validation handled via PrimeVue

---

## 📊 Data Model Examples

**AssessmentCreate Payload**

```json
{
  "is_post_ai": false,
  "user_id": 1,
  "case_id": 101,
  "assessable_image_score": 3,
  "confidence_level_top1": 4,
  "management_confidence": 3,
  "certainty_level": 4
}
```

**DiagnosisCreate Payload**

```json
{
  "assessment_id": 201,
  "diagnosis_id": 5,
  "rank": 1
}
```

**ManagementPlanCreate Payload**

```json
{
  "assessment_id": 201,
  "strategy_id": 3,
  "free_text": "Treat with oral antibiotics"
}
```

---

## 📂 Coding Conventions

* All files named in `PascalCase.vue`
* Store modules named `camelCaseStore.js`
* Use async/await with error handling
* Use constants or enums for:

  * Management strategies
  * Role types
* Comments should be present for:

  * API calls
  * State mutations
  * Navigation transitions

---

## 🚮 DO NOT

* Do not use TailwindCSS or DaisyUI
* Do not rely on manual token insertion (must auto-inject via Axios interceptor)
* Do not use sessionStorage or cookies
* Do not auto-save responses on each keystroke

---

## 📌 Summary

This project aims to:

* Provide a seamless case-by-case assessment experience
* Compare clinician decisions pre/post-AI
* Capture detailed form input and sync it reliably
* Be tested thoroughly with Cypress and resilient to disconnects
