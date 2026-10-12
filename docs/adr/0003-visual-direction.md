# ADR 0003 — Visual direction and original assets

Status: accepted (2026-10-11)

## Context
Rulebook crops are low-res and © Splotter Spellen. We want a beautiful, publishable game.

## Decision
- **Original art**: saturated cartoon (Overcooked-like) with a **50s Americana** theme.
- **Top-down with depth**: soft drop shadows, buildings with relief, light parallax,
  smooth pan/zoom. Not isometric (placement/hit-testing/asset cost).
- **Time of day** per round; **neon signs with bloom** during Dinnertime; animated
  customers walking to restaurants; coins flying to the cash register.
- Assets are **hand-authored SVG**, rasterized into textures at runtime, referenced via
  an **asset manifest** so they can be replaced later without code changes.
- Map tiles reproduce the **layout** of the 20 original base tiles (A–T) with our art.
- Desktop only, English only.

## Consequences
- `assets/` crops are reference/placeholders and must not ship in a public build.
- `reference/tiles/` holds third-party tile photos for transcription only; not shipped.
