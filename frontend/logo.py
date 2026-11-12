"""
Tekvaani logo helper.

The logo PNG has a light-gray background that must be made transparent. That work
is done ONCE per server process here and then reused by every page and every
Streamlit rerun.

Why this is in its own file: app.py is re-executed from top to bottom on every
click, so an @lru_cache placed inside app.py is re-created each time and never
actually caches. Imported modules are loaded once, so the cache here really works.
"""

import base64
import io
from functools import lru_cache
from pathlib import Path

_LOGO_PATH = Path(__file__).parent / "tekvaani.png"


@lru_cache(maxsize=None)
def logo_png(max_width: int):
    """Return (png_bytes, was_cleaned). Cleaned = gray background made transparent."""
    try:
        raw = _LOGO_PATH.read_bytes()
    except OSError:
        return b"", False

    try:
        from PIL import Image

        im = Image.open(io.BytesIO(raw)).convert("RGBA")
        k = min(1.0, max_width / im.width)
        im = im.resize((round(im.width * k), round(im.height * k)))

        px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                mn, mx = min(r, g, b), max(r, g, b)
                if mx - mn < 16 and mn > 205:
                    px[x, y] = (
                        r,
                        g,
                        b,
                        0 if mn >= 238 else round(a * (238 - mn) / 33),
                    )

        buf = io.BytesIO()
        im.save(buf, "PNG", optimize=True)
        return buf.getvalue(), True
    except Exception:
        return raw, False


@lru_cache(maxsize=None)
def logo_data_uri(max_width: int):
    """Return (data_uri, was_cleaned). data_uri is '' if the logo file is missing."""
    data, cleaned = logo_png(max_width)
    if not data:
        return "", False
    return "data:image/png;base64," + base64.b64encode(data).decode(), cleaned