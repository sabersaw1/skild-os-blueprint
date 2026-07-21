# UI Guidelines

Skild OS is mobile-first. Every screen is designed at 390px width first and adapted upward.

## Layout

- Desktop: collapsible sidebar (icon-collapsible) + top bar.
- Mobile: bottom nav (3 items in Phase 1: Command Center, Activity, Settings) + top bar.
- The Command Bar (`⌘K`) is always available and is the fastest path between screens.

## Tokens

- All color/spacing/radius tokens live in `src/styles.css`.
- **Never** hardcode color utilities (`text-white`, `bg-black`, `bg-[#...]`) in components. Use semantic tokens.
- Dark mode is a class on `<html>` toggled by Appearance settings.

## Interaction

- Tap targets ≥ 44px on mobile.
- Every route change and every write emits an activity event.
- Toasts (`sonner`) are for transient feedback only; use the activity log for durable record.

## Accessibility

- Semantic landmarks: `<header>`, `<main>`, `<nav>`.
- Every interactive element is keyboard-reachable and has an accessible name.
- Focus rings must remain visible; do not remove them without a replacement.
