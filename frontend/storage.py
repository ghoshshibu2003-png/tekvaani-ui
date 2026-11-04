"""Remember the selected State + Dialect in the browser (localStorage).

Different browser / computer = nothing saved = starts at Select State.
"""
from pathlib import Path

import streamlit.components.v1 as components

_bridge = components.declare_component(
    "tekvaani_ls_bridge",
    path=str(Path(__file__).parent / "ls_bridge"),
)


def sync_selection(state, dialect):
    """Save the current choice (if any) and return what the browser had stored.

    Returns None while the browser has not answered yet (first moments of a session),
    {} when nothing is saved, or {"state": ..., "dialect": ...}.
    """
    return _bridge(state=state, dialect=dialect, key="tekvaani_ls_bridge", default=None)