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
                    "description": "Filter by categories e.g. ['top', 'bottom', 'shoes']",
                },
                "occasions": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Filter by occasion tags e.g. ['casual', 'work']",
                },
            },
        },
    },
    {
        "name": "get_recent_outfits",
        "description": "Get outfits worn in the last N days to avoid repeats",
        "input_schema": {
            "type": "object",
            "properties": {
                "days": {
                    "type": "integer",
                    "description": "How many days back to check. Default 7.",
                }
            },
        },
    },
    {
        "name": "get_style_insights",
        "description": "Get this user's style patterns — underused items, preferences by occasion, vibe correlations",
        "input_schema": {"type": "object", "properties": {}},
    },
]


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
    context: dict,
    anchor_items: list = None,
    inspiration_image_urls: list = None,
    preferences: dict = None,
    style_dna: dict = None,
) -> dict:
    """Generate 3 daily outfit options from the user's wardrobe. Returns dict with outfits list."""
    weather = context.get("weather", {})
    context_note_line = f"\n- Additional context: {context['context_note']}" if context.get("context_note") else ""

    recently_worn_ids = set()
    for entry in _get_recent(worn_history, days=5):
        recently_worn_ids.update(entry.get("item_ids", []))

    wardrobe_lines = []
    for item in wardrobe:
        colors = ", ".join(item.get("color", [])) if isinstance(item.get("color"), list) else item.get("color", "")
        wardrobe_lines.append(
            f'- id:{item["id"]} | {item["name"]} | {item.get("category","")} | {colors} | '
            f'{item.get("fabric","")} | formality:{item.get("formality","")} | '
            f'occasions:{",".join(item.get("occasions",[]))} | season:{",".join(item.get("season",[]))} | '
            f'img:{item.get("image_url","")} | worn_recently:{"yes" if item["id"] in recently_worn_ids else "no"}'
        )

    wardrobe_block = "\n".join(wardrobe_lines) if wardrobe_lines else "No items in wardrobe yet."

    # Build STYLIST BRIEFING block from user preferences
    prefs_block = ""
    if preferences:
        prefs_lines = []
        if preferences.get("style_aesthetics"):
            prefs_lines.append(f"Style aesthetics: {', '.join(preferences['style_aesthetics'])}")
        if preferences.get("fit_preference"):
            prefs_lines.append(f"Fit preference: {preferences['fit_preference']}")
        if preferences.get("colors_to_avoid"):
            prefs_lines.append(f"Colors to avoid: {', '.join(preferences['colors_to_avoid'])}")
        if preferences.get("dresses_for"):
            prefs_lines.append(f"Dresses for: {', '.join(preferences['dresses_for'])}")
        if preferences.get("climate_preference"):
            prefs_lines.append(f"Climate preference: {preferences['climate_preference']}")
        if preferences.get("stylist_notes"):
            prefs_lines.append(f"Always remember: {preferences['stylist_notes']}")
        if prefs_lines:
            prefs_block = "\nSTYLIST BRIEFING — user's explicit constraints, always respected:\n" + "\n".join(prefs_lines) + "\n"

    # Build STYLE DNA block from observed wardrobe patterns
    daily_dna_block = ""
    if style_dna:
        dna_lines = []
        if style_dna.get("headline"):
            dna_lines.append(f"Style archetype: {style_dna['headline']}")
        if style_dna.get("style_keywords"):
            dna_lines.append(f"Style keywords: {', '.join(style_dna['style_keywords'])}")
        if style_dna.get("style_gaps"):
            dna_lines.append(f"Wardrobe gaps: {', '.join(style_dna['style_gaps'])}")
        if style_dna.get("stylist_paragraph"):
            dna_lines.append(f"Stylist's read: {style_dna['stylist_paragraph']}")
        if dna_lines:
            daily_dna_block = "\nSTYLE DNA — previously observed about this user's wardrobe (use to personalize, not override occasion or briefing):\n" + "\n".join(dna_lines) + "\n"

    # Build anchor items block
    anchor_block = ""
    if anchor_items:
        names = ", ".join(a.get("name", a.get("item_id", "")) for a in anchor_items)
        anchor_block = f"\n\nITEMS I'M DEFINITELY WEARING TODAY: {names}\nBuild at least one outfit around each of these. They must appear in the suggestions."

    user_message_text = f"""Style me for today.

Today's context:
- Occasion: {context['occasion']}
- Mood: {context['mood']}
- Vibe: {context.get('vibe', 'not specified')}
- Weather: {weather.get('temp_c', 20)}°C, {weather.get('condition', 'Clear')}. Feels like {weather.get('feels_like_c', 20)}°C. Rain chance: {weather.get('rain_chance', 0)}%.{context_note_line}{anchor_block}{prefs_block}{daily_dna_block}
My wardrobe:
{wardrobe_block}

Generate 3 complete outfit options using items from my wardrobe. Avoid items marked worn_recently:yes unless they are anchor items.

Return ONLY this exact JSON — no preamble, no markdown fences:
{{
  "outfits": [
    {{
      "outfit_index": 0,
      "item_ids": ["id_from_wardrobe_1", "id_from_wardrobe_2"],
      "item_names": ["Item name 1", "Item name 2"],
      "item_image_urls": ["img_url_1", "img_url_2"],
      "claude_note": "One direct sentence about why this works for today.",
      "occasion_tags": ["tag1", "tag2"]
    }},
    {{ "outfit_index": 1, "item_ids": [], "item_names": [], "item_image_urls": [], "claude_note": "", "occasion_tags": [] }},
    {{ "outfit_index": 2, "item_ids": [], "item_names": [], "item_image_urls": [], "claude_note": "", "occasion_tags": [] }}
  ]
}}"""

    # Build message content — add inspiration images if provided (up to 3)
    message_content = []
    if inspiration_image_urls:
        try:
            image_blocks = await _fetch_image_content_blocks(inspiration_image_urls, limit=3)
            if image_blocks:
                message_content.extend(image_blocks)
                count = len(inspiration_image_urls)
                message_content.append({
                    "type": "text",
                    "text": f"Above {'are' if count > 1 else 'is'} the user's inspiration {'images' if count > 1 else 'image'}. Study the aesthetic — color palette, silhouettes, mood, styling details — and let it guide the outfit suggestions.\n\n" + user_message_text,
                })
        except Exception:
            message_content.append({"type": "text", "text": user_message_text})
    else:
        message_content.append({"type": "text", "text": user_message_text})

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=DAILY_STYLIST_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": message_content}],
    )

    for block in response.content:
        if hasattr(block, "text"):
            return _safe_json_loads(block.text)

    return {"outfits": []}


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
        model="claude-sonnet-4-6",
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
        model="claude-sonnet-4-6",
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


async def generate_packing_list(trip: Trip, wardrobe: list[WardrobeItem], preferences: dict = None, style_dna: dict = None) -> dict:
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

    # Style DNA block — observational context about this user's wardrobe patterns
    dna_block = ""
    if style_dna:
        dna_lines = []
        if style_dna.get("headline"):
            dna_lines.append(f"Style archetype: {style_dna['headline']}")
        if style_dna.get("style_keywords"):
            dna_lines.append(f"Style keywords: {', '.join(style_dna['style_keywords'])}")
        if style_dna.get("style_gaps"):
            dna_lines.append(f"Wardrobe gaps to note: {', '.join(style_dna['style_gaps'])}")
        if style_dna.get("stylist_paragraph"):
            dna_lines.append(f"Stylist's read: {style_dna['stylist_paragraph']}")
        if dna_lines:
            dna_block = "\nSTYLE DNA — what has been previously observed about this user's wardrobe (descriptive context, not directives — trip vibe and preferences above take priority):\n" + "\n".join(dna_lines) + "\n"

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
Always remember: {prefs.get("stylist_notes") or "nothing additional"}{dna_block}{vibe_block}

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

    # Build anchor items block if the user pinned specific pieces
    anchor_block = ""
    if getattr(trip, "anchor_items", None):
        lines = []
        for a in trip.anchor_items:
            note_part = f" — user note: {a.note}" if a.note else ""
            # Try to find the name from wardrobe for readability
            matched = next((w for w in wardrobe if str(w.id) == a.item_id), None)
            item_name = matched.name if matched else f"item {a.item_id}"
            lines.append(f"  - {item_name} (id: {a.item_id}){note_part}")
        anchor_block = f"""
ANCHOR ITEMS — the user is definitely packing these pieces:
{chr(10).join(lines)}
These items MUST appear across your outfits. Build looks around them wherever it makes sense. Don't force every anchor into every outfit, but each should feature in at least one.
"""

    user_message = f"""Generate {num_outfits} outfits for this trip.

Wardrobe ({len(wardrobe)} items):
{wardrobe_json}

Trip: {trip.destination}, {dates_str}
Occasions by day: {occasions_str}
Available bag weight: {available_weight_kg}kg
Preferred aesthetics: {", ".join(prefs.get("style_aesthetics", [])) or "not specified"}
{anchor_block}
Remember: ONLY use item IDs from the wardrobe above. No invented items. No duplicate item IDs within one outfit. Return valid JSON only."""

    response = await client.messages.create(
        model="claude-sonnet-4-6",
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
        model="claude-sonnet-4-6",
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
        model="claude-sonnet-4-6",
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
        model="claude-sonnet-4-6",
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


CARPET_MIN_LOOKS = 4
# A generation in progress (or one that failed) blocks a new paid attempt for this long.
CARPET_RETRY_MINUTES = 15
# Avatar + 2 garment photos per look keeps the request under fal's reference-image limit.
CARPET_REFS_PER_LOOK = 2
_CATEGORY_PRIORITY = ["dress", "top", "bottom", "outerwear", "shoes", "bag", "accessory"]


def _wardrobe_item_view(item: WardrobeItem) -> dict:
    return {
        "id": str(item.id),
        "name": item.name,
        "category": item.category,
        "color": item.color,
        "fabric": item.fabric,
        "image_url": item.image_url,
    }


async def gather_carpet_candidates(user) -> list[dict]:
    """Every distinct look the user has: approved trip outfits plus all generated
    daily outfits, reduced to pieces that still exist in their wardrobe."""
    from app.models.daily import DailyLook  # local import to avoid circular

    wardrobe = {
        str(i.id): i
        for i in await WardrobeItem.find(WardrobeItem.user_id == user.id).to_list()
    }

    raw_looks = []
    for trip in await Trip.find(Trip.user_id == user.id).to_list():
        if not trip.packing_list:
            continue
        approved = set(trip.approved_outfits or [])
        for outfit in trip.packing_list.outfits:
            if outfit.name in approved:
                raw_looks.append({
                    "source": "trip",
                    "preferred": True,
                    "occasion": outfit.occasion_tag or outfit.occasion or "",
                    "item_ids": [p.wardrobe_item_id for p in outfit.items if p.wardrobe_item_id],
                })

    for look in await DailyLook.find(DailyLook.user_id == user.id).to_list():
        for outfit in look.generated_outfits:
            raw_looks.append({
                "source": "daily",
                "preferred": look.chosen_outfit_index == outfit.outfit_index,
                "occasion": look.occasion or "",
                "item_ids": list(outfit.item_ids),
            })

    # Preferred (approved / chosen) looks win when two looks use the same pieces.
    raw_looks.sort(key=lambda look: not look["preferred"])
    seen: set[frozenset] = set()
    candidates = []
    for look in raw_looks:
        ids = [i for i in dict.fromkeys(look["item_ids"]) if i in wardrobe]
        key = frozenset(ids)
        if len(ids) < 2 or key in seen:
            continue
        seen.add(key)
        candidates.append({
            "key": len(candidates),
            "source": look["source"],
            "preferred": look["preferred"],
            "occasion": look["occasion"],
            "items": [_wardrobe_item_view(wardrobe[i]) for i in ids],
        })
    return candidates


_CARPET_SELECT_SYSTEM = """You are PACK's stylist choosing looks for one editorial image that shows the same person four times.

Choose exactly 4 looks that are as visually different from each other as possible: different silhouettes, colour stories and occasions. Two chosen looks must not share any item. Prefer looks marked "preferred": true when that doesn't cost distinctness. If fewer than 4 looks are genuinely different, return only the ones that are.

Return ONLY valid JSON, no preamble:
{"looks": [{"key": 0, "distinct_because": "one short sentence"}]}"""


async def select_carpet_looks(candidates: list[dict]) -> list[dict]:
    """Ask Claude for 4 clearly different looks, then enforce the rules in code:
    real candidate keys, no repeats, no shared wardrobe items."""
    brief = [
        {
            "key": c["key"],
            "preferred": c["preferred"],
            "occasion": c["occasion"],
            "items": [
                {"id": i["id"], "name": i["name"], "category": i["category"], "color": i["color"]}
                for i in c["items"]
            ],
        }
        for c in candidates
    ]
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1000,
        system=_CARPET_SELECT_SYSTEM,
        messages=[{"role": "user", "content": f"Looks:\n{json.dumps(brief)}"}],
    )
    text = next((b.text for b in response.content if getattr(b, "type", "") == "text"), "")
    picks = _safe_json_loads(text).get("looks", [])

    by_key = {c["key"]: c for c in candidates}
    chosen, chosen_keys, used_items = [], set(), set()
    for pick in picks:
        look = by_key.get(pick.get("key"))
        if not look or look["key"] in chosen_keys:
            continue
        ids = {i["id"] for i in look["items"]}
        if ids & used_items:
            continue
        chosen_keys.add(look["key"])
        used_items |= ids
        chosen.append({**look, "distinct_because": pick.get("distinct_because", "")})
        if len(chosen) == CARPET_MIN_LOOKS:
            break
    return chosen


def _describe_item(item: dict) -> str:
    colors = " and ".join(item["color"]) if item.get("color") else ""
    fabric = f" {item['fabric']}" if item.get("fabric") else ""
    return f"{colors}{fabric} {item['name']} ({item['category']})".strip()


async def maybe_start_carpet(user, background_tasks) -> dict:
    """Start carpet generation if the user qualifies and none is already running.
    Returns a status the dashboard uses to decide whether to wait for it."""
    from datetime import datetime, timedelta
    from app.models.user import User  # local import to avoid circular

    if user.dashboard_carpet_url:
        return {"status": "ready", "dashboard_carpet_url": user.dashboard_carpet_url}
    if not (user.avatar and user.avatar.base_url):
        return {"status": "needs_avatar"}

    now = datetime.utcnow()
    started = user.carpet_generation_started_at
    if started and now - started < timedelta(minutes=CARPET_RETRY_MINUTES):
        return {"status": "generating"}

    candidates = await gather_carpet_candidates(user)
    if len(candidates) < CARPET_MIN_LOOKS:
        return {"status": "needs_more_looks", "looks": len(candidates), "needed": CARPET_MIN_LOOKS}

    # Claim the slot atomically so two requests can't both start a paid generation.
    cutoff = now - timedelta(minutes=CARPET_RETRY_MINUTES)
    claimed = await User.get_motor_collection().update_one(
        {
            "_id": user.id,
            "dashboard_carpet_url": None,
            "$or": [
                {"carpet_generation_started_at": None},
                {"carpet_generation_started_at": {"$lt": cutoff}},
            ],
        },
        {"$set": {"carpet_generation_started_at": now}},
    )
    if claimed.modified_count != 1:
        return {"status": "generating"}

    user.carpet_generation_started_at = now
    background_tasks.add_task(build_carpet_image, user)
    return {"status": "generating"}


_CARPET_POSES = [
    "Lying on stomach, propped on elbows, reading an open Vogue magazine with the cover visible.",
    "Lying on back, one knee bent, holding a phone above face, small white earphones in, eyes closed.",
    "Sitting cross-legged, leaning back on both hands, looking slightly off to the side, relaxed.",
    "Kneeling, sitting back on heels, flipping through a stack of record sleeves.",
]
_CARPET_POSITIONS = ["far LEFT", "centre-left", "centre-right", "far RIGHT"]


async def build_carpet_image(user) -> Optional[str]:
    """Generate the dashboard hero carpet image: the user's avatar four times,
    each wearing a different look built only from their own wardrobe.
    Generates once; the URL is stored on the user and never regenerated."""
    if getattr(user, "dashboard_carpet_url", None):
        return user.dashboard_carpet_url

    avatar = getattr(user, "avatar", None)
    if not avatar or not getattr(avatar, "base_url", None):
        logger.warning(f"build_carpet_image: user {user.id} has no avatar base_url, skipping")
        return None

    candidates = await gather_carpet_candidates(user)
    if len(candidates) < CARPET_MIN_LOOKS:
        logger.warning(f"build_carpet_image: user {user.id} has {len(candidates)} distinct looks, need {CARPET_MIN_LOOKS}")
        return None

    try:
        looks = await select_carpet_looks(candidates)
    except Exception as e:
        logger.error(f"build_carpet_image: look selection failed for user {user.id}: {e}")
        return None
    if len(looks) < CARPET_MIN_LOOKS:
        logger.warning(f"build_carpet_image: only {len(looks)} clearly different looks for user {user.id}, skipping")
        return None

    # Reference images: avatar first, then each figure's key garments in order.
    image_urls = [avatar.base_url]
    figure_lines = []
    for n, look in enumerate(looks):
        refs = sorted(
            look["items"],
            key=lambda i: _CATEGORY_PRIORITY.index(i["category"]) if i["category"] in _CATEGORY_PRIORITY else len(_CATEGORY_PRIORITY),
        )[:CARPET_REFS_PER_LOOK]
        first_ref = len(image_urls) + 1
        image_urls.extend(i["image_url"] for i in refs)
        ref_span = f"images {first_ref}-{len(image_urls)}" if len(refs) > 1 else f"image {first_ref}"
        figure_lines += [
            f"Figure {n + 1} ({_CARPET_POSITIONS[n]} of the carpet): wearing exactly these pieces, "
            f"{'; '.join(_describe_item(i) for i in look['items'])}. "
            f"The garments in {ref_span} show what the main pieces look like.",
            _CARPET_POSES[n],
            "",
        ]

    features_to_preserve = ", ".join(
        getattr(avatar.preferences, "features_to_preserve", []) or []
    ) or "natural likeness, skin tone, facial features"
    hijab = getattr(avatar.appearance, "hijab", False)

    prompt_lines = [
        "Image 1 is the person. Use them as the subject and recreate their exact face,",
        "skin tone, hair and likeness in all four figures. Do not change their appearance.",
        "",
        "WIDE HORIZONTAL overhead bird's-eye editorial photograph, camera pointing straight",
        "down at 90 degrees. Ultrawide 16:9 landscape composition. Four versions of this same",
        "person arranged LEFT TO RIGHT, evenly spaced, across a large ornate Persian carpet",
        "with intricate floral and medallion patterns in deep reds, greens and gold. The carpet",
        "fills the entire frame edge to edge. No background visible outside the carpet.",
        "All four figures must be fully visible.",
        "",
        f"Preserve exactly: {features_to_preserve}.",
    ]
    if hijab:
        prompt_lines.append("The person is wearing a hijab in all four figures.")
    prompt_lines += [
        "",
        "Each figure wears a different outfit, taken only from the garments described and shown",
        "for that figure. Match their colour, fabric and cut. Do not add, swap or invent clothing,",
        "and do not mix garments between figures.",
        "",
        *figure_lines,
        "Scattered naturally between the figures: a vintage record player with a spinning vinyl,",
        "two or three record sleeves face-up, a film camera, a half-drunk glass, a small stack of",
        "fashion books.",
        "",
        "Soft warm diffused lighting from above. Slight film grain. Editorial fashion photography",
        "aesthetic. Ultra-realistic. Shot on medium format camera.",
    ]
    assembled_prompt = "\n".join(prompt_lines)

    import fal_client
    import os
    os.environ["FAL_KEY"] = settings.FAL_API_KEY

    logger.info(f"build_carpet_image: calling fal.ai for user {user.id} with {len(image_urls)} reference images")
    try:
        result = await asyncio.to_thread(
            fal_client.run,
            "fal-ai/nano-banana-pro/edit",
            arguments={
                "prompt": assembled_prompt,
                "image_urls": image_urls,
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

    from app.services.cloudinary_service import upload_carpet_image  # local import

    try:
        permanent_url = (await upload_carpet_image(fal_url, str(user.id)))["url"]
    except Exception as e:
        logger.error(f"build_carpet_image: Cloudinary upload failed for user {user.id}: {e}")
        permanent_url = fal_url

    # $set only this field so changes made to the user during generation aren't overwritten.
    await user.set({"dashboard_carpet_url": permanent_url})
    logger.info(f"build_carpet_image: saved carpet URL for user {user.id}")
    return permanent_url


# ── Item Styling ──────────────────────────────────────────────────────────────

ITEM_STYLIST_SYSTEM_PROMPT = """
You are an expert fashion stylist. A user wants to style a specific wardrobe item they own.
You will receive: the anchor item's full details, their complete wardrobe, their style preferences, and optionally: a free-text note about the occasion/vibe, and base64-encoded inspiration images.

Your job:
1. Reason through the anchor item's color, fabric, formality, and occasions.
2. If inspiration images are provided, analyze their aesthetic — silhouette, color palette, mood, styling details — and factor that into your suggestions.
3. Search the user's wardrobe for items that complement the anchor item. Prefer actual wardrobe items. Only suggest non-wardrobe items (like "a white sneaker") if there is truly no match in the wardrobe.
4. Generate exactly N distinct outfit combinations built around the anchor item. Each outfit must feel like a complete, wearable look.
5. For each outfit, write a precise fal.ai generation prompt describing EXACTLY how the avatar is wearing every item: is the shirt tucked or untucked, is the jacket open or closed, is the bag held or on shoulder, are sunglasses on the face or on the head, is hair up or down, what exact footwear, every detail.

Return ONLY valid JSON, no markdown, no preamble:
{
  "outfits": [
    {
      "name": "short evocative name",
      "occasion": "casual / dinner / travel / etc",
      "season": ["spring", "summer"],
      "styling_notes": "why this works, the vibe, what makes it cohesive",
      "wardrobe_item_ids": ["id1", "id2"],
      "suggested_additions": ["white low-top sneaker", "gold hoop earrings"],
      "fal_prompt": "Full-body photo of a young woman. She is wearing [describe anchor item precisely], [describe each wardrobe item precisely and how it is worn — tucked/untucked, open/closed, layered how]. [Hair description]. [Accessories description, how worn]. [Shoes description]. [Bag description, how carried]. Neutral studio background, soft natural light, editorial fashion photography."
    }
  ]
}
"""


async def generate_item_styling_suggestions(
    anchor_item: dict,
    wardrobe: list,
    style_prefs: dict,
    occasion_note: str = "",
    inspiration_image_urls: list = [],
    count: int = 3,
) -> dict:
    """Generate N outfit suggestions built around a single anchor wardrobe item."""

    wardrobe_block = "\n".join([
        f"- ID: {item['id']} | {item['name']} | {item['category']} | colors: {item.get('color', [])} | fabric: {item.get('fabric', '')} | occasions: {item.get('occasions', [])} | formality: {item.get('formality', [])}"
        for item in wardrobe if item['id'] != anchor_item['id']
    ])

    text_prompt = f"""
Anchor item the user wants to style:
ID: {anchor_item['id']}
Name: {anchor_item['name']}
Category: {anchor_item['category']}
Color: {anchor_item.get('color', [])}
Fabric: {anchor_item.get('fabric', '')}
Occasions: {anchor_item.get('occasions', [])}
Formality: {anchor_item.get('formality', [])}
Season: {anchor_item.get('season', [])}

User's full wardrobe (excluding the anchor item):
{wardrobe_block if wardrobe_block else "No other items in wardrobe."}

Style preferences: {style_prefs}

User note (occasion / vibe): {occasion_note if occasion_note else "None provided"}

Generate exactly {count} outfit combinations. Use the wardrobe items above where possible.
"""

    content_blocks = []

    if inspiration_image_urls:
        for url in inspiration_image_urls[:3]:
            try:
                import httpx as _httpx
                import base64
                async with _httpx.AsyncClient() as _http:
                    r = await _http.get(url, timeout=10)
                    b64 = base64.b64encode(r.content).decode()
                    ext = url.split(".")[-1].lower().split("?")[0]
                    media_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
                content_blocks.append({
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": b64},
                })
            except Exception:
                pass

    content_blocks.append({"type": "text", "text": text_prompt})

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        system=ITEM_STYLIST_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content_blocks}],
    )

    result = _safe_json_loads(response.content[0].text.strip())
    if not result or "outfits" not in result:
        return {"outfits": []}
    return result


async def generate_look_avatar_image(
    fal_prompt: str,
    user_avatar,
) -> Optional[str]:
    """Generate a fal.ai avatar image for an approved look using the saved user avatar."""
    import fal_client
    import os
    os.environ["FAL_KEY"] = settings.FAL_API_KEY

    # Accept Avatar object or dict
    if hasattr(user_avatar, "base_url"):
        base_url = user_avatar.base_url
    elif isinstance(user_avatar, dict):
        base_url = user_avatar.get("base_url", "")
    else:
        return None

    if not base_url:
        return None

    try:
        result = await asyncio.to_thread(
            fal_client.run,
            "fal-ai/nano-banana-pro/edit",
            arguments={
                "prompt": fal_prompt,
                "image_urls": [base_url],
                "num_images": 1,
                "image_size": "portrait_9_16",
            },
        )
        images = result.get("images", [])
        if not images:
            return None
        return images[0]["url"]
    except Exception as e:
        logger.error(f"generate_look_avatar_image failed: {e}")
        return None


# ── Wardrobe item image analysis ─────────────────────────────────────

WARDROBE_ANALYSE_SYSTEM_PROMPT = """
You are a fashion expert and wardrobe cataloguing assistant. A user has uploaded a photo of a clothing item or accessory. Analyze the image carefully and extract structured metadata about the item.

Return ONLY valid JSON, no markdown, no preamble, no explanation:
{
  "name": "short descriptive name, e.g. 'White linen shirt' or 'Black leather ankle boot'",
  "category": "one of: top, bottom, dress, outerwear, shoes, bag, accessory",
  "subcategory": "specific type e.g. tank top, blazer, midi skirt, loafer, tote bag",
  "color": ["primary color", "secondary color if present"],
  "fabric": "one of: linen, cotton, silk, wool, synthetic, denim, leather, other",
  "formality": ["one or more of: casual, smart-casual, business, formal, elevated-casual, nightlife"],
  "occasions": ["one or more of: casual, travel, dinner, work, nightlife, beach, sport, formal"],
  "season": ["one or more of: spring, summer, fall, winter"],
  "weight_grams": 300,
  "notes": "any notable details worth capturing: print description, hardware details, special construction, brand if visible, condition, etc."
}

weight_grams should be an integer estimate. Typical ranges: tops 150-400, bottoms 300-700, shoes 400-900, outerwear 500-1200, bags 200-800, accessories 50-200.
Be precise with colors (say 'burgundy' not just 'red', 'ivory' not just 'white'). If the image is unclear or shows multiple items, do your best with what's visible. Never return null for required fields — use your best judgment.
"""


async def analyse_wardrobe_item_image(image_url: str) -> dict:
    """Use Claude Vision to extract wardrobe item metadata from a photo."""
    try:
        import httpx, base64
        async with httpx.AsyncClient() as http:
            r = await http.get(image_url, timeout=15)
            b64 = base64.b64encode(r.content).decode()
            ext = image_url.split(".")[-1].lower().split("?")[0]
            media_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
            if media_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
                media_type = "image/jpeg"

        response = await client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            system=WARDROBE_ANALYSE_SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {"type": "base64", "media_type": media_type, "data": b64}
                    },
                    {
                        "type": "text",
                        "text": "Analyze this wardrobe item and return the metadata JSON."
                    }
                ]
            }]
        )
        return _safe_json_loads(response.content[0].text.strip())
    except Exception as e:
        print(f"Wardrobe item analysis failed: {e}")
        return {}


# ── Purchase Analysis ─────────────────────────────────────────────────────────

PURCHASE_ANALYSIS_SYSTEM_PROMPT = """You are PACK's purchase intelligence system. A user is considering buying a new item. You have access to their full wardrobe, style DNA, preferences, and shopping archetype.

Your job is to give an honest, nuanced analysis — not a generic recommendation. You must:

1. Count exactly how many distinct outfit combinations this item enables with their existing wardrobe. Be specific — reason through the actual combinations, then give the count.

2. Assess style alignment honestly. If it matches their DNA, say so. If it doesn't, say so — but also assess whether this is a smart style expansion move or a likely impulse purchase.

3. Check for redundancy — do they already own similar items? If they have 4 black tops, a 5th needs to justify itself clearly.

4. Research the brand quality signal — use what you know about this brand's reputation for quality, sizing accuracy, fabric integrity, and ethical production. Be specific. Mention known issues if any.

5. Calculate cost per outfit if price is available: price ÷ outfit_count. Context: under $15/outfit is excellent, $15–30 is reasonable, $30–50 is acceptable for quality pieces, over $50 needs justification.

6. Assign the user a wardrobe archetype based on their shopping profile and style DNA: Curator (tight cohesive wardrobe), Explorer (varied aesthetics, high rotation), Nostalgic (returns to core aesthetic), Trend Chaser (seasonal high turnover). Frame your analysis through this lens.

7. Write one honest plain-language verdict paragraph. Do not be sycophantic. Ask one genuine question back at the user at the end. Sound like a trusted friend who knows fashion, not a chatbot.

Return ONLY valid JSON — no preamble, no markdown fences:
{
  "scores": {
    "versatility": 0-10,
    "style_alignment": 0-10,
    "gap_fill": 0-10,
    "quality": 0-10,
    "cost_per_outfit": 0-10,
    "overall": 0-10
  },
  "outfit_count": integer,
  "outfit_combinations": [
    {
      "name": "evocative outfit name",
      "items": ["wardrobe_item_id_or_description"],
      "occasion": "casual / dinner / travel / etc",
      "styling_note": "one sentence on the look"
    }
  ],
  "archetype": "Curator|Explorer|Nostalgic|Trend Chaser",
  "archetype_note": "one sentence on how this purchase fits or challenges their archetype",
  "style_expansion_note": "one sentence on whether this is a smart expansion or random departure",
  "brand_quality_note": "what you know about this brand's quality and any known issues",
  "verdict": "honest 2-3 sentence verdict ending with a genuine question"
}"""


async def analyse_purchase(product: dict, wardrobe: list, style_context: dict) -> dict:
    """Full purchase analysis: 6 metrics, brand research, outfit counting, archetype read."""

    wardrobe_block = "\n".join([
        f"- ID:{item['id']} | {item['name']} | {item['category']} | "
        f"colors:{item.get('color',[])} | fabric:{item.get('fabric','')} | "
        f"occasions:{item.get('occasions',[])} | formality:{item.get('formality',[])}"
        for item in wardrobe
    ]) or "Wardrobe is empty."

    style_dna = style_context.get("style_dna", {})
    prefs = style_context.get("preferences", {})
    shopping = style_context.get("shopping_profile", {})

    prompt = f"""Product the user is considering buying:
Name: {product.get('name', 'Unknown')}
Brand: {product.get('brand', 'Unknown')}
URL: {product.get('url', '')}
Price: {product.get('price', 'Unknown')} {product.get('currency', 'USD')}

Their wardrobe ({len(wardrobe)} items):
{wardrobe_block}

Their style DNA:
Headline: {style_dna.get('headline', 'Not analysed yet')}
Keywords: {style_dna.get('style_keywords', [])}
Style gaps: {style_dna.get('style_gaps', [])}
Stylist's read: {style_dna.get('stylist_paragraph', '')}

Their preferences:
Aesthetics: {prefs.get('style_aesthetics', [])}
Fit: {prefs.get('fit_preference', '')}
Avoid colors: {prefs.get('colors_to_avoid', [])}
Dresses for: {prefs.get('dresses_for', [])}
Stylist notes: {prefs.get('stylist_notes', '')}

Shopping profile:
Current archetype: {shopping.get('archetype', 'unknown — first analysis')}
Total analyses done: {shopping.get('total_analyses', 0)}
Impulse ratio: {f"{shopping.get('impulse_ratio', 0):.0%}" if shopping.get('total_analyses', 0) > 0 else 'no data yet'}

Analyse this purchase honestly."""

    content_blocks: list = []

    # Attach product image if available
    if product.get("image_url"):
        try:
            import httpx, base64
            async with httpx.AsyncClient(timeout=10) as http:
                r = await http.get(product["image_url"])
                b64 = base64.b64encode(r.content).decode()
                raw_type = r.headers.get("content-type", "").split(";")[0].strip()
                media_type = raw_type if raw_type.startswith("image/") else "image/jpeg"
            content_blocks.append({
                "type": "image",
                "source": {"type": "base64", "media_type": media_type, "data": b64},
            })
        except Exception:
            pass  # image fetch failed — analysis proceeds without it

    content_blocks.append({"type": "text", "text": prompt})

    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=PURCHASE_ANALYSIS_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content_blocks}],
    )

    result = _safe_json_loads(response.content[0].text.strip())

    # Build outfit collages: product image first, then matched wardrobe item images
    wardrobe_map = {item["id"]: item.get("image_url", "") for item in wardrobe}
    outfit_collages = []
    for combo in result.get("outfit_combinations", [])[:3]:
        urls: list[str] = []
        if product.get("image_url"):
            urls.append(product["image_url"])
        for ref in combo.get("items", [])[:3]:
            img = wardrobe_map.get(ref, "")
            if img:
                urls.append(img)
        outfit_collages.append(urls)

    result["outfit_collages"] = outfit_collages
    return result


# ── Packing plan ("Optimise space") ──────────────────────────────────────────
# Splits the approved packing list across the trip's bags and writes short
# packing advice. Results are saved on the trip with a signature of the items
# and bags, so opening the page again costs nothing until the list changes.

_PACKING_PLAN_SYSTEM = """You are PACK's packing expert. You decide which bag each item goes in and how to pack each bag so everything fits and stays within airline weight limits.

You receive the trip, the bags (each with the weight in grams it can still hold) and the items (each with a key and a weight in grams).

Rules:
- Put every item key in exactly one bag. Use only the keys and bag_ids you were given.
- Keep each bag's total at or under its capacity_grams when you can. A capacity of 0 means no limit was given.
- Carry-on and handbag: valuables, chargers, one change of clothes, anything fragile, what is needed on arrival.
- Checked bag: shoes, denim, heavy knits, liquids over 100ml, bulky items.
- Spread weight so no bag is close to its limit while another is nearly empty.
- If everything cannot fit, say in the tips which of the heaviest items to wear on the travel day.

Notes and tips:
- One "note" per bag, 1 to 2 sentences, practical: what goes at the bottom, what to roll, what to fold, where shoes go.
- 3 to 5 "tips" for the whole trip, each one sentence, specific to these items (name them), not generic advice.
- Write weights in kilograms with at most one decimal (5.5 kg), never in grams.
- Warm, direct, plain language. Never use em dashes.

Return only JSON:
{"bags": [{"bag_id": "...", "item_keys": ["..."], "note": "..."}], "tips": ["..."]}"""


def _no_em_dashes(text: str) -> str:
    return re.sub(r"\s*—\s*", ", ", text or "").strip()


def packing_load(trip) -> list[dict]:
    """Everything going in the bags: unique items from approved outfits, plus
    the non-clothing items the user reserved weight for when creating the trip.
    Weights match what the packing page shows."""
    load, seen = [], set()
    if trip.packing_list:
        approved = set(trip.approved_outfits or [])
        for outfit in trip.packing_list.outfits:
            if outfit.name not in approved:
                continue
            for item in outfit.items:
                key = item.wardrobe_item_id or item.name
                if key in seen:
                    continue
                seen.add(key)
                load.append({
                    "key": key,
                    "name": item.name,
                    "category": item.category,
                    "weight_grams": round((item.estimated_weight_kg or 0) * 1000),
                })
    for reserved in trip.reserved_items or []:
        load.append({
            "key": f"reserved:{reserved.name}",
            "name": reserved.name,
            "category": "other",
            "weight_grams": reserved.weight_grams or 0,
        })
    return load


def trip_bags(trip) -> list[dict]:
    """The trip's bags, or a single unnamed bag for trips made before bags existed."""
    if trip.bags:
        return [
            {"bag_id": b.bag_id, "label": b.label, "bag_type": b.bag_type, "capacity_grams": max(0, b.available_grams)}
            for b in trip.bags
        ]
    return [{"bag_id": "bag_main", "label": "Your bag", "bag_type": "", "capacity_grams": 0}]


def packing_plan_signature(load: list[dict], bags: list[dict]) -> str:
    import hashlib

    basis = {
        "items": sorted((i["key"], i["weight_grams"]) for i in load),
        "bags": [(b["bag_id"], b["capacity_grams"]) for b in bags],
    }
    return hashlib.sha1(json.dumps(basis).encode()).hexdigest()


async def build_packing_plan(trip):
    """Ask Claude to assign items to bags, then enforce the rules in code: every
    item lands in exactly one real bag and the weights are our own sums."""
    from app.models.trip import BagPlan, PackingPlan

    load = packing_load(trip)
    bags = trip_bags(trip)
    by_key = {i["key"]: i for i in load}
    by_bag = {b["bag_id"]: b for b in bags}

    brief = {
        "trip": {"destination": trip.destination, "days": trip.duration_days, "climate": trip.climate},
        "bags": [
            {"bag_id": b["bag_id"], "label": b["label"], "type": b["bag_type"], "capacity_grams": b["capacity_grams"]}
            for b in bags
        ],
        "items": [
            {"key": i["key"], "name": i["name"], "category": i["category"], "weight_grams": i["weight_grams"]}
            for i in load
        ],
    }
    response = await client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        system=_PACKING_PLAN_SYSTEM,
        messages=[{"role": "user", "content": json.dumps(brief)}],
    )
    text = next((b.text for b in response.content if getattr(b, "type", "") == "text"), "")
    result = _safe_json_loads(text)

    assigned: dict[str, list[str]] = {b["bag_id"]: [] for b in bags}
    notes: dict[str, str] = {}
    placed = set()
    for pick in result.get("bags", []):
        bag_id = pick.get("bag_id")
        if bag_id not in by_bag:
            continue
        notes[bag_id] = _no_em_dashes(pick.get("note", ""))
        for key in pick.get("item_keys", []):
            if key in by_key and key not in placed:
                assigned[bag_id].append(key)
                placed.add(key)

    def contents(bag_id):
        return sum(by_key[k]["weight_grams"] for k in assigned[bag_id])

    # Anything Claude missed goes where there is the most room, heaviest first
    leftovers = sorted((i for i in load if i["key"] not in placed), key=lambda i: -i["weight_grams"])
    for item in leftovers:
        target = max(bags, key=lambda b: (b["capacity_grams"] or 10**9) - contents(b["bag_id"]))
        assigned[target["bag_id"]].append(item["key"])

    total_load = sum(i["weight_grams"] for i in load)
    total_capacity = sum(b["capacity_grams"] for b in bags)
    over_by = max(0, total_load - total_capacity) if total_capacity else 0

    return PackingPlan(
        signature=packing_plan_signature(load, bags),
        bags=[
            BagPlan(
                bag_id=b["bag_id"],
                label=b["label"],
                bag_type=b["bag_type"],
                item_keys=assigned[b["bag_id"]],
                weight_grams=contents(b["bag_id"]),
                available_grams=b["capacity_grams"],
                note=notes.get(b["bag_id"], ""),
            )
            for b in bags
        ],
        tips=[_no_em_dashes(t) for t in result.get("tips", []) if isinstance(t, str) and t.strip()][:5],
        over_by_grams=over_by,
    )
