import anthropic
import httpx
import base64
import json
from app.core.config import settings
from app.models.trip import Trip
from app.models.item import WardrobeItem

client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)

STYLIST_SYSTEM_PROMPT = """You are PACK's personal stylist. You are exceptionally good at your job.

You know this user's wardrobe intimately. You think in outfits, not items. When given a trip, you construct a complete wardrobe for that trip: specific outfits for specific days and occasions, with clear reasoning for every choice.

You know this user's wardrobe intimately. You think in outfits, not items. You have also studied the user's inspiration images and deeply understand the vibe they are going for — the aesthetic, the mood, the specific silhouettes and color stories they are drawn to.

Your voice: confident, direct, specific. You do not hedge. You do not say "you might consider" — you say "wear the linen shirt with the wide-leg trousers on your first day." You speak like the best stylist someone has ever had.

Rules:
- Honor the user's inspiration vibe above all else. If their moodboard is quiet luxury minimalism, every outfit reflects that.
- Every outfit suggestion must pull from the user's actual wardrobe when possible. Note when an item is not in their wardrobe.
- Think about fabric weight, climate, and transition (day to evening).
- Account for re-wearing items across days.
- Include a brief stylist note per outfit explaining the thinking.
- Open with one short paragraph establishing your read on the trip.
- Default to carry-on only unless stated otherwise.

Respond ONLY with valid JSON. No preamble, no markdown fences."""

VIBE_SYSTEM_PROMPT = """You are a fashion stylist and visual trend analyst. You are given one or more inspiration images — Pinterest boards, moodboards, outfit screenshots, editorial references.

Your job is to extract the precise aesthetic language from these images. Be specific, not generic. Don't say "casual" when you mean "quiet luxury coastal minimalism." Don't say "colorful" when you mean "warm earth tones with occasional terracotta."

Respond ONLY with valid JSON. No preamble, no markdown fences."""


async def analyze_vibe(image_urls: list[str]) -> dict:
    """Analyze inspiration images with Claude vision to extract style vibe."""
    image_contents = []
    # Detect media type from magic bytes, not URL extension (Cloudinary URLs are unreliable)
    MAGIC = {
        b"\xff\xd8\xff": "image/jpeg",
        b"\x89PNG": "image/png",
        b"RIFF": "image/webp",
        b"GIF8": "image/gif",
    }

    async with httpx.AsyncClient() as http:
        for url in image_urls[:5]:
            r = await http.get(url)
            content_type = r.headers.get("content-type", "").split(";")[0].strip()
            if content_type.startswith("image/"):
                media_type = content_type
            else:
                # Fall back to magic bytes
                header = r.content[:4]
                media_type = next(
                    (mt for sig, mt in MAGIC.items() if header[:len(sig)] == sig),
                    "image/jpeg",
                )
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

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1000,
        system=VIBE_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": image_contents}]
    )

    raw = response.content[0].text.strip()
    # Strip markdown fences if Claude wrapped the JSON
    if raw.startswith("```"):
        # handles ```json\n...\n``` and ```\n...\n```
        inner = raw[3:]  # strip opening ```
        if inner.startswith("json"):
            inner = inner[4:]
        raw = inner.split("```")[0]
    parsed = json.loads(raw.strip())
    # Raise if Claude returned an error object instead of VibeAnalysis
    if "error" in parsed and "summary" not in parsed:
        raise ValueError(parsed.get("message", "Could not analyze image"))
    return parsed


async def analyze_style_dna(wardrobe: list[WardrobeItem]) -> dict:
    """Synthesize personal style DNA from wardrobe metadata."""
    wardrobe_context = [
        {
            "name": item.name,
            "category": item.category,
            "color": item.color,
            "fabric": item.fabric,
            "formality": item.formality,
            "occasions": item.occasions,
            "season": item.season,
            "notes": item.notes,
        }
        for item in wardrobe
    ]

    user_message = f"""Analyze this wardrobe of {len(wardrobe)} items and identify the wearer's personal style DNA.

Wardrobe:
{json.dumps(wardrobe_context, indent=2)}

Return ONLY this JSON — no preamble:
{{
  "headline": "3-5 word style archetype, e.g. 'Quiet Luxury Minimalist'",
  "summary": "2-3 sentences describing their overall aesthetic, signature silhouettes, and what sets their style apart",
  "style_keywords": ["5-7 precise style keywords"],
  "color_palette": ["4-6 specific colors they gravitate toward, written as CSS-compatible color names or hex"],
  "formality_level": "their typical formality register",
  "most_worn_category": "the category they have the most of",
  "avoid": ["2-3 things notably absent or avoided in their wardrobe"]
}}"""

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=800,
        system=[
            {
                "type": "text",
                "text": STYLIST_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        inner = raw[3:]
        if inner.startswith("json"):
            inner = inner[4:]
        raw = inner.split("```")[0]
    return json.loads(raw.strip())


def build_preferences_briefing(prefs: dict) -> str:
    """Build the STYLIST BRIEFING block from user preferences."""
    if not prefs:
        return ""
    lines = []
    if prefs.get("style_aesthetics"):
        lines.append(f"Style aesthetics: {', '.join(prefs['style_aesthetics'])}")
    if prefs.get("fit_preference"):
        lines.append(f"Fit preference: {prefs['fit_preference']}")
    if prefs.get("colors_to_avoid"):
        lines.append(f"Colors to avoid: {', '.join(prefs['colors_to_avoid'])}")
    if prefs.get("dresses_for"):
        lines.append(f"Dresses for: {', '.join(prefs['dresses_for'])}")
    if prefs.get("climate_preference"):
        lines.append(f"Climate preference: {prefs['climate_preference']}")
    if prefs.get("stylist_notes"):
        lines.append(f"Always remember: {prefs['stylist_notes']}")
    if not lines:
        return ""
    body = "\n".join(lines)
    return f"\nSTYLIST BRIEFING — read before generating any outfits:\n{body}\n"


async def generate_packing_list(trip: Trip, wardrobe: list[WardrobeItem], style_prefs: dict, preferences: dict = None) -> dict:
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
            "notes": item.notes,
        }
        for item in wardrobe
    ]

    vibe_context = ""
    if trip.vibe_analysis:
        vibe_context = f"""
INSPIRATION VIBE (from user's moodboard — honor this above all else):
Summary: {trip.vibe_analysis.summary}
Style keywords: {", ".join(trip.vibe_analysis.style_keywords)}
Color palette: {", ".join(trip.vibe_analysis.color_palette)}
Formality: {trip.vibe_analysis.formality_level}
Avoid: {", ".join(trip.vibe_analysis.avoid)}
"""

    style_context = ""
    if style_prefs.get("notes"):
        style_context = f"\nUser style notes: {style_prefs['notes']}"
    if style_prefs.get("avoid"):
        style_context += f"\nUser always avoids: {', '.join(style_prefs['avoid'])}"

    # Build bag context string
    if trip.bags:
        bag_lines = ", ".join(
            f"{b.label} ({b.available_grams / 1000:.1f}kg available)"
            for b in trip.bags
        )
        total_kg = trip.available_clothing_weight_grams / 1000
        bag_context = f"\nBags: {bag_lines} — {total_kg:.1f}kg total for clothing"
    else:
        bag_context = "\nBags: carry-on only (default)"

    preferences_briefing = build_preferences_briefing(preferences or {})

    user_message = f"""Trip: {trip.name}
Destination: {trip.destination}
Dates: {trip.start_date} to {trip.end_date} ({trip.duration_days} days)
Climate: {trip.climate}
Occasions: {", ".join(trip.occasions)}
Notes from user: {trip.notes or "None"}
{bag_context}{preferences_briefing}{vibe_context}{style_context}
Wardrobe ({len(wardrobe)} items):
{json.dumps(wardrobe_context, separators=(',', ':'))}

Build the complete packing list for this trip. When an item is from the wardrobe, use its exact id in wardrobe_item_id and set in_wardrobe to true.

Return ONLY this JSON structure with no preamble:
{{
  "stylist_note": "one confident paragraph — name the destination, reference the vibe from their moodboard if provided, set the tone for the packing strategy",
  "outfits": [
    {{
      "name": "Day 1 — Arrival",
      "occasion": "travel",
      "items": [
        {{
          "wardrobe_item_id": "exact_id_from_wardrobe_or_null",
          "name": "White linen shirt",
          "category": "top",
          "in_wardrobe": true,
          "checked": false
        }}
      ],
      "styling_note": "one sentence — the specific logic behind this outfit"
    }}
  ],
  "essentials": ["universal adapter", "laundry bag", "travel umbrella"],
  "raw_items": ["deduplicated flat list of all item names"]
}}

raw_items must be a flat deduplicated list of every item across all outfits. Keep raw_items as a simple list of item name strings, not objects."""

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        system=[
            {
                "type": "text",
                "text": STYLIST_SYSTEM_PROMPT,
                "cache_control": {"type": "ephemeral"},
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        inner = raw[3:]
        if inner.startswith("json"):
            inner = inner[4:]
        raw = inner.split("```")[0]
    return json.loads(raw.strip())
