---
paths:
  - "**/frontend/**"
---

# Frontend rules

## Checks

Run these commands in `frontend/` before you commit:

```bash
npm run type-check
npm run lint
npm run test:run
```

## Text

- Write all user-visible text in Swedish. Use å, ä, and ö: "längd", "långsamt", "högst".
- Use sentence case. Do not use `uppercase tracking-widest` for labels.
- Name people as the beneficiary. Do not credit "systemet" or "AI" for work that people did.

## Accessibility

Many users are older and non-technical. Apply these rules to each component you touch:

- Use at least 14px text for body text and controls. Remove `text-[9px]`, `text-[10px]`, and `text-[11px]`.
- Do not make text smaller on larger screens.
- Make tap targets at least 44x44px.
- Give every control a strong clickability cue: a button shape and a visible icon or word.
- Use a visible word when the action is new or has no widely known icon.
- Give every control an accessible name with a verb.
- Give each control one behaviour in all states. If the look of the control shows its next behaviour, for example a sort button with a direction arrow, a second behaviour is allowed.
- Show every status with a word. A widely known icon, for example a sort direction arrow, may stand alone if it has an accessible name.
- Show a success after an action as a toast that fades.
- Show an error that a person must act on next to the control it concerns, and keep it until the person retries or changes the input.
- Keep a prompt for a contribution, and the acknowledgment after a vote, visible until the person closes it or moves on.

## Components

- Before you create a component, search `src/components/`, `src/ui/`, and `src/layout/`. Reuse or extend what exists.
- Import from `src/` with the `@` alias.

## API client

- `src/api/generated/` and `src/api/models/` contain generated code. Do not edit these files.
- To regenerate them, start the API locally and run `npm run api:update`.
- `src/api/manual/` contains hand-written clients.

## Tests

- Make every mock and simulated event match the real app. Use `src/test/authValue.ts` for auth, `src/test/typeInto.ts` for typing, and `src/test/getInputByLabel.ts` for finding inputs. Change app code to meet a behaviour that a test asserts, never to fit a mock.

## Product decisions

Do not change these without the maintainer:

- Classification does not require login.
- No points, badges, streaks, or leaderboards.
- Bulk tables are for admin pages only.
