from urllib.parse import unquote

import streamlit as st

from frontend.logo import logo_data_uri
from frontend.styles import load_styles
from frontend.voice_to_voice import voice_to_voice


# =====================================================
# PAGE CONFIGURATION
# =====================================================

st.set_page_config(
    page_title="Voice AI",
    page_icon="🎙️",
    layout="centered",
    initial_sidebar_state="collapsed",
)

load_styles()


# =====================================================
# STATE + DIALECT CONFIGURATION
# =====================================================

DIALECTS = {
    "Odisha": [
        "Sambalpuri / Kosli",
        "Baleswari",
        "Cuttacki / Kataki",
        "Ganjami",
    ],
    "Uttar Pradesh": [
        "Bhojpuri",
        "Awadhi",
        "Braj Bhasha",
        "Bundeli",
        "Kannauji",
    ],
}

# Remembered choice: the conversation page saves the selection in a browser cookie
# ("tekvaani_selection"). Streamlit sends cookies with the first request, so reading
# it here is instant (no custom component, no loading spinner, no extra rerun).

def _saved_selection():
    try:
        raw = st.context.cookies.get("tekvaani_selection")
        if not isinstance(raw, str) or not raw:
            return None, None
        state, _, dialect = unquote(raw).partition("|")
    except Exception:
        return None, None
    # Never trust a cookie blindly: only accept values that exist in DIALECTS.
    if state in DIALECTS and dialect in DIALECTS[state]:
        return state, dialect
    return None, None


if "selected_state" not in st.session_state:
    _state, _dialect = _saved_selection()
    st.session_state.selected_state = _state
    st.session_state.selected_dialect = _dialect


# =====================================================
# SELECTION SCREEN STYLING + ARTWORK
# =====================================================

_SELECT_CSS = """
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">

<style>
.stApp {
    background:
        radial-gradient(circle at 12% 6%, rgba(176,224,236,.30), transparent 32%),
        radial-gradient(circle at 92% 16%, rgba(190,236,216,.26), transparent 30%),
        linear-gradient(180deg,#fffaf2 0%,#fbf8ef 60%,#f3f8f4 100%) !important;
}

.block-container {
    max-width: 520px !important;
    padding: 1.2rem 22px 3rem !important;
}

.sel-logo {
    display: flex;
    justify-content: center;
    margin: 0 0 34px 0;
}

.sel-logo img {
    height: 52px;
    width: auto;
}

.sel-title {
    font-family: "Source Sans 3", Arial, sans-serif !important;
    text-align: center !important;
    font-size: clamp(28px,8vw,34px) !important;
    font-weight: 700 !important;
    color: #16263d !important;
    margin: 0 !important;
    padding: 0 !important;
    line-height: 1.2 !important;
}

.sel-sub {
    font-family: "Source Sans 3", Arial, sans-serif !important;
    text-align: center !important;
    font-size: clamp(17px,4.9vw,20px) !important;
    color: #566578 !important;
    margin: 6px 0 26px 0 !important;
}

.sel-art {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 520px;
    bottom: 0;
    height: 24vh;
    min-height: 110px;
    pointer-events: none;
    z-index: 0;
    opacity: .9;
}

.sel-art svg {
    width: 100%;
    height: 100%;
}

.st-key-sel_box {
    position: relative;
    z-index: 1;
}

.st-key-sel_box div[data-testid="stButton"] > button {
    width: 100% !important;
    height: 72px !important;
    min-height: 72px !important;
    border: 0 !important;
    border-radius: 999px !important;
    color: #fff !important;
    font-family: "Source Sans 3", Arial, sans-serif !important;
    font-size: 24px !important;
    font-weight: 700 !important;
    margin-bottom: 14px !important;
    background: linear-gradient(100deg,#1b46cf 0%,#1670b8 55%,#0f9a73 100%) !important;
    box-shadow: 0 14px 28px rgba(31,86,214,.28),
                inset 0 1px 0 rgba(255,255,255,.35) !important;
}

.st-key-sel_box div[data-testid="stButton"] > button:hover {
    filter: brightness(1.07);
    transform: translateY(-1px);
}

.st-key-sel_box div[data-testid="stButton"] > button p {
    font-size: 24px !important;
    font-weight: 700 !important;
    color: #fff !important;
}

.st-key-sel_box .st-key-sel_back div[data-testid="stButton"] > button {
    height: 48px !important;
    min-height: 48px !important;
    background: transparent !important;
    box-shadow: none !important;
    color: #566578 !important;
}

.st-key-sel_box .st-key-sel_back div[data-testid="stButton"] > button p {
    font-size: 18px !important;
    font-weight: 600 !important;
    color: #566578 !important;
}
</style>
"""


# =====================================================
# BOTTOM ARTWORK
# =====================================================

_ART_SVG = """
<div class="sel-art" aria-hidden="true">
<svg viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice">

<path d="M0 140C60 110 120 165 200 135S340 115 400 140V200H0Z"
fill="rgba(110,185,215,.30)"/>

<path d="M0 165C80 135 150 185 230 160S350 150 400 168V200H0Z"
fill="rgba(110,205,170,.28)"/>

<g transform="translate(338 196)">
<path d="M0 0C-26-30-22-72 0-108C22-72 26-30 0 0Z"
fill="rgba(31,174,122,.55)"/>

<path d="M0 0C-30-18-52-44-52-76C-24-62-4-34 0 0Z"
fill="rgba(31,140,150,.45)"
transform="translate(-6 0)"/>

<path d="M0 0C28-14 46-40 48-68C22-56 4-30 0 0Z"
fill="rgba(60,190,150,.5)"
transform="translate(8 0)"/>
</g>

</svg>
</div>
"""

# =====================================================
# LOGO
# =====================================================
# The logo is processed once per server process (frontend/logo.py), not on every click.
# It is shown at 52px high, so 300px wide is already sharp on high-density screens.

def _logo_html() -> str:
    uri, _ = logo_data_uri(300)
    if not uri:
        return ""
    return '<div class="sel-logo"><img alt="Tekvaani" src="' + uri + '"></div>'


# =====================================================
# SELECTION CALLBACKS
# =====================================================
# Callbacks run BEFORE Streamlit reruns the script, so one click = one rerun.
# (Calling st.rerun() after a button made every click run the whole script twice.)

def _pick_state(value):
    st.session_state.selected_state = value
    st.session_state.selected_dialect = None


def _pick_dialect(value):
    st.session_state.selected_dialect = value


def _back_to_state():
    st.session_state.selected_state = None
    st.session_state.selected_dialect = None


# =====================================================
# SELECTION SCREEN
# =====================================================

def _selection_screen(
    title,
    subtitle,
    options,
    key_prefix,
    on_pick,
    on_back=None,
):
    st.markdown(
        _SELECT_CSS + _ART_SVG + _logo_html(),
        unsafe_allow_html=True,
    )

    with st.container(key="sel_box"):
        st.markdown(
            f'<h1 class="sel-title">{title}</h1>'
            f'<p class="sel-sub">{subtitle}</p>',
            unsafe_allow_html=True,
        )

        for option in options:
            st.button(
                option,
                key=f"{key_prefix}_{option}",
                use_container_width=True,
                on_click=on_pick,
                args=(option,),
            )

        if on_back:
            with st.container(key="sel_back"):
                st.button(
                    "← Back",
                    key=f"{key_prefix}_back",
                    use_container_width=True,
                    on_click=on_back,
                )

    st.stop()


# =====================================================
# STATE SELECTION
# =====================================================

if st.session_state.selected_state is None:
    _selection_screen(
        "Select State",
        "Choose your state",
        list(DIALECTS),
        "state",
        _pick_state,
    )


# =====================================================
# DIALECT SELECTION
# =====================================================

if st.session_state.selected_dialect is None:
    _selection_screen(
        "Select Dialect",
        f"{st.session_state.selected_state} - choose your dialect",
        DIALECTS[st.session_state.selected_state],
        "dialect",
        _pick_dialect,
        _back_to_state,
    )


# =====================================================
# CONVERSATION PAGE
# =====================================================
# The in-page "Language" button (inside the voice page) clicks this hidden
# button; the callback resets the choice and Streamlit reruns once.

st.markdown(
    '<style>.st-key-language_reset{display:none !important;}</style>',
    unsafe_allow_html=True,
)

with st.container(key="language_reset"):
    st.button("Language", key="language_reset_btn", on_click=_back_to_state)


voice_to_voice(
    st.session_state.selected_state,
    st.session_state.selected_dialect,
)