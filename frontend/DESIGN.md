---
name: dansbart.se
description: A community's shared, hand-kept record of dance-worthy folk music.
colors:
  ink: "rgb(21 24 28)"
  ink-hover: "rgb(50 55 62)"
  ink-muted: "rgb(89 96 105)"
  ground: "rgb(243 243 239)"
  surface: "rgb(255 255 255)"
  hairline: "rgb(225 225 219)"
  control-border: "rgb(138 143 150)"
  secondary-fill: "rgb(233 233 228)"
  blue-link: "rgb(30 74 138)"
  amber-playing: "rgb(204 122 31)"
  amber-playing-text: "rgb(138 75 8)"
  success: "rgb(31 107 58)"
  error: "rgb(185 28 28)"
  on-ink: "rgb(255 255 255)"
typography:
  body:
    fontFamily: "'Schibsted Grotesk Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "'Schibsted Grotesk Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  headline:
    fontFamily: "'Schibsted Grotesk Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  label:
    fontFamily: "'Schibsted Grotesk Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "0.5rem"
  lg: "0.75rem"
  full: "9999px"
spacing:
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  section: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    minHeight: "44px"
  button-primary-hover:
    backgroundColor: "{colors.ink-hover}"
  button-secondary:
    backgroundColor: "{colors.secondary-fill}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
  card:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "16px"
  pill-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  pill-selected:
    backgroundColor: "rgb(30 74 138 / 0.10)"
    textColor: "{colors.blue-link}"
---

# Design System: dansbart.se

## Overview

**Creative North Star: "The Village Hall Ledger"**

dansbart.se reads as a community's shared, hand-kept record: plain, calm and communally maintained, never a corporate music-streaming console. The home page rebuild is the first surface of this world: a cool stone ground, white hairline-bordered cards, and one grotesk throughout, carrying the site's actual mechanism — the community votes to confirm a track's dance style and tempo, one entry at a time.

The system is communal and inviting: nothing gated, nothing intimidating, no sales language, no gamification chrome (no points, badges, streaks). Density is moderate — horizontally-scrolling rails of soft-cornered tiles, generous tap targets, and a search field and buttons sized for a 14-to-85-year-old, non-technical audience. Two visual-tone constraints are confirmed by the build: no cover art or imagery anywhere on the home page (copyright), and no separate display face — one voice, sized up or down by weight and size, not by switching fonts.

**Key Characteristics:**
- Cool stone ground with white, hairline-bordered cards; no shadows in the page flow.
- Ink as the one action colour, blue for links and selection, amber for playback. Nothing else is coloured except the dance styles.
- Fully rounded, soft geometry everywhere — no sharp corners.
- One sans (Atkinson Hyperlegible Next) at every size; no display/body pairing.
- Rails of tiles (dance styles, artists, playlists) as the home page's signature composition.

## Colors

Clean slate as of October 2026. Three colour roles, one neutral family, and one colour pair per dance style. Nothing else is coloured.

### Roles
- **Ink** (`--color-accent`, `rgb(21 24 28)`; dark theme `rgb(236 237 238)`): the action colour. Primary buttons, the play control, active chips.
- **Blue** (`--color-link`, `--color-selected`, `--color-focus`, `rgb(30 74 138)`; dark theme `rgb(138 174 230)`): links, the selected or toggled state, and the focus ring.
- **Amber** (`--color-now-playing`, `rgb(204 122 31)`; dark theme `rgb(232 160 70)`): playback state only. Progress fill, the ring on the playing row, the current queue item. Amber is a fill, never text; words about playback use `--color-now-playing-text`.

### Neutrals
- **Ground** (`--color-bg`, `rgb(243 243 239)`): cool stone, the page background.
- **Surface** (`--color-bg-elevated`, `rgb(255 255 255)`): cards, rows, inputs.
- **Hairline** (`--color-border`, `rgb(225 225 219)`): dividers and card borders. Decorative, so it may sit below 3:1.
- **Control border** (`--color-border-strong`, `rgb(138 143 150)`): borders on inputs and selects. Clears 3:1 against the surface, as WCAG 1.4.11 requires for a control boundary.
- **Ink** (`--color-text`) and **Ink muted** (`--color-text-muted`, `rgb(89 96 105)`, 5.7:1 on the ground).

### Dance style colours
Each of the eleven styles keeps one colour pair in `src/styles/danceStyleColors.ts`, used wherever a track lists its style. Warm hues are tretakt (Polska, Hambo, Vals, Mazurka, Slängpolska, Menuett); cool hues are tvåtakt (Polka, Schottis, Snoa, Engelska, Gånglåt). Light backgrounds share one lightness and text colours another, so every pair clears 4.5:1 in both themes.

### Named Rules
**The Three Roles Rule.** Ink acts, blue links and selects, amber plays. A new meaning gets a new token, never a repurposed one.

**The Shape-Not-Hue Rule.** Confidence is never a colour. A confirmed style is a filled pill with a check; a guess is a dashed outline in the same colour with a question mark; an unknown style is a grey dashed outline with a plus. This also satisfies WCAG 1.4.1.

## Typography

**Body Font:** Schibsted Grotesk Variable (served from the site's own origin via `@fontsource-variable/schibsted-grotesk`, with `ui-sans-serif, system-ui, sans-serif` fallback)

**Character:** One grotesk at every size. Weight, size and tight tracking on headlines carry hierarchy; the family never changes.

### Hierarchy
- **Headline** (700, 32px, 1.15, tracking -0.01em): the page `<h1>`.
- **Title** (700, 20px, 1.3): section headings and card titles.
- **Body** (400, 15px, 1.5): row titles at 700, running copy, inputs.
- **Label** (600, 13px, 1.4): pills, meta columns, captions, tab labels.

### Named Rules
**The One Voice Rule.** No second font family for headlines, numerals or emphasis.

**The 13 px Floor.** WCAG sets no minimum size, but nothing a person reads is set below 13px and nothing they press below 14px. Numerals that align (durations, positions) use tabular figures.

## Layout

The home page composes as a single scrollable column of sections (`space-y-8`), each with a title row (`SectionTitle`, with an optional "Se alla" link) and content below. The signature pattern is a row of fixed-width tiles (`w-36`, 144px) at `gap-3` (12px); sections stack at `space-y-8` (32px). Dansstilar is a fixed, known set (eleven styles today) and wraps onto as many rows as needed (`flex flex-wrap`) rather than scrolling — every style is visible without a "Se alla" link. Utvalda artister and Spellistor are open-ended, unbounded lists and stay horizontally-scrolling rails (`overflow-x-auto` with a hidden scrollbar, the `scrollbar-hide` utility), each with a "Se alla" link to browse the rest.

The layout is responsive by reflow, not by a distinct mobile composition: the same rails and card widths persist from desktop to phone, with the sidebar collapsing to a hamburger-triggered slide-in overlay below the desktop breakpoint (see Navigation).

## Elevation & Depth

Depth is drawn with hairlines, not shadows. Cards and rows sit on the surface colour with a 1px hairline border and no shadow. The one shadow token (`--color-card-shadow`) is reserved for floating layers: menus, dialogs and the nudge card.

### Named Rules
**The Floating-Only Rule.** A shadow means the element floats above the page. Nothing in the page flow casts one.

## Shapes

Two radii: `--radius` (0.5rem, 8px) for buttons, inputs, selects and chips that are not pills; `--radius-lg` (0.75rem, 12px) for cards, tiles, rows containers and dialogs. `--radius-full` for pills, avatars and the search field. Borders are 1px hairlines; the only 2px border is the focus ring.

## Components

### Buttons
- **Shape:** `--radius` (8px) corners, minimum 44px height (`min-h-11`).
- **Primary:** ink background, white text, `px-4 py-2` at default size; hovers to `--color-accent-hover`.
- **Secondary:** `--color-accent-muted` fill with ink text, no border. **Outline:** transparent with a hairline border.
- **Ghost:** transparent, text-colored, hover to a faint black tint.
- **Danger:** reserved for destructive actions; red background, or red outline inside a red-bordered section.

### Chips / Pills
- **Style:** fully rounded (`--radius-full`), `px-3 py-1.5`, text-sm font-medium.
- **State:** inactive pills use a muted hairline-tinted background; active pills use the accent-muted/accent pairing, except the Pill component's `green`/`red` variants which map to Spotify/YouTube source identity, not to the design system's semantic roles.

### Cards / Containers
- **Corner Style:** `--radius-lg` (12px).
- **Background:** `--color-bg-elevated` (white) on the stone ground.
- **Shadow Strategy:** the single ambient card-lift shadow (see Elevation & Depth).
- **Border:** hairline, 50%-opacity.
- **Internal Padding:** `p-3` (12px) for rail tiles, `p-4` (16px) for row-layout cards.

### Inputs / Fields
- **Style:** `--color-border-strong` border (3:1 against the surface), white background, fully rounded when it is a search field (`rounded-full`), `--radius` otherwise; minimum 44px height.
- **Focus:** a 2px `--color-focus` (blue) outline offset 2px, on every focusable element.

### Navigation
- Sidebar nav items are left-aligned rows with a leading icon and label, weight and a tinted blue background marking the active item (`bg-[--color-selected]/10`, no colored left-border or bar). Inactive items are plain text with a hairline hover tint.
- On mobile the sidebar becomes a hamburger-triggered slide-in overlay (inside `Layout.tsx`), not a persistent bar.

### Rail Tile (signature component)
The tile is the home page's signature shape, reused three times with two distinct treatments:
- **Dance-style tile** (`StyleShortcutCard`): a solid-colored card in the dance style's own fixed hue, left-aligned title and count, no icon. Wraps in a static grid rather than scrolling (see Layout).
- **Artist tile** (`ArtistCard`, `layout="tile"`): a neutral `Card` with a centered 56px circular avatar placeholder above a centered name that wraps onto multiple lines rather than truncating.
- **Playlist tile** (`PlaylistShortcutCard`): a neutral `Card` with a bottom-anchored, left-aligned 40px rounded-square icon tile above the name.

## Do's and Don'ts

### Do:
- **Do** keep the three colour roles: ink acts, blue links and selects, amber plays. Do not extend any of them to decoration.
- **Do** keep every corner fully rounded (`--radius`, `--radius-lg`, or `--radius-full`); a sharp corner does not belong in this world.
- **Do** keep the one-sans rule: size and weight carry hierarchy, not a second font family.
- **Do** keep card depth ambient and soft (the single `--color-card-shadow` token); do not introduce a hard-offset or outlined shadow.
- **Do** keep each dance style's badge color fixed and independent of the primary/selected/now-playing roles, wherever a track lists its style.

### Don't:
- **Don't** add a hard-offset, outlined, or neobrutalist-style shadow; the built system uses one soft, diffuse shadow only.
- **Don't** introduce a display or headline typeface; the system commits to one sans voice at every size.
- **Don't** treat a bottom tab bar as an existing pattern. The home page's own direction contract names one for mobile, but no bottom tab bar exists anywhere in the shipped app; mobile navigation is a hamburger-triggered slide-in sidebar overlay. Building a bottom tab bar is a site-wide navigation change for the maintainer to decide, not an inherited system rule.
- **Don't** treat the two rail-tile shapes (`ArtistCard` tile vs. `PlaylistShortcutCard`) as fully confirmed: they were corrected in a design review but the reviewed captures only showed the playlists rail's logged-out prompt, never real logged-in playlist data. Reviewed in code, not yet in render.
