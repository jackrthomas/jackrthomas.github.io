"""Runs after `quarto render`.

Quarto has just built the notes into _build/ (never into the live site). This script
copies ONLY the notes pages into place and merges them into the shared files, so the
rest of the site (index.html, events.html, teaching.html, site_libs/, styles.css, the
11 older notes ...) is never rewritten.

What it may change:
  notes/index.html                       the Notes listing page
  notes/libs/                            style/script files used by the pages Quarto builds
  notes/posts/<name>/<page>.html         each note that has a source file (.qmd/.ipynb)
  notes/posts/<name>/<page>_files/       figures made by a notebook
  notes/index.xml                        the RSS feed: new notes are ADDED (old items are kept)
  search.json, sitemap.xml, listings.json   new notes are ADDED (old entries are kept)
Everything else is left alone. A note folder with an old built index.html but no source
file (the 11 older notes) is refused.
"""
import datetime, email.utils, json, os, re, shutil, sys

SITE_URL = "https://jackrthomas.github.io"
root = os.path.abspath(os.environ.get("QUARTO_PROJECT_DIR", os.getcwd()))
build = os.path.abspath(os.environ.get("QUARTO_PROJECT_OUTPUT_DIR", os.path.join(root, "_build")))
backup = os.path.join(root, ".quarto", "backup-before-last-render")
SOURCE_EXT = (".qmd", ".ipynb", ".md", ".rmd")


def rel(p):
    return os.path.relpath(p, root).replace("\\", "/")


def read(path):
    with open(path, "r", encoding="utf-8", newline="") as f:
        return f.read()


def write(path, text):
    # keep the file's existing line endings (these files use Windows CRLF)
    if os.path.exists(path):
        with open(path, "rb") as f:
            if b"\r\n" in f.read():
                text = text.replace("\r\n", "\n").replace("\n", "\r\n")
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def save_backup(path):
    if os.path.exists(path):
        dest = os.path.join(backup, rel(path))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copy2(path, dest)


# ---- which pages did Quarto produce this time? ------------------------------------
outputs = []
for line in os.environ.get("QUARTO_PROJECT_OUTPUT_FILES", "").splitlines():
    line = line.strip()
    if not line:
        continue
    p = line if os.path.isabs(line) else os.path.join(root, line)
    p = os.path.abspath(p)
    if p.lower().endswith(".html") and p.startswith(build + os.sep):
        outputs.append(os.path.relpath(p, build).replace("\\", "/"))
if not outputs:
    print("[notes] nothing rendered, nothing to copy")
    sys.exit(0)

if os.path.exists(backup):
    shutil.rmtree(backup)

copied, refused = [], []
for out in outputs:
    if not out.startswith("notes/"):
        refused.append(out + "  (outside notes/)")
        continue
    src = os.path.join(build, out)
    if "<body" not in read(src):
        # Quarto leaves an empty stub for a note marked "draft: true": never publish it
        refused.append(out + "  (draft: left out)")
        continue
    dst = os.path.join(root, out)
    folder = os.path.dirname(dst)
    stem = os.path.splitext(os.path.basename(out))[0]
    if out != "notes/index.html":
        # a note: its folder must contain a source file for this page
        has_source = any(os.path.exists(os.path.join(folder, stem + e)) for e in SOURCE_EXT)
        if not has_source:
            refused.append(out + "  (no source file next to it: left untouched)")
            continue
    save_backup(dst)
    os.makedirs(folder, exist_ok=True)
    shutil.copy2(src, dst)
    copied.append(out)
    figs = os.path.join(os.path.dirname(src), stem + "_files")
    if os.path.isdir(figs):
        target = os.path.join(folder, stem + "_files")
        if os.path.isdir(target):
            shutil.rmtree(target)  # figures of a note Quarto just rebuilt
        shutil.copytree(figs, target)

# ---- the style/script files the new pages use (a folder only Quarto writes) ---------
libs_src = os.path.join(build, "notes", "libs")
if copied and os.path.isdir(libs_src):
    libs_dst = os.path.join(root, "notes", "libs")
    if os.path.isdir(libs_dst):
        shutil.rmtree(libs_dst)
    shutil.copytree(libs_src, libs_dst)

# ---- search.json: add/replace the entries of the pages just built ---------------------
new_pages = [c for c in copied]
sj_new = os.path.join(build, "search.json")
sj = os.path.join(root, "search.json")
if new_pages and os.path.exists(sj_new):
    old = json.loads(read(sj)) if os.path.exists(sj) else []
    fresh = [e for e in json.loads(read(sj_new)) if e["href"].split("#")[0] in new_pages]
    # drop entries of pages that are no longer built (e.g. a note switched back to draft)
    built_notes = {p for p in new_pages}
    old = [e for e in old if e["href"].split("#")[0] not in built_notes]
    save_backup(sj)
    write(sj, json.dumps(old + fresh, indent=2, ensure_ascii=False))

# ---- sitemap.xml: add new URLs, refresh the date of rebuilt ones ---------------------
sm = os.path.join(root, "sitemap.xml")
if new_pages and os.path.exists(sm):
    text = read(sm)
    now = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    save_backup(sm)
    for page in new_pages:
        loc = f"<loc>{SITE_URL}/{page}</loc>"
        if loc in text:
            i = text.index(loc)
            a = text.index("<lastmod>", i)
            b = text.index("</lastmod>", a)
            text = text[: a + 9] + now + text[b:]
        else:
            entry = f"  <url>\n    {loc}\n    <lastmod>{now}</lastmod>\n  </url>\n"
            text = text.replace("</urlset>", entry + "</urlset>")
    write(sm, text)

# ---- listings.json: record the new notes in the Notes listing ---------------------------
lj = os.path.join(root, "listings.json")
if new_pages and os.path.exists(lj):
    data = json.loads(read(lj))
    for lst in data:
        if lst.get("listing") == "/notes/index.html":
            items = lst.get("items", [])
            for page in reversed([p for p in new_pages if p != "notes/index.html"]):
                if "/" + page not in items:
                    items.insert(0, "/" + page)
            lst["items"] = items
    save_backup(lj)
    write(lj, json.dumps(data, indent=2, ensure_ascii=False))


# ---- notes/index.xml (the RSS feed): add the new notes in date order, keep every old item untouched ----
feed_new = os.path.join(build, "notes", "index.xml")
feed = os.path.join(root, "notes", "index.xml")
rebuilt_notes = [c for c in copied if c != "notes/index.html"]
if rebuilt_notes and os.path.exists(feed_new) and os.path.exists(feed):
    old = read(feed)

    def feed_link(item):
        m = re.search(r"<link>(.*?)</link>", item, re.S)
        return m.group(1).strip() if m else ""

    def feed_date(item):
        m = re.search(r"<pubDate>(.*?)</pubDate>", item, re.S)
        try:
            return email.utils.parsedate_to_datetime(m.group(1).strip()) if m else None
        except Exception:
            return None

    # Quarto only knows real links for the notes that have a source file; the hand-listed old notes
    # come out with the home page as their link, so they are ignored here.
    built_urls = {f"{SITE_URL}/{pg[:-len('index.html')]}" for pg in rebuilt_notes}
    fresh_items = [it for it in re.findall(r"<item>.*?</item>", read(feed_new), re.S) if feed_link(it) in built_urls]
    if fresh_items:
        save_backup(feed)
        for it in fresh_items:
            link = feed_link(it)
            existing = [m for m in re.finditer(r"<item>.*?</item>", old, re.S) if feed_link(m.group(0)) == link]
            if existing:                                           # a note that was rebuilt: take out its old item, then place the new one by date
                m = existing[0]
                end = m.end()
                while end < len(old) and old[end] in "\r\n":
                    end += 1
                old = old[: m.start()] + old[end:]
            nd = feed_date(it)
            pos = None
            for m in re.finditer(r"<item>.*?</item>", old, re.S):  # first older item: the new one goes just before it
                od = feed_date(m.group(0))
                if nd is not None and od is not None and od < nd:
                    pos = m.start()
                    break
            if pos is None:
                pos = old.rindex("</channel>")
            gap = "\r\n" if "\r\n" in old else "\n"
            old = old[:pos] + it.replace("\r\n", "\n").replace("\n", gap) + gap + old[pos:]
        dates = [d for d in (feed_date(m.group(0)) for m in re.finditer(r"<item>.*?</item>", old, re.S)) if d]
        if dates:
            newest = email.utils.format_datetime(max(dates).astimezone(datetime.timezone.utc), usegmt=True)
            old = re.sub(r"<lastBuildDate>.*?</lastBuildDate>", f"<lastBuildDate>{newest}</lastBuildDate>", old, count=1, flags=re.S)
        write(feed, old)
        print("[notes] RSS feed: added/updated", len(fresh_items), "item(s) in notes/index.xml")

print("[notes] copied into place:")
for c in copied:
    print("   ", c)
for r in refused:
    print("[notes] skipped:", r)
print("[notes] done. Not changed: index.html, events.html, teaching.html, site_libs/, styles.css, older notes.")
