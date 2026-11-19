# Writing a new note (Quarto)

Short version: put your note in a new folder under `notes/posts/`, then run `quarto render` in the
`personal-website` folder. The note is turned into a web page and appears on the Notes page.

## Add a note

1. Make a folder, e.g. `notes/posts/my-talk/`. The folder name becomes the web address
   (`.../notes/posts/my-talk/`). Use short lower-case names with hyphens.
2. Copy a template into it and call it `index.qmd` (or `index.ipynb` for a Jupyter notebook):
   - `notes/_template/new-note.qmd`  (text with maths, theorems, proofs)
   - `notes/_template/new-note.ipynb`  (a notebook; Quarto shows the outputs already stored in it,
     it does not re-run your cells)
3. Edit the block at the top (between the two `---` lines): `title`, `subtitle`, `description`, `date`,
   `categories` (choose from Talk, Group Meeting, Seminar, Conference, Poster, Thesis, Notes) and `author`.
   For the small picture on the Notes page, put `thumb.png` in the same folder and remove the `# ` in front of
   `image:`. Put pdfs and figures in the same folder and link to them by file name.
4. Open a terminal in the `personal-website` folder and run

       quarto render

   Nothing else is needed. It takes a few seconds.
5. Look at it: double-click `notes/posts/my-talk/index.html` (and `notes/index.html`). It opens straight from the
   disk. Maths and the Lato font need an internet connection, exactly like the old pages.
   (Use `quarto render`, not `quarto preview`; preview has not been tested with this setup.)
6. Happy? Push as usual (list of files below).

## What `quarto render` changes

It builds into a scratch folder `_build/` (ignored by git) and then copies in only:

- `notes/posts/<name>/index.html` for each note that has a source file (`index.qmd` or `index.ipynb`), plus
  `index_files/` (pictures made by a notebook);
- `notes/index.html` (the Notes page, rebuilt with the new note in date order, categories and year list);
- `notes/libs/` (style and script files used by these pages);
- three shared files, where the new notes are only ADDED and nothing is removed: `search.json` (site search),
  `sitemap.xml`, `listings.json`.

It never touches `index.html`, `events.html`, `teaching.html`, `404.html`, `styles.css`, `site_libs/`, `images/`,
`office/`, `globe/`, `teaching/` or the 11 older notes. A safety check refuses to overwrite a note folder that has
a built page but no source file. A copy of each page and each shared file it overwrote is kept in
`.quarto/backup-before-last-render/` until the next render.

The RSS feed `notes/index.xml` is kept up to date: each new note is added to it in date order (a note you edit and
render again is replaced, not duplicated), and the 11 older items are left exactly as they are. (This needs `feed: true`
in the listing of `notes/index.qmd` and `site-url` in `_quarto.yml`; both are set.)

Not updated: the "Updated: Oct 2026" text in the footer of the new pages (set in `_quarto.yml`, `page-footer`; the old
pages keep their own text).

## Files to `git add`

    git add notes/posts/my-talk notes/index.html notes/index.xml notes/libs search.json sitemap.xml listings.json

The first time (setting the workflow up) also add: `_quarto.yml`, `.gitignore`, `notes/index.qmd`,
`notes/_metadata.yml`, `notes/_nav-preview.html`, `notes/_proofs.html`, `notes/theme.scss`, `notes/_tools/`,
`notes/_template/`, `notes/posts/_metadata.yml`, `notes/README-quarto.md` and the draft folder
`notes/posts/group-meeting-draft/`. Do not add `_build/` or `.quarto/` (the `.gitignore` hides them).

## Drafts (not published yet)

`notes/posts/group-meeting-draft/` is the Group Meetings notebook (September 2025) copied from your old Quarto
book. It has `draft: true` in the first cell of `index.ipynb`, so `quarto render` leaves it out of the website, the
Notes page and the search. (It is a different, older version from the published `body-ordered` note, so it would
otherwise appear twice.) To publish it: open `index.ipynb`, delete the line `draft: true` in the first (raw) cell,
tidy the title/date/description, add a `thumb.png` if you like, run `quarto render`. The old book's other files
are kept, unused, in `group-meeting-draft/_original-book-files/`. Your original `Group Meetings` folder was copied,
not moved.

Any new note can be a draft the same way: add the line `draft: true`.

## About the 11 older notes (important)

The original Quarto source of the site is not on this computer; the folder holds only the built pages. So:

- The 11 older notes (`orthogonal-polynomials`, `locality`, `rHF`, `CT`, `screening-rhf`, `friedel-oscillations`,
  `body-ordered`, `locality-interatomic`, `phd-thesis`, `locality-poster`, `msc-thesis`) are fixed web pages. They
  cannot be re-rendered. To change one, edit its `index.html` by hand, or rebuild its source as a note (copy the
  text into a new `index.qmd` in the same folder; the next render then replaces its `index.html`).
- They appear on the Notes page because they are listed by hand at the top of `notes/index.qmd` (title, date,
  categories, picture). Change an entry there to change how it appears in the list. If you rebuild an old note
  from source, delete its hand-written entry so it is not listed twice.
- The pages Quarto builds look the same as the old ones (same theme, colours, navigation bar, banner, layout).
  `notes/theme.scss` reproduces the old theme. They use their own copy of the style/script files in `notes/libs/`,
  not `site_libs/`, so the old pages cannot be broken by a render. They were produced with Quarto 1.8.25 (the
  site was originally built with 1.10.18).
- Citations: put a `references.bib` in the note's folder and add `bibliography: references.bib` to its header.
  (The `bib.bib` at the top of the site is your publication list, not used for notes.)
