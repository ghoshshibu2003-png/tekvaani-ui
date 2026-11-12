"""
Tekvaani - Voice-to-Voice page (frontend only, mobile-first, 6 screens).

This file only assembles the page. The page itself lives in frontend/voice/:

    voice.html   page markup (top bar, orb, status, chat, buttons, menu, How to Use)
    voice.css    all styling
    voice.js     screens/states, microphone + silence detection, orb drawing
                 and the BACKEND INTEGRATION POINTS:
                     startConversation()   sendAudioToBackend()   receiveUserTranscript()
                     receiveAIResponse()   playAIResponse()       endConversation()
    demo.js      browser-only demo (speech-to-text, sample reply, browser voice)

When the real service is connected: set DEMO_MODE = False and delete demo.js.

SHOW_OWN_TOP_BAR = True: on THIS page only, the old Streamlit header and side menu
are hidden (CSS injected below) and the in-page top bar, menu and How to Use are
used instead. Settings/About in the menu press the existing app menu buttons, so
app.py is not changed. Set False to keep the old header (menu and help then hidden).
"""

import json
from functools import lru_cache
from pathlib import Path
from urllib.parse import quote

import streamlit as st
import streamlit.components.v1 as components

from frontend.logo import logo_data_uri

DEMO_MODE = False          # browser-only demo. Set False when the real service is wired in.
SHOW_OWN_TOP_BAR = True   # in-page top bar + menu + How to Use (hides the old header on this page)

_DIR = Path(__file__).parent / "voice"

_PAGE_CSS = (
    "<style>"
    ".stApp{background:radial-gradient(circle at 12% 6%,rgba(176,224,236,.30),transparent 32%),"
    "radial-gradient(circle at 92% 16%,rgba(190,236,216,.26),transparent 30%),"
    "linear-gradient(180deg,#fffaf2 0%,#fbf8ef 60%,#f3f8f4 100%) !important;}"
    ".st-key-voice_header,.st-key-voice_side_menu,.voice-side-overlay{display:none !important;}"
    ".block-container{max-width:560px !important;padding:.4rem 12px .3rem !important;}"
    ".block-container [data-testid=stVerticalBlock]{gap:0 !important;row-gap:0 !important;}"
    "[data-testid=stElementContainer]:has(style),.element-container:has(style){display:none !important;}"
    "</style>"
)


def _read(name: str) -> str:
    return (_DIR / name).read_text(encoding="utf-8")


def _files_stamp() -> tuple:
    """Modification times of the page files. Used as part of the cache key so that
    editing voice.js / voice.css / voice.html is picked up without restarting."""
    try:
        return tuple((_DIR / n).stat().st_mtime_ns for n in ("voice.html", "voice.css", "voice.js", "demo.js"))
    except OSError:
        return ()


def _build_html(state: str = "", dialect: str = "") -> str:
    return _build_html_cached(state, dialect, _files_stamp())


@lru_cache(maxsize=32)
def _build_html_cached(state: str, dialect: str, _stamp: tuple) -> str:
    """Assemble the page once per (state, dialect). The files are read and the logo
    is processed once, not on every Streamlit rerun. Nothing user-specific is cached:
    the result only depends on the selected state and dialect."""
    state_id = "odisha" if state == "Odisha" else "uttar_pradesh"
    language_id = "odia" if state == "Odisha" else "hindi"

    dialect_ids = {
        "Sambalpuri / Kosli": "sambalpuri",
        "Baleswari": "baleswari",
        "Cuttacki / Kataki": "cuttacki",
        "Ganjami": "ganjami",
        "Bhojpuri": "bhojpuri",
        "Awadhi": "awadhi",
        "Braj Bhasha": "braj",
        "Bundeli": "bundeli",
        "Kannauji": "kannauji",
    }

    dialect_id = dialect_ids.get(dialect, "")
    demo_js = _read("demo.js") if DEMO_MODE else ""
    # Logo background is removed here (once, cached) so the browser does not have to
    # redo the pixel work every time the conversation page opens.
    logo_uri, logo_clean = logo_data_uri(700)
    voice_js = (
        _read("voice.js")
        .replace("__DEMO__", "true" if DEMO_MODE else "false")
        .replace("__LOGO_CLEAN__", "true" if logo_clean else "false")
        .replace("__LOGO__", logo_uri)
        .replace("__SAVED_SELECTION__", quote(f"{state}|{dialect}", safe=""))
        .replace("__DIALECT__", json.dumps(dialect)[1:-1])
        .replace("__STATE_ID__", state_id)
        .replace("__LANGUAGE_ID__", language_id)
        .replace("__DIALECT_ID__", dialect_id)
    )
    return (
        _read("voice.html")
        .replace("__BAR__", "" if SHOW_OWN_TOP_BAR else "no-bar")
        .replace("/*__CSS__*/", _read("voice.css"))
        .replace("/*__DEMO_JS__*/", demo_js)
        .replace("/*__VOICE_JS__*/", voice_js)
    )


def voice_to_voice(state: str = "", dialect: str = ""):
    if SHOW_OWN_TOP_BAR:
        st.markdown(_PAGE_CSS, unsafe_allow_html=True)
    components.html(_build_html(state, dialect), height=760, scrolling=False)