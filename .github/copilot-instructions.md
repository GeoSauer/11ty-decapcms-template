# Copilot Instructions

This repository is an Eleventy + Nunjucks + Decap CMS template.

## Default Workflow

- Validate changes with `npm run build` before finalizing.
- Edit source files in `src/` only. Never treat `public/` as source of truth.
- Prefer minimal, targeted edits. Avoid broad formatting-only changes.

## Project Conventions

- Data files in `src/_data/` are exposed to templates by filename.
- Use JavaScript-identifier-friendly data filenames (for example, `projectOne.json`, not `project-one.json`).
- Keep template references aligned with those names (for example, `projectOne.title`).

## CMS Safety Rules

- Main CMS config is `src/admin/config.yml`.
- Preserve valid YAML indentation and list structure in `collections` and `files` blocks.
- Keep client-facing guardrails in place where present:
  - Character limits (`maxLength`)
  - List constraints (`min`/`max`)
  - Field hints (`hint`)
- If changing CMS schema, ensure matching data files under `src/_data/` still satisfy expected shapes.

## Content and Build Checks

- After content schema updates, verify pages still render:
  - `/`
  - `/about/`
  - `/project-one/`
  - `/project-two/`
  - `/reviews/`
  - `/blog/`
- Confirm `/admin/` still loads with no YAML parse errors.

## Documentation Sync

When behavior, paths, or conventions change, update `README.md` in the same task.
