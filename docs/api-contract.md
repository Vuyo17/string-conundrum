# API Contract (Frozen for Phase 1)

Base URL: `/api`
Content type: `application/json`

## 1) POST `/api/visualize`

Purpose: Convert a string operation into render-ready visualization state.

Request:
```json
{
  "expression": "word[1:4]",
  "context": {
    "word": "python"
  }
}
```

Response:
```json
{
  "ok": true,
  "visual_state": {
    "source": {
      "value": "python",
      "cells": [
        {"char": "p", "index": 0},
        {"char": "y", "index": 1}
      ]
    },
    "result": {
      "value": "yth",
      "cells": []
    },
    "highlighted_indices": [1, 2, 3],
    "operation": "slice"
  }
}
```

## 2) POST `/api/execute`

Purpose: Run a constrained string expression and return output/state.

Request:
```json
{
  "code": "name = 'Ada'\nprint(name.upper())"
}
```

Response:
```json
{
  "ok": true,
  "stdout": "ADA\n",
  "stderr": "",
  "timed_out": false,
  "visual_state": null
}
```

## 3) POST `/api/exercises/submit`

Purpose: Evaluate learner answer and return misconception-targeted feedback.

Request:
```json
{
  "module_id": "immutability",
  "question_id": "immut-01",
  "answer": "original string changed in place"
}
```

Response:
```json
{
  "ok": true,
  "correct": false,
  "misconception_id": "immutability_in_place",
  "feedback": "Strings are immutable. Operations create new strings instead of editing in place."
}
```

## 4) GET `/api/progress/<user_id>`

Purpose: Fetch module progress and scores.

Response:
```json
{
  "ok": true,
  "user_id": "demo-user",
  "modules": [
    {
      "module_id": "intro",
      "completed": false,
      "score": 0,
      "last_session_at": null
    }
  ]
}
```
