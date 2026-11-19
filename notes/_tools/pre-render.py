"""Runs before `quarto render`. Safety net only.

Quarto builds into _build/ and, while doing so, moves the old notes/index.html away.
post-render.py puts the new one back. If a previous render crashed half-way and
notes/index.html is missing, bring it back from the copy kept in .quarto/.
"""
import os, shutil

root = os.environ.get("QUARTO_PROJECT_DIR", os.getcwd())
page = os.path.join(root, "notes", "index.html")
keep = os.path.join(root, ".quarto", "notes-index.html.bak")
os.makedirs(os.path.dirname(keep), exist_ok=True)
if os.path.exists(page):
    shutil.copy2(page, keep)
elif os.path.exists(keep):
    shutil.copy2(keep, page)
    print("restored notes/index.html from .quarto/notes-index.html.bak")
