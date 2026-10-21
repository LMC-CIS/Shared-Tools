# Academic Tools in Development

A static community catalog where college faculty and staff share tools and resources for academic use: bookmarklets, AI skills, guides, workflows, small apps, and browser extensions.

> A community effort led by Lake Michigan College CIS faculty. Not an official college product.

- **Live site:** https://lmc-cis.github.io/Shared-Tools/
- **Contributors:** see [CONTRIBUTING.md](CONTRIBUTING.md) or the site's Contribute page.
- **This README** is for maintainers.

Everything is plain HTML, CSS, and JavaScript with no framework. Node is used only for checking the catalog and building one index file.

---

## Contents

1. [How the site works](#how-the-site-works)
2. [Repository layout](#repository-layout)
3. [tool.json fields](#tooljson-fields)
4. [Adding a tool](#adding-a-tool): web editor, local Git, hosted vs. linked, and email submissions
5. [Changing status or retiring a tool](#changing-status-or-retiring-a-tool)
6. [Automation](#automation)
7. [Enabling GitHub Pages](#enabling-github-pages)
8. [Recommended branch protection](#recommended-branch-protection)
9. [Base path and switching to a custom domain](#base-path-and-switching-to-a-custom-domain)
10. [Previewing locally](#previewing-locally)
11. [Editing site pages and settings](#editing-site-pages-and-settings)
12. [Rules for everything in this repo](#rules-for-everything-in-this-repo)

---

## How the site works

1. Each tool has a folder at `catalog/<slug>/` containing a `tool.json` file. It can also have a `README.md` (a longer description) and any files the tool hosts here.
2. When `main` changes, a GitHub Action does the following:
   - checks every `tool.json`
   - builds `catalog/index.json`, which lists every tool
   - copies the site into `_site/` and publishes it to GitHub Pages
3. The home page (`index.html`) reads `catalog/index.json` to draw the cards, filters, and search. Each tool's page is `tool.html?id=<slug>`. There is one page file for every tool, so adding a tool never means writing HTML.

`catalog/index.json` and `_site/` are generated during the build and are **not** committed.

## Repository layout

```
index.html, tool.html          Home (cards, filters, search) and tool detail page
about.html, disclaimer.html,   Static pages
license.html, contribute.html,
404.html
assets/css/site.css            The only stylesheet (light/dark colors at the top)
assets/js/                     common.js (shared), catalog.js (home), tool.js (detail),
                               markdown.js (safe Markdown renderer), theme-init.js
catalog/<slug>/tool.json       One per tool (required)
catalog/<slug>/README.md       Long description (optional)
catalog/<slug>/...             Hosted files (optional)
schema/tool.schema.json        Rules for tool.json (JSON Schema)
templates/tool.json            Copy-paste starting point
scripts/validate.mjs           Checks the catalog; plain-language errors
scripts/build-index.mjs        Builds _site/ and catalog/index.json
scripts/check-links.mjs        Checks linked-source URLs
scripts/serve.mjs              Local preview server
site.config.json               Base path, repo URL, contact email, form URL
.github/workflows/             validate.yml (pull requests), deploy.yml (Pages)
.github/pull_request_template.md   Contribution checklist
```

## tool.json fields

Start from [`templates/tool.json`](templates/tool.json). Rules are enforced by [`schema/tool.schema.json`](schema/tool.schema.json).

| Field | Required | What to put |
|---|---|---|
| `name` | yes | Display name (3–80 characters). |
| `summary` | yes | One or two sentences for the card (10–200 characters). |
| `type` | yes | `bookmarklet`, `skill`, `guide`, `workflow`, `app`, `extension`, or `other`. Controls the how-to-use instructions shown. |
| `audience` | yes | List with any of `students`, `faculty`, `staff`, e.g. `["faculty", "staff"]`. |
| `runsOn` | yes | List of systems as free text, e.g. `["Canvas", "Chrome"]`. Used for the "Runs on" filter, so reuse existing spellings. |
| `author` | yes | Who to credit. |
| `contact` | yes | Email address or `https://` link. |
| `version` | yes | Free text, e.g. `"0.1.0"`. |
| `status` | yes | `active`, `experimental`, `unmaintained`, or `retired`. |
| `lastTested` | yes | Date as `"YYYY-MM-DD"`, or `null` if never tested. |
| `source` | linked tools | `https://` link to where the code lives. |
| `files` | hosted tools | List of files in this folder, e.g. `["bookmarklet.js"]`. |
| `primaryFile` | no | Which of `files` the main button uses. Defaults to the first one. |
| `bookmarkletCode` | linked bookmarklets | `https://` link to the raw JavaScript (e.g. on `raw.githubusercontent.com`), so the drag button can be built. |
| `dataHandling` | yes | One sentence on what data the tool reads, stores, or sends. |
| `license` | yes | e.g. `MIT` (code) or `CC-BY-4.0` (documents). |
| `ferpaConfirmed` | yes | Must be `true`. |
| `tags` | no | Extra search keywords. |
| `todo` | no | `true` marks a placeholder and shows a "Placeholder" badge. |

Every tool needs at least one of `source` or `files`. A tool can have both, for example a short guide hosted here plus a link to a full repo.

The validator also checks the following:
- Folder names are lowercase with hyphens.
- Every listed file exists.
- There are no compiled programs or archives (`.exe`, `.dmg`, `.msi`, `.crx`, `.zip`, …). Apps must link to source code.
- Nothing looks like a password, API key, or token.

It also warns about real-looking email addresses inside hosted files. Addresses at `example.org`, `example.com` and similar are fine.

## Adding a tool

### Way 1: GitHub web editor (no command line)

1. On GitHub, open the [`catalog`](catalog) folder and choose **Add file → Create new file**.
2. Name it `my-tool-name/tool.json`. Typing the `/` creates the folder. Use lowercase letters, numbers and hyphens.
3. Paste in [`templates/tool.json`](templates/tool.json) and fill it in. For a linked tool, replace `"files": [...]` with `"source": "https://…"`.
4. Optional: in the same folder, **Add file → Create new file** for a `README.md` description, or **Add file → Upload files** for hosted files.
5. **Commit changes → Create a new branch for this commit → Propose changes → Create pull request.**
6. Wait about a minute for the **Validate catalog** check. If it fails, click **Details**: the summary lists what to fix. Edit the file on the same branch (pencil icon) and commit again; the check re-runs on its own.
7. Another maintainer approves and merges. The site updates a minute or two after the merge.

### Way 2: Local Git

```bash
git clone https://github.com/LMC-CIS/Shared-Tools.git
cd Shared-Tools
npm ci                                   # once; installs the validator
git switch -c add-my-tool
mkdir catalog/my-tool-name
cp templates/tool.json catalog/my-tool-name/tool.json
# edit tool.json, add README.md and any files
npm run validate                         # plain-language check
npm start                                # build + preview at http://localhost:8080/Shared-Tools/
git add catalog/my-tool-name
git commit -m "Add My Tool Name"
git push -u origin add-my-tool           # then open a pull request on GitHub
```

### Hosted vs. linked

Visitors can't tell the two kinds apart. Both get the same card and detail page, and the "View source code" link goes either to the tool's folder here or to its own repo.

| | Hosted | Linked |
|---|---|---|
| Where the code lives | `catalog/<slug>/` in this repo | Its own repo or website |
| Required field | `files` | `source` |
| Good for | Bookmarklets, single-file skills, guides, workflow docs | Apps, extensions, anything with its own releases or issues |
| Verified by | The build (files must exist) | Weekly link check |

For a **linked bookmarklet**, also set `bookmarkletCode` to the raw `.js` URL so the drag-to-bookmarks button works.

**Bookmarklet files:** write readable JavaScript in `bookmarklet.js`. The site wraps and encodes it into a `javascript:` link. If the file already starts with `javascript:`, it is used unchanged.

### Adding a tool someone emailed or submitted by form

1. Check their submission against the checklist (in the PR template and on the Contribute page).
2. Add it with Way 1 or Way 2. Put their name in `author` and the contact address they want shown in `contact`.
3. In the pull request, fill in "Submitted on behalf of someone else" and confirm they agreed to the license.
4. Do **not** commit anything they sent that contains real student data, credentials, or internal addresses.

## Changing status or retiring a tool

Edit `catalog/<slug>/tool.json` (pencil icon on GitHub), change the field, and open a pull request.

- **`active`**: works and is maintained.
- **`experimental`**: early or in progress.
- **`unmaintained`**: may still work, but nobody is updating it. The detail page shows a notice.
- **`retired`**: no longer recommended. It is hidden from the home page by default (visitors can tick "Retired" to see it), and the detail page still works so old links don't break.

Also update `version` and `lastTested` when someone re-tests a tool. To remove a tool completely, delete its folder. Retiring is usually better, because removing it breaks existing links.

## Automation

| Workflow | When | What |
|---|---|---|
| `validate.yml` | Every pull request | `npm run validate`, then a test build. Fails with plain-language messages in the run summary and on the "Files changed" tab. |
| `deploy.yml` | Push to `main`, every Monday 09:17 UTC, manual | Validates, builds, checks every linked `source`/`bookmarkletCode` URL, and deploys to Pages. |

**Link check.** Broken links never fail the deploy. They are listed in the run's **Summary** and show a "Link may be broken" badge on the card. Each card shows **Last verified**:
- Hosted tools: the date of the last build.
- Linked tools: the date of the last successful link check.

To re-check now, open **Actions → Build and deploy site → Run workflow**. You can also run `npm run check-links` locally.

The placeholder At-Risk Early Warning Dashboard links to a repo that doesn't exist yet, so it is **expected** to show as broken.

## Enabling GitHub Pages

1. Go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**. Don't choose "Deploy from a branch".
3. Go to **Actions → Build and deploy site → Run workflow** (or push to `main`).
4. When it finishes, the deploy job shows the site URL: https://lmc-cis.github.io/Shared-Tools/.

If the deploy job says the `github-pages` environment is protected, open **Settings → Environments → github-pages** and allow the `main` branch.

## Recommended branch protection

Set this up once, after the first push. Go to **Settings → Rules → Rulesets → New branch ruleset** (or **Settings → Branches → Add rule**):

- **Target:** the default branch (`main`).
- **Require a pull request before merging**, with **1 required approval**.
- Turn on **Dismiss stale approvals when new commits are pushed**.
- **Require status checks to pass:** add **validate** (from "Validate catalog"). It appears in the list after it has run once on a pull request.
- **Block force pushes** and **Restrict deletions**.
- Optional: leave admins able to bypass for emergencies, or add maintainers to the bypass list.

Casual contributors without write access can still propose changes. GitHub forks the repo for them automatically in the web editor.

## Base path and switching to a custom domain

All links, styles, scripts and data requests use **relative paths**, so the same files work at `https://lmc-cis.github.io/Shared-Tools/`, at a custom domain's root, and locally.

There is **one** setting: `basePath` in [`site.config.json`](site.config.json), currently `"/Shared-Tools/"`. It is used only for:
- the `404.html` page, which can be shown at any URL depth and so needs an absolute base
- the local preview server, which serves the site under the same path as Pages

**To switch to a custom domain** (e.g. `tools.example.edu`):

1. In `site.config.json`, set `"basePath": "/"`.
2. **Settings → Pages → Custom domain**: enter the domain and save. With the Actions source, no `CNAME` file is needed.
3. At your DNS provider, add a `CNAME` record pointing the domain to `lmc-cis.github.io`.
4. Once the certificate is issued, tick **Enforce HTTPS**.
5. Optional: update the absolute links that mention `lmc-cis.github.io` in this README, `LICENSE-docs.md` and `schema/tool.schema.json` (`$id`).

If the repo is ever renamed, update `basePath` and `repoUrl` in `site.config.json`.

## Previewing locally

You need Node 20 or newer.

```bash
npm ci
npm start          # validates, builds _site/, serves http://localhost:8080/Shared-Tools/
```

The pages fetch `catalog/index.json`, so opening the `.html` files directly from disk won't show the tools. Use `npm start`. To use another port, run `PORT=3000 npm run serve`.

## Editing site pages and settings

- **Contact email and submission form:** edit `contactEmail` and `submissionFormUrl` in `site.config.json`. The Contribute page reads them from there. While they contain `TODO`, the page shows a reminder to maintainers. **Also update the fallback text in `contribute.html`**, which is shown if JavaScript is off.
- **Header and footer:** these are written out in each `.html` file so pages work without JavaScript. If you change them, change all seven pages.
- **Colors:** the light and dark palettes are at the top of `assets/css/site.css`. Keep text contrast at 4.5:1 or higher (WCAG AA).
- **Disclaimer and License** pages are marked **DRAFT**. Remove the draft notice once maintainers approve the wording.
- The site has **no tracking or analytics**. Please keep it that way. A Content-Security-Policy in each page blocks inline and third-party scripts.

## Rules for everything in this repo

- No real student data, names, IDs, or grades, including in screenshots. Use made-up names like "Student A".
- No credentials, tokens, API keys, internal hostnames, or institution-only endpoints.
- No compiled binaries. Apps and extensions link to (or include) source code.
- Use `example.org` for placeholder email addresses and links.
