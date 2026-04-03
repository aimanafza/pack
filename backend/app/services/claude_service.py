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


CATEGORY_LABELS = {
    "top": "Tops",
    "bottom": "Bottoms",
    "dress": "Dresses",
    "outerwear": "Layers",
    "shoes": "Shoes",
    "bag": "Bags",
    "accessory": "Accessories",
}


async def analyze_style_dna(wardrobe: list[WardrobeItem]) -> dict:
    """Synthesize personal style DNA from wardrobe metadata."""
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

    user_message = f"""Analyze this wardrobe of {len(wardrobe)} items and return the wearer's style DNA.

Wardrobe:
{json.dumps(wardrobe_context, indent=2)}

Return ONLY this JSON — no preamble, no markdown:
{{
  "headline": "3-5 word style archetype, e.g. 'Quiet Luxury Minimalist'",
  "color_palette": ["exactly 5 hex color codes dominant in this wardrobe, e.g. '#C4A882'"],
  "style_keywords": ["3-5 evocative style descriptors, e.g. 'Quiet Luxury', 'Effortless Bohemian'"],
  "signature_piece_ids": ["2-3 item IDs from the wardrobe that are most defining or versatile"],
  "style_gaps": ["1-3 short observations about what is missing, e.g. 'No formal pieces in your wardrobe'"],
  "stylist_paragraph": "2-3 sentences written as a stylist describing this person's aesthetic — warm, editorial, specific to their actual items"
}}"""

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=900,
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


async def regenerate_style_dna_for_user(user_id: str) -> None:
    """Background task: re-run style DNA analysis and persist to user document."""
    from app.models.user import User, StyleDNA
    from datetime import datetime
    try:
        user = await User.get(user_id)
        if not user:
            return
        wardrobe = await WardrobeItem.find(WardrobeItem.user_id == user_id).to_list()
        if len(wardrobe) < 3:
            return
        result = await analyze_style_dna(wardrobe)
        breakdown: dict[str, int] = {}
        for item in wardrobe:
            label = CATEGORY_LABELS.get(item.category, item.category.capitalize())
            breakdown[label] = breakdown.get(label, 0) + 1
        user.style_dna = StyleDNA(
            headline=result.get("headline", ""),
            color_palette=result.get("color_palette", []),
            style_keywords=result.get("style_keywords", []),
            category_breakdown=breakdown,
            signature_piece_ids=result.get("signature_piece_ids", []),
            style_gaps=result.get("style_gaps", []),
            stylist_paragraph=result.get("stylist_paragraph", ""),
            generated_at=datetime.utcnow(),
        )
        await user.save()
    except Exception:
        pass  # background task — fail silently


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
    prefs = preferences or {}

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
            "weight_kg": round(item.weight_grams / 1000, 2),
        }
        for item in wardrobe
    ]
    wardrobe_json = json.dumps(wardrobe_context, separators=(',', ':'))

    available_weight_kg = round(trip.available_clothing_weight_grams / 1000, 2)
    num_outfits = max(trip.duration_days, len(trip.occasions), 1)
    month = trip.start_date.strftime("%B")
    dates_str = f"{trip.start_date} to {trip.end_date} ({trip.duration_days} days)"
    occasions_str = ", ".join(trip.occasions) if trip.occasions else "general travel"

    # Inspiration vibe block (injected into system prompt if available)
    vibe_block = ""
    if trip.vibe_analysis:
        vibe_block = f"""
INSPIRATION VIBE (from user moodboard — honor this above all else):
Summary: {trip.vibe_analysis.summary}
Style keywords: {", ".join(trip.vibe_analysis.style_keywords)}
Color palette: {", ".join(trip.vibe_analysis.color_palette)}
Formality: {trip.vibe_analysis.formality_level}
Avoid: {", ".join(trip.vibe_analysis.avoid)}
"""

    system_prompt = f"""You are a senior fashion editor and stylist. You have 15 years of experience at Vogue, 10 Magazine, and Net-a-Porter. You have dressed people for editorial shoots, styled capsule travel wardrobes for high-profile clients, and consulted for minimalist luxury brands.

YOUR APPROACH:
- You think in complete outfits, never individual items
- You understand proportion: volume on top needs a slim base, a structured piece needs something fluid to breathe
- You find the unexpected combination — not the obvious one
- You know that one strong detail (a texture, a print, a silhouette) does more than many competing ones
- You understand occasion dressing — appropriateness is part of style
- You never apologize for a small wardrobe — constraints are where craft shows
- Every outfit you create has a point of view and tells a story

STYLIST BRIEFING — read before generating any outfit:
Style aesthetics: {", ".join(prefs.get("style_aesthetics", [])) or "not specified"}
Fit preference: {prefs.get("fit_preference") or "not specified"}
Colors to avoid: {", ".join(prefs.get("colors_to_avoid", [])) or "none"}
Dresses for: {", ".join(prefs.get("dresses_for", [])) or "not specified"}
Climate preference: {prefs.get("climate_preference") or "not specified"}
Always remember: {prefs.get("stylist_notes") or "nothing additional"}{vibe_block}

WARDROBE — these are the ONLY items you may use:
{wardrobe_json}

CRITICAL RULES — non-negotiable:
1. You may ONLY select items from the wardrobe list above
2. Every id you reference must exactly match an id in the wardrobe
3. Do NOT invent, suggest, or hallucinate any item not in the list
4. Each item id may appear only ONCE within a single outfit
5. Avoid repeating the same statement/focal piece across multiple outfits. Track item usage across all outfits. Avoid repeating the same item as a focal piece in more than one outfit.
6. If the wardrobe lacks something essential (shoes, outerwear), note it in style_gaps — never invent it as an outfit item
7. Return ONLY valid JSON. No preamble, no explanation outside the JSON.

TRIP CONTEXT:
Destination: {trip.destination}
Travel dates: {dates_str}
Occasions: {occasions_str}
Available bag weight: {available_weight_kg}kg (after reserved items deducted)
Number of outfits requested: {num_outfits}

YOUR TASK:
Before selecting items, reason through each outfit:
1. OCCASION: What does this specific day/occasion demand? What impression should this person make?
2. WEATHER: What does {trip.destination} feel like in {month}? What does that mean for layering?
3. SILHOUETTE: What proportion works for this person's preferences?
4. COLOR STORY: What palette serves this outfit?
5. THEN select items. Every choice must be intentional.

When writing styling_notes: write like a Vogue fashion editor. Be specific, visual, and opinionated. Reference the mood, the tension in the combination, why this works. 2-3 sentences maximum. Sharp, not verbose.

When writing design_rationale: be precise about the craft decisions.
- silhouette: the proportion logic
- color_story: the palette and why it works
- occasion_fit: what this outfit handles and how
- the_detail: the one element that elevates the whole look

OUTPUT FORMAT — return this exact JSON structure:
{{
  "outfits": [
    {{
      "outfit_id": "outfit_1",
      "day_label": "DAY 1 — OCCASION NAME IN CAPS",
      "occasion_tag": "OCCASION TYPE / ACTIVITY",
      "items": [
        {{
          "id": "exact_id_from_wardrobe",
          "name": "item name",
          "category": "category",
          "estimated_weight_kg": 0.0
        }}
      ],
      "total_weight": 0.0,
      "styling_notes": "Editorial styling note written as a senior Vogue stylist would. Specific, visual, opinionated.",
      "design_rationale": {{
        "silhouette": "proportion logic",
        "color_story": "palette description",
        "occasion_fit": "what this handles",
        "the_detail": "the one thing that makes this work"
      }},
      "style_gaps": [
        "Item not in wardrobe but would complete this look: e.g. ankle boots"
      ]
    }}
  ],
  "packing_summary": "2-3 sentence overview of the full packing strategy for this trip, written editorially"
}}"""

    user_message = f"""Generate {num_outfits} outfits for this trip.

Wardrobe ({len(wardrobe)} items):
{wardrobe_json}

Trip: {trip.destination}, {dates_str}
Occasions by day: {occasions_str}
Available bag weight: {available_weight_kg}kg
Preferred aesthetics: {", ".join(prefs.get("style_aesthetics", [])) or "not specified"}

Remember: ONLY use item IDs from the wardrobe above. No invented items. No duplicate item IDs within one outfit. Return valid JSON only."""

    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=4000,
        temperature=1.0,
        messages=[{"role": "user", "content": user_message}],
        system=system_prompt,
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        inner = raw[3:]
        if inner.startswith("json"):
            inner = inner[4:]
        raw = inner.split("```")[0]
    return json.loads(raw.strip())
