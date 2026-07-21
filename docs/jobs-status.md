# Jobs — Status Model

Phase 6

## States

- `draft` — created but not yet on the schedule.
- `scheduled` — booked into a time slot.
- `in_progress` — technician is actively working.
- `paused` — work started, temporarily halted (waiting on parts, customer
  approval, bay availability, etc.).
- `completed` — terminal success state.
- `cancelled` — terminal abort state (may be reached from any non-terminal
  status).

## Transitions

```text
draft         ── schedule ─► scheduled
draft         ── cancel   ─► cancelled
scheduled     ── start    ─► in_progress
scheduled     ── cancel   ─► cancelled
in_progress   ── pause    ─► paused
in_progress   ── complete ─► completed
in_progress   ── cancel   ─► cancelled
paused        ── resume   ─► in_progress
paused        ── cancel   ─► cancelled
completed     (terminal)
cancelled     (terminal)
```

## Guarantees

1. **Self-transitions are rejected.** Calling `changeStatus(id, to)` where
   `from === to` throws — the UI must not offer a no-op button.
2. **Illegal transitions are rejected.** Any pair not in the table above
   throws with `Illegal job status transition <from> → <to>`.
3. **History is append-only.** Every accepted transition writes a
   `JobStatusHistory` row and emits exactly one `job.status.changed`
   event.
4. **`Job.updatedAt` is bumped** on every accepted transition.
5. **Terminal states are frozen** — from `completed` or `cancelled`, the
   repository has no forward transitions. Re-opening a job requires
   creating a new job that references the same customer/vehicle/quote.

## Reason field

Every transition accepts an optional trimmed `reason`. If provided, it is
stored on the history row and included in the emitted event payload.
