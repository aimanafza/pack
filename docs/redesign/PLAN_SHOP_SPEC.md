# Plan + Shop redesign: build spec

Approved designs for the `shop` branch. Read this whole file, then open the mockups in `docs/redesign/mockups/` before writing any component. The mockups are the visual ground truth. Live canvas: https://claude.ai/artifact/CYaj3VFk5EAjRSSZTDdNkC

## What changes

1. **Daily and Trips merge into one page: Plan** (`/plan`). Today's look sits at the top, then a 7-day strip, with trips drawn as a bar across the days they happen, then past trips.
2. **Daily becomes outfit first.** Opening Plan shows a ready look. Nobody fills in a form to get dressed. Tweaking happens on a separate screen (`/plan/today`) with two modes: swap pieces by hand, or tell PACK in chat.
3. **Shopping moves out of Profile into its own page: Shop** (`/shop`). Four sections, in this order: what your wardrobe is missing, secondhand near you, online picks, your purchase checks.

New sidebar and bottom nav order: Dashboard, Wardrobe, Plan, Shop, Profile.

## Hard design rules (non-negotiable)

- **No underlines anywhere.** Every link and text button gets `text-decoration: none`, including hover. Hover changes color only (`--color-text-primary` to `--color-text-secondary`, or the reverse).
- **No text arrows.** Never use `→` or `←` characters in UI copy. Search the files you touch and remove them.
- **Forward and back use a thin stroke chevron icon.** Back: reuse `components/ui/BackLink.jsx` as is. Forward: create `components/ui/ForwardLink.jsx` that mirrors BackLink (same CSS module pattern, chevron path `M5.5 3L9.5 7l-4 4`, icon after the label, `gap: var(--space-1)`, min-height 44px).
- Palette and type only from `styles/tokens.css`. Cormorant Garamond for display, DM Sans for UI. No shadows, no gradients, 0.5px borders, sharp corners.
- Section labels: 11px, uppercase, `--tracking-wider`, `--color-text-secondary` (not tertiary, which fails contrast at 11px).
- Every screen needs loading, empty and error states, and must work at 375px.

## Routes

| Route | Page | Replaces |
|---|---|---|
| `/plan` | `PlanPage.jsx` | `/daily` and `/trips` (redirect both to `/plan`) |
| `/plan/today` | `TweakLookPage.jsx` | the old Daily context form |
| `/trips/new`, `/trips/:id`, `/trips/:id/review`, `/trips/:id/pack` | unchanged | keep, but their BackLink now says "Plan" and points to `/plan` |
| `/shop` | `ShopPage.jsx` | `/profile/shopping` (redirect) |
| `/shop/checks/:analysis_id` | existing `ShoppingAnalysisPage.jsx` | `/profile/shopping/:analysis_id` (redirect) |

Remove the "Shopping history" block from `ProfilePage.jsx`.

## Screen 1: Plan (`mockups/Main.dc.html`, mobile: `mockups/PlanMobile.dc.html`)

**Header:** label "Plan", serif headline with today's full date, "Plan a trip" button (black, uppercase 13px, goes to `/trips/new`).

**Today block** (two columns on desktop, stacked on mobile):
- Left: the look as a collage on `--color-bg-secondary`. Reuse/extend `OutfitCollage`: outerwear tall on the left, top and bottom stacked right, shoes as a wide strip under both. Real item photos, background removed, `object-fit: contain`.
- Right: label "Today's look", chips for weather and (when connected) the next calendar event, the stylist note in serif italic 28px, buttons "Wear this" (primary) and "Show another" (outline), then a ForwardLink "Tweak it" to `/plan/today`.
- Outfit-first behavior: on load call `GET /api/v1/daily/today`. If no look exists, call `POST /api/v1/daily/generate` automatically with inferred defaults (occasion from the day of week and calendar when available, mood `null` or a neutral default, lat/lon from geolocation). Show a loading state in the collage area while it generates ("Styling your day..."). "Wear this" calls the existing choose endpoint. "Show another" cycles to the next of the 3 generated outfits, then regenerates after the third.
- Hide the calendar chip when `daily_styling_prefs.calendar_connected` is false. Do not fake it.

**The week ahead:** 7-column grid (horizontal scroll on mobile). Each day card: weekday label, date in serif, weather, one line for the day's event or trip city, then either three tiny thumbnails of a planned look or a muted "Plan look +" link. Trips from `GET /api/v1/trips/` that overlap the week render as a black bar spanning their days (`grid-column: start / span n`) with trip name in serif and packing progress on the right, linking to `/trips/:id`.

**Past trips:** 3-column grid of existing trip cards (reuse `TripCard`), "See all" ForwardLink when there are more than 3.

Empty states: no wardrobe yet (prompt to add pieces first, link to `/wardrobe`), no trips (just the "Plan a trip" button, no empty section).

## Screen 2: Tweak today's look (`mockups/Tweak.dc.html`)

- BackLink "Plan" to `/plan`. Serif headline "Make it yours". "Wear this look" primary button top right.
- Left: the same collage, live-updating as pieces change.
- Right: a two-tab segmented control, "Swap pieces" and "Tell PACK" (black fill on the active tab).
- **Swap pieces:** one row per slot (Outerwear, Top, Bottom, Shoes). Each row shows the current piece plus 2 alternatives that work with the rest of the look, and an "All" tile that opens the existing `WardrobePickerModal` filtered to that category. The selected tile gets a 1.5px `--color-text-primary` border.
- **Tell PACK:** chat thread (PACK messages on `--color-bg-secondary`, user messages on `--color-text-primary` with white text), quick chips ("Warmer", "More dressed up", "More comfortable", "Use something I haven't worn lately"), text input plus "Send".
- Fold the old ContextCard inputs (mood, occasion, vibe, anchor items, inspiration images) into this screen. Chat covers free text. Anchor items become "Swap pieces". Keep inspiration upload as an attach button in the chat input.

**Backend needed:**
- `GET /api/v1/daily/{look_id}/alternatives?slot=outerwear` returns up to 2 wardrobe items that fit the rest of the current outfit and the weather (Claude call with the current outfit plus wardrobe, or a cheap rule-based filter first).
- `PATCH /api/v1/daily/{look_id}/outfits/{index}` with `{ "item_ids": [...] }` saves a hand-edited outfit.
- `POST /api/v1/daily/{look_id}/refine` with `{ "message": str, "outfit_index": int }` runs the daily stylist with the user's instruction and returns the updated outfit plus a short reply. Reuse `generate_daily_outfits` in `claude_service.py` and its tools.
- All responses use `{ success, data, message }`.

## Screen 3: Shop (`mockups/Shop.dc.html`)

**Header:** label "Shop", headline "Buy less. Buy what works.", one line of sub copy, and a row of section pills that scroll to each section (active pill filled black).

**1. What your wardrobe is missing:** 3 ranked cards (01, 02, 03 in large serif). Each has the gap name, one sentence on why, "Works with N pieces you own", and two ForwardLinks: "Find it secondhand" (scrolls to nearby, filtered) and "Shop online" (muted).
- Backend: `GET /api/v1/shop/gaps` runs a Claude call over the wardrobe plus Style DNA and returns `[{ rank, name, reason, category, works_with_count }]`. Cache the result per user and refresh when the wardrobe changes.

**2. Secondhand near you:** city label with "Change" link, 3 store cards (photo, name, area and distance, "Good for your gap: X").
- Backend: `GET /api/v1/shop/nearby?lat=&lon=&gap=` backed by the Google Places API (text search for second-hand, vintage and thrift stores). Needs a `GOOGLE_PLACES_API_KEY` env var. Ship this section behind a feature flag until the key is set.

**3. Online picks for you:** SSQRD-style ranked list, 2 columns on desktop, 1 on mobile: rank number, thumbnail, brand label, product name, price, "Unlocks N new looks", "View" ForwardLink.
- Data source is undecided (affiliate feed or product API). Build the UI against a `GET /api/v1/shop/picks` endpoint that returns an empty list for now, and show an empty state ("Picks are on the way. Your gaps above are the best place to start.").

**4. Your purchase checks:** move `ShoppingHistoryPage` content here as a list. Each row: thumbnail, item, store and date, verdict in serif, one-line reason, "Details" ForwardLink to `/shop/checks/:analysis_id`. Data from the existing `GET /api/v1/purchase-analysis/me`. Header link "Get the Chrome extension".

## Build order

1. Nav changes, redirects, `ForwardLink`, and the no-underline / no-arrow sweep across every file you touch.
2. Plan page using existing endpoints (today, generate, choose, trips).
3. Tweak page: swap mode with the PATCH endpoint, then chat mode with `/refine`.
4. Shop: purchase checks (existing data) and gaps first, then nearby (Places), then online picks UI with the empty endpoint.

## Placeholders in the mockups

Bracketed text (`[TEMP]`, `[EVENT]`, `[STORE NAME]`, `[BRAND]`, `[PRICE]`) and the grey tiles stand in for real data and wardrobe photos. The Lake Como + Paris dates on the week strip are sample data.
