# Why TypeScript Didn't Catch the TrackListDto / Template Mismatch

After the backend started returning `TrackListDto` (camelCase: `danceStyle`, `confidence`, `playbackPlatform`, etc.), the frontend still used snake_case in places (`style_confidence`, `has_vocals`). TypeScript didn't report any errors. Here's why.

## 1. The track list is not fetched with the generated client

**Location:** `js/hooks/tracks.ts`

The track list is loaded with **raw `fetch()`**, not with the generated `getTracks()` from `js/api/generated/tracks/tracks.ts`:

```ts
const response = await fetch(`/api/tracks?${params.toString()}`);
const data = (await response.json()) as { items?: TrackItem[]; total?: number };
const newItems = data.items ?? [];
```

So the **generated types are never used** for this endpoint. TypeScript only sees:

- `TrackItem` = `{ id: string; [key: string]: unknown }`

So the type of each item is effectively “object with an `id` and any other keys”. No shape is enforced, so wrong property names are never caught.

## 2. Generated types are out of date anyway

**Location:** `js/api/models/pageTrack.ts`

The generated client still types the list response as:

```ts
export interface PageTrack {
  content?: Track[];   // full domain Track, not TrackListDto
  totalElements?: number;
  // ...
}
```

So even if we had used `getTracks()`:

- The spec was generated when the API returned `Track` (or a Spring `Page` with `content`).
- The backend now returns `PageResponse<TrackListDto>` with `items` and `total`.
- So the **OpenAPI spec and Orval output were not regenerated** after the backend change. The generated type does not match the real response.

## 3. Components use a hand-written interface, not the API type

**Location:** `js/components/types.ts`, `TrackCard.ts`

Components expect a **hand-written** `TrackDisplay` interface, not the generated `Track` or `TrackListDto`:

```ts
track: { type: Object as PropType<TrackDisplay>, required: true }
```

So:

- There is **no type link** from “what the API returns” to “what the component expects”.
- `TrackDisplay` is maintained by hand and can drift from the real DTO (e.g. it had `styleConfidence` but the template used `style_confidence`).

## 4. Vue templates are not type-checked by default

**Location:** `TrackCard.ts` template

The template used:

```html
<div v-if="track.style_confidence >= 1.0">
```

TypeScript only type-checks **script** code. In most Vue setups, **template expressions are not checked** against the prop types. So:

- `track` is typed as `TrackDisplay` in the script.
- `TrackDisplay` has `styleConfidence` and `confidence`, not `style_confidence`.
- But because this is in the **template**, the compiler never checks that `track.style_confidence` exists on `TrackDisplay`, so no error is reported.

So the bug was “wrong property name in template” and the type system never saw it.

---

## How to get type safety next time

1. **Use the generated client for the track list**  
   In `useTracks`, call `getTracks(params)` (and similarly for search) instead of raw `fetch`, so the response type is part of the type graph.

2. **Regenerate OpenAPI and Orval after API changes**  
   After changing the backend to return `PageResponse<TrackListDto>` (and `TrackListDto` in discovery/album/playlist), regenerate the spec and run Orval so that:
   - The list endpoint is typed as something like `PageResponse<TrackListDto>` (or whatever the spec exposes).
   - The generated “track list item” type has the real fields (`danceStyle`, `confidence`, `playbackPlatform`, etc.).

3. **Type component props from the generated DTO**  
   Use the generated list-item type (e.g. `TrackListDto`) as the prop type for list cards, or a type that extends it. Then script and template will both refer to the same shape (e.g. `confidence`, not `style_confidence`).

4. **Enable Vue template type-checking**  
   With Volar (Vue Language Features) and TypeScript, you can enable “template type-checking” so that expressions like `track.style_confidence` are checked against the prop type and you get an error if the property doesn’t exist.

Summary: the mismatch wasn’t caught because the list isn’t fetched with the generated client, the generated types don’t reflect the new DTO, components use a separate hand-written type, and Vue templates weren’t type-checked. Fixing those four points will make similar breakages show up at build time.
