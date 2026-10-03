---
name: dansbart.se
description: A community's shared, hand-kept record of dance-worthy folk music.
colors:
  linen: "rgb(245 239 228)"
  linen-sunken: "rgb(238 230 214)"
  paper: "rgb(253 250 244)"
  hairline: "rgb(214 200 180)"
  hairline-strong: "rgb(178 160 136)"
  ink: "rgb(38 28 22)"
  ink-muted: "rgb(104 84 70)"
  falu-red: "rgb(128 30 26)"
  falu-red-hover: "rgb(100 22 20)"
  falu-red-muted: "rgb(243 220 212)"
  accent-foreground: "rgb(255 250 243)"
  spruce-selected: "rgb(30 84 56)"
  spruce-selected-muted: "rgb(220 232 222)"
  ochre-now-playing: "rgb(150 86 16)"
  ochre-now-playing-muted: "rgb(249 236 214)"
  success: "rgb(35 105 60)"
  error: "rgb(166 35 30)"
  pill-bg: "rgb(235 226 208)"
typography:
  display:
    fontFamily: "'Fraunces Variable', Georgia, 'Iowan Old Style', 'Times New Roman', serif"
    fontVariationSettings: "'SOFT' 80, 'WONK' 0, 'opsz' 48"
    fontWeight: 600
  headline:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
  title:
    fontFamily: "{typography.display.fontFamily}"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "'Atkinson Hyperlegible Next Variable', ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "{typography.body.fontFamily}"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  lg: "0.75rem"
  full: "9999px"
spacing:
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  section: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.falu-red}"
    textColor: "{colors.accent-foreground}"
    border: "1px solid {colors.falu-red-hover}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.falu-red}"
    border: "1px solid {colors.hairline-strong}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.paper}"
    border: "1px solid {colors.hairline}"
    rounded: "{rounded.lg}"
    padding: "16px"
  pill-active:
    backgroundColor: "{colors.falu-red-muted}"
    textColor: "{colors.falu-red}"
    border: "1px solid {colors.falu-red}"
    rounded: "{rounded.full}"
    padding: "6px 12px"
---

# Design System: dansbart.se

## Overview

**Creative North Star: "The Village Hall Ledger"**

dansbart.se reads as a community's shared, hand-kept record: a ledger on the table of a village hall, not a music-streaming console. The page is linen, the cards are paper, the ink is warm umber, and the three colours of Swedish folk craft each do one job: Falu red is pressed, spruce green is chosen, ochre is playing. A woven band of lozenges runs under the header, the way a ribbon edges a tablecloth, and the eight-petal rosette of the wordmark is the mark a hand would carve into a chest.

Two voices carry the type. A warm serif (Fraunces, with its soft axis turned up) names places: the wordmark, page titles, section headings, and the counts in the ledger. A legible sans (Atkinson Hyperlegible Next) carries everything a person reads at length or taps. The audience is 14 to 85 and non-technical, so the sans never gets smaller on larger screens and every control keeps a word.

**Key Characteristics:**
- Linen ground with a faint paper grain; paper cards with a solid warm edge and a whisper of lift, never flat white or a floating SaaS shadow.
- Warm umber ink and muted ink, not Tailwind gray.
- Modest corners (8px on controls, 12px on cards). Pills are reserved for chips, avatars and the badge on a track.
- A serif display face for headings and the wordmark, a sans for body and controls.
- Ornament in two places only: the woven band and the rosette. Nothing else is decorated.

## Colors

### Primary
- **Falu red** (`rgb(128 30 26)`, dark `rgb(228 128 108)`): the colour a person presses. Primary buttons, the search button, active links, focus rings, the favourite heart. Its foreground is warm white (`rgb(255 250 243)`), never pure white.
- **Falu red muted** (`rgb(243 220 212)`): the fill of an active chip and of a secondary button on hover.

### Secondary
- **Spruce green** (`rgb(30 84 56)`, dark `rgb(122 206 160)`): a selected or toggled state. The active sidebar item sits on `spruce-selected-muted` with a 3px inset spruce bar on its left. Success toasts use the same pair.
- **Ochre** (`rgb(150 86 16)`, dark `rgb(232 176 96)`): the track playing now, and nothing else. The player's artwork tile, the now-playing chip on a track card, the star on a dance list.

### Neutral
- **Linen** (`rgb(245 239 228)`, dark `rgb(29 22 18)`): the page ground. `linen-sunken` (`rgb(238 230 214)`) is the sidebar.
- **Paper** (`rgb(253 250 244)`, dark `rgb(42 33 27)`): cards, inputs, the header, the player.
- **Ink** (`rgb(38 28 22)`) and **ink muted** (`rgb(104 84 70)`): text. Both pass 4.5:1 on linen and paper.
- **Hairline** (`rgb(214 200 180)`) and **hairline strong** (`rgb(178 160 136)`): card edges and input borders. Borders are solid, never at half opacity.
- **Pill background** (`rgb(235 226 208)`): a neutral chip or an informational box.

### Named Rules
**The Fixed-Role Accent Rule.** Falu red, spruce and ochre each carry exactly one role. Do not repurpose one for a new meaning; add a token instead.

**The Style-Badge Independence Rule.** Each of the eleven dance styles keeps its own badge colour (`src/styles/danceStyleColors.ts`) wherever a track lists its style. The tile adds a border in the same hue at 35% so it reads as a painted card, not a flat swatch.

**The No Gray Rule.** No Tailwind gray, slate, blue, indigo or purple appears in the app outside the admin pages and the Spotify and YouTube source identities. The umber neutrals and the folk tokens cover every need.

## Typography

**Display:** Fraunces Variable, served from the site's own origin through fontsource (`@fontsource-variable/fraunces/full.css`). `font-variation-settings: "SOFT" 80, "WONK" 0, "opsz" 48` gives the rounded, hand-cut feel. Tailwind exposes it as `font-display`; `h1` and `h2` use it by default.

**Body:** Atkinson Hyperlegible Next Variable, the default `font-sans`.

### Hierarchy
- **Page title** (display, 600, 1.875rem on phones, 2.25rem on desktop): the page's `<h1>`.
- **Section heading** (display, 600, 1.25rem): `SectionTitle`, trailed by a ledger rule and an optional "Se alla" link.
- **Ledger numeral** (display, 600, 1.5rem): the counts in the stats strip on the home page.
- **Body** (sans, 400, 1rem): running copy, inputs, descriptions.
- **Label** (sans, 600, 0.875rem): buttons, chips, nav items.

### Named Rules
**The Two Voices Rule.** The serif names a place; the sans does the work. Never set a button, a chip, a form label or a track title in the serif. Never set a page title in the sans.

**Sentence case everywhere.** No uppercase tracking labels. A section label is a sentence-case heading in the display face.

## Layout

A sticky paper header with the rosette and wordmark on the left and the login control on the right, closed by the woven band. Below it, a sunken-linen sidebar on desktop (a slide-in overlay on phones) and a single scrolling column of sections at `space-y-10`. The home page opens with the title, a one-paragraph greeting, the search field, then the ledger strip: one paper card divided into three cells by hairlines, each with a display numeral and a sentence-case caption. Sections follow: the eleven dance styles as a wrapping grid of tiles, and horizontally scrolling rails of artists and playlists.

## Elevation & Depth

Depth comes from edges, not shadows. Every card has a solid hairline border and the one ambient shadow token (`--color-card-shadow`: a 1px contact line and a soft 10px lift at under 10% umber). The player bar casts the same shadow upward. Modals use the same token; there is no heavier "modal" shadow. Hover changes background tint or lifts a tile by half a pixel, never shadow depth.

## Shapes

- `--radius-sm` (6px): badges.
- `--radius` (8px): buttons, inputs, icon buttons, sidebar items, the player's artwork tile.
- `--radius-lg` (12px): cards, dance-style tiles, modals, the cookie banner.
- `--radius-full`: chips, avatars, the style badge on a track row, play buttons.

## Ornament

- **Woven band** (`folk-band` utility): an 8px row of lozenges and dots in `currentColor`, masked from an inline SVG. Used under the header in Falu red. It may close a card that wants a craft edge. It is never used as a divider between sections.
- **Rosette** (`RosetteIcon`, `public/favicon.svg`): eight petals on a Falu red disc, with the petals in the paper colour. It is the site's mark; it does not decorate anything else.
- **Paper grain**: a fixed `body::before` layer of fractal noise at 4.5% (6% in dark). It sits below content and never above a card.

## Components

Every page is built from the same handful of pieces in `src/ui/`. Reach for these before writing markup:

- **`PageHeader`**: the title in the display face, with `meta` for a count ("8 danser"), `description` for a sentence, `icon` for a mark and `action` for one control on the right.
- **`SearchField`** and **`SelectField`**: the only search box and the only labelled select. Both use `fieldClassName`, the one input chrome, which `TextField` and every create-form input share.
- **`ListRow`**: one entry in a list. A paper card row with an optional round play button, an icon tile or avatar, a title that links, a subtitle, badges as children and `trailing` text or controls. Dances, playlists, groups, dance lists, artists and albums all render through it.
- **`PlayCircleButton`**: the round play button, outlined on paper and Falu red when playing. `ListRow`, `TrackCard` and the track row's play button share its look.
- **`EmptyState`**: a centred paper card for a list with nothing in it or a page that needs a login first, with `LinkButton` for the action.
- **`Button`** and **`LinkButton`**: the same four variants, as a button or a router link.

### Buttons
- **Primary:** Falu red fill, warm-white text, a 1px border in the hover red so the edge reads as cut, `--radius`, `min-h-11`.
- **Secondary:** paper fill, Falu red text, hairline-strong border; hover fills with Falu red muted.
- **Ghost:** transparent, ink text, hover tints with 6% ink.
- **Danger:** error red with the same cut edge.

### Chips / Pills
- Inactive: paper fill, hairline border, ink text. Active: Falu red muted fill, Falu red text and border. The Spotify (green) and YouTube (red) variants keep their source identity.

### Cards
- Paper fill, hairline border, `--radius-lg`, the one shadow. `p-3` for rail tiles, `px-3 py-2.5` for list rows.

### List rows
- `ListRow` for every entry list. The whole row is a link; the play button and any trailing control sit above the link so both stay clickable. Rows stack at `space-y-2`. Track lists on the search and playlist pages use `TrackRow`, a denser bordered row with the same play button, because they can hold hundreds of entries.

### Dance-style tile
- The style's own fixed colour pair, a border in the text colour at 35%, the style name in the display face at 1.125rem, and the count in the sans.

### Inputs
- Paper fill, hairline-strong border, `--radius`, `min-h-11`. Focus: Falu red border and a 1px Falu red ring. The home page search field is 48px tall and carries the card shadow.

### Navigation
- Sidebar items are rounded rows at `--radius`. Active: spruce muted fill, spruce text, a 3px inset bar on the left. Hover: paper fill. Counts sit in a Falu red disc.

### Player
- Paper bar with a hairline-strong top edge and the upward shadow. The artwork tile is ochre on ochre muted with the music-note icon. Layout, controls and embed space are unchanged.

### Listening nudge (`SmartNudge`)
- Each step is a saturated folk card with warm-white text: umber ink to confirm a style, spruce to add a second style, ochre to confirm a secondary style, Falu red to ask for a style when there is none. The "no" button is a 15% white tint; the "yes" button is paper.

### Toasts
- Success: spruce text and border on spruce muted. Error: error red text and border on paper. Both carry the card shadow.

## Do's and Don'ts

### Do:
- **Do** set page titles and section headings in the display face, and everything else in the sans.
- **Do** give every card and input a solid hairline border; depth is an edge, not a shadow.
- **Do** keep Falu red for the pressed thing, spruce for the chosen thing, ochre for the playing thing.
- **Do** keep the eleven style colours exactly as they are.
- **Do** keep all text in sentence case with å, ä and ö.

### Don't:
- **Don't** reintroduce Tailwind gray, blue, indigo or purple; use the umber neutrals and the folk tokens.
- **Don't** round a button or input past `--radius`, or a card past `--radius-lg`. Pills are for chips, avatars and the track badge.
- **Don't** add ornament beyond the woven band and the rosette. One ribbon and one mark are the whole decoration.
- **Don't** set a control, a label or a track title in the serif.
- **Don't** add a heavier modal shadow or a hard-offset shadow; the system has one shadow token.
