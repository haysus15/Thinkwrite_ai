# Academic Studio Sprint J Validation (In Progress)

## Baseline
- Global type-check baseline at Sprint J start: `0` errors.

## Automated checks completed
- `npm run -s type-check:academic` passes.
- `npm run -s type-check` passes.
- `npx playwright test tests/academic-studio --reporter=list` passes (`22/22`).
- `npx playwright test tests/academic-studio/paper-step-progression.spec.js --reporter=list` passes (`9/9`).
- `npx playwright test tests/academic-studio/coding-review-hardening.spec.js -g "blocks placement submit until run, and shows inline error if output is cleared" --reporter=list` passes (`1/1`).
- Shell/navigation validation:
  - `/academic` shell header + nav persist across Academic routes.
  - Canonical route aliases added: `/academic/paper -> /academic/paper-workflow`, `/academic/math -> /academic/math-mode`, `/academic/dashboard -> /academic`.

## Worker Ant Scenarios (to complete manually)

| Scenario | Pre-Sprint Result | Post-Sprint Target | Post-Sprint Result |
|---|---|---|---|
| 1 — 11pm Paper | Pending | Under 15 min, no confusion | Pending |
| 2 — Morning Quiz | Pending | Under 5 min | Pending |
| 3 — First Time User | Pending | Workflow begun in 60 sec | Pending |
| 4 — Recovery | Pending | Work intact, path clear | Pending |
| 5 — Status Check | Pending | Urgent item in 10 sec | Pending |
| 6 — Cross-Workflow Navigation | N/A pre | Round trip under 30 sec, paper state intact | Pending |
| 7 — Tab Recognition | N/A pre | Correct section in one click | Pending |

## Notes
- Layer 0 shell is active under `/academic` with persistent header/nav and canonical alias routes.
- Layer 1 crash-surface hardening is active for key context providers and fallback state.
- Layer 2 partial: Dashboard urgency card, Agenda first-session day mode + URL persistence, Study Hub upload-first + immediate quiz prompt.
- Layer 3 partial: First-time entry screen and Paper quick-outline fast path added.
- Save-before-navigate guard now wired in:
  - Paper workflow (`workflow_step` persistence before nav)
  - Study Hub upload panel close + completion signal before nav
