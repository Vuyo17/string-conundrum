# Architecture (MVC)

String Conundrum follows a Model-View-Controller split.

- Model: Firebase Authentication for identity; PostgreSQL for users, progress, attempts and lecturer-authored content.
- View: React frontend that only renders state from backend responses.
- Controller: Flask REST API responsible for execution, evaluation, and feedback mapping.

## Layer Responsibilities

- Frontend
  - Collect user code/answers.
  - Render visualized string state and feedback.
  - Send Firebase ID token as `Authorization: Bearer <token>`.

- Backend
  - Validate inputs.
  - Execute string code in a constrained sandbox.
  - Return normalized JSON suitable for rendering.
  - Detect misconception IDs and return explanation text.

- Firebase
  - Authenticate users and issue ID tokens verified by the backend.

- PostgreSQL
  - Store users and roles, per-module completion and scores, graded attempts, exam results, and lecturer-authored module content.

## Development Phases Supported

- Phase 1: API stubs and integration path.
- Phase 2: Visualizer + execution pipeline.
- Phase 3: Full concept modules and progression logic.
- Phase 4: Integration, evaluation, performance hardening.
