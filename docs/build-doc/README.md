# Build documentation generator

Single source of truth for the project's build documentation. Running it writes
**both** `../build-documentation.pdf` and `../BUILD_DOCUMENTATION.md` so the two
never drift apart.

## Regenerate

```bash
cd docs/build-doc
npm install   # first time only
npm run build # -> docs/build-documentation.pdf + docs/BUILD_DOCUMENTATION.md
```

## Add a new phase / enhancement

Edit `generate.mjs`:

1. Add a milestone status map (e.g. `const M7 = { ...M6, newStep: "live" };`).
   Each key maps a journey step to `live` | `config` | `device` | `todo`.
2. Add content blocks to the `BLOCKS` array — `h2(...)`, `para(...)`,
   `bullets([...])`, `callout(title, [...])`, and `journey(M7, "caption")` for
   the updated flowchart snapshot.
3. Append the change to the `commits` array.
4. `npm run build`, then commit the regenerated `.pdf` and `.md`.

The flowchart is drawn as vector graphics in the PDF and as a status table in
the Markdown, both from the same status map — so a status change is a one-line
edit reflected in both formats.
