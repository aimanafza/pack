# PACK — Full Product Specification
## For Claude Code: Build this app exactly as specified. Read every section before writing a single line of code.

---

## 0. What PACK Is

PACK is a fashion travel packing app with an AI personal stylist at its core. The user logs in, builds their wardrobe (uploading clothing items), creates a trip (destination, dates, occasions), and the AI generates a curated packing list with full outfit breakdowns — thinking like a personal stylist, not a checklist generator. Users can save trips, edit lists, and check items off as they pack.

This is a capstone project (CP192, Minerva University). It must be fully functional, visually exceptional, and built to the exact specifications below. There is no room for generic UI. Every screen must feel like it was art-directed.

---

## 1. File Structure

```
PACK/
├── frontend/
│   ├── public/
│   │   └── fonts/                  # Self-hosted font files if needed
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                 # Reusable primitives (Button, Input, Modal, Tag, Toast)
│   │   │   ├── wardrobe/           # WardrobeGrid, ItemCard, UploadModal, ItemDetail
│   │   │   ├── trips/              # TripCard, TripForm, TripDetail, VibeCard
│   │   │   ├── packing/            # PackingList, OutfitCard, SuggestionStream
│   │   │   ├── review/             # SwipeCard, ItemScrollRow, RejectionModal, BagCounter
│   │   │   ├── layout/             # Navbar, Sidebar, PageWrapper
│   │   │   └── auth/               # LoginForm, SignupForm
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx       # public, unauthenticated
│   │   │   ├── AuthPage.jsx
│   │   │   ├── DashboardPage.jsx     # logged-in homepage with welcome back experience
│   │   │   ├── OnboardingPage.jsx    # guided interactive walkthrough
│   │   │   ├── ProfilePage.jsx       # activity summary + AI wardrobe vibe
│   │   │   ├── WardrobePage.jsx
│   │   │   ├── WardrobeItemPage.jsx  # NEW — item detail/product page at /wardrobe/:item_id
│   │   │   ├── TripDetailPage.jsx
│   │   │   ├── NewTripPage.jsx
│   │   │   ├── SwipeReviewPage.jsx
│   │   │   └── PackingPage.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useWardrobe.js
│   │   │   ├── useTrips.js
│   │   │   └── usePackingSuggestions.js
│   │   ├── store/
│   │   │   └── index.js            # Zustand store — single file, all slices
│   │   ├── utils/
│   │   │   ├── api.js              # Axios instance with baseURL + auth headers
│   │   │   └── helpers.js
│   │   ├── styles/
│   │   │   ├── tokens.css          # All CSS custom properties (design tokens)
│   │   │   └── global.css          # Reset + base typography
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env                        # VITE_API_URL=http://localhost:8000
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py         # POST /auth/register, /auth/login, /auth/me
│   │   │   │   ├── wardrobe.py     # CRUD for clothing items
│   │   │   │   ├── trips.py        # CRUD for trips
│   │   │   │   └── pack.py         # POST /pack/suggest (Claude API call)
│   │   │   └── deps.py             # get_current_user dependency
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── item.py
│   │   │   └── trip.py
│   │   ├── services/
│   │   │   ├── auth_service.py     # JWT creation + verification
│   │   │   ├── claude_service.py   # All Claude API logic lives here
│   │   │   └── cloudinary_service.py
│   │   ├── core/
│   │   │   ├── config.py           # Settings from .env via pydantic-settings
│   │   │   ├── security.py         # Password hashing
│   │   │   └── database.py         # MongoDB Atlas connection via Beanie
│   │   └── main.py                 # FastAPI app, CORS, rate limiting, router registration
│   ├── .env                        # All secrets — never commit this
│   ├── requirements.txt
│   └── README.md
│
├── PACK_SPEC.md                    # This file
└── CLAUDE.md                       # Aiman's design agent config
```

---

## 2. Tech Stack

### Frontend
- **React 18** + **Vite 5**
- **Zustand** — state management (one store, multiple slices)
- **React Router v6** — client-side routing
- **Axios** — HTTP client, single configured instance in `utils/api.js`
- **CSS Modules** — component-scoped styles, no styled-components, no Tailwind
- **Framer Motion** — page transitions and item animations only, not overused

### Backend
- **FastAPI** — async Python web framework
- **Beanie** — async MongoDB ODM (wraps Motor)
- **MongoDB Atlas** — M0 free tier, cloud-hosted even for local dev
- **python-jose** — JWT auth
- **passlib[bcrypt]** — password hashing
- **slowapi** — rate limiting
- **anthropic** — official Python SDK
- **cloudinary** — image upload and storage
- **pydantic-settings** — env var management

### External Services
- **MongoDB Atlas** — free M0 cluster
- **Cloudinary** — free tier (25GB storage). All wardrobe item uploads must use the `e_background_removal` transformation to produce clean white/transparent backgrounds automatically.
- **Anthropic API** — Claude Haiku 4.5 (model string: `claude-haiku-4-5-20251001`)

---

## 3. Environment Variables

### backend/.env
```
MONGODB_URL=mongodb+srv://...
DATABASE_NAME=pack_db
JWT_SECRET=your_long_random_secret_here
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
ANTHROPIC_API_KEY=sk-ant-...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
FRONTEND_URL=http://localhost:5173
```

### frontend/.env
```
VITE_API_URL=http://localhost:8000
```

**NEVER hardcode any of these values. NEVER commit .env files. Add both to .gitignore immediately.**

---

## 4. Design System — Read This Before Writing Any CSS

### 4.1 Design Philosophy

PACK looks like a fashion editorial magazine, not a SaaS app. Every screen is art-directed. References: SSQRD (ssqrd.co), Phia (phia.com), JW Anderson (jwanderson.com). White backgrounds, high-contrast serif headlines, photography-forward, restraint everywhere.

**The rule:** If it looks like a dashboard, it's wrong. If it looks like a travel magazine, it's right.

### 4.2 Color Tokens

```css
/* styles/tokens.css */
:root {
  /* Backgrounds */
  --color-bg-primary: #FFFFFF;
  --color-bg-secondary: #F7F5F2;    /* Warm off-white — page backgrounds */
  --color-bg-tertiary: #EFECE7;     /* Warm light gray — card surfaces */
  --color-bg-overlay: rgba(0, 0, 0, 0.45);

  /* Text */
  --color-text-primary: #1A1A18;    /* Near-black, not pure black */
  --color-text-secondary: #6B6860;  /* Muted body text */
  --color-text-tertiary: #9E9B94;   /* Labels, captions, metadata */
  --color-text-inverse: #FFFFFF;

  /* Borders */
  --color-border-light: #E8E4DE;    /* Default dividers */
  --color-border-medium: #D4CFC8;   /* Hover states, active borders */
  --color-border-dark: #B8B2A8;     /* Emphasized borders */

  /* Accent */
  --color-accent: #1A1A18;          /* Primary actions — same as text, not a color */
  --color-accent-hover: #3D3D38;

  /* Semantic */
  --color-success: #2D5016;         /* Forest green — only for success states */
  --color-error: #8B2500;           /* Deep terracotta — only for errors */

  /* NO OTHER COLORS. No blues, no purples, no gradients, no tints. */
  /* If you are reaching for a color not in this list, stop and reconsider. */
}
```

### 4.3 Typography

```css
/* Import in index.html */
/* Cormorant Garamond — display headlines */
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');
/* DM Sans — body, UI, labels */
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

:root {
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;

  /* Type scale */
  --text-xs: 11px;      /* Uppercase labels, metadata */
  --text-sm: 13px;      /* Secondary body, captions */
  --text-base: 15px;    /* Primary body text */
  --text-md: 18px;      /* Large body, intro text */
  --text-lg: 24px;      /* Small display */
  --text-xl: 36px;      /* Section headlines */
  --text-2xl: 52px;     /* Page titles */
  --text-3xl: 72px;     /* Hero text */

  /* Line heights */
  --leading-tight: 1.1;
  --leading-snug: 1.3;
  --leading-normal: 1.6;
  --leading-loose: 1.8;

  /* Letter spacing */
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.06em;    /* For uppercase labels */
  --tracking-wider: 0.12em;   /* For small caps labels */
}
```

### 4.4 Spacing

Base unit: 4px. Use multiples only.
```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;
  --space-32: 128px;
}
```

### 4.5 Borders and Radius

```css
:root {
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 20px;
  --radius-pill: 999px;

  --border-thin: 0.5px solid var(--color-border-light);
  --border-default: 1px solid var(--color-border-light);
  --border-medium: 1px solid var(--color-border-medium);
}
```

### 4.6 Typography Patterns (how to actually use the fonts)

**Display headings** (Cormorant Garamond):
- Weight 300 or 400 for elegance, weight 500 only for emphasis
- Use italic variant for stylistic moments (taglines, callouts)
- Generous negative tracking: `--tracking-tight`
- Used for: page titles, section headers, trip names, feature headlines

**UI text** (DM Sans):
- Weight 300 for body paragraphs
- Weight 400 for default UI
- Weight 500 for labels, button text, navigation
- Used for: nav items, buttons, form labels, body copy, metadata

**Section labels** (DM Sans, uppercase):
- 11px, weight 500, letter-spacing 0.12em, color `--color-text-tertiary`
- Format: "THE WARDROBE" / "UPCOMING TRIPS" / "YOUR STYLIST"
- This is the SSQRD/Phia pattern — small muted label above the serif headline

**Example pattern used everywhere:**
```
THE WARDROBE          ← DM Sans 11px, 500, uppercase, --color-text-tertiary
Your Closet           ← Cormorant Garamond 36px, 400, --color-text-primary
32 items ready to pack ← DM Sans 15px, 300, --color-text-secondary
```

### 4.7 Component Visual Rules

**Cards:**
- Background: `--color-bg-secondary` or `--color-bg-primary`
- Border: `--border-thin`
- Radius: `--radius-lg`
- No drop shadows. Never. Use border instead.
- Hover: border transitions to `--border-medium`, subtle scale `1.01`

**Buttons:**
- Primary: `background: --color-text-primary`, `color: --color-text-inverse`, no radius (sharp corners), DM Sans 13px weight 500, letter-spacing 0.06em, uppercase
- Secondary: `background: transparent`, `border: --border-medium`, `color: --color-text-primary`
- No rounded buttons except pill tags
- Hover on primary: `--color-accent-hover`

**Inputs:**
- Background: `--color-bg-primary`
- Border: `--border-default`
- Border-radius: `--radius-sm`
- Focus: border-color `--color-border-dark`, no glow, no box-shadow
- Label: DM Sans 11px, uppercase, `--tracking-wider`, `--color-text-tertiary`, above the input

**Tags/Pills:**
- Background: `--color-bg-tertiary`
- Border: `--border-thin`
- Radius: `--radius-pill`
- Text: DM Sans 11px, weight 500, `--color-text-secondary`
- Used for: occasion tags, category labels, clothing attributes

**Dividers:**
- `1px solid --color-border-light`
- Or: thin horizontal rule with generous vertical margin
- Never decorative, only structural

**Images:**
- Always `object-fit: cover`
- Aspect ratios are fixed per context (see per-component specs)
- Never stretched, never pixelated
- Placeholder for empty wardrobe items: `--color-bg-tertiary` with centered thin plus icon

### 4.8 Layout

- Max content width: `1200px`, centered, `padding: 0 var(--space-8)`
- Sidebar width: `240px` (fixed, left)
- Main content: fluid, fills remaining space
- Page padding top: `var(--space-12)`
- Section gap: `var(--space-16)`
- Grid gaps: `var(--space-6)` default, `var(--space-4)` compact

### 4.9 Motion

Use Framer Motion sparingly. Only these:
- Page transition: `opacity 0 → 1`, `y: 8px → 0`, duration 0.3s, ease out
- Card hover: `scale 1 → 1.01`, duration 0.2s
- Modal: `opacity + scale 0.97 → 1`, duration 0.2s
- List items stagger: `y: 12px → 0`, stagger 0.05s per item
- Packing suggestion stream: fade in per paragraph as Claude streams

**No bouncing. No spring physics. No dramatic entrances. Restraint.**

---

## 5. Data Models

### User
```python
class User(Document):
    email: str                    # unique index
    password_hash: str
    name: str
    created_at: datetime
    style_preferences: StylePreferences  # embedded doc

class StylePreferences(BaseModel):
    occasions: List[str]          # ["work", "casual", "formal", "travel"]
    preferred_palette: List[str]  # ["neutrals", "earth tones", "bold"]
    avoid: List[str]              # ["prints", "heels", etc.]
    notes: str                    # freeform style notes, feeds stylist context
```

### WardrobeItem
```python
class WardrobeItem(Document):
    user_id: PydanticObjectId
    name: str                     # "White linen shirt"
    category: str                 # "top" | "bottom" | "dress" | "outerwear" | "shoes" | "bag" | "accessory"
    subcategory: str              # "shirt" | "jeans" | "blazer" etc.
    color: List[str]              # ["white", "ivory"]
    fabric: str                   # "linen" | "cotton" | "silk" | "wool" | "synthetic"
    formality: str                # "casual" | "smart-casual" | "business" | "formal"
    occasions: List[str]          # ["work", "dinner", "beach", "travel"]
    season: List[str]             # ["spring", "summer", "fall", "winter", "all"]
    image_url: str                # Cloudinary URL
    cloudinary_public_id: str     # For deletion
    weight_grams: int             # Estimated weight in grams. Default by category if user skips:
                                  # top=300g, bottom=500g, dress=400g, outerwear=800g,
                                  # shoes=600g, bag=400g, accessory=100g
    notes: str                    # Optional styling notes
    created_at: datetime
```

### Trip
```python
class Trip(Document):
    user_id: PydanticObjectId
    name: str                     # "Paris in June" — user-set
    destination: str              # "Paris, France"
    start_date: date
    end_date: date
    duration_days: int            # computed
    occasions: List[str]          # ["sightseeing", "business dinners", "casual days"]
    climate: str                  # "hot" | "warm" | "mild" | "cold" | "variable"
    notes: str = ""               # user's notes to the stylist
    # Weight logic
    bag_type: str = "checked"     # "carry_on" | "checked" | "both"
    bag_weight_limit_grams: int   # Total bag allowance e.g. 23000 (23kg)
    empty_bag_weight_grams: int   # Weight of the empty bag e.g. 2000 (2kg)
    reserved_items: List[ReservedItem] = []  # Shoes, makeup, toiletries etc
    available_clothing_weight_grams: int     # Computed: limit - empty_bag - sum(reserved)
    weight_unit: str = "kg"       # "kg" | "lbs" — display preference only, store always in grams
    inspiration_images: List[InspirationImage] = []   # uploaded moodboard screenshots
    vibe_analysis: Optional[VibeAnalysis] = None      # Claude vision analysis of inspiration
    packing_list: Optional[PackingList] = None        # populated after AI suggestion
    approved_outfits: List[str] = []                  # outfit names approved via swipe
    rejected_outfits: List[str] = []                  # outfit names rejected
    created_at: datetime
    status: str                   # "planning" | "reviewing" | "packed" | "completed"

class InspirationImage(BaseModel):
    url: str                      # Cloudinary URL
    cloudinary_public_id: str

class VibeAnalysis(BaseModel):
    summary: str                  # "Effortless coastal minimalism with a quiet luxury edge"
    style_keywords: List[str]     # ["minimal", "neutral tones", "linen", "oversized"]
    color_palette: List[str]      # ["ivory", "sand", "warm white", "light denim"]
    formality_level: str          # "casual" | "smart-casual" | "elevated casual" | "formal"
    avoid: List[str]              # ["prints", "bright colors"]
    raw_analysis: str             # full Claude vision response

class PackingList(BaseModel):
    generated_at: datetime
    stylist_note: str             # Opening paragraph from the stylist
    outfits: List[Outfit]
    essentials: List[str]         # Non-clothing items: "adapter", "sunscreen"
    raw_items: List[PackingItem]  # Flat list for checklist view

class Outfit(BaseModel):
    name: str                     # "Day 1 — Arrival"
    occasion: str
    items: List[PackingItem]
    styling_note: str             # Stylist's note on this specific outfit

class PackingItem(BaseModel):
    wardrobe_item_id: Optional[str]   # Links to actual wardrobe item if matched
    name: str
    category: str
    image_url: Optional[str]      # wardrobe item image for swipe UI
    weight_grams: int             # carried through from wardrobe item
    checked: bool = False
    in_wardrobe: bool             # True if matched to user's existing item

class ReservedItem(BaseModel):
    name: str                     # "Makeup bag", "Shoes", "Toiletries"
    weight_grams: int             # User-entered weight
```

---

## 6. API Routes

### Auth — `/api/v1/auth`
```
POST /register        Body: {email, password, name}         Returns: {token, user}
POST /login           Body: {email, password}               Returns: {token, user}
GET  /me              Header: Authorization Bearer          Returns: user object
```

### Wardrobe — `/api/v1/wardrobe`
```
GET    /              Returns: list of all user's items
POST   /              Body: multipart form (item data + image file)   Returns: created item
GET    /{item_id}     Returns: single item with trips it appears in
PUT    /{item_id}     Body: partial update (including optional new image)  Returns: updated item
DELETE /{item_id}     Also deletes Cloudinary image
```

### Trips — `/api/v1/trips`
```
GET    /                          Returns: list of user's trips
POST   /                          Body: trip data (no packing list yet)   Returns: created trip
GET    /{trip_id}                 Returns: full trip with packing list
PUT    /{trip_id}                 Body: partial update
DELETE /{trip_id}
PATCH  /{trip_id}/check-item      Body: {item_id, checked}               Returns: updated trip
PATCH  /{trip_id}/approve-outfit  Body: {outfit_name}                    Returns: updated trip
PATCH  /{trip_id}/reject-outfit   Body: {outfit_name, keep_items: bool}  Returns: updated trip
```

### Inspiration — `/api/v1/trips/{trip_id}/inspiration`
```
POST   /upload    Body: multipart images (up to 5)    Uploads to Cloudinary, returns urls
POST   /analyze   Body: {trip_id}                     Calls Claude vision API, returns VibeAnalysis
                  Rate limited: 5/minute per user
```

### Pack — `/api/v1/pack`
```
POST /suggest         Body: {trip_id}    Calls Claude API   Returns: PackingList
                      Rate limited: 10/minute per user
                      This is the most expensive route — guard it
```

### Response format (all routes):
```python
# Success
{"success": True, "data": {...}, "message": ""}

# Error
{"success": False, "data": None, "message": "Descriptive error message"}
```

### File: `backend/app/services/cloudinary_service.py`

All wardrobe item uploads must apply Cloudinary's AI background removal transformation. This runs automatically on upload and returns a clean white/transparent background — no manual editing needed.

```python
import cloudinary
import cloudinary.uploader
from app.core.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET
)

async def upload_wardrobe_item(file, user_id: str) -> dict:
    result = cloudinary.uploader.upload(
        file,
        folder=f"pack/wardrobe/{user_id}",
        transformation=[
            {"effect": "background_removal"},   # AI background removal — always on
            {"quality": "auto"},
            {"fetch_format": "auto"}
        ]
    )
    return {
        "url": result["secure_url"],
        "public_id": result["public_id"]
    }

async def delete_wardrobe_item(public_id: str) -> None:
    cloudinary.uploader.destroy(public_id)
```

**Note:** Background removal counts against Cloudinary's free tier transformation credits. The free tier includes 25 monthly credits — each background removal uses 1 credit. At capstone scale (a few dozen wardrobe items) this will never be an issue.

### File: `backend/app/services/claude_service.py`

Two functions: `analyze_vibe` (vision) and `generate_packing_list` (stylist). Both use the same client and cached system prompt.

```python
import anthropic
import json
import base64
import httpx
from app.core.config import settings

client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

STYLIST_SYSTEM_PROMPT = """You are PACK's personal stylist. You are exceptionally good at your job.

You know this user's wardrobe intimately. You think in outfits, not items. You have also studied the user's inspiration images and deeply understand the vibe they are going for — the aesthetic, the mood, the specific silhouettes and color stories they are drawn to.

Your voice: confident, direct, specific. You do not hedge. You say "wear the linen shirt with the wide-leg trousers on your first day. The ivory reads effortlessly against Paris stone." You speak like the best stylist someone has ever had.

Rules:
- Honor the user's inspiration vibe above all else. If their moodboard is quiet luxury minimalism, every outfit reflects that.
- Pull from the user's actual wardrobe when possible. Note when an item is not in their wardrobe.
- Think about fabric weight, climate, and day-to-evening transition.
- Re-wear items strategically across days — a good packer wears one blazer three ways.
- Include a brief stylist note per outfit.
- Open with one short paragraph establishing your read on the trip AND the vibe.
- Default to carry-on only unless stated otherwise.

Respond ONLY with valid JSON. No preamble, no markdown fences."""

VIBE_SYSTEM_PROMPT = """You are a fashion stylist and visual trend analyst. You are given one or more inspiration images — Pinterest boards, moodboards, outfit screenshots, editorial references.

Your job is to extract the precise aesthetic language from these images. Be specific, not generic. Don't say "casual" when you mean "quiet luxury coastal minimalism." Don't say "colorful" when you mean "warm earth tones with occasional terracotta."

Respond ONLY with valid JSON. No preamble, no markdown fences."""


async def analyze_vibe(image_urls: list[str]) -> dict:
    """Analyze inspiration images with Claude vision to extract style vibe."""

    # Fetch images and encode as base64
    image_contents = []
    async with httpx.AsyncClient() as http:
        for url in image_urls[:5]:   # max 5 images
            r = await http.get(url)
            ext = url.split(".")[-1].split("?")[0].lower()
            media_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
            b64 = base64.standard_b64encode(r.content).decode("utf-8")
            image_contents.append({
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": b64}
            })

    image_contents.append({
        "type": "text",
        "text": """Analyze these inspiration images and return a JSON object with this exact structure:
{
  "summary": "2-3 sentence description of the overall aesthetic — be specific and evocative",
  "style_keywords": ["5-8 precise style keywords, e.g. 'quiet luxury', 'coastal minimal', 'oversized tailoring'"],
  "color_palette": ["4-6 specific colors present, e.g. 'warm ivory', 'camel', 'washed denim'"],
  "formality_level": "casual | smart-casual | elevated casual | formal",
  "avoid": ["2-4 things this aesthetic explicitly rejects, e.g. 'logo-heavy pieces', 'bright colors'"],
  "raw_analysis": "your full detailed analysis before distilling to keywords"
}"""
    })

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        system=VIBE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": image_contents}]
    )

    return json.loads(response.content[0].text)


async def generate_packing_list(trip, wardrobe, style_prefs: dict) -> dict:
    """Generate outfit-based packing list using wardrobe + vibe context."""

    wardrobe_context = [
        {
            "id": str(item.id),
            "name": item.name,
            "category": item.category,
            "color": item.color,
            "fabric": item.fabric,
            "formality": item.formality,
            "occasions": item.occasions,
            "season": item.season,
            "weight_grams": item.weight_grams,
            "notes": item.notes
        }
        for item in wardrobe
    ]

    vibe_context = ""
    if trip.vibe_analysis:
        vibe_context = f"""
INSPIRATION VIBE (from user's moodboard — honor this above all):
Summary: {trip.vibe_analysis.summary}
Style keywords: {", ".join(trip.vibe_analysis.style_keywords)}
Color palette: {", ".join(trip.vibe_analysis.color_palette)}
Formality: {trip.vibe_analysis.formality_level}
Avoid: {", ".join(trip.vibe_analysis.avoid)}
"""

    user_message = f"""Trip: {trip.name}
Destination: {trip.destination}
Dates: {trip.start_date} to {trip.end_date} ({trip.duration_days} days)
Climate: {trip.climate}
Occasions: {", ".join(trip.occasions)}
Notes: {trip.notes}

WEIGHT BUDGET:
- Bag limit: {trip.bag_weight_limit_grams / 1000:.1f}kg
- Empty bag: {trip.empty_bag_weight_grams / 1000:.1f}kg
- Reserved items: {", ".join([f"{r.name} ({r.weight_grams/1000:.1f}kg)" for r in trip.reserved_items])}
- Available for clothing: {trip.available_clothing_weight_grams / 1000:.1f}kg
Do NOT suggest outfits whose total item weight exceeds this clothing budget.
Prioritize versatile, lightweight pieces. If the budget is tight, say so in the stylist note.
{vibe_context}
Wardrobe ({len(wardrobe)} items):
{json.dumps(wardrobe_context, indent=2)}

Build the complete packing list. Return this JSON structure:
{{
  "stylist_note": "opening paragraph — reference the trip, the vibe, and the weight budget strategy",
  "total_weight_grams": 0,
  "outfits": [
    {{
      "name": "Day 1 — Arrival",
      "occasion": "travel",
      "outfit_weight_grams": 0,
      "items": [
        {{
          "wardrobe_item_id": "id_or_null",
          "name": "White linen shirt",
          "category": "top",
          "image_url": "url_if_in_wardrobe_or_null",
          "weight_grams": 300,
          "in_wardrobe": true,
          "checked": false
        }}
      ],
      "styling_note": "specific stylist note for this outfit"
    }}
  ],
  "essentials": ["universal adapter", "laundry bag"],
  "raw_items": []
}}

raw_items is the flat deduplicated list. total_weight_grams and outfit_weight_grams must be accurate sums."""

    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2000,
        system=[
            {
                "type": "text",
                "text": STYLIST_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"}
            }
        ],
        messages=[{"role": "user", "content": user_message}]
    )

    return json.loads(response.content[0].text)
```

---

## 8. Auth Flow

- JWT stored in `localStorage` (acceptable for capstone scope)
- Axios instance in `utils/api.js` reads token and adds `Authorization: Bearer <token>` to every request
- FastAPI `deps.py` has `get_current_user` dependency that verifies JWT and returns user
- On 401 response, frontend clears token and redirects to `/auth`
- Password hashed with bcrypt via passlib before storing

```python
# backend/app/api/deps.py
async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(status_code=401, detail="Invalid credentials")
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = await User.get(user_id)
    if user is None:
        raise credentials_exception
    return user
```

---

## 9. Zustand Store

```javascript
// frontend/src/store/index.js
import { create } from 'zustand'

const useStore = create((set, get) => ({
  // Auth slice
  user: null,
  token: localStorage.getItem('pack_token'),
  setUser: (user) => set({ user }),
  setToken: (token) => {
    localStorage.setItem('pack_token', token)
    set({ token })
  },
  logout: () => {
    localStorage.removeItem('pack_token')
    set({ user: null, token: null })
  },

  // Wardrobe slice
  wardrobe: [],
  wardrobeLoading: false,
  setWardrobe: (wardrobe) => set({ wardrobe }),
  addItem: (item) => set((s) => ({ wardrobe: [item, ...s.wardrobe] })),
  removeItem: (id) => set((s) => ({ wardrobe: s.wardrobe.filter(i => i._id !== id) })),

  // Trips slice
  trips: [],
  activeTrip: null,
  tripsLoading: false,
  setTrips: (trips) => set({ trips }),
  setActiveTrip: (trip) => set({ activeTrip: trip }),
  updateTrip: (updated) => set((s) => ({
    trips: s.trips.map(t => t._id === updated._id ? updated : t),
    activeTrip: s.activeTrip?._id === updated._id ? updated : s.activeTrip
  })),

  // Packing slice
  packingLoading: false,
  packingError: null,
  setPackingLoading: (v) => set({ packingLoading: v }),
  setPackingError: (e) => set({ packingError: e }),
}))

export default useStore
```

---

## 10. Pages — Full Specifications

### 10.1 Landing Page (`/`) — Public, Unauthenticated

**Purpose:** Marketing page. Converts visitors to sign-ups. If authenticated, redirect immediately to `/dashboard`.

**Layout:** Full-page sections, no sidebar.

**Section 1 — Hero:**
- Full viewport height, split: left 55% text, right 45% editorial fashion photo (--color-bg-tertiary placeholder)
- Label: "INTRODUCING PACK" — DM Sans 11px uppercase --tracking-wider --color-text-tertiary
- Headline: Cormorant Garamond 72px weight 300 italic: *"Pack like you mean it."*
- Subhead: DM Sans 18px weight 300 --color-text-secondary: "Your AI personal stylist. Every trip, perfectly packed."
- CTA: "Start Packing" — primary button, uppercase DM Sans 13px weight 500, sharp corners
- Below CTA: DM Sans 11px --color-text-tertiary: "Free to use. No credit card required."

**Section 2 — How It Works:**
- Label: "HOW IT WORKS"
- 3 columns. Each: Cormorant 52px number (weight 300, --color-text-tertiary), Cormorant 24px headline, DM Sans 15px weight 300 body
- Col 1: "01 / Build Your Wardrobe — Upload your clothes once. PACK learns your style."
- Col 2: "02 / Set the Vibe — Drop your Pinterest inspo. Your stylist reads the aesthetic."
- Col 3: "03 / Pack Smarter — Swipe through AI-generated outfits. Approve what you love."

**Section 3 — Bottom CTA:**
- Centered, --space-32 top and bottom padding
- Cormorant 52px italic: *"Every trip deserves the right wardrobe."*
- "Create Your Account" primary button

**Footer:** © 2026 PACK — DM Sans 11px --color-text-tertiary centered only.

---

### 10.2 Auth Page (`/auth`)

**Purpose:** Login and signup, toggled on the same page.

**Layout:** Split — left editorial panel, right form.

**Left panel:**
- Background: --color-bg-secondary
- Centered: "PACK" in Cormorant Garamond 52px weight 300 italic
- DM Sans 15px weight 300 italic --color-text-secondary below: *"Your personal stylist, in your pocket."*

**Right panel:**
- Centered form, max-width 360px
- Toggle: "Sign in" / "Create account" — active --color-text-primary, inactive --color-text-tertiary
- Fields (login): Email, Password
- Fields (signup): Name, Email, Password
- Submit: full width primary button
- Errors: DM Sans 13px --color-error below relevant field
- After signup: redirect to `/onboarding`
- After login: redirect to `/dashboard`

---

### 10.3 Dashboard Page (`/dashboard`) — Logged-In Homepage

**Purpose:** Home screen after login. Two states: returning user and fresh user.

**Layout:** Sidebar + main content.

**Sidebar (240px, fixed left):**
- "PACK" wordmark — Cormorant 24px italic, top padding --space-8
- Nav items (DM Sans 14px weight 400): Dashboard / Wardrobe / Trips / Profile
- Bottom: user name (DM Sans 13px weight 500), email (DM Sans 11px --color-text-tertiary), Logout
- Active state: weight 500, 2px left border --color-text-primary, no background fill

**Returning user state** (reference: `references/ssqrd-welcomeback.png`):
- Full-bleed hero area at top: most recently added wardrobe item as background image, or --color-bg-tertiary fallback
- Frosted glass card over hero (backdrop-filter: blur(12px), background: rgba(255,255,255,0.72), --border-thin, --radius-xl, padding --space-8):
  - "Welcome back, [Name]." — Cormorant 36px weight 400
  - Stats: DM Sans 13px --color-text-secondary: "[n] trips planned · [n] wardrobe items · [n] outfits approved"
  - Two action icon cards side by side (like SSQRD Atlas/Explore): "NEW TRIP" with map pin icon + "MY WARDROBE" with hanger icon — --color-bg-primary, --border-thin, --radius-lg, 120px wide, icon centered above label
  - "Continue" primary button below
- Upcoming Trips section: label "UPCOMING TRIPS", horizontal scroll TripCards + "Plan a trip +" dashed card at end
- Wardrobe Snapshot: label "YOUR WARDROBE", 6 thumbnails 100px, "View all →" link

**Fresh user state (no wardrobe, no trips):**
- No hero, no frosted card
- Centered: Cormorant 36px italic: *"Let's build your wardrobe."*
- DM Sans 15px weight 300 --color-text-secondary: "Add your first piece to get started."
- "Add First Item" primary button
- "Or take the guided tour →" text link below — navigates to `/onboarding`

---

### 10.4 Onboarding Page (`/onboarding`) — Interactive Guided Walkthrough

**Purpose:** First-time experience only. Guides new users through a real action at each step. Not a slideshow.

**Layout:** Full screen. Semi-transparent dark overlay (rgba(0,0,0,0.55)) over blurred app UI.

**Always visible:** "Skip intro →" top right — DM Sans 13px --color-text-inverse, text only.

**Step indicator:** Top center: 4 white dots (filled = active, outlined = inactive). "GETTING STARTED" label above in DM Sans 11px.

**Step 1 — Welcome:**
- Centered modal: --color-bg-primary, --radius-xl, max-width 440px
- Cormorant 32px italic: *"Welcome to PACK."*
- DM Sans 15px weight 300: "Your AI personal stylist lives here. Let's set things up in 4 quick steps."
- "Let's go" primary button

**Step 2 — Upload first wardrobe item:**
- Spotlight ring highlights the "Add Item" button area (CSS box-shadow cutout on overlay)
- Animated CSS arrow pointing to it
- Tooltip card (--color-bg-primary, --border-default, --radius-lg) near the arrow:
  - Cormorant 20px: "Add your first piece"
  - DM Sans 13px weight 300 --color-text-secondary: "Upload a photo of any clothing item."
  - "Open Wardrobe" primary small button — opens Add Item modal directly on top of overlay
- On successful upload: auto-advance to step 3
- "Do this later" text link — skip to step 3

**Step 3 — Create first trip:**
- Spotlight shifts to Trips nav + new trip area
- Tooltip card:
  - Cormorant 20px: "Plan your first trip"
  - DM Sans 13px: "Tell your stylist where you're going. Drop inspiration images for best results."
  - "Plan a Trip" button — navigates to `/trips/new` (exits onboarding overlay, sets localStorage `pack_onboarding_step=3` so returning mid-flow picks up here)
- "Do this later" link — skip to step 4

**Step 4 — Meet your stylist:**
- Full overlay, no spotlight
- Cormorant 32px italic: *"Your stylist is ready."*
- DM Sans 15px weight 300: "Generate a packing list and swipe through your AI-curated outfits."
- Static mockup of a simplified outfit card (placeholder, not real data)
- "Start Exploring" primary button — navigates to `/dashboard`, sets `localStorage.setItem('pack_onboarded', 'true')`

---

---

### 10.4 Wardrobe Page (`/wardrobe`)

**Purpose:** Browse, add, and manage all clothing items.

**Layout:** Sidebar + main content.

**Header:**
- Label: "THE WARDROBE"
- Headline: "Your Closet" — Cormorant 52px
- Right side: "[n] items" in DM Sans 13px --color-text-tertiary, and "Add Item" button (primary)

**Filter bar (below header, above grid):**
- Horizontal row of pill tags for filtering: All / Tops / Bottoms / Dresses / Outerwear / Shoes / Bags / Accessories
- Active filter: background --color-text-primary, text --color-text-inverse
- Inactive: --color-bg-tertiary, text --color-text-secondary

**Wardrobe grid:**
- 4 columns on desktop, 2 on mobile
- Gap: --space-6
- Each item card:
  - Square image, aspect 1:1, object-fit: cover, radius --radius-md
  - Below image: item name (DM Sans 14px weight 400 --color-text-primary)
  - Category tag (DM Sans 11px uppercase --color-text-tertiary)
  - Weight (DM Sans 11px --color-text-tertiary): e.g. "300g"
  - On hover: semi-transparent overlay (rgba(26,26,24,0.35)) with two icon buttons centered:
    - Edit icon (pencil) — opens Edit Item modal
    - Delete icon (trash) — opens confirm delete dialog
  - Clicking the image itself (not the icons) → navigates to `/wardrobe/:item_id` (item detail page)

**Add Item modal (triggered by "Add Item" button):**
- Full-screen overlay, --color-bg-overlay background
- Centered card, max-width 480px, --color-bg-primary, --radius-lg, --space-8 padding
- Title: "Add to Wardrobe" — Cormorant 28px
- Image upload area: dashed border, centered text "Drop an image or click to upload", 1:1 aspect ratio preview
- Fields: Name (text), Category (select), Subcategory (text), Color(s) (tag input), Fabric (select), Formality (select), Occasions (multi-select tags), Season (multi-select tags), Weight in grams (number input — placeholder pre-fills by category when user selects it: top=300, bottom=500, dress=400, outerwear=800, shoes=600, bag=400, accessory=100), Notes (textarea optional)
- Buttons: "Add Item" (primary) + "Cancel" (secondary), right-aligned row
- On submit: POST to `/api/v1/wardrobe`, image uploads to Cloudinary first via backend

**Edit Item modal (same fields as Add, pre-populated):**
- Same layout as Add Item modal
- Title: "Edit Item" — Cormorant 28px
- Image: shows current image with "Replace photo" overlay option on hover
- All fields pre-filled with current item data
- Buttons: "Save Changes" (primary) + "Cancel" (secondary)
- On submit: PUT to `/api/v1/wardrobe/:item_id`

**Delete confirm dialog:**
- Small centered modal (max-width 360px), not full-screen overlay
- Cormorant 20px: "Remove this item?"
- DM Sans 13px --color-text-secondary: "It will be removed from your wardrobe and any upcoming trip suggestions."
- Buttons: "Remove" (--color-error text, no background) + "Keep it" (primary)

**Empty state (no items yet):**
- Centered, generous vertical padding
- DM Sans 15px weight 300 --color-text-secondary: "Your wardrobe is empty. Add your first item to get started."
- "Add Item" button below

---

### 10.4b Wardrobe Item Detail Page (`/wardrobe/:item_id`)

**Purpose:** Full product-page view of a single wardrobe item. Edit or delete from here too.

**Layout:** Sidebar + main content (two-column).

**Left column — image:**
- Large square image, max-width 400px, object-fit: contain, --color-bg-secondary background, --radius-lg
- Background-removed wardrobe photo shows cleanly on the warm bg
- Below image: small "Replace photo" text link

**Right column — item details:**
- Category label: DM Sans 11px uppercase --color-text-tertiary (e.g. "TOP")
- Item name: Cormorant 42px weight 400
- Weight: DM Sans 13px --color-text-secondary: "~300g"
- Divider line --border-thin
- **Details section:**
  - Each detail as a row: DM Sans 11px uppercase --color-text-tertiary label left, DM Sans 14px --color-text-primary value right
  - Rows: Subcategory / Fabric / Formality / Season / Color(s)
  - Color(s): shown as small pill tags
  - Occasions: shown as pill tags
- **Notes section** (if notes exist):
  - Label: "STYLIST NOTES"
  - DM Sans 14px weight 300 italic --color-text-secondary
- **Actions** (bottom of right column):
  - "Edit Item" — secondary button, opens Edit modal
  - "Remove from Wardrobe" — text link, --color-error, opens confirm dialog
- **Trips this item appears in** (below actions):
  - Label: "APPEARS IN"
  - List of trip names where this item has been suggested, each as a clickable link → `/trips/:id`
  - Empty state: "Not used in any trips yet."

**Back navigation:**
- "← Your Wardrobe" — DM Sans 13px --color-text-tertiary, top left of main content

---

### 10.5 New Trip Page (`/trips/new`)

**Purpose:** Create a new trip. Collected info + inspiration images become full context for the AI stylist.

**Layout:** Sidebar + centered form (max-width 560px).

**Header:**
- Label: "NEW TRIP"
- Headline: "Where are you going?" — Cormorant 52px italic

**Form fields (in order):**
1. **Trip name** — text input, placeholder: "Paris in June"
2. **Destination** — text input, placeholder: "Paris, France"
3. **Dates** — two date inputs side by side: "Depart" and "Return"
4. **Climate** — select: Hot / Warm / Mild / Cold / Variable
5. **Occasions** — multi-select pill tags: Sightseeing / Business meetings / Casual days / Dinners out / Beach / Hiking / Formal events / Nightlife
6. **Notes to your stylist** — textarea, placeholder: "I have a wedding on Saturday. I want to pack light but look put-together every day."
7. **Choose Your Bag** — visual selector, label: "YOUR BAG"
   - Subtext: DM Sans 11px --color-text-tertiary: "Select the bag you're travelling with"
   - Three large clickable cards side by side: "Carry-On", "Checked Bag", "Both"
   - Each card: bag illustration image centered (use `references/carry_on.png` and `references/checked_bag.png` — both have transparent backgrounds so they render cleanly on any bg), bag type label in DM Sans 13px weight 500 below, standard weight range in DM Sans 11px --color-text-tertiary below that:
     - Carry-On: "references/carry_on.png" / "Carry-On" / "Typically 7–10kg"
     - Checked Bag: "references/checked_bag.png" / "Checked Bag" / "Typically 20–23kg"
     - Both: show both illustrations stacked small / "Carry-On + Checked" / "Enter both limits"
   - Unselected card: --color-bg-secondary, --border-thin, --radius-lg
   - Selected card: --color-bg-primary, 2px solid --color-text-primary border, --radius-lg
   - Selecting "Both" splits the weight section below into two parallel inputs
   - Bag type stored as: `bag_type: "carry_on" | "checked" | "both"`
   - When "Carry-On" selected: pre-fills bag weight limit to 7000g, pre-fills empty bag weight to 2000g (user can override)
   - When "Checked" selected: pre-fills bag weight limit to 23000g, pre-fills empty bag weight to 3000g (user can override)
   - When "Both" selected: two sets of weight inputs appear (one for carry-on, one for checked), available weight is the sum of both
8. **Bag Weight Limit** — number input + kg/lbs toggle pill, placeholder auto-filled based on bag type selection
   - Label: "BAG WEIGHT LIMIT"
   - Subtext: DM Sans 11px --color-text-tertiary: "Your airline's allowance for this bag"
9. **Empty Bag Weight** — number input, auto-filled based on bag type
   - Label: "EMPTY BAG WEIGHT"
   - Subtext: "How much does your empty bag weigh?"
10. **Reserved Items** — dynamic add/remove list, label: "RESERVED WEIGHT"
    - Subtext: DM Sans 11px --color-text-tertiary: "Shoes, makeup bag, toiletries — things going in the bag that aren't clothes"
    - Each row: item name text input (placeholder: "Makeup bag") + weight number input + × remove button
    - "+ Add item" text link adds a new blank row
11. **Live weight calculator** — updates in real time as user types any weight field:
    - --color-bg-tertiary background, --radius-md, --space-4 padding
    - Label: "AVAILABLE FOR CLOTHES" — DM Sans 11px uppercase --color-text-tertiary
    - Large Cormorant 36px weight 300: "14.2 kg" (computed: limit − empty bag − sum of reserved)
    - DM Sans 11px breakdown below: "23kg limit − 2kg bag − 6.8kg reserved = 14.2kg"
    - If result goes negative: number turns --color-error, "You're over your limit" warning
12. **Inspiration upload** — label: "STYLE INSPIRATION"
    - Subtext: DM Sans 13px --color-text-secondary: "Drop your Pinterest screenshots, moodboards, or outfit inspo. Your stylist will study the vibe."
    - Dashed border upload zone, --radius-lg, min-height 160px, accepts up to 5 images
    - Horizontal thumbnail preview row with × remove buttons on each
    - Empty state text: DM Sans 13px --color-text-tertiary centered: "Drop images here or click to browse"

**Submit button:** "Plan This Trip" — full width, primary style

**On success:** 
- If inspiration images were uploaded: POST to `/api/v1/trips/{id}/inspiration/analyze` immediately after trip creation, then redirect to `/trips/[id]`
- If no inspiration images: redirect directly to `/trips/[id]`

---

### 10.6 Trip Detail Page (`/trips/:id`)

**Purpose:** View trip info, see vibe analysis results, generate packing list, then enter swipe review.

**Layout:** Sidebar + main content (two-column on desktop)

**Trip header:**
- Label: "YOUR TRIP"
- Trip name: Cormorant 52px
- Destination + dates: DM Sans 15px --color-text-secondary
- Status tag (planning / reviewing / packed / completed)

**Left column — Trip Info:**
- Climate, duration, occasions (pill tags)
- Stylist notes from user
- **Weight budget card** (--color-bg-secondary, --border-thin, --radius-lg, --space-4 padding):
  - Label: "WEIGHT BUDGET"
  - Cormorant 28px: "[X.X]kg available for clothes"
  - DM Sans 11px breakdown: "[limit]kg limit − [bag]kg bag − [reserved]kg reserved"
  - Reserved items listed as small pills below
  - If total_weight_grams from packing list exists: thin progress bar showing used/available

**Inspiration & Vibe section (left column, below trip info):**
- Label: "YOUR VIBE"
- If inspiration images exist: show them as a horizontal scrollable row of 80px thumbnails
- If vibe_analysis exists: show the vibe card:
  - Summary in Cormorant 18px italic, --color-text-secondary
  - Style keywords as pill tags
  - Color palette: small colored squares (actual colors from palette) + text label
  - Formality level tag
  - "Avoid" section: small strikethrough tags
- If no vibe yet but images exist: show "Analyzing your vibe..." with pulse animation
- If no images: show subtle "Add inspiration →" link

**Right column — Packing:**
- "Generate Packing List" button — primary, full width
  - Loading state: "Your stylist is thinking..." with pulse
  - If vibe exists, the button label is: "Generate Outfits Based on Your Vibe"
- After generation: show stylist note (Cormorant 20px italic, left border 2px) + "Review Outfits" button (primary) that navigates to `/trips/:id/review`
- If outfits already approved: show summary of approved outfits + "Go to Packing" button

---

### 10.7 Swipe Review Page (`/trips/:id/review`) — THE HERO FEATURE

**Purpose:** Review AI-generated outfits one at a time. Swipe right to approve (add to bag), swipe left to reject. This is the core interaction of PACK.

**Layout:** No sidebar. Centered, full-height experience. Max-width 480px centered.

**Header:**
- Back link: "← [Trip Name]"
- Label: "REVIEW YOUR OUTFITS"
- Progress indicator: "3 of 8 outfits" — DM Sans 13px --color-text-tertiary
- Thin progress bar: 2px height, no radius, --color-text-primary fill

**Main card — the outfit:**
This is the Phia "Shop the look" pattern but for approval. One outfit at a time.

Card structure (--color-bg-primary, --border-default, --radius-xl, generous padding):
- Top: outfit name — DM Sans 14px weight 500 uppercase --color-text-tertiary (e.g. "DAY 2 — SIGHTSEEING")
- Occasion tag pill below name
- **Item scroll row** — the core visual:
  - Horizontal scrollable row of item cards
  - Each item card: 140px wide, aspect 3:4, --color-bg-secondary background, --border-thin, --radius-md
  - Item image centered (object-fit: contain — these are background-removed wardrobe photos on clean bg)
  - Active/selected item: border becomes 2px --color-text-primary (like Phia's blue border)
  - Clicking an item makes it active and shows its details below
  - Scroll with trackpad/mouse horizontally
  - Items not in wardrobe: show placeholder bg with item name centered in DM Sans 13px italic
- **Selected item detail** (below scroll row, updates on click):
  - Item name: Cormorant 20px
  - Category tag + formality tag
  - DM Sans 13px --color-text-secondary: item notes if any
- **Weight indicator** (below outfit name, above item scroll):
  - DM Sans 11px --color-text-tertiary: "~[X.Xkg] · [n] pieces"
  - Running total in bag counter: "Bag ([X.Xkg] / [limit]kg)"

**Action buttons — bottom of card:**
Two large buttons side by side:
- Left: "Pass" — secondary style, DM Sans 13px weight 500
- Right: "Add to Bag" — primary style (sharp corners, near-black bg), DM Sans 13px weight 500

**"Add to Bag" interaction — the visual moment:**
When user clicks "Add to Bag":
1. The card animates: scale up slightly (1.02) then flies upward and fades out (Framer Motion: y: 0 → -40px, opacity: 1 → 0, duration 0.4s)
2. A small bag icon in the top right of the screen briefly pulses (scale 1 → 1.3 → 1)
3. The outfit name appears briefly as a toast below the bag icon: "Day 2 outfit added" — DM Sans 13px, fades after 1.5s
4. Next outfit card slides in from the right (x: 60px → 0, opacity: 0 → 1, duration 0.3s)
5. Progress bar updates

**"Pass" interaction:**
1. Card slides left and fades (x: 0 → -40px, opacity: 1 → 0, duration 0.3s)
2. **Rejection modal appears** (centered overlay):
   - Title: "Keep any pieces?" — Cormorant 24px
   - Shows each item from the outfit as a small pill tag with a checkbox
   - Below: "Keep pieces but restyle" button (secondary) — saves selected items to a "loose items" list for the stylist to reassign
   - "Skip entirely" button (text only, --color-text-tertiary) — discards the whole outfit
   - This gives the user granular control without losing good individual pieces

**Bag counter** (top right, persistent):
- Small bag icon + number: "Bag (3)"
- DM Sans 13px weight 500
- Pulses on each addition

**Completion state:**
When all outfits reviewed:
- Headline: Cormorant 52px italic: *"Your bag is packed."*
- Summary: "You approved [n] outfits, [n] items total."
- Two buttons: "Review Bag" (secondary) → goes to packing list, "Start Packing" (primary) → goes to `/trips/:id/pack`

---

### 10.8 Trip Detail Page — After Review (`/trips/:id`)

After outfits are approved, the right column of the trip detail page updates to show:
- Approved outfits summary (outfit names + item count each)
- "Edit Selections" link → back to `/trips/:id/review`
- "Start Packing" button → `/trips/:id/pack`

---

### 10.9 Packing Page (`/trips/:id/pack`)

**Purpose:** Focused checklist view. User is actively packing. Distraction-free.

**Layout:** No sidebar. Full-width, centered max-width 640px.

**Header:**
- Back link: "← Paris in June"
- Label: "PACKING MODE"
- Progress: "12 / 24 packed" — large Cormorant 52px with thin DM Sans label

**All items as a flat checklist grouped by category:**
- Category label: DM Sans 11px uppercase --color-text-tertiary
- Each item: large checkbox, item name DM Sans 15px, outfit tag (small pill)
- Checked state: item name gets line-through, text shifts to --color-text-tertiary

**"All packed!" state:**
- When all items checked: headline changes to Cormorant italic *"You're ready."*
- Trip status updates to "packed" automatically

---

### 10.12 Profile Page (`/profile`)

**Purpose:** Visual activity summary + AI analysis of the user's personal style DNA based on their wardrobe.

**Layout:** Sidebar + main content.

**Header** (reference: `references/phia-profile1.png`):
- Centered, generous top padding
- Circular avatar 80px: first wardrobe item image, or initials on --color-bg-tertiary
- Name: Cormorant 32px weight 400
- Two pill buttons: "Preferences" + "Settings" — secondary style, side by side

**Activity Stats row:**
- 4 stats horizontal, thin --color-border-light dividers between
- Each: Cormorant 52px weight 300 number + DM Sans 11px uppercase label below
- Stats: TRIPS PLANNED / WARDROBE ITEMS / OUTFITS APPROVED / LOOKS GENERATED

**Upcoming Trips section** (reference: `references/phia-profile2.png` scroll pattern):
- Label: "UPCOMING TRIPS"
- Subtext: DM Sans 13px --color-text-secondary
- Horizontal scroll row with ← → arrow buttons top right (DM Sans 13px "See all" + arrow icons)
- Same TripCard as dashboard

**Style DNA section — the AI personality card:**
- Label: "YOUR STYLE DNA"
- Calls `/api/v1/profile/analyze-style` on mount if user has 3+ wardrobe items
- Loading state: DM Sans 13px --color-text-tertiary: "Analyzing your wardrobe..." with pulse on card
- Result (--color-bg-secondary, --border-thin, --radius-xl, --space-8 padding):
  - Cormorant 28px italic headline: the vibe summary e.g. *"Quiet Luxury with an Edge"*
  - DM Sans 15px weight 300 --color-text-secondary: 2-3 sentence style description
  - Style keyword pills
  - Color palette row: 24px color circles + name labels
  - "Most worn category" stat — DM Sans 13px
  - "Based on [n] items" — DM Sans 11px --color-text-tertiary
  - "Re-analyze →" text link bottom right
- Empty state (< 3 items): "Add at least 3 items to unlock your Style DNA."

**Approved Looks section** (reference: `references/phia-profile2.png`):
- Label: "APPROVED LOOKS"
- Horizontal scroll row with ← → arrows
- Each card: outfit name (DM Sans 14px weight 500), trip name (DM Sans 11px --color-text-tertiary), occasion tag, item count
- Empty state: "Approve outfits from a trip to see your looks here."

**Backend:**
```
POST /api/v1/profile/analyze-style
Rate limited: 3/hour per user
Returns: VibeAnalysis object based on full wardrobe
```

---

```python
# backend/app/main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# backend/app/api/routes/pack.py
@router.post("/suggest")
@limiter.limit("10/minute")
async def suggest_packing_list(request: Request, ...):
    ...
```

---

## 12. CORS Setup

```python
# backend/app/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],   # "http://localhost:5173" from .env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 13. Local Dev Setup — Running the App

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Create backend/.env with all variables
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
# Create frontend/.env with VITE_API_URL=http://localhost:8000
npm run dev
# Runs on http://localhost:5173
```

**Two terminals. No Docker. MongoDB is Atlas cloud, no local instance needed.**

### requirements.txt
```
fastapi==0.111.0
uvicorn[standard]==0.30.1
beanie==1.26.0
motor==3.5.1
pydantic-settings==2.3.4
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
slowapi==0.1.9
anthropic==0.28.0
cloudinary==1.40.0
httpx==0.27.0
```

### package.json dependencies
```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.24.0",
    "zustand": "^4.5.4",
    "axios": "^1.7.2",
    "framer-motion": "^11.3.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.1"
  }
}
```
---

## 15. Critical Design Reminders for Claude Code

1. No drop shadows anywhere. Ever. Border instead.
2. No gradients. Flat color only.
3. Cormorant Garamond for all display text. DM Sans for all UI text. Nothing else.
4. Section labels are ALWAYS: DM Sans 11px, weight 500, uppercase, letter-spacing 0.12em, --color-text-tertiary
5. Buttons are sharp-cornered (no border-radius) except pill tags
6. No Inter, no Roboto, no system-ui as a display font
7. Every page has a sidebar except Landing, Auth, and Packing Mode
8. The only accent color is --color-text-primary (near-black). There is no blue, no green as a UI color.
9. All images are object-fit: cover with fixed aspect ratios
10. Hover states use border-color change + scale 1.01, never background color fill change
11. Empty states are written in warm human language, never "No data found"
12. Every form field label is uppercase DM Sans 11px above the input, not placeholder-only
13. Loading states exist for every async operation. Use subtle pulse animation on the container, not a spinner.
14. The swipe review page is the hero moment of the app — treat it like that. The "Add to Bag" animation must feel satisfying and deliberate.
15. The packing list generation is the second hero moment — the UI must feel special when Claude responds.

---

*Built for CP192 Mini Capstone, Minerva University, Spring 2026.*
*Design references: SSQRD (ssqrd.co), Phia (phia.com), JW Anderson (jwanderson.com), MaxMara (thejacketcirclegame.maxmara.com)*
*Stack: React + Vite + Zustand + FastAPI + Beanie + MongoDB Atlas + Cloudinary + Anthropic Claude Haiku 4.5*
