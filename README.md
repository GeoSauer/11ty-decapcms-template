# Eleventy + Decap CMS Website Template

A reusable starting point for building client websites with Eleventy, Nunjucks, Sass, and Decap CMS. It includes a demo site, editable content, page scaffolding, and checks for common issues before launch.

This template began with [CodeStitch's Intermediate Website Kit (SASS)](https://github.com/CodeStitchOfficial/Intermediate-Website-Kit-SASS). Thanks to CodeStitch for the original starter, demo components, and Eleventy plugins. It has since been customized with additional CMS controls, development utilities, and validation informed by building client sites.

## What is included

- **A demo site** with a home page, about, projects, reviews, blog, and contact pages, plus shared navigation, footer, and call to action.
- **Decap CMS** collections for blog posts, reviews, page content, business information, and shared CTA/footer content, with custom previews.
- **Page utilities** to create and remove scaffolded pages, including their data, navigation links, and CMS entries.
- **Build tooling** for Sass, PostCSS, JavaScript bundling, image optimization, production minification, and sitemap generation.
- **Quality checks** for page tooling, built routes and internal asset links, optional external links, and common launch placeholders. GitHub Actions runs tests and a build on pull requests and pushes to `main`.
- **Accessibility and metadata foundations**, including a skip link, reduced-motion support, page metadata, and configurable social-sharing images.

The demo is a starting point, not a finished production site. Replace its content and branding, configure a form provider and CMS authentication, and review the site before launch.

## Requirements

- Node.js 22 or newer and npm.
- Basic HTML, CSS, and JavaScript. Familiarity with [Eleventy](https://www.11ty.dev/), [Nunjucks](https://mozilla.github.io/nunjucks/), and [Decap CMS](https://decapcms.org/docs/intro/) is helpful.

## Quick start

1. Create a repository from this template and clone it locally.
2. Install dependencies and start the development servers:

   ```sh
   npm install
   npm start
   ```

3. Open the site at <http://localhost:8080/> and the CMS at <http://localhost:8080/admin/>. `npm start` runs Eleventy and the local Decap backend together.
4. Update `src/_data/clientData.json` with the business name, full production domain, contact details, social links, and default social-sharing image. These values are also editable under **Site Content > Business Info** in the CMS.
5. Replace the demo copy, images, logos, and favicons. Adjust shared colors and styles in `src/assets/sass/root.scss`.
6. Run `npm test` and review the launch checklist below before deploying.

**Edit source files, not `public/`.** Eleventy generates `public/`; changes made there can be overwritten by the next build. The `clean-build` and `test` commands delete and recreate that directory.

## Commands

| Command | Purpose |
| --- | --- |
| `npm start` | Run the Eleventy development server and local CMS backend. |
| `npm run build` | Build the production site into `public/`. |
| `npm run clean-build` | Delete `public/` and create a fresh production build. |
| `npm run preview` | Serve a production-mode build locally. |
| `npm test` | Run focused tests, a clean build, and the smoke check. |
| `npm run test:unit` | Run the page-utility and validation tests. |
| `npm run test:smoke` | Check an existing build's expected routes and root-relative links and assets. |
| `npm run test:links` | Check external HTTP/HTTPS links in an existing build. |
| `npm run check:launch` | Report known launch placeholders and setup issues. |
| `npm run create-page -- "Page Name"` | Create a scaffolded page and related files. |
| `npm run remove-page -- "Page Name"` | Remove a page created by the page utility. |
| `npm run remove-demo` | Move demo files to a backup and simplify the site. |
| `npm run remove-decap` | Remove the CMS, optionally removing the blog too. |
| `npm run remove-dark-mode` | Remove the template's dark-mode code. |

Build before running either link check. The external check requires network access and is not part of normal CI; HTTP 401, 403, and 429 are treated as reachable. To exclude known exceptions, set `EXTERNAL_LINK_CHECK_SKIP` to comma-separated URL substrings:

```sh
EXTERNAL_LINK_CHECK_SKIP="example.com,another-site.com" npm run test:links
```

`check:launch` is an opt-in check: it exits with an error when it finds known placeholders or setup issues, but it does not block ordinary builds. It cannot catch every placeholder or prove that a live integration works.

## Content and CMS

### Editing content

The local CMS is configured in `src/admin/config.yml`. Its collections include:

- **Blog** and **Reviews**, stored under `src/content/`.
- **Site Content**, including homepage, about, project pages, business information, and shared content.
- **Shared Content**, which controls the reusable CTA text and link and the footer description through `src/_data/sharedContent.json`.

The CMS supports local editing when `npm start` is running. To use it on a deployed site, configure a production backend separately; the checked-in `git-gateway` block is a placeholder for local setup, not a complete production authentication setup.

Data files in `src/_data/` become available to Eleventy templates by filename. `client.js` exposes the contents of `clientData.json` as `client`, alongside the production-mode flag. For new data files, use identifier-friendly names such as `projectOne.json` rather than `project-one.json`.

Page-specific metadata lives in front matter. The base layout uses the page's `image` when provided, otherwise `client.socialImage`; internal image paths are converted to absolute URLs for social metadata. Use a valid full domain including `https://` in `clientData.json`, and replace the default social image with one appropriate for the site.

### Markdown in templates

The `markdown` filter renders Markdown stored in data files:

```njk
{{ content | markdown | safe }}
```

Raw HTML in the input is escaped, line breaks are supported, and recognizable URLs are linked. Treat content and links as editorial input and review them before publishing.

### Production CMS setup

You can use a compatible Decap backend and authentication provider; [DecapBridge](https://decapbridge.com/) is one option. For a DecapBridge setup:

1. Put the new site repository on GitHub and deploy the site.
2. Create a site in the DecapBridge dashboard and follow its current instructions to connect the repository and configure access.
3. Replace the placeholder `backend` block in `src/admin/config.yml` with the provider's configuration. Update `logo_url` and any other site-specific CMS settings.
4. Deploy the change, invite the intended editors, and verify that an editor can sign in, save content, and see the resulting change on the site.

Keep credentials out of the repository. Restrict any provider token to the necessary repository and permissions, and follow the provider's current documentation for setup and token rotation.

## Creating and removing pages

Create one or more pages with comma-separated names:

```sh
npm run create-page -- "Services, Our Team"
```

You can also run `npm run create-page` without arguments to start a wizard. It asks for page names and shows the slugs before creating anything. The argument form remains available for scripts and automation and does not prompt.

For each page, the utility creates an HTML page from `src/content/pages/_template.txt`, a Sass file, and an identifier-friendly JSON data file. It adds header and footer links and, when the CMS is present, a Site Content entry and preview. Edit the scaffold's copy, metadata, styles, and layout to suit the site.

The script rejects invalid names and collisions rather than overwriting existing files. It tracks generated pages in `scripts/generated-pages.json`; keep that file and the generated markers in page, navigation, and CMS files if you want to use the removal utility:

```sh
npm run remove-page -- "Services, Our Team"
```

Run `npm run remove-page` without arguments to choose registered generated pages by number or name (or choose `all`). The wizard lists what it will remove and requires confirmation. The argument form remains available for scripts and automation and does not prompt.

Removal deletes the generated page, Sass, and data files and their managed navigation and CMS entries. It is intended for pages created by this utility, not existing demo pages or other manually created pages. Review your changes or commit them first if you may need to recover content.

### Removing optional features

`remove-demo` and `remove-decap` prompt before making changes and move selected files into `scripts/deleted/`. They stop if a matching backup already exists instead of overwriting it; move or restore that backup before retrying. Review the resulting site and run a build afterward.

After removing Decap, synchronize the lockfile before using `npm ci`:

```sh
npm install --package-lock-only
```

`remove-dark-mode` removes dark-mode code. As with the other customization scripts, review its changes before committing.

## Project layout

```text
.
├── .eleventy.js                 Eleventy configuration, plugins, and filters
├── .github/workflows/ci.yml     Build and validation workflow
├── netlify.toml                 Netlify build and cache configuration
├── scripts/                     Page, removal, validation, and test utilities
├── src/
│   ├── _data/                   Business, page, and shared content data
│   ├── _includes/               Layouts, sections, and components
│   ├── admin/                   Decap configuration and previews
│   ├── assets/                  Source images, fonts, SVGs, JavaScript, and Sass
│   ├── config/                  Eleventy filters, plugins, and processors
│   ├── content/                 Blog posts, reviews, and interior pages
│   ├── _redirects               Netlify redirect rules
│   ├── index.html               Homepage
│   ├── robots.html              Generates robots.txt
│   └── sitemap.html             Generates sitemap.xml
└── public/                      Generated output; do not edit
```

The base layout in `src/_includes/layouts/base.html` supplies the shared page shell, header, footer, and metadata. Page templates extend it with Nunjucks blocks. The build compiles Sass and JavaScript and uses CodeStitch's Sharp image plugin for image transformations; production mode also applies minification.

## Deployment and launch checklist

`netlify.toml` configures Netlify to run `npm run build` and publish `public/`. For another static host, configure the same build command and output directory, and adapt redirects and provider-specific integrations as needed.

Before handing off or launching a site:

1. Replace demo copy, images, client details, logos, favicons, manifest name, and default social image. Check page titles and descriptions.
2. Confirm the production domain in `src/_data/clientData.json`; it is used for canonical URLs, social metadata, `robots.txt`, and the sitemap.
3. Configure and test the production CMS backend and editor access if the CMS is retained.
4. **Configure a submission provider for the demo contact form.** The form has no submission service out of the box. Send a real test and confirm delivery; a successful build does not verify this.
5. Run `npm test` and `npm run check:launch`. Optionally run `npm run test:links` when network access is available.
6. Review the deployed pages, navigation, mobile layout, accessibility, social previews, sitemap, and any forms or integrations manually.

## License and credits

The repository includes [LICENSE.md](LICENSE.md). The original starter and its demo components come from [CodeStitch's Intermediate Website Kit (SASS)](https://github.com/CodeStitchOfficial/Intermediate-Website-Kit-SASS); this template builds on that work with additional customization and tooling.
