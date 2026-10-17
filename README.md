> This is a work in progress that was put together using Claude Sonnet 4. I was intrigued on the idea of creating web-based storytelling that would not be in a traditional form of just pages and plain text. AI is a nice way to test things with small effort. -Pipe

# Desktop Story - Interactive Fiction Experience

An immersive interactive fiction experience presented as a desktop computer interface. Explore the mysterious disappearance of Sarah Chen through her personal computer files, emails, and browsing history.

## 🖥️ Overview

This project simulates a complete desktop environment where players can investigate a psychological thriller mystery by examining:

- **Personal emails** with disturbing revelations from doctors, family, and mysterious contacts
- **Research documents** detailing identity displacement phenomena and classified experiments
- **Diary entries** chronicling Sarah's deteriorating mental state
- **Web browser** with news articles, forums, and government sites
- **Hidden files** containing classified medical records and warning letters

## 🎮 Features

- **Fully Interactive Desktop**: Draggable windows, working taskbar, real-time clock
- **Immersive Storytelling**: Uncover the mystery through authentic-feeling digital artifacts
- **Multiple Investigation Paths**: Emails, documents, diary entries, and web browsing
- **Atmospheric Design**: Retro desktop aesthetic with modern web technologies
- **Non-linear Narrative**: Piece together the story in any order you choose

## 🎭 Story

Sarah Chen, a research scientist, begins experiencing disturbing symptoms - lost time, unfamiliar belongings in her apartment, and dreams of alternate lives. As players explore her computer, they uncover evidence of a government conspiracy involving quantum consciousness experiments, parallel timelines, and identity displacement.

The story explores themes of identity, reality, and the question: *What if someone else was living your life?*

## 🛠️ Technical Details

- **Pure HTML/CSS/JavaScript** - No frameworks or dependencies
- **Story content lives in its own files** under `content/`: one Markdown file per email, document, diary entry, photo, website and search result
- **Window manager**: drag (mouse or touch), click to bring to front, minimize, maximize (button or double-click the title bar), taskbar buttons and a Start menu
- **Simulated web browser** with an address bar, search, and working Back/Forward/Refresh history
- **Custom SVG icons** for authentic desktop feel

```
index.html          page shell
css/desktop.css     styles
js/                 desktop, windows, apps and browser code
content/            the story (see below)
tools/              manifest builder and local preview server
```

## ✍️ Adding content

Every item is a `.md` file with a short header between `---` lines, followed by the text.
Drop a new file in the right folder and it appears in the story. No code changes are needed.

| Folder | Header fields |
| --- | --- |
| `content/emails/` | `fromName` (inbox list), `from`, `to` (optional), `subject`, `date`, `preview` (optional), `unread: true` (optional) |
| `content/documents/` | `name` (file label), `title`, `date` or `subtitle`, `banner` (optional red warning box) |
| `content/diary/` | `date` |
| `content/photos/` | `name`, `title`, `image` (optional image file in the same folder), `icon` (`photo` or `folder`) |
| `content/web/sites/` | `url`, `aliases` (other addresses), `template` (`news`, `forum`, `error` or `plain`), `title`, `tagline`, `code` (error pages) |
| `content/web/search/` | `keywords`, `title`, `url` (which site the result opens); the text is the snippet |

Example, `content/emails/04-sister.md`:

```
---
fromName: Lily
from: Lily Chen <lily.chen@email.com>
subject: Call me back
date: 2024-03-29 21:10
unread: true
---
Sarah,

Mom is freaking out. Please just text one of us.
```

- **Dates** are written `2024-03-29` or `2024-03-29 21:10`. Emails sort newest first and diary entries oldest first. Other folders follow the file names, so start them with numbers (`01-`, `02-`, ...).
- **Values** containing square brackets need quotes, e.g. `from: "[ENCRYPTED SENDER]"`. Lists look like `[sarah chen, missing, identity]`.
- **Text formatting:** `||hidden text||` is redacted (revealed on hover), `**bold**`, `*italic*`, and `[link text](mirrortruth.forum)` opens that address in the story's web browser.
- **Website pages** are split into articles or forum posts with `## Heading` lines. A `meta: ...` line right under a heading becomes its byline or date.
- **Drafts:** files whose name starts with `_` are ignored.
- **General settings** live in `content/story.json`: the window titles, the search engine's hint text, and `clockStart`, the moment in the story the taskbar clock starts from.

## ▶️ Running it

The story loads its content files with JavaScript. Browsers don't allow that when `index.html` is opened by double-clicking, so preview it through the included local server (needs [Node.js](https://nodejs.org)):

```
node tools/serve.mjs
```

Then open http://localhost:8000. New and edited content files show up when you refresh the page.

**Publishing:** the workflow in `.github/workflows/pages.yml` publishes the site to GitHub Pages on every push to `main`, and builds `content/manifest.json` (the list of content files) as it goes. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 📱 Compatibility

Works best on desktop browsers. On phones and tablets, windows shrink to fit the screen and icons open with a single tap.

---

*Dive into Sarah's digital life and uncover the truth behind Project Mirror...*
