---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-07-31T12:31:19.800Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | unrun-verify | .github/workflows/db-ci.yml |  | Actual GitHub Actions run success and branch protection on main not verified — no gh CLI / GitHub token in execution environment; requires pushing branch + opening PR + GitHub UI (plan's own human-check) | open |  | 2026-07-31T12:31:19.800Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "01",
    "file": ".github/workflows/db-ci.yml",
    "line": null,
    "description": "Actual GitHub Actions run success and branch protection on main not verified — no gh CLI / GitHub token in execution environment; requires pushing branch + opening PR + GitHub UI (plan's own human-check)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-31T12:31:19.800Z",
    "resolved_at": null
  }
]
````
