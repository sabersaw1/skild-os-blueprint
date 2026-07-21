# Jobs Module

Phase 6 · Local-only · Module Contract v1

The Jobs module owns repair/service execution. It turns an approved quote
(or a walk-in) into a scheduled, assignable, trackable unit of work with
labor logs, status history, and freeform notes.

## Boundaries

- **Owns**: `Job`, `JobStatusHistory`, `LaborEntry`, `JobNote`, status
  transitions, assignment.
- **Does not own**: customers, vehicles, inspections, quotes, parts
  inventory, finance / payments, invoicing. These are referenced by ID
  only. The module never imports another module's repository
  implementation.
- **External surface**: `JobsRepository` (registered in the core Data
  Registry under `JOBS_REPOSITORY`), commands (`jobs.new`, `jobs.search`,
  `jobs.goto`), widget (`jobs.recentJobs`), routes under `/jobs/*`.

## Data flow

```text
Customer ──┐
Vehicle  ──┤
Quote?   ──┼─► Job (draft) ─► schedule ─► scheduled ─► start ─► in_progress
Inspection?┘                                     └► cancel ─► cancelled
                                                        ├► pause ─► paused ─► resume
                                                        └► complete ─► completed
```

Every Job carries an append-only `JobStatusHistory[]`, a set of
`LaborEntry[]` rows, and `JobNote[]` rows. Assignment is tracked directly
on `Job.assignedTo` (opaque technician id string — no Users module in
Phase 6).

See [jobs-model.md](../jobs-model.md) for entity fields and
[jobs-status.md](../jobs-status.md) for the transition rules.

## Storage

Repository-only writes, versioned envelope keys:

| Key                                | Entity                |
| ---------------------------------- | --------------------- |
| `skildos.jobs.jobs.v1`             | `Job[]`               |
| `skildos.jobs.status-history.v1`   | `JobStatusHistory[]`  |
| `skildos.jobs.labor.v1`            | `LaborEntry[]`        |
| `skildos.jobs.notes.v1`            | `JobNote[]`           |

v0 → v1 pass-through migrations are registered up front so the schema
version bump is safe without changing existing data.

## Capabilities

| Capability          | Grants                                        |
| ------------------- | --------------------------------------------- |
| `jobs.read`         | List / view jobs, history, labor, notes       |
| `jobs.write`        | Create / edit job scope, priority, schedule   |
| `jobs.status`       | Transition status between the allowed states  |
| `jobs.labor.write`  | Log labor entries                             |
| `jobs.notes.write`  | Add notes                                     |
| `jobs.assign`       | Assign / unassign a technician                |

Owner wildcard grants all six; other roles are opt-in and enforced by
`useHasCapability(...)` in every mutation UI.

## Activity events

Emitted through `@/core/activity/emitter`, immutable names. All events go
under `moduleId: "jobs"`:

- `job.created`
- `job.updated`
- `job.status.changed`
- `job.labor.added`
- `job.note.added`
- `job.assigned`

Mutation order is always `validate → persist → emit → return`.

## Routes

| Path                       | Purpose                                  |
| -------------------------- | ---------------------------------------- |
| `/jobs`                    | List + search + status/priority filters  |
| `/jobs/new`                | Create (customer, vehicle, links, scope) |
| `/jobs/$jobId`             | Detail: status, assignment, labor, notes |
| `/jobs/$jobId/edit`        | Edit scope, priority, schedule           |

All routes are declared with `createModuleRoute({ moduleId: "jobs" })`.

## UI capability gating

| Control                                                  | Capability(ies)     |
| -------------------------------------------------------- | ------------------- |
| "New job" button                                         | `jobs.write`        |
| Edit button + form submit                                | `jobs.write`        |
| Status transition buttons (Schedule / Start / …)         | `jobs.status`       |
| Log-labor form                                           | `jobs.labor.write`  |
| Add-note form                                            | `jobs.notes.write`  |
| Assign / unassign controls                               | `jobs.assign`       |
