# Jobs — Data Model

Phase 6 · Local-only

All entities are owned by the Jobs module. Cross-module references
(`customerId`, `vehicleId`, `quoteId`, `inspectionId`) are opaque ID
strings; the module never imports another module's repository.

## `Job`

| Field            | Type               | Notes                                                                     |
| ---------------- | ------------------ | ------------------------------------------------------------------------- |
| `id`             | `string` (UUID v4) | From `@/core/ids`                                                         |
| `customerId`     | `string`           | Required                                                                  |
| `vehicleId`      | `string`           | Required                                                                  |
| `quoteId?`       | `string`           | Optional — the approved quote that spawned this job                       |
| `inspectionId?`  | `string`           | Optional — the inspection that surfaced the findings                      |
| `title`          | `string`           | Trimmed, non-empty                                                        |
| `description`    | `string`           | Free text; scope of work                                                  |
| `status`         | `JobStatus`        | `draft` \| `scheduled` \| `in_progress` \| `paused` \| `completed` \| `cancelled` (starts at `draft`) |
| `priority`       | `JobPriority`      | `low` \| `normal` \| `high` \| `urgent` (defaults to `normal`)            |
| `scheduledStart?`| `number`           | epoch ms                                                                  |
| `scheduledEnd?`  | `number`           | epoch ms; must be ≥ `scheduledStart` when both are present                |
| `assignedTo?`    | `string`           | Free-form technician id / name (no Users module in Phase 6)               |
| `notes`          | `string`           | Free text summary; discrete notes live in `JobNote`                       |
| `createdAt`      | `number`           | epoch ms                                                                  |
| `updatedAt`      | `number`           | epoch ms; bumped by every mutation (including labor/notes/assign)         |
| `createdBy`      | `string`           | Identity id at create time                                                |

## `JobStatusHistory`

Append-only audit row created for every status transition.

| Field         | Type          | Notes                            |
| ------------- | ------------- | -------------------------------- |
| `id`          | `string`      | UUID v4                          |
| `jobId`       | `string`      | Parent job id                    |
| `fromStatus`  | `JobStatus`   | Previous status                  |
| `toStatus`    | `JobStatus`   | New status                       |
| `changedBy`   | `string`      | Identity id                      |
| `reason?`     | `string`      | Optional user-supplied note      |
| `createdAt`   | `number`      | epoch ms                         |

## `LaborEntry`

| Field         | Type          | Notes                                          |
| ------------- | ------------- | ---------------------------------------------- |
| `id`          | `string`      | UUID v4                                        |
| `jobId`       | `string`      | Parent job id                                  |
| `description` | `string`      | Trimmed, non-empty                             |
| `hours`       | `number ≥ 0`  |                                                |
| `rate`        | `number ≥ 0`  | Hourly rate at logging time                    |
| `createdAt`   | `number`      | epoch ms                                       |
| `createdBy`   | `string`      | Identity id                                    |

Line total = `hours * rate` (not persisted; computed at read time).

## `JobNote`

| Field         | Type       | Notes                              |
| ------------- | ---------- | ---------------------------------- |
| `id`          | `string`   | UUID v4                            |
| `jobId`       | `string`   | Parent job id                      |
| `body`        | `string`   | Trimmed, non-empty                 |
| `createdAt`   | `number`   | epoch ms                           |
| `createdBy`   | `string`   | Identity id                        |

## Priority

`low`, `normal`, `high`, `urgent` — free-form scheduling hint; no
automatic behavior in Phase 6.

## Validation summary

- `customerId`, `vehicleId`, and `title` are required on create.
- `priority`, when supplied, must be one of the four allowed values.
- Schedule: both endpoints must be finite numbers; if both are set,
  `scheduledEnd >= scheduledStart`.
- Labor: `description` non-empty, `hours >= 0`, `rate >= 0`.
- Notes: `body` non-empty after trim.
- Status transitions: see [jobs-status.md](../jobs-status.md).
