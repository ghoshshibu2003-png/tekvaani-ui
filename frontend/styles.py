import streamlit as st


def load_styles():
    st.markdown(
        """
        <style>

        /* =====================================================
           GLOBAL
           ===================================================== */

        #MainMenu {
            visibility: hidden;
        }

        footer {
            visibility: hidden;
        }

        header {
            visibility: hidden;
        }


        /* =====================================================
           APP BACKGROUND
           ===================================================== */

        .stApp {
            min-height: 100vh;

            background:
                radial-gradient(
                    circle at 8% 18%,
                    rgba(245, 205, 177, 0.22),
                    transparent 27%
                ),
                radial-gradient(
                    circle at 92% 20%,
                    rgba(242, 190, 169, 0.20),
                    transparent 27%
                ),
                radial-gradient(
                    circle at 50% 100%,
                    rgba(247, 220, 197, 0.18),
                    transparent 35%
                ),
                linear-gradient(
                    135deg,
                    #fffaf6 0%,
                    #fff8f4 45%,
                    #fffaf7 100%
                );

            color: #302923;
        }


        /* =====================================================
           MAIN CONTAINER
           ===================================================== */

        .block-container {
            max-width: 760px;
            padding-top: 2rem;
            padding-bottom: 3rem;
        }


        /* =====================================================
           HEADER ALIGNMENT
           -----------------------------------------------------
           NOTE: this used to be unscoped ("div[data-testid=
           stHorizontalBlock] { align-items: center !important; }"),
           which forced vertical centering on EVERY st.columns()
           row in the app, not just the header. Scoped to the
           header container so it can't affect other pages.
           ===================================================== */

        .st-key-voice_header div[data-testid="stHorizontalBlock"] {
            align-items: center !important;
        }


        /* =====================================================
           ALL BUTTONS (default chrome + fallback size)
           -----------------------------------------------------
           These reset button chrome (background/border/shadow)
           and set a default height. This part was NOT the bug --
           it's left unscoped intentionally so every button in the
           app gets sane default chrome/height unless a more
           specific, higher-specificity rule overrides it (e.g.
           settings.py's option buttons use a more specific
           selector to win on height/width/border-radius). The
           actual bug -- width/border-radius rules keyed off
           :first-child / :last-child -- has been moved into the
           header-scoped section below so it can't leak onto
           other pages' column rows.
           ===================================================== */

        div[data-testid="stButton"] {
            margin: 0 !important;
            padding: 0 !important;
        }

        div[data-testid="stButton"] > button,
        div.stButton > button {
            background: transparent !important;
            background-color: transparent !important;

            border: none !important;
            outline: none !important;

            box-shadow: none !important;

            color: #3c332d !important;

            padding: 0 !important;
            margin: 0 !important;

            min-height: 42px !important;
            height: 42px !important;

            transition: all 0.2s ease;
        }

        div[data-testid="stButton"] > button:hover,
        div.stButton > button:hover {
            background: transparent !important;
            background-color: transparent !important;

            border: none !important;
            box-shadow: none !important;
        }

        div[data-testid="stButton"] > button:focus,
        div[data-testid="stButton"] > button:active,
        div.stButton > button:focus,
        div.stButton > button:active {
            background: transparent !important;
            background-color: transparent !important;

            border: none !important;
            box-shadow: none !important;
            outline: none !important;
        }


        /* =====================================================
           LEFT MENU (hamburger button)
           -----------------------------------------------------
           FIX: scoped to .st-key-voice_header so this no longer
           matches the first column of every st.columns() row
           app-wide (this was collapsing "Light" / "Default" on
           the Settings page down to a 42px-wide button).
           ===================================================== */

        .st-key-voice_header div[data-testid="stHorizontalBlock"]
        > div:first-child
        div[data-testid="stButton"] {
            display: flex;
            justify-content: flex-start;
            align-items: center;
        }

        .st-key-voice_header div[data-testid="stHorizontalBlock"]
        > div:first-child
        div[data-testid="stButton"] > button {

            width: 42px !important;
            height: 42px !important;
            min-height: 42px !important;

            font-size: 22px !important;
            font-weight: 400 !important;

            color: #3c332d !important;

            display: flex !important;
            align-items: center !important;
            justify-content: flex-start !important;
        }


        /* =====================================================
           CENTER BRAND
           -----------------------------------------------------
           FIX: scoped to .st-key-voice_header so this no longer
           matches the middle column of every 2- or 3-column row
           app-wide.
           ===================================================== */

        .st-key-voice_header div[data-testid="stHorizontalBlock"]
        > div:nth-child(2) {

            display: flex;
            justify-content: center;
            align-items: center;
        }

        .brand {
            width: 100%;

            text-align: center;

            font-size: 13px;
            font-weight: 800;

            letter-spacing: 4px;

            color: #302923;

            padding: 0;
            margin: 0;
        }


        /* =====================================================
           RIGHT QUESTION BUTTON
           -----------------------------------------------------
           FIX: scoped to .st-key-voice_header. This was the main
           culprit -- unscoped, it forced the LAST column's button
           in every st.columns() row app-wide into a 42x42 circle,
           which is exactly what was happening to "Dark" and
           "Female" on the Settings page.
           ===================================================== */

        .st-key-voice_header div[data-testid="stHorizontalBlock"]
        > div:last-child {

            display: flex;
            justify-content: flex-end;
            align-items: center;
        }

        .st-key-voice_header div[data-testid="stHorizontalBlock"]
        > div:last-child
        div[data-testid="stButton"] {

            display: flex;
            justify-content: flex-end;
            align-items: center;
        }

        .st-key-voice_header div[data-testid="stHorizontalBlock"]
        > div:last-child
        div[data-testid="stButton"] > button {

            width: 42px !important;
            height: 42px !important;

            min-height: 42px !important;

            border-radius: 50% !important;

            background: #fff4ec !important;
            background-color: #fff4ec !important;

            border: 1px solid #e7c5b0 !important;

            color: #7f4d38 !important;

            font-size: 19px !important;
            font-weight: 800 !important;

            display: flex !important;
            align-items: center !important;
            justify-content: center !important;

            box-shadow:
                0 4px 12px rgba(105, 75, 55, 0.10) !important;
        }


        /* =====================================================
           SPEAK TITLE
           ===================================================== */

        .speak-title {
            text-align: center;

            margin-top: 42px;
            margin-bottom: 0;

            font-size: 36px;
            font-weight: 800;

            color: #302923 !important;

            line-height: 1.2;
        }


        /* =====================================================
           MOBILE
           ===================================================== */

        @media (max-width: 700px) {

            .block-container {
                padding-left: 18px;
                padding-right: 18px;
            }

            .speak-title {
                margin-top: 30px;
                font-size: 28px;
            }

            .st-key-voice_header div[data-testid="stHorizontalBlock"]
            > div:first-child
            div[data-testid="stButton"] > button {
                width: 36px !important;
            }

        }

        </style>
        """,
        unsafe_allow_html=True,
    )