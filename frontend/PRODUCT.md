# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is one person in two moments: a dancer who looks for music, and a voter who corrects a track.

- The dancer searches by dance style and tempo and plays tracks. The dancer needs a correct, trustworthy dance style and tempo.
- The voter forms an opinion while listening. The voter needs a one-tap way to state the dance style or tempo, with or without an account.
- The logged-in voter votes regularly. A private confirmed-track count is visible only to that voter.
- The admin manages tracks, artists, albums, and the style configuration in `/admin`.

The audience is non-technical and spans ages 14 to 85. Most users are of ordinary working age. The site is accessible to all of them. It is not designed for older users only.

## Product Purpose

dansbart.se helps a person in Sweden find folk music to dance to. The community sets the dance style and the tempo of each track, one vote at a time.

The current priority is fast and easy classification. Success looks like this:

1. A voter casts a common vote in one tap, with no forced tutorial.
2. One anonymous vote can confirm a style.
3. A confirmed track shows the correct style and tempo when the vote crosses the threshold.
4. Most voters vote once or a few times and stop. That is the expected shape of a volunteer project.
5. A dancer who searches by tempo finds every track whose style the community confirmed.

## Positioning

Volunteers confirm the dance style and tempo of each track, so a dancer can trust the result. The library is organised around the eleven dance styles and tempo. A general music service does not offer both.

## Operating Context

- The site is a non-profit hobby project run by dance enthusiasts.
- Tracks play through Spotify and YouTube.
- Classification happens in two places: the player nudge (`SmartNudge`) during playback, and the dance style badge on a track row.
- A voter forms an opinion while listening. The site takes the correction on the row that the person already looks at, in one or two taps.
- A track has a processing state (`PENDING`, `PROCESSING`, `REANALYZING`, `DONE`, `FAILED`). The state is admin-only.
- Groups own shared, curated playlists. A group is public or private.

## Page Roles

- The home page is the exploration entrance. A visitor browses dance styles, artists, and playlists there. It does not list or filter tracks directly.
- The search page, the playlist page, the group page, and the dance page are utility pages. Each does one task: find a track, manage a playlist, see a group, or browse one dance style's tracks.
- The player is a persistent, cross-page component. A redesign may change its color and shape. It keeps its layout, controls, and the space it gives the YouTube and Spotify embeds.

## Capabilities and Constraints

- The eleven dance styles are Polska, Slängpolska, Hambo, Vals, Mazurka, Menuett, Polka, Schottis, Snoa, Gånglåt, and Engelska.
- Classification needs no login. An anonymous voter is identified by a generated ID.
- The site has no points, badges, streaks, or leaderboards.
- A bulk table belongs on an admin page only. It does not belong on a phone.
- A person sets a perceived tempo category (Långsamt, Lugnt, Lagom, Snabbt, V. snabbt) only when a track has no tempo estimate.
- The audio analysis pipeline gives a first-guess style and tempo. Community votes decide what a dancer sees as confirmed.
- The approved terms and their Swedish app text are in `docs/terminology.md`.
- Undecided: whether the site publishes a style that carries the provenance `ml`, whether a person can correct a confirmed style, and the Swedish heading for the contribution section. See `docs/open-questions.md`.
- Stack: React 19, strict TypeScript, Tailwind CSS v4, Vite, Vitest. The API client is generated with orval.

## Brand Commitments

- The name is written `dansbart.se` or `Dansbart.se`.
- The favicon is `public/favicon.svg`.
- All visible text is Swedish, with å, ä, and ö.
- The text addresses the reader as "du".
- The tone is a warm, plain, volunteer-run project. The text uses no sales language.
- The palette draws on Swedish folk-culture colour, on a light, warm neutral ground. Light is the primary theme; dark stays a user choice. Falu red is the primary action colour, the colour a person presses most. Ochre marks the track playing now. Spruce green marks a selected or toggled state.
- Each dance style keeps its own badge colour, unchanged, wherever a track lists its style.

## Evidence on Hand

- A running library with statistics on track count, categorised share, and last added date, from `getStats`.
- Community classification data from votes.
- Research notes on dance rhythm in `research/`, summarised in `docs/rhythm-research.md`.
- No testimonials, press, customer names, or usage benchmarks exist. Do not invent them.

## Product Principles

1. A correction takes one or two taps, on the row where the person listens.
2. A single vote is worth casting alone.
3. Every classification control carries a word and stays on screen until the person acts.
4. Show a track's confirmed dance style and tempo as the source of truth. Show the analysis guess as a secondary signal.
5. Credit the community for the work that people did.

## Accessibility & Inclusion

- Text meets WCAG 2.2 AA contrast and stays readable at 200% zoom. No pixel minimum applies beyond that.
- Tap targets meet WCAG 2.2 AA: at least 24x24 CSS px. Primary touch controls aim for 44px.
- Every control has a strong clickability cue and an accessible name with a verb.
- Every status appears as a word. A widely known icon may stand alone when it has an accessible name.
- An error that a person must act on appears next to the control it concerns.
- The light and dark themes are a user choice.
