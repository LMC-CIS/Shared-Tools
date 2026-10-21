# Contributing

Thanks for sharing your work. There are two ways to contribute.

## 1. Add it yourself on GitHub (no command line)

1. Open the [`catalog`](catalog) folder and choose **Add file → Create new file**. If you don't have write access, GitHub will offer to fork the repo for you. Accept.
2. Name the file `your-tool-name/tool.json` (lowercase letters, numbers, hyphens).
3. Paste in [`templates/tool.json`](templates/tool.json) and fill it in. Field meanings are in the [README](README.md#tooljson-fields).
4. Optionally add a `README.md` with a longer description, and upload any files the tool needs (list them under `"files"`). If the code lives in its own repo, use `"source": "https://…"` instead.
5. **Commit changes → Create a new branch → Propose changes → Create pull request**, then tick every item in the checklist.
6. An automatic check explains anything that needs fixing. A maintainer reviews and merges.

## 2. Send it to a maintainer

Use the contact link or submission form on the site's **Contribute** page. Include the name, a summary, the type, who it's for, what it runs on, the files or a link, one sentence on data handling, and how you want to be credited.

## Checklist (required for every submission)

- [ ] FERPA and student privacy have been considered.
- [ ] No credentials, passwords, API keys, or access tokens are included.
- [ ] No real student data appears in examples or screenshots.
- [ ] Data handling is described.
- [ ] The author is credited.
- [ ] Tested in the stated environment.

## Good to know

- There's no rigid template beyond `tool.json`. Write your `README.md` however suits your tool.
- Don't upload compiled programs (`.exe`, `.dmg`, `.crx`, `.zip`, …). Link to source code instead.
- Shared code is MIT-licensed and documentation is CC BY 4.0 unless you set a different `license`. See [LICENSE](LICENSE) (draft).
