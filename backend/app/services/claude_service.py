import asyncio
import base64
import json
import logging
import re
import httpx
import anthropic
from typing import Optional
from app.core.config import settings

logger = logging.getLogger(__name__)
from app.models.trip import Trip
from app.models.item import WardrobeItem

client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)


def _safe_json_loads(raw: str) -> dict:
    """Parse JSON from a Claude response, tolerating common artifacts.

    Claude occasionally outputs trailing commas, // comments, or extra
    whitespace inside otherwise-valid JSON — especially on large prompts.
    This strips the most common violations before falling back to a
    character-by-character repair if the first parse still fails.
    """
    # 1. Strip markdown code fences
    text = raw.strip()
    if text.startswith("```"):
        inner = text[3:]
        if inner.startswith("json"):
            inner = inner[4:]
        text = inner.split("```")[0].strip()

    # 2. First attempt — clean input
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 3. Strip // single-line comments
    text = re.sub(r'//[^\n]*', '', text)

    # 4. Strip trailing commas before ] or }
    text = re.sub(r',\s*([}\]])', r'\1', text)

    # 5. Second attempt after cleanup
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.error(f"_safe_json_loads: could not parse Claude JSON — {e}\nRaw (first 300): {text[:300]}")
        raise

# Image magic bytes for content-type detection
_MAGIC = {
    b"\xff\xd8\xff": "image/jpeg",
    b"\x89PNG": "image/png",
    b"RIFF": "image/webp",
    b"GIF8": "image/gif",
}

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


async def _fetch_image_content_blocks(urls: list[str], limit: int = 5) -> list:
    """Fetch images from URLs and return Claude image content blocks."""
    blocks = []
    async with httpx.AsyncClient() as http:
        for url in urls[:limit]:
            r = await http.get(url)
            content_type = r.headers.get("content-type", "").split(";")[0].strip()
            if content_type.startswith("image/"):
                media_type = content_type
            else:
                header = r.content[:4]
                media_type = next(
                    (mt for sig, mt in _MAGIC.items() if header[:len(sig)] == sig),
                    "image/jpeg",
                )
            b64 = base64.standard_b64encode(r.content).decode("utf-8")
            blocks.append({
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": b64}
            })
    return blocks


_AVATAR_ANALYSE_SYSTEM = """You are analysing reference photos to build a fashion avatar.
Study all photos carefully. Return ONLY valid JSON, no preamble.
{
  "hair_length": "string",
  "hair_texture": "string",
  "hair_color": "string",
  "skin_tone": "string",
  "face_shape": "string",
  "body_silhouette": "string",
  "notable_features": "string",
  "photo_quality": "good | acceptable | poor"
}"""


async def analyse_avatar_photos(photo_urls: list[str]) -> dict:
    """Analyse reference photos with Claude vision to extract physical appearance."""
    image_blocks = await _fetch_image_content_blocks(photo_urls)
    image_blocks.append({"type": "text", "text": "Analyse these reference photos."})

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        system=_AVATAR_ANALYSE_SYSTEM,
        messages=[{"role": "user", "content": image_blocks}],
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        inner = raw[3:]
        if inner.startswith("json"):
            inner = inner[4:]
        raw = inner.split("```")[0]
    return _safe_json_loads(raw)


async def analyze_vibe(image_urls: list[str]) -> dict:
    """Analyze inspiration images with Claude vision to extract style vibe."""
    image_contents = await _fetch_image_content_blocks(image_urls, limit=5)

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
    parsed = _safe_json_loads(raw)
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
    return _safe_json_loads(raw)


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

WEIGHT ESTIMATION RULES:
Every item in the wardrobe has an estimated_weight_kg field.
If an item's weight is 0 or null, estimate it yourself using these fashion industry averages:

Top / shirt / blouse: 0.25kg
Sweater / knitwear: 0.5kg
Jacket / blazer: 0.75kg
Heavy coat / parka: 1.4kg
Jeans / trousers: 0.6kg
Dress (light): 0.3kg
Dress (heavy/formal): 0.65kg
Skirt (light): 0.25kg
Shoes (flat/sneaker): 0.5kg
Shoes (boots): 0.95kg
Bag (small crossbody): 0.4kg
Bag (tote/large): 0.65kg
Accessories (belt/scarf): 0.15kg

Add estimated_weight_kg to every item in your output, whether the original data had it or not.

WEIGHT CALCULATION — read this carefully:
- Each outfit has its own total_weight (sum of ALL its items) — this shows the user what they wear that day
- packing_weight_total = weight of UNIQUE items only, deduplicated by item id across ALL outfits
- An item appearing in 3 outfits still only weighs its weight ONCE in packing_weight_total
- This is intentional — versatile pieces that work across multiple outfits are a GOOD thing, they save pack weight
- The weight budget check is against packing_weight_total only

Example:
  Outfit 1: jeans 0.6kg + sweater 0.5kg + loafers 0.5kg → total_weight = 1.6kg
  Outfit 2: jeans 0.6kg + silk top 0.2kg + loafers 0.5kg → total_weight = 1.3kg
  packing_weight_total = 0.6 + 0.5 + 0.5 + 0.2 = 1.8kg (jeans and loafers counted once)
  NOT 1.6 + 1.3 = 2.9kg

WEIGHT BUDGET RULES:
Available bag weight: {available_weight_kg}kg (already deducted: empty bag weight + reserved items)

For each outfit:
1. Sum ALL selected item weights → this is total_weight (what they're wearing that day)
2. Separately track UNIQUE item ids across ALL outfits — the combined weight of unique items only must not exceed {available_weight_kg}kg

If you cannot fit all requested outfits within the weight limit:
- Prioritize fewer, more versatile items — items that work in multiple outfits save weight
- Favour lighter items unless heavier ones are essential
- Note in packing_summary how you managed the weight constraint
- NEVER let packing_weight_total exceed the available_weight limit

weight_status must be 'under' or 'at_limit'. If it would be 'over', restructure outfits until it is not.

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
      "weight_note": "1.4kg — lightest outfit, ideal for travel days",
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
  "packing_weight_total": 0.0,
  "weight_budget": {available_weight_kg},
  "weight_remaining": 0.0,
  "weight_status": "under",
  "unique_item_count": 0,
  "versatility_note": "e.g. Your dark jeans work across 3 outfits — smart packing",
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
        max_tokens=8000,
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
    return _safe_json_loads(raw)


async def generate_restyle_outfit(
    trip: Trip,
    wardrobe: list[WardrobeItem],
    kept_item_ids: list[str],
    preferences: dict,
    approved_item_ids: set[str],
) -> dict:
    """Generate a single restyled outfit built around kept anchor pieces."""
    prefs = preferences or {}

    wardrobe_context = [
        {
            "id": str(item.id),
            "name": item.name,
            "category": item.category,
            "color": item.color,
            "fabric": item.fabric,
            "formality": item.formality,
            "weight_kg": round(item.weight_grams / 1000, 2),
        }
        for item in wardrobe
    ]
    wardrobe_json = json.dumps(wardrobe_context, separators=(',', ':'))

    kept_items = [item for item in wardrobe if str(item.id) in kept_item_ids]
    kept_context = [
        {"id": str(i.id), "name": i.name, "category": i.category, "color": i.color}
        for i in kept_items
    ]

    available_weight_kg = round(trip.available_clothing_weight_grams / 1000, 2)
    occasions_str = ", ".join(trip.occasions) if trip.occasions else "general travel"

    system = f"""You are a senior Vogue fashion editor. A user rejected an outfit but kept specific anchor pieces. Your job is to build the most impressive possible new outfit around exactly those pieces.

Think harder than last time. The user already rejected one option — surprise them with an unexpected but perfectly coherent combination.

STYLIST BRIEFING:
Style aesthetics: {", ".join(prefs.get("style_aesthetics", [])) or "not specified"}
Fit preference: {prefs.get("fit_preference") or "not specified"}
Colors to avoid: {", ".join(prefs.get("colors_to_avoid", [])) or "none"}

WARDROBE (only choose from these):
{wardrobe_json}

RULES — non-negotiable:
1. You MUST include every kept piece by their exact IDs
2. You may only use item IDs from the wardrobe list above
3. Do not repeat the exact combination that was rejected
4. Return ONLY valid JSON — a single outfit object

Return this exact JSON structure:
{{
  "outfit_id": "restyle_1",
  "day_label": "RESTYLED LOOK",
  "occasion_tag": "appropriate occasion",
  "items": [
    {{"id": "exact_wardrobe_id", "name": "item name", "category": "category", "estimated_weight_kg": 0.0}}
  ],
  "total_weight": 0.0,
  "weight_note": "e.g. 1.4kg — the lightest way to wear this",
  "styling_notes": "2-3 sentence editorial styling note, written as a Vogue stylist",
  "design_rationale": {{
    "silhouette": "proportion logic",
    "color_story": "palette description",
    "occasion_fit": "what this handles",
    "the_detail": "the one thing that elevates this look"
  }},
  "style_gaps": []
}}"""

    user_msg = f"""KEPT ANCHOR PIECES (must include all of these):
{json.dumps(kept_context, indent=2)}

Trip: {trip.destination}
Occasions: {occasions_str}
Weight budget: {available_weight_kg}kg

Build the best possible outfit around the kept pieces. Return ONLY valid JSON."""

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        temperature=1.0,
        messages=[{"role": "user", "content": user_msg}],
        system=system,
    )

    raw = response.content[0].text.strip()
    if raw.startswith("```"):
        inner = raw[3:]
        if inner.startswith("json"):
            inner = inner[4:]
        raw = inner.split("```")[0]
    return _safe_json_loads(raw)


_AVATAR_PROMPT_SYSTEM = """You are a professional fashion photographer and AI image generation prompt engineer. Write a single detailed paragraph prompt for Nano Banana Pro to generate a photorealistic base avatar.

Requirements for the avatar:
- Photorealistic, full body head to toe visible
- Wearing: plain white fitted t-shirt, straight-leg white jeans
- Arms slightly away from body (clothing visible on all sides)
- Front-facing neutral pose, weight evenly distributed
- Clean light grey studio background (#F2F2F2)
- Soft even lighting, no harsh shadows
- 9:16 portrait orientation

Vibe guide:
- realistic: exact natural appearance, no idealization
- polished: natural but slightly editorial, great posture
- idealized: fashion model quality treatment, same person elevated

Be extremely specific about every physical detail.
Return ONLY the prompt string. No JSON, no explanation."""


async def generate_avatar_prompt(data: dict) -> str:
    """Have Claude write the Nano Banana prompt from user data."""
    appearance = data.get("appearance", {})
    fit = data.get("fit_profile", {})
    prefs = data.get("preferences", {})
    photo_urls = data.get("photo_urls", [])
    feedback = data.get("feedback")
    previous_prompt = data.get("previous_prompt")

    if feedback and previous_prompt:
        user_message = f"""Previous prompt:
{previous_prompt}

User feedback: '{feedback}'

Rewrite the prompt incorporating this feedback while preserving all other confirmed physical details.
Return ONLY the new prompt string."""
        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=800,
            system=_AVATAR_PROMPT_SYSTEM,
            messages=[{"role": "user", "content": user_message}],
        )
    else:
        hijab_line = "Wearing hijab — preserve in all generations." if prefs.get("hijab") else ""
        features = ", ".join(prefs.get("features_to_preserve", [])) or "none"

        user_text = f"""Write the avatar prompt for this person:

APPEARANCE (confirmed by user):
Hair: {appearance.get('hair_color', '')}, {appearance.get('hair_texture', '')}, {appearance.get('hair_length', '')}
{hijab_line}
Skin tone: {appearance.get('skin_tone', '')}
Face shape: {appearance.get('face_shape', '')}
Body silhouette: {appearance.get('body_silhouette', '')}
Notable features: {appearance.get('notable_features', '')}
Features to preserve: {features}

FIT PROFILE:
Shirt: {fit.get('shirt_size', 'not specified')}, Waist: {fit.get('waist_size', 'not specified')}, Dress: {fit.get('dress_size', 'not specified')}, Height: {fit.get('height', 'not specified')}, Inseam: {fit.get('inseam', 'not specified')}

Makeup: {prefs.get('makeup', 'natural')}
Vibe: {prefs.get('vibe', 'realistic')}

Reference photos attached — study them and incorporate what you see."""

        content_blocks = await _fetch_image_content_blocks(photo_urls)
        content_blocks.append({"type": "text", "text": user_text})

        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=800,
            system=_AVATAR_PROMPT_SYSTEM,
            messages=[{"role": "user", "content": content_blocks}],
        )

    return response.content[0].text.strip()


async def run_fal_generation(prompt: str, photo_urls: list[str]) -> list[str]:
    """Call fal.ai nano-banana-pro and return variation URLs."""
    import fal_client
    import os
    os.environ["FAL_KEY"] = settings.FAL_API_KEY

    result = await asyncio.to_thread(
        fal_client.run,
        "fal-ai/nano-banana-pro/edit",
        arguments={
            "prompt": prompt,
            "image_urls": photo_urls,
            "num_images": 3,
            "image_size": "portrait_9_16",
        },
    )
    return [img["url"] for img in result["images"]]


_OUTFIT_PROMPT_SYSTEM = """You write image generation prompts for a fashion AI. Given an outfit and a person's appearance, write a single prompt for nano-banana-pro that will generate a full-body editorial fashion photo of that person wearing the outfit.

Rules:
- Start with the person's physical description (skin tone, hair, silhouette)
- List every item in the outfit by name, color, and category
- Background must always be plain white or very light neutral — no locations, no streets, no landscapes, no environments
- Lighting: clean studio editorial lighting, soft and even
- Describe the aesthetic mood in 3-5 words (e.g. "quiet luxury minimalist", "coastal elevated casual")
- Keep the total prompt under 200 words
- Write in present tense, no bullet points, one cohesive paragraph
- Do not use the word "photograph" — say "editorial fashion image"
- Never mention a city, country, street, setting, season, or weather
- Respond with ONLY the prompt text, nothing else"""


async def generate_outfit_image_prompt(outfit, user_avatar, trip, style_aesthetics: list[str]) -> str:
    """Use Claude Haiku with vision to generate a Nano Banana image prompt for one outfit."""
    item_image_urls = [
        item.image_url for item in outfit.items if item.image_url
    ]

    appearance = getattr(user_avatar, "appearance", None)
    fit = getattr(user_avatar, "fit_profile", None)

    avatar_desc_parts = []
    if appearance:
        if getattr(appearance, "skin_tone", None):
            avatar_desc_parts.append(f"skin tone: {appearance.skin_tone}")
        if getattr(appearance, "hair_color", None):
            avatar_desc_parts.append(f"hair: {appearance.hair_color}")
        if getattr(appearance, "hair_texture", None):
            avatar_desc_parts.append(f"texture: {appearance.hair_texture}")
        if getattr(appearance, "body_silhouette", None):
            avatar_desc_parts.append(f"silhouette: {appearance.body_silhouette}")
    if fit and getattr(fit, "height", None):
        avatar_desc_parts.append(f"height: {fit.height}cm")

    avatar_desc = ", ".join(avatar_desc_parts) if avatar_desc_parts else "not specified"

    item_lines = "\n".join(
        f"- {item.name} ({item.category})" for item in outfit.items
    )
    aesthetics = ", ".join(style_aesthetics) if style_aesthetics else "classic, elevated"
    climate = getattr(trip, "climate", "") or "mild"
    destination = getattr(trip, "destination", "") or "travel"
    occasion = outfit.occasion_tag or outfit.occasion or "casual"

    user_text = f"""Person: {avatar_desc}
Style aesthetics: {aesthetics}

Outfit: {outfit.name}
Occasion: {occasion}
Items:
{item_lines}

Styling note: {outfit.styling_notes or outfit.styling_note}

Write the image generation prompt. Plain white background, studio lighting only."""

    content: list = []
    if item_image_urls:
        image_blocks = await _fetch_image_content_blocks(item_image_urls, limit=4)
        content.extend(image_blocks)
    content.append({"type": "text", "text": user_text})

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        system=_OUTFIT_PROMPT_SYSTEM,
        messages=[{"role": "user", "content": content}],
    )
    return response.content[0].text.strip()


async def generate_all_lookbook_images(trip, user) -> None:
    """Background task — pre-generates lookbook images for all outfits in a packing list.
    Called once after pack/suggest so images are ready by the time the user finishes review."""
    style_aesthetics = (
        user.preferences.style_aesthetics
        if user.preferences and user.preferences.style_aesthetics
        else []
    )
    if not trip.packing_list:
        return
    changed = False
    for outfit in trip.packing_list.outfits:
        if outfit.lookbook_image_url:
            continue
        try:
            url = await generate_lookbook_image(outfit, user.avatar, trip, style_aesthetics)
            if url:
                outfit.lookbook_image_url = url
                changed = True
                logger.info(f"Lookbook pre-generated for outfit: {outfit.outfit_id}")
        except Exception as e:
            logger.warning(f"Lookbook pre-generation failed for {outfit.outfit_id}: {e}")
    if changed:
        await trip.save()


_LOOKBOOK_PROMPT_SYSTEM = """You write image generation prompts for a fashion AI called Nano Banana Pro.

Nano Banana Pro receives reference images in this order:
1. First image — the person's avatar body (USE THIS EXACT PERSON, do not change their face, skin tone, hair, or body)
2. Remaining images — the clothing items, sunglasses, watches, shoes, accessories, everything the user decides and approves should be put on and dress them in

Your prompt must make this explicit. Start with:
"Dress the person from the first reference image in..."

Rules:
- Explicitly reference "the person from the first reference image"
- List every outfit item to put ON that person by name, color, category
- Pure white seamless studio background — no location, no props, no scenery
- Full body head to toe visible, centered with generous negative space on all sides
- Natural relaxed standing pose, weight slightly on one hip, arms loosely at sides, slightly posed, like how model pose, basically editorial, check the lookbook_reference and editorial_poses.png in the refernces folder so it gets an idea how to style the person, please tell it that we only want ONE pose full head to toe in an outfit
- Soft diffused even studio lighting, completely even, no harsh shadows
- The outfit must be clearly visible — every item readable
- Under 150 words, one paragraph, present tense
- Respond with ONLY the prompt text, nothing else"""


async def generate_lookbook_image(
    outfit, user_avatar, trip, style_aesthetics: list[str]
) -> Optional[str]:
    """Generate a clean studio lookbook image. Called once per outfit, result stored on outfit document."""
    import fal_client
    import os
    os.environ["FAL_KEY"] = settings.FAL_API_KEY

    appearance = getattr(user_avatar, "appearance", None)
    fit = getattr(user_avatar, "fit_profile", None)

    avatar_desc_parts = []
    if appearance:
        for attr in ["skin_tone", "hair_color", "hair_texture", "body_silhouette"]:
            val = getattr(appearance, attr, None)
            if val:
                avatar_desc_parts.append(f"{attr.replace('_', ' ')}: {val}")
    if fit and getattr(fit, "height", None):
        avatar_desc_parts.append(f"height: {fit.height}cm")
    avatar_desc = ", ".join(avatar_desc_parts) or "not specified"

    item_lines = "\n".join(
        f"- {item.name} ({item.category})" for item in outfit.items
    )
    aesthetics = ", ".join(style_aesthetics) if style_aesthetics else "classic, elevated"

    user_text = f"""Person: {avatar_desc}
Style aesthetics: {aesthetics}

Outfit: {outfit.name}
Items:
{item_lines}

Write the studio image generation prompt.
Start with: "Dress the person from the first reference image in..."
White background only. No location context."""

    content: list = []
    item_image_urls = [item.image_url for item in outfit.items if item.image_url]
    if item_image_urls:
        image_blocks = await _fetch_image_content_blocks(item_image_urls, limit=4)
        content.extend(image_blocks)
    content.append({"type": "text", "text": user_text})

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=250,
        system=_LOOKBOOK_PROMPT_SYSTEM,
        messages=[{"role": "user", "content": content}],
    )
    prompt = response.content[0].text.strip()
    logger.info(f"Lookbook prompt for '{outfit.name}':\n{prompt}")

    # Avatar MUST be first — Nano Banana uses image order to assign roles
    reference_urls: list[str] = []
    if user_avatar and getattr(user_avatar, "base_url", None):
        reference_urls.append(user_avatar.base_url)
    else:
        logger.warning(
            f"No avatar base_url for outfit '{outfit.name}' — "
            f"lookbook will generate a generic person"
        )
    reference_urls.extend(item_image_urls[:3])

    if not reference_urls:
        logger.warning(f"No reference URLs at all for '{outfit.name}', skipping")
        return None

    result = await asyncio.to_thread(
        fal_client.run,
        "fal-ai/nano-banana-pro/edit",
        arguments={
            "prompt": prompt,
            "image_urls": reference_urls,
            "num_images": 1,
            "image_size": "portrait_9_16",
        },
    )
    images = result.get("images", [])
    if not images:
        logger.warning(f"fal.ai returned no images for lookbook '{outfit.name}'")
        return None
    return images[0]["url"]


async def generate_single_outfit_image(outfit, user_avatar, trip, style_aesthetics: list[str]) -> Optional[str]:
    """Generate one outfit editorial image via fal.ai. Returns the image URL or None on failure."""
    import fal_client
    import os
    os.environ["FAL_KEY"] = settings.FAL_API_KEY

    prompt = await generate_outfit_image_prompt(outfit, user_avatar, trip, style_aesthetics)

    # Use avatar base_url as the reference image if available; else use item images
    reference_urls: list[str] = []
    if user_avatar and getattr(user_avatar, "base_url", None):
        reference_urls.append(user_avatar.base_url)

    item_image_urls = [item.image_url for item in outfit.items if item.image_url]
    reference_urls.extend(item_image_urls[:3])

    if not reference_urls:
        logger.warning(f"No reference URLs for outfit '{outfit.name}' — skipping image generation")
        return None

    logger.info(f"Generating image for outfit '{outfit.name}' with {len(reference_urls)} reference(s)")
    result = await asyncio.to_thread(
        fal_client.run,
        "fal-ai/nano-banana-pro/edit",
        arguments={
            "prompt": prompt,
            "image_urls": reference_urls,
            "num_images": 1,
            "image_size": "portrait_9_16",
        },
    )
    images = result.get("images", [])
    if not images:
        logger.warning(f"fal.ai returned no images for outfit '{outfit.name}'. Result: {result}")
        return None
    return images[0]["url"]


def _select_distinct_outfits(approved_outfit_objects: list, count: int = 3) -> list:
    """Pick up to `count` outfits that are as visually distinct as possible.

    Distinctness is determined by occasion_tag first (different occasion types),
    then by item category mix. Groups by occasion_tag and takes one per group,
    filling the remainder from leftover outfits.
    """
    if len(approved_outfit_objects) <= count:
        return approved_outfit_objects

    # Group by occasion_tag
    groups: dict[str, list] = {}
    for outfit in approved_outfit_objects:
        tag = (outfit.occasion_tag or outfit.occasion or "other").strip().upper()
        # Normalise to broad category so similar tags don't fragment
        if any(k in tag for k in ["EVENING", "FORMAL", "GALA", "DINNER"]):
            key = "evening"
        elif any(k in tag for k in ["BEACH", "RESORT", "POOL", "CASUAL"]):
            key = "casual"
        elif any(k in tag for k in ["TRAVEL", "TRANSIT", "ARRIVAL"]):
            key = "travel"
        elif any(k in tag for k in ["WORK", "BUSINESS", "MEETING"]):
            key = "work"
        else:
            key = tag or "other"
        groups.setdefault(key, []).append(outfit)

    # Take one from each group (most occasion variety first)
    selected = []
    for group_outfits in groups.values():
        if len(selected) >= count:
            break
        selected.append(group_outfits[0])

    # Fill remaining slots from outfits not yet selected
    if len(selected) < count:
        selected_ids = {id(o) for o in selected}
        for outfit in approved_outfit_objects:
            if len(selected) >= count:
                break
            if id(outfit) not in selected_ids:
                selected.append(outfit)

    return selected[:count]


async def build_carpet_image(user) -> Optional[str]:
    """Generate the dashboard hero carpet image for a user.

    Called after the user's 5th distinct approved outfit. Generates once only:
    if user.dashboard_carpet_url already exists it is returned immediately without
    calling fal.ai again.
    """
    # --- Guard: already generated ---
    if getattr(user, "dashboard_carpet_url", None):
        return user.dashboard_carpet_url

    # --- Guard: need an avatar to use as reference ---
    avatar = getattr(user, "avatar", None)
    if not avatar or not getattr(avatar, "base_url", None):
        logger.warning(f"build_carpet_image: user {user.id} has no avatar base_url — skipping")
        return None

    # --- Collect approved outfits from all trips ---
    from app.models.trip import Trip  # local import to avoid circular

    all_trips = await Trip.find(Trip.user_id == user.id).to_list()

    approved_outfit_objects = []
    seen_names: set[str] = set()
    for trip in all_trips:
        if not trip.packing_list:
            continue
        approved_names = set(trip.approved_outfits or [])
        for outfit in trip.packing_list.outfits:
            if outfit.name in approved_names and outfit.name not in seen_names:
                seen_names.add(outfit.name)
                approved_outfit_objects.append(outfit)

    if len(approved_outfit_objects) < 3:
        logger.warning(
            f"build_carpet_image: user {user.id} has only {len(approved_outfit_objects)} "
            "approved outfit(s) — need at least 3, skipping"
        )
        return None

    # --- Select 3 most visually distinct looks ---
    outfits = _select_distinct_outfits(approved_outfit_objects, count=3)

    def _describe_pieces(outfit) -> str:
        pieces = [item.name for item in outfit.items if item.name]
        if not pieces:
            return "a complete outfit"
        return ", ".join(pieces)

    outfit_1, outfit_2, outfit_3 = outfits[0], outfits[1], outfits[2]

    # --- Assemble avatar fields ---
    features_to_preserve = ", ".join(
        getattr(avatar.preferences, "features_to_preserve", []) or []
    ) or "natural likeness, skin tone, facial features"

    hijab = getattr(avatar.appearance, "hijab", False)
    hijab_line = (
        "The person is wearing a hijab in all three figures."
        if hijab
        else ""
    )

    # --- Build the prompt ---
    # Figures are arranged LEFT TO RIGHT across the wide carpet so the
    # composition reads as horizontal and fills a landscape frame correctly.
    prompt_lines = [
        "Use the person in the reference image provided as the subject.",
        "Recreate their exact face, skin tone, hair, and likeness in all",
        "three figures. Do not change their appearance.",
        "",
        "WIDE HORIZONTAL overhead bird's-eye editorial photograph, camera",
        "pointing straight down at 90 degrees. Ultrawide 16:9 landscape",
        "composition. Three versions of this same person arranged",
        "LEFT TO RIGHT across a large ornate Persian carpet with intricate",
        "floral and medallion patterns in deep reds, greens, and gold.",
        "The carpet fills the entire frame edge to edge.",
        "No background visible outside the carpet.",
        "All three figures must be fully visible and evenly spaced",
        "across the full width of the frame.",
        "",
        f"Preserve exactly: {features_to_preserve}.",
    ]
    if hijab_line:
        prompt_lines.append(hijab_line)
    prompt_lines += [
        "",
        f"Figure 1 (LEFT third of carpet): wearing {_describe_pieces(outfit_1)}.",
        f"{outfit_1.styling_notes or outfit_1.styling_note}. Lying on stomach, propped on elbows,",
        "reading an open Vogue magazine. The magazine cover is visible.",
        "",
        f"Figure 2 (CENTER of carpet): wearing {_describe_pieces(outfit_2)}.",
        f"{outfit_2.styling_notes or outfit_2.styling_note}. Lying on back, one knee bent, holding",
        "phone above face, small white earphones in, eyes closed.",
        "",
        f"Figure 3 (RIGHT third of carpet): wearing {_describe_pieces(outfit_3)}.",
        f"{outfit_3.styling_notes or outfit_3.styling_note}. Sitting cross-legged, leaning back on",
        "both hands, looking slightly off to the side, relaxed.",
        "",
        "Scattered naturally between the figures on the carpet: a",
        "vintage record player with a spinning vinyl, two or three record",
        "sleeves face-up, a film camera, a half-drunk glass, a small stack",
        "of fashion books.",
        "",
        "Soft warm diffused lighting from above. Slight film grain.",
        "Editorial fashion photography aesthetic. Ultra-realistic.",
        "Shot on medium format camera.",
    ]
    assembled_prompt = "\n".join(prompt_lines)

    # --- Call fal.ai ---
    # Uses nano-banana-pro/edit (the image-to-image endpoint active in this codebase)
    # so the avatar base_url is honoured as a visual reference for the subject's likeness.
    import fal_client
    import os
    os.environ["FAL_KEY"] = settings.FAL_API_KEY

    logger.info(f"build_carpet_image: calling fal.ai for user {user.id}")
    try:
        result = await asyncio.to_thread(
            fal_client.run,
            "fal-ai/nano-banana-pro/edit",
            arguments={
                "prompt": assembled_prompt,
                "image_urls": [avatar.base_url],
                "num_images": 1,
                "image_size": "landscape_16_9",
            },
        )
    except Exception as e:
        logger.error(f"build_carpet_image: fal.ai call failed for user {user.id}: {e}")
        return None

    images = result.get("images", [])
    if not images:
        logger.warning(f"build_carpet_image: fal.ai returned no images for user {user.id}")
        return None

    fal_url = images[0]["url"]

    # --- Upload to Cloudinary and persist ---
    from app.services.cloudinary_service import upload_carpet_image  # local import

    try:
        cloudinary_result = await upload_carpet_image(fal_url, str(user.id))
        permanent_url = cloudinary_result["url"]
    except Exception as e:
        logger.error(f"build_carpet_image: Cloudinary upload failed for user {user.id}: {e}")
        # Fall back to the fal.ai URL so the user still gets their image
        permanent_url = fal_url

    user.dashboard_carpet_url = permanent_url
    await user.save()
    logger.info(f"build_carpet_image: saved carpet URL for user {user.id}")
    return permanent_url
