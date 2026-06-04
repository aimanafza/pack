# PACK — Full Product Specification
## For Claude Code: Build this app exactly as specified. Read every section before writing a single line of code.

---

## 0. What PACK Is

PACK is a full-scale consumer fashion app with an AI personal stylist at its core. It is being built for public launch and investor funding. Every architectural and design decision must be production-grade, scalable, and investor-ready. There are no shortcuts.

PACK has two core experiences:

**Trip Packing:** The user creates a trip (destination, dates, occasions), uploads wardrobe items and inspiration images, and the AI generates a curated packing list with full outfit breakdowns — thinking like a personal stylist, not a checklist generator. Users can save trips, edit lists, and check items off as they pack.

**Daily Styling:** Every morning, PACK's AI agent styles the user for the day — pulling weather automatically, reading their calendar, tracking what they've worn recently, and asking for mood + occasion + social vibe. It generates 3 outfit options from their real wardrobe. Users swipe to choose. Their selection is logged and the agent learns their patterns over time.

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
│   │   │   ├── daily/              # NEW — all daily styling components
│   │   │   │   ├── TodayCard.jsx
│   │   │   │   ├── ContextCard.jsx
│   │   │   │   ├── DailyOutfitSwipe.jsx
│   │   │   │   ├── LookHistoryCard.jsx
│   │   │   │   ├── OutfitCollage.jsx
│   │   │   │   └── VibeSelector.jsx
│   │   │   ├── layout/             # Navbar, Sidebar, PageWrapper
│   │   │   └── auth/               # LoginForm, SignupForm
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx
│   │   │   ├── AuthPage.jsx
│   │   │   ├── DashboardPage.jsx     # UPDATED — Today section added above Upcoming Trips
│   │   │   ├── OnboardingPage.jsx
│   │   │   ├── ProfilePage.jsx       # UPDATED — Your Looks section + Looks Styled stat
│   │   │   ├── WardrobePage.jsx
│   │   │   ├── WardrobeItemPage.jsx
│   │   │   ├── TripDetailPage.jsx
│   │   │   ├── NewTripPage.jsx
│   │   │   ├── SwipeReviewPage.jsx
│   │   │   ├── PackingPage.jsx
│   │   │   └── DailyStylingPage.jsx  # NEW
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   ├── useWardrobe.js
│   │   │   ├── useTrips.js
│   │   │   ├── usePackingSuggestions.js
│   │   │   └── useDailyStyling.js    # NEW
│   │   ├── store/
│   │   │   └── index.js            # Zustand store — single file, all slices
│   │   ├── utils/
│   │   │   ├── api.js
│   │   │   └── helpers.js
│   │   ├── styles/
│   │   │   ├── tokens.css
│   │   │   └── global.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py
│   │   │   │   ├── wardrobe.py
│   │   │   │   ├── trips.py
│   │   │   │   ├── pack.py
│   │   │   │   └── daily.py          # NEW
│   │   │   └── deps.py
│   │   ├── models/
│   │   │   ├── user.py               # UPDATED — daily styling fields added
│   │   │   ├── item.py
│   │   │   ├── trip.py
│   │   │   └── daily.py              # NEW
│   │   ├── services/
│   │   │   ├── auth_service.py
│   │   │   ├── claude_service.py     # UPDATED — daily agent added
│   │   │   ├── cloudinary_service.py
│   │   │   └── weather_service.py    # NEW
│   │   ├── core/
│   │   │   ├── config.py             # UPDATED — OPENWEATHER_API_KEY added
│   │   │   ├── security.py
│   │   │   └── database.py
│   │   └── main.py
│   ├── .env
│   ├── requirements.txt
│   └── README.md
│
├── PACK_SPEC.md
└── CLAUDE.md
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
- **MongoDB Atlas** — production cluster
- **python-jose** — JWT auth
- **passlib[bcrypt]** — password hashing
- **slowapi** — rate limiting
- **anthropic** — official Python SDK, tool use enabled
- **cloudinary** — image upload and storage
- **pydantic-settings** — env var management
- **httpx** — async HTTP for weather API calls

### External Services
- **MongoDB Atlas** — production-grade cluster
- **Cloudinary** — free tier (25GB storage). All wardrobe item uploads must use the `e_background_removal` transformation to produce clean white/transparent backgrounds automatically.
- **Anthropic API** — claude-sonnet-4-6 (model string: `claude-sonnet-4-6`). Use this model everywhere. Do not use Haiku.
- **OpenWeatherMap API** — free tier, current weather by coordinates

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
OPENWEATHER_API_KEY=...
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
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&display=swap');
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

:root {
  --font-display: 'Cormorant Garamond', Georgia, serif;
  --font-body: 'DM Sans', system-ui, sans-serif;

  --text-xs: 11px;
  --text-sm: 13px;
  --text-base: 15px;
  --text-md: 18px;
  --text-lg: 24px;
  --text-xl: 36px;
  --text-2xl: 52px;
  --text-3xl: 72px;

  --leading-tight: 1.1;
  --leading-snug: 1.3;
  --leading-normal: 1.6;
  --leading-loose: 1.8;

  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.06em;
  --tracking-wider: 0.12em;
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

### 4.6 Typography Patterns

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

**Dividers:**
- `1px solid --color-border-light`
- Never decorative, only structural

**Images:**
- Always `object-fit: cover`
- Aspect ratios are fixed per context
- Never stretched, never pixelated
- Placeholder: `--color-bg-tertiary` with centered thin plus icon

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
    email: str
    password_hash: str
    name: str
    created_at: datetime
    style_preferences: StylePreferences
    # NEW — daily styling fields
    daily_styling_prefs: DailyStylingPrefs = Field(default_factory=DailyStylingPrefs)
    style_insights: StyleInsights = Field(default_factory=StyleInsights)
    worn_history: List[WornHistoryEntry] = Field(default_factory=list)

class StylePreferences(BaseModel):
    occasions: List[str]
    preferred_palette: List[str]
    avoid: List[str]
    notes: str

# NEW embedded models for daily styling
class DailyStylingPrefs(BaseModel):
    notification_time: str = "07:30"
    notifications_enabled: bool = False
    calendar_connected: bool = False
    calendar_provider: Optional[str] = None   # "google" | "apple"

class StyleInsights(BaseModel):
    last_updated: Optional[datetime] = None
    underused_item_ids: List[str] = []
    skip_pattern_item_ids: List[str] = []
    occasion_preferences: dict = {}
    vibe_correlations: dict = {}
    wear_frequency: dict = {}

class WornHistoryEntry(BaseModel):
    date: date
    look_id: str
    occasion: str
    vibe: Optional[str] = None
    item_ids: List[str]
    weather_summary: str
```

### WardrobeItem
```python
class WardrobeItem(Document):
    user_id: PydanticObjectId
    name: str
    category: str                 # "top" | "bottom" | "dress" | "outerwear" | "shoes" | "bag" | "accessory"
    subcategory: str
    color: List[str]
    fabric: str
    formality: str                # "casual" | "smart-casual" | "business" | "formal"
    occasions: List[str]
    season: List[str]
    image_url: str
    cloudinary_public_id: str
    weight_grams: int             # Default by category: top=300, bottom=500, dress=400, outerwear=800, shoes=600, bag=400, accessory=100
    notes: str
    created_at: datetime
```

### Trip
```python
class Trip(Document):
    user_id: PydanticObjectId
    name: str
    destination: str
    start_date: date
    end_date: date
    duration_days: int
    occasions: List[str]
    climate: str                  # "hot" | "warm" | "mild" | "cold" | "variable"
    notes: str = ""
    bag_type: str = "checked"     # "carry_on" | "checked" | "both"
    bag_weight_limit_grams: int
    empty_bag_weight_grams: int
    reserved_items: List[ReservedItem] = []
    available_clothing_weight_grams: int
    weight_unit: str = "kg"
    inspiration_images: List[InspirationImage] = []
    vibe_analysis: Optional[VibeAnalysis] = None
    packing_list: Optional[PackingList] = None
    approved_outfits: List[str] = []
    rejected_outfits: List[str] = []
    created_at: datetime
    status: str                   # "planning" | "reviewing" | "packed" | "completed"

class InspirationImage(BaseModel):
    url: str
    cloudinary_public_id: str

class VibeAnalysis(BaseModel):
    summary: str
    style_keywords: List[str]
    color_palette: List[str]
    formality_level: str
    avoid: List[str]
    raw_analysis: str

class PackingList(BaseModel):
    generated_at: datetime
    stylist_note: str
    outfits: List[Outfit]
    essentials: List[str]
    raw_items: List[PackingItem]

class Outfit(BaseModel):
    name: str
    occasion: str
    items: List[PackingItem]
    styling_note: str

class PackingItem(BaseModel):
    wardrobe_item_id: Optional[str] = None
    name: str
    category: str
    image_url: Optional[str] = None
    weight_grams: int
    checked: bool = False
    in_wardrobe: bool

class ReservedItem(BaseModel):
    name: str
    weight_grams: int
```

### NEW: DailyLook
```python
class DailyLook(Document):
    user_id: PydanticObjectId
    date: date
    occasion: str                 # "college" | "office" | "going_out" | "dinner_date" | "wfh" | "travel" | "active" | "special_event"
    mood: str                     # "energised" | "put_together" | "lowkey" | "playful" | "cozy"
    vibe: Optional[str] = None    # "lowkey" | "going_out_out" | "cute_casual" | "dress_to_impress" | "match_energy" | "surprise"
    weather_summary: str
    generated_outfits: List[DailyOutfit]
    chosen_outfit_index: Optional[int] = None
    chosen_item_ids: List[str] = []
    status: str = "generated"     # "generated" | "chosen" | "skipped"
    created_at: datetime

class DailyOutfit(BaseModel):
    outfit_index: int
    item_ids: List[str]
    item_names: List[str]
    item_image_urls: List[str]
    claude_note: str
    occasion_tags: List[str]
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
PUT    /{item_id}     Body: partial update     Returns: updated item
DELETE /{item_id}     Also deletes Cloudinary image
```

### Trips — `/api/v1/trips`
```
GET    /                          Returns: list of user's trips
POST   /                          Body: trip data    Returns: created trip
GET    /{trip_id}                 Returns: full trip with packing list
PUT    /{trip_id}                 Body: partial update
DELETE /{trip_id}
PATCH  /{trip_id}/check-item      Body: {item_id, checked}
PATCH  /{trip_id}/approve-outfit  Body: {outfit_name}
PATCH  /{trip_id}/reject-outfit   Body: {outfit_name, keep_items: bool}
```

### Inspiration — `/api/v1/trips/{trip_id}/inspiration`
```
POST   /upload    Body: multipart images (up to 5)
POST   /analyze   Body: {trip_id}    Rate limited: 5/minute
```

### Pack — `/api/v1/pack`
```
POST /suggest     Body: {trip_id}    Rate limited: 10/minute
```

### NEW: Daily Styling — `/api/v1/daily`
```
POST /generate              Body: { occasion, mood, vibe?, lat?, lon? }   Returns: { look_id, outfits, weather_summary }   Rate limited: 10/minute
POST /{look_id}/choose      Body: { outfit_index: 0|1|2 }                 Returns: updated DailyLook
GET  /history               Query: ?limit=20&offset=0                     Returns: paginated DailyLook list
GET  /today                 Returns: today's DailyLook if exists, or null
GET  /insights              Returns: user's StyleInsights
```

### NEW: Weather — `/api/v1/weather`
```
GET /current?lat={lat}&lon={lon}
  Returns: { temp_c, feels_like_c, condition, rain_chance, icon, city }
  Cached 30 minutes per coordinate pair
```

### Response format (all routes):
```python
# Success
{"success": True, "data": {...}, "message": ""}

# Error
{"success": False, "data": None, "message": "Descriptive error message"}
```

---

## 7. Services

### File: `backend/app/services/cloudinary_service.py`

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
            {"effect": "background_removal"},
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

### File: `backend/app/services/weather_service.py` — NEW

```python
import httpx
from app.core.config import settings

async def get_current_weather(lat: float, lon: float) -> dict:
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "lat": lat,
        "lon": lon,
        "appid": settings.OPENWEATHER_API_KEY,
        "units": "metric"
    }
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params, timeout=5.0)
            data = response.json()
        return {
            "temp_c": round(data["main"]["temp"]),
            "feels_like_c": round(data["main"]["feels_like"]),
            "condition": data["weather"][0]["description"].capitalize(),
            "rain_chance": round(data.get("clouds", {}).get("all", 0)),
            "icon": data["weather"][0]["icon"],
            "city": data.get("name", "")
        }
    except Exception:
        # Never crash if weather fails — return a neutral default
        return {
            "temp_c": 20,
            "feels_like_c": 20,
            "condition": "Clear",
            "rain_chance": 0,
            "icon": "01d",
            "city": ""
        }

def get_weather_summary(weather: dict) -> str:
    city = f" · {weather['city']}" if weather.get("city") else ""
    return f"{weather['temp_c']}°C · {weather['condition']}{city}"
```

### File: `backend/app/services/claude_service.py`

Two existing functions (analyze_vibe, generate_packing_list) plus the new daily styling agent. Do not remove the existing functions.

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

# NEW — daily styling agent
DAILY_STYLIST_SYSTEM_PROMPT = """You are PACK's personal stylist. You style users for their actual day, every day.

You have access to their real wardrobe. You know what they've worn recently. You understand their style patterns.

Your output: exactly 3 distinct outfit combinations. Each must be a complete look — at minimum top + bottom (or dress) + shoes. Accessories optional but elevate the look.

Rules:
- Never suggest an item worn in the last 5 days
- Each of the 3 options must feel genuinely different — different silhouette, different energy, or different colour story
- Match the occasion AND the vibe. If vibe is "going_out_out", the outfits should reflect that energy
- "lowkey" means effortless and easy. "dress_to_impress" means reach for the best pieces
- Consider the weather. Cold: add a layer. Rain: avoid delicate fabrics. Warm: breathable fabrics first
- For underused items in style_insights: work them in where they fit naturally
- Write one sentence per outfit. Direct, specific, no filler. Like a real stylist texting you in the morning

Return ONLY valid JSON. No preamble. No markdown fences."""

DAILY_STYLING_TOOLS = [
    {
        "name": "get_wardrobe",
        "description": "Get the user's wardrobe items, optionally filtered by category or occasion",
        "input_schema": {
            "type": "object",
            "properties": {
                "categories": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Filter by categories e.g. ['top', 'bottom', 'shoes']"
                },
                "occasions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Filter by occasion tags e.g. ['casual', 'work']"
                }
            }
        }
    },
    {
        "name": "get_recent_outfits",
        "description": "Get outfits worn in the last N days to avoid repeats",
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "How many days back to check. Default 7."
                }
            }
        }
    },
    {
        "name": "get_style_insights",
        "description": "Get this user's style patterns — underused items, preferences by occasion, vibe correlations",
        "input_schema": {"type": "object", "properties": {}}
    }
]


async def analyze_vibe(image_urls: list[str]) -> dict:
    """Analyze inspiration images with Claude vision to extract style vibe."""
    image_contents = []
    async with httpx.AsyncClient() as http:
        for url in image_urls[:5]:
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
  "style_keywords": ["5-8 precise style keywords"],
  "color_palette": ["4-6 specific colors present"],
  "formality_level": "casual | smart-casual | elevated casual | formal",
  "avoid": ["2-4 things this aesthetic explicitly rejects"],
  "raw_analysis": "your full detailed analysis before distilling to keywords"
}"""
    })

    response = client.messages.create(
        model="claude-sonnet-4-6",
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
{vibe_context}
Wardrobe ({len(wardrobe)} items):
{json.dumps(wardrobe_context, indent=2)}

Build the complete packing list. Return this JSON structure:
{{
  "stylist_note": "opening paragraph",
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
}}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
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


def _filter_wardrobe(wardrobe: list, filters: dict) -> list:
    """Filter wardrobe items by category and/or occasion."""
    result = wardrobe
    if filters.get("categories"):
        result = [i for i in result if i.get("category") in filters["categories"]]
    if filters.get("occasions"):
        result = [i for i in result if any(o in i.get("occasions", []) for o in filters["occasions"])]
    return result


def _get_recent(worn_history: list, days: int = 7) -> list:
    """Return worn outfits from the last N days."""
    from datetime import date, timedelta
    cutoff = date.today() - timedelta(days=days)
    return [e for e in worn_history if e.get("date") and e["date"] >= str(cutoff)]


async def generate_daily_outfits(
    wardrobe: list,
    worn_history: list,
    style_insights: dict,
    context: dict
) -> dict:
    """Run the daily styling agent with tool use. Returns dict with 3 outfits."""
    tool_data = {
        "wardrobe": wardrobe,
        "recent_outfits": worn_history,
        "style_insights": style_insights
    }

    weather = context.get("weather", {})
    user_message = f"""Style me for today.

Today's context:
- Occasion: {context['occasion']}
- Mood: {context['mood']}
- Vibe: {context.get('vibe', 'not specified')}
- Weather: {weather.get('temp_c', 20)}°C, {weather.get('condition', 'Clear')}. Feels like {weather.get('feels_like_c', 20)}°C. Rain chance: {weather.get('rain_chance', 0)}%.

Use your tools to check my wardrobe and recent outfits, then generate 3 complete outfit options.

Return this exact JSON structure:
{{
  "outfits": [
    {{
      "outfit_index": 0,
      "item_ids": ["id1", "id2", "id3"],
      "item_names": ["White linen shirt", "Black wide-leg trousers", "Ballet flats"],
      "item_image_urls": ["url1", "url2", "url3"],
      "claude_note": "One direct sentence about why this works for today.",
      "occasion_tags": ["daytime", "polished", "comfortable"]
    }},
    {{ "outfit_index": 1 }},
    {{ "outfit_index": 2 }}
  ]
}}"""

    messages = [{"role": "user", "content": user_message}]

    while True:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2000,
            system=DAILY_STYLIST_SYSTEM_PROMPT,
            tools=DAILY_STYLING_TOOLS,
            messages=messages
        )

        if response.stop_reason == "end_turn":
            for block in response.content:
                if hasattr(block, 'text'):
                    return json.loads(block.text)

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    if block.name == "get_wardrobe":
                        result = _filter_wardrobe(tool_data["wardrobe"], block.input)
                    elif block.name == "get_recent_outfits":
                        result = _get_recent(tool_data["recent_outfits"], block.input.get("days", 7))
                    elif block.name == "get_style_insights":
                        result = tool_data["style_insights"]
                    else:
                        result = {}

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result)
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
        else:
            raise ValueError(f"Unexpected stop reason: {response.stop_reason}")
```

---

## 8. Auth Flow

- JWT stored in `localStorage`
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

  // NEW — Daily styling slice
  todayLook: null,
  lookHistory: [],
  dailyLoading: false,
  dailyError: null,
  setTodayLook: (look) => set({ todayLook: look }),
  setLookHistory: (history) => set({ lookHistory: history }),
  setDailyLoading: (v) => set({ dailyLoading: v }),
  setDailyError: (e) => set({ dailyError: e }),
  chooseDailyOutfit: (outfitIndex) => set((s) => ({
    todayLook: s.todayLook
      ? { ...s.todayLook, chosen_outfit_index: outfitIndex, status: 'chosen' }
      : null
  })),
}))

export default useStore
```

---

## 10. Pages — Full Specifications

### 10.1 Landing Page (`/`) — Public, Unauthenticated

**Layout:** Full-page sections, no sidebar.

**Section 1 — Hero:**
- Full viewport height, split: left 55% text, right 45% editorial fashion photo
- Label: "INTRODUCING PACK" — DM Sans 11px uppercase --tracking-wider --color-text-tertiary
- Headline: Cormorant Garamond 72px weight 300 italic: *"Pack like you mean it."*
- Subhead: DM Sans 18px weight 300 --color-text-secondary: "Your AI personal stylist. Every trip, perfectly packed."
- CTA: "Start Packing" — primary button
- Below CTA: DM Sans 11px --color-text-tertiary: "Free to use. No credit card required."

**Section 2 — How It Works:**
- Label: "HOW IT WORKS"
- 3 columns. Each: Cormorant 52px number (weight 300, --color-text-tertiary), Cormorant 24px headline, DM Sans 15px weight 300 body
- Col 1: "01 / Build Your Wardrobe"
- Col 2: "02 / Set the Vibe"
- Col 3: "03 / Pack Smarter"

**Section 3 — Bottom CTA:**
- Cormorant 52px italic: *"Every trip deserves the right wardrobe."*
- "Create Your Account" primary button

**Footer:** © 2026 PACK — DM Sans 11px --color-text-tertiary centered.

---

### 10.2 Auth Page (`/auth`)

**Layout:** Split — left editorial panel, right form.

**Left panel:** --color-bg-secondary, centered "PACK" Cormorant 52px italic, tagline below.

**Right panel:** centered form max-width 360px, toggle sign in/create account, fields, submit button.

After signup: redirect to `/onboarding`. After login: redirect to `/dashboard`.

---

### 10.3 Dashboard Page (`/dashboard`) — UPDATED

**Layout:** Sidebar + main content.

**Sidebar (240px, fixed left):**
- "PACK" wordmark — Cormorant 24px italic
- Nav: Dashboard / Wardrobe / Trips / Profile / **Today** (new item, links to /daily)
- Bottom: user name, email, Logout
- Active state: weight 500, 2px left border --color-text-primary

**Returning user state:**
- Full-bleed hero with frosted glass welcome card (backdrop-filter: blur(12px), rgba(255,255,255,0.72)):
  - "Welcome back, [Name]." — Cormorant 36px
  - Stats row
  - NEW TRIP + MY WARDROBE icon cards
  - "Continue" primary button

**Content sections in this order:**
1. Hero / welcome card
2. **TODAY** ← new section
3. UPCOMING TRIPS
4. YOUR WARDROBE snapshot

**TODAY section:**
- Label: "TODAY"
- Single TodayCard component (not a scroll row)
- Left-aligned, ~360px wide on desktop, full width on mobile
- Two states — see TodayCard spec in Section 10.10

**Fresh user state:** Cormorant 36px italic "Let's build your wardrobe." + "Add First Item" button + "Or take the guided tour →" link.

---

### 10.4 Onboarding Page (`/onboarding`)

**Layout:** Full screen with dark overlay (rgba(0,0,0,0.55)) over blurred app UI.

**Always visible:** "Skip intro →" top right.

**Step indicator:** Top center: 4 white dots.

**Step 1:** Welcome modal — Cormorant 32px italic "Welcome to PACK." + "Let's go" button.

**Step 2:** Spotlight on Add Item button. Tooltip card with "Add your first piece" + upload trigger. Auto-advance on upload or "Do this later".

**Step 3:** Spotlight on Trips. "Plan your first trip" tooltip. "Plan a Trip" button navigates to /trips/new.

**Step 4:** "Your stylist is ready." — static mockup of outfit card. "Start Exploring" → /dashboard, sets `localStorage.setItem('pack_onboarded', 'true')`.

---

### 10.5 Wardrobe Page (`/wardrobe`)

**Header:** Label "THE WARDROBE", headline "Your Closet" Cormorant 52px, "[n] items" + "Add Item" button right.

**Filter bar:** Horizontal pill row — All / Tops / Bottoms / Dresses / Outerwear / Shoes / Bags / Accessories. Active: --color-text-primary bg + --color-text-inverse text.

**Grid:** 4 columns desktop, 2 mobile, --space-6 gap. Each card: 1:1 square image, name DM Sans 14px, category tag 11px uppercase, weight 11px. Hover: overlay with edit + delete icons. Click image → /wardrobe/:item_id.

**Add Item modal:** Full-screen overlay, max-width 480px card. Fields: Name, Category, Subcategory, Colors, Fabric, Formality, Occasions, Season, Weight (auto-prefills by category), Notes.

**Edit Item modal:** Same fields pre-populated.

**Delete confirm:** Small modal — "Remove this item?" + "Remove" (--color-error) + "Keep it" (primary).

**Empty state:** "Your wardrobe is empty. Add your first item to get started."

---

### 10.5b Wardrobe Item Detail Page (`/wardrobe/:item_id`)

**Layout:** Sidebar + two-column.

**Left column:** Large square image (max-width 400px, object-fit: contain, --color-bg-secondary bg, --radius-lg) + "Replace photo" link below.

**Right column:**
- Category label DM Sans 11px uppercase
- Item name Cormorant 42px
- Weight DM Sans 13px
- Divider
- Details rows: Subcategory / Fabric / Formality / Season / Color(s) / Occasions
- Notes section (if exists): label "STYLIST NOTES", DM Sans 14px weight 300 italic
- Actions: "Edit Item" secondary + "Remove from Wardrobe" --color-error text link
- "APPEARS IN": list of trips this item appears in

**Back nav:** "← Your Wardrobe" top left.

---

### 10.6 New Trip Page (`/trips/new`)

**Header:** Label "NEW TRIP", headline "Where are you going?" Cormorant 52px italic.

**Form fields:**
1. Trip name
2. Destination
3. Dates (Depart + Return side by side)
4. Climate (select)
5. Occasions (multi-select pills)
6. Notes to your stylist
7. **Bag type selector** — 3 large clickable cards: Carry-On / Checked Bag / Both. Each has illustration image (references/carry_on.png, references/checked_bag.png), label, weight range. Selected: 2px solid --color-text-primary. Carry-On pre-fills 7000g limit / 2000g empty. Checked pre-fills 23000g / 3000g.
8. Bag Weight Limit (number + kg/lbs toggle)
9. Empty Bag Weight (number)
10. Reserved Items (dynamic add/remove rows: name + weight + × button)
11. **Live weight calculator** (--color-bg-tertiary bg, --radius-md): "AVAILABLE FOR CLOTHES" label, Cormorant 36px computed weight, breakdown text below. Turns --color-error if negative.
12. Inspiration upload — dashed border zone, up to 5 images, horizontal thumbnail preview row

**Submit:** "Plan This Trip" full-width primary button.

**On success:** If inspiration images exist → analyze immediately → redirect to /trips/:id. Else redirect directly.

---

### 10.7 Trip Detail Page (`/trips/:id`)

**Layout:** Sidebar + two-column desktop.

**Trip header:** Label "YOUR TRIP", trip name Cormorant 52px, destination + dates DM Sans 15px, status tag.

**Left column:**
- Climate, duration, occasions pills
- Stylist notes
- Weight budget card (--color-bg-secondary, --border-thin, --radius-lg): Cormorant 28px "X.Xkg available", breakdown text, progress bar when packing list exists
- Vibe section: inspiration thumbnails horizontal scroll, vibe_analysis card (summary italic Cormorant, keywords pills, color palette swatches, formality tag, avoid strikethrough tags)

**Right column:**
- "Generate Packing List" primary button. Loading: "Your stylist is thinking..." with pulse.
- After generation: stylist note (Cormorant 20px italic, 2px left border) + "Review Outfits" button → /trips/:id/review
- If approved: approved outfits summary + "Go to Packing" button

---

### 10.8 Swipe Review Page (`/trips/:id/review`) — THE HERO FEATURE

**Layout:** No sidebar. Centered max-width 480px.

**Header:** Back link, "REVIEW YOUR OUTFITS" label, "3 of 8 outfits" progress, 2px progress bar.

**Main card** (--color-bg-primary, --border-default, --radius-xl):
- Outfit name: DM Sans 14px weight 500 uppercase --color-text-tertiary
- Occasion tag pill
- Weight indicator: "~X.Xkg · n pieces" + "Bag (X.Xkg / limit kg)"
- **Item scroll row:** horizontal scroll, 140px × 3:4 cards, --color-bg-secondary, --border-thin, --radius-md. Click item = active (2px --color-text-primary border) + shows detail below. Items not in wardrobe: placeholder with name centered.
- Selected item detail below: Cormorant 20px name, category + formality tags, notes

**Action buttons:**
- "Pass" — secondary
- "Add to Bag" — primary

**"Add to Bag" animation:**
1. Card: scale 1.02 then y: 0 → -40px, opacity → 0, duration 0.4s
2. Bag icon pulse: scale 1 → 1.3 → 1
3. Toast: "Day 2 outfit added" — DM Sans 13px, fades 1.5s
4. Next card: x: 60px → 0, opacity 0 → 1, duration 0.3s

**"Pass" → Rejection modal:**
- "Keep any pieces?" Cormorant 24px
- Each item as checkable pill
- "Keep pieces but restyle" secondary + "Skip entirely" text link

**Bag counter** (top right): bag icon + "Bag (3)", pulses on addition.

**Completion state:** Cormorant 52px italic "Your bag is packed." + "Review Bag" + "Start Packing" → /trips/:id/pack.

---

### 10.9 Packing Page (`/trips/:id/pack`)

**Layout:** No sidebar. Centered max-width 640px.

**Header:** Back link, "PACKING MODE" label, "12 / 24 packed" Cormorant 52px progress.

**Checklist:** Items grouped by category. Category label DM Sans 11px uppercase. Each item: large checkbox, name DM Sans 15px, outfit tag pill. Checked: line-through, --color-text-tertiary.

**All packed state:** Cormorant italic "You're ready." Trip status → "packed".

---

### 10.10 Daily Styling Page (`/daily`) — NEW

**Layout:** No sidebar. Focused mode, same as SwipeReviewPage and PackingPage. Max-width 520px centered.

**3 steps, managed by local state: 'context' | 'outfits' | 'confirmed'**

**Step: 'context' — Context Card**

```
Label: "TODAY"
Date: Cormorant 42px — "Friday, April 25" (JS Date, formatted)
Weather strip: auto-fetched via /api/v1/weather/current using navigator.geolocation
  "18°C · Partly cloudy · Buenos Aires" — DM Sans 13px --color-text-secondary
  Loading: "--°C · Fetching weather..." in --color-text-tertiary
  Error or denied: hide weather strip silently

Divider --border-thin

Mood selector — label: "HOW ARE YOU FEELING?"
  5 option cards in flex row (wrap to 2+3 on mobile)
  Each: icon (24px emoji) centered, DM Sans 11px label below
  Default: --color-bg-secondary, --border-thin, --radius-lg, ~80px wide
  Selected: --color-bg-primary, 2px solid --color-text-primary
  Options/values:
    Energised ⚡ → "energised"
    Put-together 🎯 → "put_together"
    Lowkey 🤍 → "lowkey"
    Playful 🎨 → "playful"
    Cozy ☁️ → "cozy"

Divider --border-thin

Occasion selector — label: "WHAT'S TODAY?"
  8 pills in flex-wrap, 4 per row desktop, 2 per row mobile
  Default: --radius-pill, --color-bg-tertiary, --border-thin, DM Sans 12px weight 500
  Selected: bg --color-text-primary, color --color-text-inverse
  Options/values:
    🎓 College → "college"
    💼 Office → "office"
    👯 Going Out → "going_out"
    🍽 Dinner/Date → "dinner_date"
    🏠 WFH → "wfh"
    ✈️ Travel Day → "travel"
    🏃 Active → "active"
    🎉 Special Event → "special_event"

VibeSelector (VibeSelector.jsx):
  Renders only when occasion === "going_out" || occasion === "dinner_date"
  Framer Motion: initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
  Label: "WHAT'S THE ENERGY?"
  Sub-label: "Friends always ask what you're wearing." — DM Sans 13px --color-text-secondary italic
  6 pills in 2 rows of 3:
    "Keep it lowkey 🤍" → "lowkey"
    "We're going out out 🔥" → "going_out_out"
    "Cute but casual ✨" → "cute_casual"
    "Dress to impress 💅" → "dress_to_impress"
    "Match the group energy 👯" → "match_energy"
    "Surprise me" → "surprise"

CTA: "Style Me Today" — primary, full width, sharp corners
  Disabled if no occasion selected
  onClick: get geolocation → call generateLook({ occasion, mood, vibe, lat, lon })
```

**Step: 'generating' (while API call in progress)**
```
Cormorant 28px italic: "Your stylist is working..."
DM Sans 13px --color-text-secondary: "Checking your wardrobe and today's weather."
Pulse animation on a thin horizontal line — not a spinner
```

**Step: 'outfits' — 3 Outfit Options**
```
Local state: currentIndex (0, 1, 2)

Progress: "OPTION {currentIndex + 1} OF 3" — DM Sans 11px uppercase --color-text-tertiary

Card (--color-bg-primary, --border-default, --radius-xl, --space-8 padding):
  Occasion tags from outfit.occasion_tags as pills
  Claude's note: outfit.claude_note — Cormorant 20px italic --color-text-secondary, --space-4 vertical margin
  ItemScrollRow (reuse existing component): outfit items, same 140px × 3:4 cards
  Context line: DM Sans 11px --color-text-tertiary — weather summary + occasion

Action buttons:
  "Next option →" — secondary
    If currentIndex < 2: increment, animate card out left / new card in right
    If currentIndex === 2: label "Back to first", wraps to 0
  "Wear this today" — primary
    Calls chooseOutfit(look._id, currentIndex)
    On success: transition to 'confirmed'

Card transition (Framer Motion AnimatePresence, key={currentIndex}):
  Out: x: 0 → -30px, opacity: 1 → 0, duration 0.25s
  In:  x: 30px → 0, opacity: 0 → 1, duration 0.25s
```

**Step: 'confirmed'**
```
Cormorant 48px italic: "Looking good."
OutfitCollage (size="md") showing chosen outfit's item_image_urls
DM Sans 15px weight 300 --color-text-secondary: "Your look for {date} is saved."
"View your wardrobe →" text link → /wardrobe
"Back to Dashboard" secondary button → /dashboard
```

---

### 10.11 Profile Page (`/profile`) — UPDATED

**Layout:** Sidebar + main content.

**Header:** Circular avatar 80px, Name Cormorant 32px, "Preferences" + "Settings" pill buttons.

**Activity Stats row — UPDATED:**
5 stats with --color-border-light dividers between:
- TRIPS PLANNED / WARDROBE ITEMS / OUTFITS APPROVED / LOOKS GENERATED / **LOOKS STYLED** (new)
Each: Cormorant 52px weight 300 number + DM Sans 11px uppercase label.

**Upcoming Trips:** Label + horizontal scroll row with ← → arrows + TripCards.

**Style DNA section:**
- Label "YOUR STYLE DNA"
- Calls /api/v1/profile/analyze-style on mount if 3+ wardrobe items
- Loading: pulse on card
- Result (--color-bg-secondary, --border-thin, --radius-xl): Cormorant 28px italic headline, DM Sans 15px description, keyword pills, color circles, most worn category, "Re-analyze →" link
- Empty: "Add at least 3 items to unlock your Style DNA."

**Approved Looks section:**
- Label "APPROVED LOOKS"
- Horizontal scroll, ← → arrows
- Each card: outfit name DM Sans 14px, trip name 11px, occasion tag, item count

**NEW: Your Looks section:**
- Label "YOUR LOOKS"
- Sub-label DM Sans 13px: "Your daily style archive."
- Horizontal scroll row, same pattern as Approved Looks
- LookHistoryCard for each DailyLook in lookHistory
- Empty: "Start styling daily to build your look archive."

---

## 11. New Components — Daily Styling

### OutfitCollage.jsx

A reusable component displaying 3 clothing item images as a loose editorial flat-lay.

Props: `{ imageUrls: string[], size?: 'sm' | 'md' }`

Visual spec:
- Container: relative position, height md=160px sm=100px
- 3 images absolutely positioned:
  - Left: bottom-left, width ~45%, `transform: rotate(2deg)`, z-index 1
  - Center: centered, width ~50%, `transform: rotate(-3deg)`, z-index 2
  - Right: bottom-right, width ~45%, `transform: rotate(1.5deg)`, z-index 1
- Each image: --radius-md, object-fit: contain, --color-bg-tertiary bg, --border-thin
- Missing images: --color-bg-tertiary placeholder rectangle

### TodayCard.jsx

Props: `{ todayLook, onStyleMe }`

**State A: todayLook null**
- Card: TripCard dimensions (~280px height), --color-bg-secondary, --border-thin, --radius-lg
- Date + weather in DM Sans 11px
- Cormorant 28px italic "What are you wearing today?"
- DM Sans 13px --color-text-tertiary "Your stylist is ready."
- "Style me today →" primary button

**State B: todayLook.status === 'chosen'**
- Occasion + vibe pill tags top
- OutfitCollage (size="md") center
- Claude's note Cormorant 14px italic bottom
- "Change look →" text link right

**State C: todayLook.status === 'generated' (in progress)**
- Same as State A but button reads "Continue styling →"

Hover: scale 1.01, --border-medium.

### LookHistoryCard.jsx

Props: `{ look }` — DailyLook object

- Card: TripCard dimensions, --color-bg-secondary, --border-thin, --radius-lg
- Top 55%: OutfitCollage (size="sm")
- Bottom 45%: date (DM Sans 11px uppercase), occasion + vibe pills, Claude note (Cormorant 13px italic, 2 lines max)
- Hover: scale 1.01, --border-medium

### VibeSelector.jsx

Props: `{ value, onChange }` — controlled

- Framer Motion animate in/out
- Label + sub-label
- 6 pills in 2×3 grid
- Selected: --color-text-primary bg + --color-text-inverse text

### ContextCard.jsx (used inside DailyStylingPage)

Full context input. Props: `{ onGenerate }`.
Contains: weather strip, mood selector, occasion selector, VibeSelector (conditional), CTA button.
See DailyStylingPage spec above for full visual detail.

---

## 12. useDailyStyling Hook

```javascript
// frontend/src/hooks/useDailyStyling.js
import api from '../utils/api'
import useStore from '../store'

export function useDailyStyling() {
  const { setTodayLook, setLookHistory, setDailyLoading, setDailyError } = useStore()

  const getLocation = () => new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000 }
    )
  })

  const checkToday = async () => {
    try {
      const res = await api.get('/api/v1/daily/today')
      if (res.data.data) setTodayLook(res.data.data)
    } catch (_) {}
  }

  const generateLook = async ({ occasion, mood, vibe, lat, lon }) => {
    setDailyLoading(true)
    setDailyError(null)
    try {
      const res = await api.post('/api/v1/daily/generate', { occasion, mood, vibe, lat, lon })
      setTodayLook(res.data.data)
      return res.data.data
    } catch (err) {
      setDailyError(err.response?.data?.message || 'Something went wrong')
      throw err
    } finally {
      setDailyLoading(false)
    }
  }

  const chooseOutfit = async (lookId, outfitIndex) => {
    const res = await api.post(`/api/v1/daily/${lookId}/choose`, { outfit_index: outfitIndex })
    setTodayLook(res.data.data)
    return res.data.data
  }

  const fetchHistory = async (limit = 20, offset = 0) => {
    const res = await api.get(`/api/v1/daily/history?limit=${limit}&offset=${offset}`)
    setLookHistory(res.data.data)
  }

  return { checkToday, generateLook, chooseOutfit, fetchHistory, getLocation }
}
```

---

## 13. Rate Limiting

```python
# backend/app/main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Applied per route:
# pack/suggest: @limiter.limit("10/minute")
# trips/inspiration/analyze: @limiter.limit("5/minute")
# daily/generate: @limiter.limit("10/minute")
# profile/analyze-style: @limiter.limit("3/hour")
```

---

## 14. CORS Setup

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 15. Local Dev Setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

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

## 16. Critical Design Reminders for Claude Code

1. No drop shadows anywhere. Ever. Border instead.
2. No gradients. Flat color only.
3. Cormorant Garamond for all display text. DM Sans for all UI text. Nothing else.
4. Section labels are ALWAYS: DM Sans 11px, weight 500, uppercase, letter-spacing 0.12em, --color-text-tertiary
5. Buttons are sharp-cornered (no border-radius) except pill tags.
6. No Inter, no Roboto, no system-ui as a display font.
7. Every page has a sidebar except Landing, Auth, Packing Mode, Swipe Review, and Daily Styling.
8. The only accent color is --color-text-primary (near-black). No blue, no green as UI colors.
9. All images are object-fit: cover with fixed aspect ratios.
10. Hover states use border-color change + scale 1.01, never background fill change.
11. Empty states are written in warm human language, never "No data found."
12. Every form field label is uppercase DM Sans 11px above the input, not placeholder-only.
13. Loading states exist for every async operation. Subtle pulse animation, not a spinner.
14. The swipe review page is the hero moment of the trip flow — treat it like that.
15. The packing list generation is the second hero moment of the trip flow.
16. The model is claude-sonnet-4-6 everywhere. No exceptions. Update any existing references to older models.
17. The TodayCard flat-lay collage (OutfitCollage.jsx) is the visual identity of daily styling. 3 images, loose positioning, center image rotated -3deg. Make it feel editorial not utilitarian.
18. The vibe selector only appears for social occasions. Animate it in with Framer Motion, don't just toggle display.
19. Weather is fetched client-side via navigator.geolocation and passed as lat/lon to the backend. Never hardcode a city.
20. Every daily look logged to wornHistory is a data asset. Log it correctly every time with item_ids, weather, occasion, and vibe.
21. The DailyStylingPage has no sidebar — it is a focused mode experience like PackingPage.
22. The TODAY section on the dashboard sits above UPCOMING TRIPS, below the hero card.

---

*Built for public launch and investor funding. Production-grade. No shortcuts.*
*Design references: SSQRD (ssqrd.co), Phia (phia.com), JW Anderson (jwanderson.com), MaxMara*
*Stack: React + Vite + Zustand + FastAPI + Beanie + MongoDB Atlas + Cloudinary + Anthropic Claude + OpenWeatherMap*