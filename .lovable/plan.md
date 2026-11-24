# Studios desktop split and compact cards

## Scope
- Rebalance the `/studios` desktop split at 1280px and above to approximately 48% list and 52% map while preserving the sticky full-height map and all stacked layouts below 1280px.
- Let the app shell use nearly the full viewport at 2xl widths with 32px horizontal padding.
- Refactor studio cards in the desktop list into a compact 96px-photo layout with a two-line studio title, right-aligned rating, English-only service and price, a stable distance/directions row, and one tightly wrapped action row.

## Technical details
- Keep existing list-to-pin and pin-to-list hover synchronization unchanged.
- Use responsive Tailwind layout classes and semantic design tokens only.
- Use a two-line clamp for long names and a single clean ellipsis for the complete service phrase; avoid mid-word clipping.
- Verify rendered layout and overflow at 1280, 1440, and 1920 widths, plus run the relevant build check.

## Acceptance
- The map/list ratio is approximately 52/48 at desktop split widths.
- At 1280, 1440, and 1920, titles, distance controls, and action chips remain readable without incoherent clipping or overlap.
- The map remains sticky and full height, and layouts below 1280px are unchanged.
