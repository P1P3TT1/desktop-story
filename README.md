> This is a work in progress that was first put together using Claude Sonnet 4 and over year later continued with Opus 5.5. I was intrigued on the idea of creating web-based storytelling that would not be in a traditional form of just pages and plain text. AI is a nice way to test things with small effort. -Pipe

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
- **A story that reacts**: password-locked folders, emails that arrive as you discover things, a reply choice and two endings. Progress is saved in the reader's browser.
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
| `content/endings/` | `title`, `requires` (when it plays); the text appears paragraph by paragraph on a black screen |

Example, `content/emails/07-sister.md`:

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

## 🔓 Making the story react

Any file can use these extra header fields. They refer to other items by their **ID**: the folder plus the file name without `.md`, e.g. `emails/02-mom` or `photos/hidden/02-two-girls`.

| Field | What it does |
| --- | --- |
| `requires: [documents/02-letter-draft, emails/02-mom]` | The item stays hidden until the reader has opened all of these. |
| `requires: [emails/06-last-chance:pier]` | `ID:choice` means "after the reader picked this reply". |
| `delay: 20` | Wait this many seconds after the requirements are met. New emails pop up with a notification. An email without a `date` gets the story clock's time when it arrives. |
| `password: [B-7, Room B-7]` and `hint: ...` | Locks the item until one of the passwords is typed in. Capitals, spaces and punctuation don't matter. Works in Documents, Photos and websites. |
| `opens: hidden` | Turns a Documents or Photos item into a folder that shows the files in the `hidden/` subfolder next to it. |
| `choices: [pier: I'll be there, stay: Leave me alone]` | Emails only. The reader can reply once by picking one of these. The word before `:` is what `requires` refers to. Don't use commas inside a choice. |

Example: an email that arrives 30 seconds after the reader has seen both the letter and Mom's email:

```
---
fromName: Sarah Chen
from: Sarah Chen <sarah.chen@email.com>
subject: Don't go
requires: [emails/04-mom-the-photos, documents/02-letter-draft]
delay: 30
---
You read my letter. I can tell.
```

The current chain:
1. Unlock the hidden folder in Photos. The password is in the letter and on the forum.
2. Opening a photo there brings Mom's email, which also unlocks an archived newspaper article.
3. The letter and Mom's email bring "Don't go".
4. That email and the medical records bring "Tonight", with the reply choice.
5. Each reply plays its ending.

## ▶️ Running it

The story loads its content files with JavaScript. Browsers don't allow that when `index.html` is opened by double-clicking, so preview it through the included local server (needs [Node.js](https://nodejs.org)):

```
npm start
```

Then open http://localhost:8000. New and edited content files show up when you refresh the page. The terminal lists problems in the story, such as a `requires` pointing to a file that doesn't exist. To check the story without starting the server, run `npm run build`.

**Testing the story while you write it:**
- http://localhost:8000/?fast makes new content arrive immediately instead of waiting for its `delay`.
- http://localhost:8000/?debug unlocks everything, saves nothing, and lists the endings in the Start menu so you can watch each one.
- **Start → Restart story** erases your progress so you can play from the beginning.

**Publishing:** the workflow in `.github/workflows/pages.yml` publishes the site to GitHub Pages on every push to `main`. It builds `content/manifest.json` (the list of content files) as it goes. If the story has problems, the publish stops and the live site stays as it was; the problems are listed in the repository's Actions tab. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

## 📱 Compatibility

Works best on desktop browsers. On phones and tablets, windows shrink to fit the screen and icons open with a single tap.

---

*Dive into Sarah's digital life and uncover the truth behind Project Mirror...*
