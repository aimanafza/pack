import asyncio
import logging
import os
import tempfile
from typing import Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class TranscriptionError(Exception):
    pass


# Formats the Groq (OpenAI-compatible) Whisper endpoint accepts as-is.
_ACCEPTED_EXTS = {"flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "wav", "webm"}

_EXT_BY_MIME = {
    "audio/mp4": "m4a",
    "audio/m4a": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
    # iPhone-native voice memo container — not accepted by Groq/OpenAI as-is.
    "audio/x-caf": "caf",
    "audio/caf": "caf",
}

# Magic-byte sniffing as a fallback when Linq's mime_type is missing or generic
# (e.g. "application/octet-stream") — the same pattern claude_service.py uses
# for images, applied to the audio containers we're likely to actually see.
_MAGIC_SNIFFERS = (
    (b"caff", "caf"),
    (b"RIFF", "wav"),          # WAVE has "WAVE" at offset 8, but RIFF alone is enough here
    (b"OggS", "ogg"),
    (b"fLaC", "flac"),
    (b"\x1a\x45\xdf\xa3", "webm"),
    (b"ID3", "mp3"),
)


def _sniff_audio_ext(data: bytes) -> Optional[str]:
    header = data[:16]
    for magic, ext in _MAGIC_SNIFFERS:
        if header.startswith(magic):
            return ext
    # ftyp-based containers (m4a/mp4) have the box type at offset 4, not 0.
    if len(header) >= 8 and header[4:8] == b"ftyp":
        return "m4a"
    # Bare MPEG audio frame sync (no ID3 tag) — 0xFFEx/0xFFFx.
    if len(header) >= 2 and header[0] == 0xFF and (header[1] & 0xE0) == 0xE0:
        return "mp3"
    return None


def _detect_extension(audio_bytes: bytes, mime_type: str) -> Optional[str]:
    mime_ext = _EXT_BY_MIME.get((mime_type or "").split(";")[0].strip().lower())
    return mime_ext or _sniff_audio_ext(audio_bytes)


async def _convert_to_m4a(audio_bytes: bytes) -> bytes:
    """Convert an unsupported/unrecognized audio container to m4a via ffmpeg."""
    with tempfile.NamedTemporaryFile(suffix=".src", delete=False) as src_file:
        src_file.write(audio_bytes)
        src_path = src_file.name
    dst_path = src_path + ".m4a"

    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", src_path, "-vn", "-acodec", "aac", dst_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise TranscriptionError(
                f"ffmpeg conversion failed (code {proc.returncode}): "
                f"{stderr.decode(errors='ignore')[-500:]}"
            )
        with open(dst_path, "rb") as f:
            return f.read()
    except FileNotFoundError:
        raise TranscriptionError("ffmpeg is not installed/on PATH")
    finally:
        for path in (src_path, dst_path):
            try:
                os.remove(path)
            except OSError:
                pass


async def _transcribe_groq(audio_bytes: bytes, mime_type: str) -> str:
    if not settings.GROQ_API_KEY:
        raise TranscriptionError("GROQ_API_KEY is not configured")

    ext = _detect_extension(audio_bytes, mime_type)
    if ext not in _ACCEPTED_EXTS:
        logger.info(
            "Converting voice note to m4a via ffmpeg (detected_ext=%s, mime_type=%s)",
            ext, mime_type,
        )
        audio_bytes = await _convert_to_m4a(audio_bytes)
        ext = "m4a"

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            headers={"Authorization": f"Bearer {settings.GROQ_API_KEY}"},
            files={"file": (f"voice_note.{ext}", audio_bytes, mime_type or "application/octet-stream")},
            data={"model": settings.TRANSCRIPTION_MODEL, "response_format": "json"},
        )
        if response.status_code >= 400:
            raise TranscriptionError(f"Groq API error {response.status_code}: {response.text[:500]}")
        return response.json()["text"].strip()


async def transcribe_voice_note(audio_bytes: bytes, mime_type: str) -> str:
    """Transcribe a voice note. Provider/model come from config — switching
    providers later (e.g. to OpenAI) means adding a branch here and changing
    TRANSCRIPTION_PROVIDER, not touching any caller."""
    provider = settings.TRANSCRIPTION_PROVIDER
    if provider == "groq":
        return await _transcribe_groq(audio_bytes, mime_type)
    raise TranscriptionError(f"Unsupported TRANSCRIPTION_PROVIDER: {provider}")
