# PACK
### An AI-Powered Travel Wardrobe Stylist

PACK is a full-stack web application that acts as a personal stylist for travel. You upload your wardrobe, build an avatar that looks like you, and get photorealistic outfit suggestions showing your avatar wearing your actual clothes — before you pack.

**Live app:** [pack-capstone.vercel.app](https://pack-capstone.vercel.app)

---

## Demo

- [Part 1 — Onboarding, Avatar Builder, Wardrobe & Style DNA](https://www.loom.com/share/7024a6a5fcfb4910955ec1a16ce92f09)
- [Part 2 — Trip Planning, Style Brief, Outfit Generation & Lookbook](https://www.loom.com/share/b692127d44ec4688942bd901d923ed71)

---

## Features

- **Avatar Builder** — Upload a photo, Claude Vision extracts your features, Nano Banana Pro generates a base avatar that looks like you
- **Wardrobe Management** — Upload and categorize your clothing items
- **Style DNA** — AI-generated style fingerprint based on your wardrobe
- **Trip Planning + Style Brief** — Set a destination and vibe, Claude writes an editorial style direction for your trip
- **Outfit Generation** — Claude engineers per-pose prompts, Nano Banana generates 3 photorealistic shots of your avatar in each outfit
- **Swipe Flow** — Approve or reject outfits
- **Lookbook** — Your final curated packing list

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite |
| Backend | FastAPI |
| Database | MongoDB Atlas |
| Image Storage | Cloudinary |
| AI | Claude API (Anthropic) |
| Image Generation | fal.ai Nano Banana Pro |
| Deployment | Vercel |

---

## Project Structure

```
pack-capstone/
├── frontend/        # React + Vite
├── backend/         # FastAPI
├── references/      # Spec files written before each feature
├── PACK_SPEC.md     # Full product specification
└── CLAUDE.md        # Claude Code instructions
```

---

## Built for

CP192 Mini Capstone — Minerva University, Spring 2026  
Aiman Afzal Arain
