# Performance Baselines (Phase 1.5)

These numbers are the **regression gates** for Phase 2 onward. Every phase
must re-measure and MUST NOT regress any budget by more than the listed
tolerance without an ADR justifying the change.

## How to measure

Run against a production build (`npm run build && npm run preview`) served
locally, using Chrome DevTools Lighthouse in **Mobile** mode with the
default throttled profile, and Vite's build output for bundle numbers.

## Baselines & budgets

| Metric                                 | Baseline (Phase 1.5) | Budget (max) | Tolerance |
| -------------------------------------- | -------------------- | ------------ | --------- |
| Total client JS (uncompressed)         | TBD KB               | 500 KB       | +10%      |
| Total client JS (gzip)                 | TBD KB               | 180 KB       | +10%      |
| Initial route (`/`) JS (gzip)          | TBD KB               | 100 KB       | +10%      |
| CSS (gzip)                             | TBD KB               | 30 KB        | +10%      |
| Lighthouse Performance (mobile)        | TBD                  | ≥ 90         | -3        |
| Lighthouse Accessibility               | TBD                  | ≥ 95         | -2        |
| Lighthouse Best Practices              | TBD                  | ≥ 95         | -2        |
| First Contentful Paint (mobile, sim.)  | TBD ms               | 1500 ms      | +200 ms   |
| Time to Interactive (mobile, sim.)     | TBD ms               | 3000 ms      | +300 ms   |
| Cold boot to Command Center render     | TBD ms               | 1500 ms      | +200 ms   |
| Command Bar open latency (⌘K → focus)  | TBD ms               | 100 ms       | +30 ms    |
| Activity Log render (500 events)       | TBD ms               | 150 ms       | +50 ms    |

> **TBD** entries are to be filled the first time this document is opened
> against a production build. Values must be committed alongside the fill.
> Until then, Phase 2 PR reviewers should treat the **budget** column as
> the pass/fail threshold.

## Recording procedure

1. Fresh clone → `npm ci` → `npm run build` → `npm run preview`.
2. Open the preview in an incognito Chrome window.
3. Run Lighthouse (Mobile, Performance + A11y + Best Practices).
4. Note the compressed transfer size per route from the Network tab
   (disable cache, hard reload).
5. Use the DevTools Performance panel to record ⌘K open → focus and
   Activity Log render.
6. Update the table above with the observed values and commit.

## Regression policy

- Any single-metric regression beyond tolerance blocks the merge.
- If a regression is intentional (new required feature), open an ADR that
  proposes the new baseline and justifies the cost.
- Silent regressions are a bug even if features work.
