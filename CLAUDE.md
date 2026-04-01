# CLAUDE.md — Aiman's Design Agent

This file trains Claude on how I work. Read it before touching any code or copy in this repo.

---

## Who I Am

Product designer + CS student (AI + Design, Minerva University). I work at the intersection of fashion, tech, and equitable design. My products include SwapCircle (credit-based clothing exchange), PACK (fashion travel packing app), and Undercurrent (diaspora cultural belonging tracker). I care about systems thinking, editorial aesthetics, and design that actually makes sense for real people.

---

## Tone & Communication Rules

- **No em dashes** (—) anywhere. Ever. Use commas, periods, or rewrite the sentence.
- Write with confidence. No hedging phrases like "it might be worth considering" or "you could potentially."
- Plain, direct language. No corporate filler. No generic praise.
- When writing UX copy: warm but not cutesy, clear but not cold, intentional not ornamental.
- When writing documentation: structured, scannable, no fluff.

---

## Design Taste & Visual References

**This is my aesthetic universe. Every project lives inside it, even if the specific palette or type is different.**

### The through-line across everything I make:
- Editorial fashion, not SaaS. If it looks like a dashboard, it's wrong.
- Photography does the heavy lifting. UI steps back and lets imagery breathe.
- Serif headlines (high-contrast, fashion-magazine weight) paired with restrained sans body copy.
- White, cream, or light gray backgrounds. No gradient backgrounds unless it's a deliberate artistic choice (like MaxMara's game).
- Ranked lists, editorial sections, and image-forward navigation feel native to my work.
- Interactivity that feels intentional: 3D globes, hover reveals, masonry grids, full-bleed hero photography.
- Luxury without being cold. Human without being casual.

### Screenshot references — view these files before building any UI

All screenshots are in `/references/`. Claude Code must view them before writing any component. They are the visual ground truth, not the descriptions below.

| File | What to look for |
|---|---|
| `references/ssqrd-explore.png` | Full-bleed editorial hero image, caption overlay style, sidebar nav treatment |
| `references/ssqrd-shop.png` | Ranked list layout (numbered 1-12), item card with thumbnail + brand label + price, Women's/Men's toggle pill |
| `references/ssqrd-brands.png` | Newly Added grid: image-forward cards with brand name overlaid in serif, NEW badge treatment |
| `references/ssqrd-media.png` | Rotated scattered card layout, "SSQRD Media" serif headline, editorial subhead copy style |
| `references/ssqrd-globe.png` | Interactive 3D globe, stats card (white, no shadow, just border), Auto Rotate/Reset pill buttons |
| `references/phia-search.png` | Search modal: "Editor's picks" label + horizontal scroll cards with text overlay, "Explore brands" grid below |
| `references/phia-explore.png` | Left sidebar with icon nav, full-bleed image main content, serif caption overlay bottom-left |
| `references/phia-shop.png` | "Shop the look" modal: horizontal scrollable item cards, selected card gets blue border, product name + price below, full-width CTA button — this is the pattern for SwipeReviewPage ItemScrollRow |
| `references/maxmara-game.png` | Soft warm background, product card centered, serif product name below image, circular nav buttons |
| `references/carry_on.png` | Carry-on suitcase line illustration, transparent background — use in bag type selector on New Trip form |
| `references/checked_bag.png` | Checked bag line illustration, transparent background — use in bag type selector on New Trip form |

### Reference sites (study these):
| Site | What it does right |
|---|---|
| [ssqrd.co](https://ssqrd.co) | High-contrast serif wordmark, minimal nav, masonry product grid, ranked trending lists, interactive globe, Substack-style editorial section |
| [phia.com](https://phia.com) | White, editorial, serif section headers, image-forward search modal, "Editor's picks" framing, brand exploration that feels curated not catalogued |
| [jwanderson.com](https://jwanderson.com/en-ar/collections/bags-new-in) | Full-bleed fashion photography, clean luxury e-commerce, nothing wasted |
| [thejacketcirclegame.maxmara.com](https://thejacketcirclegame.maxmara.com) | Soft product card, product-as-hero, whimsical but luxury, gamified but restrained |

### Typography patterns I respond to:
- High-contrast serif for display (think: Cormorant Garamond, Playfair, Canela, Freight Display)
- Clean humanist sans for body/UI (Neue Haas Grotesk, GT Walsheim, DM Sans — not Inter, not Roboto)
- Generous line-height, unhurried spacing
- Lettercase as voice: editorial brands use mixed case thoughtfully, not title case everything

### What "editorial" actually means in practice:
- Section labels are small, muted, uppercase tracking — not bold headers
- Images are never stretched or cropped carelessly
- White space is deliberate, not default
- CTAs are understated: "Read article →" not "CLICK HERE"
- Numbers and ranking used as visual texture (SSQRD's trending lists)

---

## Active Design Systems

### SwapCircle
- **Primary color:** Phthalo Blue `#0046B0`
- **Typography:** EB Garamond (headings), system sans for body
- **Source of truth:** `theme.js` — never hardcode colors or spacing, always reference theme tokens
- **Component naming:** PascalCase, descriptive (e.g. `SwapProcessingModal`, `UserSearchCard`)
- **Stack:** React + Vite, Railway backend, MongoDB Atlas, Firebase Storage, Vercel frontend
- **State:** Keep global state minimal; prefer local component state unless data is shared across 3+ components
- **API pattern:** FastAPI routes, `/api/v1/` prefix, snake_case for all Python variables

### PACK (CP192 Mini Capstone)
- **Palette:** `#FFFFFF` primary bg, `#F7F5F2` secondary bg, `#EFECE7` tertiary, `#1A1A18` text primary — no other colors, no gradients
- **Typography:** Cormorant Garamond (all display/headlines), DM Sans (all UI/body) — nothing else
- **Aesthetic:** Editorial luxury-minimal. SSQRD meets personal stylist. Fashion magazine, not travel app.
- **Stack:** React + Vite + Zustand, FastAPI + Beanie, MongoDB Atlas, Cloudinary, Claude Haiku 4.5 API
- **Image treatment:** All wardrobe item photos have background removed (white/transparent) via Cloudinary AI background removal
- **Key principle:** Every screen should feel like it belongs in a fashion editorial, not a SaaS dashboard
- **Full spec:** See `PACK_SPEC.md` at project root — read it entirely before building anything

### Undercurrent (FigBuild 2026)
- **Concept:** Speculative cultural belonging sense tracker for diaspora communities
- **Visual language:** Real photography, map-based, layered data visualization
- **Three surfaces:** Bio-patch (physical), phone app, city aggregate layer
- **Aesthetic:** Grounded and human, not futuristic or clinical

### Portfolio (aimanafzalarain.vercel.app)
- **Aesthetic:** Museum/gallery — paper texture, warm browns, gold accents, serif typography
- **Features:** 3D card carousel (journal section), hover video previews (project cards), Research & Writing section
- **Tone:** Confident, curator's voice — not a resume, a body of work

---

## Code Conventions

### General
- **Always** check if a design token exists in `theme.js` (or equivalent) before hardcoding any value
- Prefer composition over inheritance in React components
- Name things like they'll be read by someone who doesn't know the codebase
- Write comments for *why*, not *what*

### React / Frontend
- Functional components only, hooks-first
- File structure: `components/`, `pages/`, `hooks/`, `utils/`, `styles/`
- CSS: styled-components or CSS modules preferred; no inline styles except for truly dynamic values
- Always handle loading, error, and empty states — design all three, not just the happy path
- Accessibility: semantic HTML, aria-labels on icon-only buttons, keyboard navigation on modals

### API / Backend (FastAPI)
- snake_case for all Python (variables, functions, routes)
- Routes: `/api/v1/resource` pattern
- Always return consistent JSON: `{ success: bool, data: ..., message: str }`
- Pydantic models for all request/response shapes

### Git
- Branch names: `feature/`, `fix/`, `chore/` prefixes
- Commit messages: imperative present tense ("Add swap cancellation modal", not "Added" or "Adding")
- Never commit directly to main

---

## UX Copy Guidelines

When writing microcopy, button labels, empty states, or onboarding text:

- Button labels: action-oriented verbs ("Start Swapping", not "Submit")
- Error messages: tell the user what happened AND what to do next
- Empty states: human and encouraging, not apologetic
- Onboarding: one thing at a time. Don't front-load information.
- Loading states: acknowledge the wait, keep it brief ("Finding your matches...")
- For SwapCircle specifically: community-forward voice, peer-to-peer not transactional
- For PACK specifically: editorial, aspirational, slightly romantic about travel

---

## Design Review Checklist

Before handing off any screen or component, check:

- [ ] All states designed: empty, loading, error, success
- [ ] Mobile-first: does this work at 375px?
- [ ] Touch targets: minimum 44x44px
- [ ] Color contrast: WCAG AA at minimum
- [ ] Typography scale is from the system (not arbitrary sizes)
- [ ] Spacing uses the 4px/8px base grid
- [ ] Component exists in Figma before it exists in code

---

## Research & Documentation Templates

### User Interview Script Structure
1. Warm-up (2 min): context-free chitchat
2. Context setting (3 min): "walk me through the last time you..."
3. Core questions (15 min): behavior-first, never ask "would you use..."
4. Concept reaction (5 min): show, don't tell
5. Wrap-up: "What would make this indispensable for you?"

### Insight Synthesis Format
```
THEME: [Name]
EVIDENCE: [2-3 direct quotes or observed behaviors]
IMPLICATION: [What this means for design]
PRIORITY: [High / Medium / Low]
```

### Design System Documentation Structure
1. Principles (the why)
2. Tokens (colors, type, spacing)
3. Components (usage, variants, do/don't)
4. Patterns (repeated UX flows)
5. Voice & tone

---

## What NOT to Do

### Design
- Don't default to SaaS aesthetic: no blue primary buttons on white, no card grids with drop shadows, no hero sections with centered text + CTA button
- Don't use Inter, Roboto, or Arial as display fonts — ever
- Don't suggest purple/teal gradients. If you're reaching for a gradient, ask first.
- Don't crop or compress photography carelessly — images are the design, not decoration
- Don't make it look like a landing page template. Every screen should feel art-directed.

### Code
- Don't hardcode colors or spacing — check `theme.js` (or equivalent) first
- Don't add features that weren't asked for
- Don't write CSS that fights the design system

### Copy & Communication
- No em dashes (—) anywhere, ever
- No passive voice
- No "I've created a..." or "I've gone ahead and..." preamble — just deliver the work
- No hedging language: "might," "could potentially," "it may be worth considering"

---

## Current Projects (update as needed)

| Project | Status | Stack | Notes |
|---|---|---|---|
| SwapCircle | Live (Vercel + Railway) | React, FastAPI, MongoDB, Firebase | Pending: search bar (waiting on PR merge) |
| PACK | In design/build | React + Vite + Three.js, FastAPI, MongoDB, Claude API | CP192 mini capstone |
| Undercurrent | In design | Figma | FigBuild 2026, solo entry |
| Portfolio | Live, iterating | Vercel | Museum/gallery aesthetic |

---

*Last updated: March 2026. Update this file when design systems, stack, or conventions change.*
