---
name: dansbart.se
description: A community's shared, hand-kept record of dance-worthy folk music.
colors:
  falu-red: "rgb(123 30 30)"
  falu-red-hover: "rgb(95 20 20)"
  falu-red-muted: "rgb(250 224 224)"
  accent-foreground: "rgb(255 255 255)"
  ochre-now-playing: "rgb(204 119 34)"
  spruce-selected: "rgb(10 92 54)"
  warm-ground: "rgb(250 247 242)"
  warm-ground-elevated: "rgb(255 253 250)"
  ink: "rgb(17 24 39)"
  ink-muted: "rgb(107 114 128)"
  hairline: "rgb(229 231 235)"
  success: "rgb(21 128 61)"
  error: "rgb(185 28 28)"
  pill-bg: "rgb(238 242 255)"
typography:
  body:
    fontFamily: "'Atkinson Hyperlegible Next Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "'Atkinson Hyperlegible Next Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
  headline:
    fontFamily: "'Atkinson Hyperlegible Next Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.3
  label:
    fontFamily: "'Atkinson Hyperlegible Next Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
rounded:
  sm: "1rem"
  lg: "1.5rem"
  full: "9999px"
spacing:
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  section: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.falu-red}"
    textColor: "{colors.accent-foreground}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.falu-red-hover}"
  button-secondary:
    backgroundColor: "{colors.falu-red-muted}"
    textColor: "{colors.falu-red}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.warm-ground-elevated}"
    rounded: "{rounded.lg}"
    padding: "16px"
  pill-active:
    backgroundColor: "{colors.falu-red-muted}"
    textColor: "{colors.falu-red}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
---

# Design System: dansbart.se

## Overview

**Creative North Star: "The Village Hall Ledger"**

dansbart.se reads as a community's shared, hand-kept record: warm, plain, and communally maintained, never a corporate music-streaming console. The home page rebuild is the first surface of this world: a warm paper-toned ground, rounded cards that lift gently off it, and one legible sans throughout, carrying the site's actual mechanism — the community votes to confirm a track's dance style and tempo, one entry at a time.

The system is communal and inviting: nothing gated, nothing intimidating, no sales language, no gamification chrome (no points, badges, streaks). Density is moderate — horizontally-scrolling rails of soft-cornered tiles, generous tap targets, and a search field and buttons sized for a 14-to-85-year-old, non-technical audience. Two visual-tone constraints are confirmed by the build: no cover art or imagery anywhere on the home page (copyright), and no separate display face — one voice, sized up or down by weight and size, not by switching fonts.

**Key Characteristics:**
- Warm, paper-toned ground with soft-lifted cards, never flat-white or corporate-gray.
- Falu red as the one primary action color; used sparingly (search button, active links, primary CTA).
- Fully rounded, soft geometry everywhere — no sharp corners.
- One sans (Atkinson Hyperlegible Next) at every size; no display/body pairing.
- Rails of tiles (dance styles, artists, playlists) as the home page's signature composition.

## Colors

The palette draws on Swedish folk-culture color on a warm neutral ground; each accent carries one fixed semantic role, never a decorative one.

### Primary
- **Falu Red** (`rgb(123 30 30)`, dark theme `rgb(224 122 122)`): the primary action color — the search button, primary CTA, active section links, focus rings. Used sparingly, on the control a person presses most.

### Secondary
- **Ochre** (`rgb(204 119 34)`, dark theme `rgb(230 170 90)`): marks the track playing now. Reserved for the player; not a general-purpose accent.
- **Spruce Green** (`rgb(10 92 54)`, dark theme `rgb(110 211 163)`): marks a selected or toggled state, for example the active sidebar item's tinted background and text.

### Neutral
- **Warm Ground** (`rgb(250 247 242)`, dark theme `rgb(26 20 18)`): the page background. Warm, not gray.
- **Warm Ground Elevated** (`rgb(255 253 250)`, dark theme `rgb(40 31 28)`): card and input surfaces, one step lighter than the ground.
- **Ink** (`rgb(17 24 39)`): primary text.
- **Ink Muted** (`rgb(107 114 128)`): secondary text, captions, helper copy.
- **Hairline** (`rgb(229 231 235)`): borders and dividers, always at reduced opacity (`/50`) against a card, never a full-strength rule.

### Named Rules
**The Fixed-Role Accent Rule.** Falu red, ochre, and spruce green each carry exactly one semantic role (primary action, now-playing, selected) system-wide. Do not repurpose one for a new meaning on a new surface; add a new token instead.

**The Style-Badge Independence Rule.** Each of the eleven dance styles keeps its own fixed badge color (`src/styles/danceStyleColors.ts`, one light/dark pair per style plus family fallbacks for triple/duple meter) wherever a track lists its style. These colors are a separate, per-style system and are never substituted with the primary/selected/now-playing roles.

## Typography

**Body Font:** Atkinson Hyperlegible Next Variable (with `ui-sans-serif, system-ui, sans-serif` fallback)

**Character:** One legible, humanist sans carries every size and weight; the system commits to a single voice rather than a display/body pairing, in service of a non-technical, all-ages audience.

### Hierarchy
- **Headline** (700, 1.5rem/24px, 1.3 line-height): the page's `<h1>`, e.g. "Bibliotek".
- **Title** (600, 1.125rem/18px, 1.4 line-height): section headings, e.g. "Dansstilar", card titles.
- **Body** (400, 1rem/16px, 1.5 line-height): running copy, descriptions, form input text.
- **Label** (500, 0.875rem/14px, 1.4 line-height): buttons, pills, nav items, captions ("2082 låtar").

### Named Rules
**The One Voice Rule.** No second font family is introduced for headlines, numerals, or emphasis. Weight and size carry hierarchy; the family never changes.

## Layout

The home page composes as a single scrollable column of sections (`space-y-8`), each with a title row (`SectionTitle`, with an optional "Se alla" link) and content below. The signature pattern is the horizontally-scrolling rail: a flex row of fixed-width tiles (`w-36`, 144px) with `overflow-x-auto` and a hidden scrollbar (`scrollbar-hide` utility), used identically for dance styles, artists, and playlists. Tiles gap at `gap-3` (12px); sections stack at `space-y-8` (32px).

The layout is responsive by reflow, not by a distinct mobile composition: the same rails and card widths persist from desktop to phone, with the sidebar collapsing to a hamburger-triggered slide-in overlay below the desktop breakpoint (see Navigation).

## Elevation & Depth

Depth is soft and layered, not flat and not neobrutalist. Cards lift gently off the warm ground with a diffuse, low-contrast shadow; there is no hard-offset or outlined "sticker" shadow anywhere in the built surface.

### Shadow Vocabulary
- **Card lift** (`box-shadow: 0 8px 24px -4px rgb(0 0 0 / 0.10), 0 2px 6px -2px rgb(0 0 0 / 0.06)`, dark theme `0.45`/`0.3` alpha): the one shadow token in the system (`--color-card-shadow`), used on every `Card` and on `StyleShortcutCard`. No second, heavier "modal" shadow exists.

### Named Rules
**The Ambient Lift Rule.** Shadows are ambient, not structural: they signal that a surface is a card, not that it is interactive or urgent. Hover state changes background tint or scale, never shadow depth.

## Shapes

Corners are generously and consistently rounded: `--radius` (1rem/16px) for buttons, inputs, and badges; `--radius-lg` (1.5rem/24px) for cards and the dance-style tiles; `--radius-full` for pills, the search field, and avatar placeholders. No sharp corner appears anywhere in this world. Borders, where present, are hairline and low-opacity (`border-[rgb(var(--color-border))]/50`), never a heavy or colored outline.

## Components

### Buttons
- **Shape:** fully rounded corners (`--radius`, 1rem), minimum 44px height (`min-h-11`).
- **Primary:** Falu red background, white text, `px-4 py-2` at default size; hovers to a darker red (`--color-accent-hover`).
- **Secondary:** Falu-red-muted background with Falu red text and a hairline border.
- **Ghost:** transparent, text-colored, hover to a faint black tint.
- **Danger:** reserved for destructive actions; red background, distinct from Falu red.

### Chips / Pills
- **Style:** fully rounded (`--radius-full`), `px-3 py-1.5`, text-sm font-medium.
- **State:** inactive pills use a muted hairline-tinted background; active pills use the accent-muted/accent pairing, except the Pill component's `green`/`red` variants which map to Spotify/YouTube source identity, not to the design system's semantic roles.

### Cards / Containers
- **Corner Style:** `--radius-lg` (1.5rem).
- **Background:** warm-ground-elevated, one step lighter than the page ground.
- **Shadow Strategy:** the single ambient card-lift shadow (see Elevation & Depth).
- **Border:** hairline, 50%-opacity.
- **Internal Padding:** `p-3` (12px) for rail tiles, `p-4` (16px) for row-layout cards.

### Inputs / Fields
- **Style:** hairline border, warm-ground-elevated background, fully rounded when it is a search field (`rounded-full`), `--radius` otherwise; minimum 44px height.
- **Focus:** border shifts to Falu red, with a matching 1px focus ring on the search field and a 2px offset ring on standard fields and buttons.

### Navigation
- Sidebar nav items are left-aligned rows with a leading icon and label, weight and a tinted spruce-green background marking the active item (`bg-[--color-selected]/10`, no colored left-border or bar). Inactive items are plain text with a hairline hover tint.
- On mobile the sidebar becomes a hamburger-triggered slide-in overlay (inside `Layout.tsx`), not a persistent bar.

### Rail Tile (signature component)
The horizontally-scrolling tile rail is the home page's signature pattern, reused three times with two distinct tile shapes:
- **Dance-style tile** (`StyleShortcutCard`): a solid-colored card in the dance style's own fixed hue, left-aligned title and count, no icon.
- **Artist tile** (`ArtistCard`, `layout="tile"`): a neutral `Card` with a centered 56px circular avatar placeholder above a centered name.
- **Playlist tile** (`PlaylistShortcutCard`): a neutral `Card` with a bottom-anchored, left-aligned 40px rounded-square icon tile above the name.

## Do's and Don'ts

### Do:
- **Do** use Falu red only for the primary action and active-link role; do not extend it to decorative accents.
- **Do** keep every corner fully rounded (`--radius`, `--radius-lg`, or `--radius-full`); a sharp corner does not belong in this world.
- **Do** keep the one-sans rule: size and weight carry hierarchy, not a second font family.
- **Do** keep card depth ambient and soft (the single `--color-card-shadow` token); do not introduce a hard-offset or outlined shadow.
- **Do** keep each dance style's badge color fixed and independent of the primary/selected/now-playing roles, wherever a track lists its style.

### Don't:
- **Don't** add a hard-offset, outlined, or neobrutalist-style shadow; the built system uses one soft, diffuse shadow only.
- **Don't** introduce a display or headline typeface; the system commits to one sans voice at every size.
- **Don't** treat a bottom tab bar as an existing pattern. The home page's own direction contract names one for mobile, but no bottom tab bar exists anywhere in the shipped app; mobile navigation is a hamburger-triggered slide-in sidebar overlay. Building a bottom tab bar is a site-wide navigation change for the maintainer to decide, not an inherited system rule.
- **Don't** treat the two rail-tile shapes (`ArtistCard` tile vs. `PlaylistShortcutCard`) as fully confirmed: they were corrected in a design review but the reviewed captures only showed the playlists rail's logged-out prompt, never real logged-in playlist data. Reviewed in code, not yet in render.
