const fs = require("fs");
const path = require("path");
const readline = require("node:readline");
const yaml = require("js-yaml");

const root = process.cwd();
const resolve = (file) => path.join(root, file);
const read = (file) => fs.readFileSync(resolve(file), "utf8");
const exists = (file) => fs.existsSync(resolve(file));
const registryPath = "scripts/generated-pages.json";
const headerPath = "src/_includes/sections/header.html";
const footerPath = "src/_includes/sections/footer.html";
const configPath = "src/admin/config.yml";
const adminPath = "src/admin/index.html";

function names(input) {
	if (!input) throw new Error('Provide page names, e.g. npm run create-page -- "Services, Our Team".');
	const pages = input.split(",").map((name) => {
		const slug = name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/[\s-]+/g, "-").replace(/^-|-$/g, "");
		if (!/^[a-z][a-z0-9-]*$/.test(slug)) throw new Error(`Invalid page name: ${name}`);
		const camel = slug.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
		if (["true", "false", "none", "null", "and", "or", "not", "in", "if", "else", "for", "endfor"].includes(camel)) {
			throw new Error(`Page name is reserved in templates: ${name}`);
		}
		const title = slug.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
		return { slug, camel, title };
	});
	if (new Set(pages.map((page) => page.slug)).size !== pages.length ||
		new Set(pages.map((page) => page.camel)).size !== pages.length) {
		throw new Error("Page names resolve to duplicate slugs or data identifiers.");
	}
	return pages;
}

function insertOnce(text, anchor, block, file) {
	const index = text.indexOf(anchor);
	if (index < 0 || text.indexOf(anchor, index + anchor.length) >= 0) {
		throw new Error(`Expected one insertion point in ${file}; no changes made.`);
	}
	return text.slice(0, index) + block + text.slice(index);
}

function markers(slug, kind) {
	return kind === "yaml"
		? [`          # generated-page:${slug}:start`, `          # generated-page:${slug}:end`]
		: kind === "js"
			? [`			// generated-page:${slug}:start`, `			// generated-page:${slug}:end`]
			: [`            <!-- generated-page:${slug}:start -->`, `            <!-- generated-page:${slug}:end -->`];
}

function block(slug, kind, body) {
	const [start, end] = markers(slug, kind);
	return `${start}\n${body}\n${end}\n`;
}

function removeBlock(text, slug, kind, file) {
	const [start, end] = markers(slug, kind);
	const first = text.indexOf(start);
	const last = text.indexOf(end);
	if (first < 0 || last < first || text.indexOf(start, first + start.length) >= 0 || text.indexOf(end, last + end.length) >= 0) {
		throw new Error(`Missing or ambiguous managed block for ${slug} in ${file}; no changes made.`);
	}
	return text.slice(0, first) + text.slice(last + end.length).replace(/^\r?\n/, "");
}

function create(pages, registry, changes, deletions) {
	const template = read("src/content/pages/_template.txt");
	const withCms = exists(configPath) && exists(adminPath);
	if (exists(configPath) !== exists(adminPath)) throw new Error("CMS files are incomplete; restore or remove both before creating pages.");
	for (const { slug, camel, title } of pages) {
		const html = `src/content/pages/${slug}.html`;
		const scss = `src/assets/sass/${slug}.scss`;
		const data = `src/_data/${camel}.json`;
		if (registry[slug] || Object.values(registry).some((entry) => entry.camel === camel) ||
			[html, scss, data, `src/_data/${camel}.js`, `src/_data/${camel}.cjs`, `src/_data/${camel}`].some(exists)) {
			throw new Error(`Page ${slug} or one of its files already exists; no changes made.`);
		}
		const page = template.replace("    <!-- Page HTML goes here, without a <main> wrapper. The <main> tag is already presented in layouts/base.html -->",
			`    <section class="cs-container">\n        <h1>{{ ${camel}.title }}</h1>\n        <p>{{ ${camel}.text }}</p>\n    </section>`);
		if (page === template) throw new Error("Page template has changed; cannot safely insert starter content.");
		changes[html] = page.replace(/^---\r?\n/, `---\n# generated-page:${slug}\n`);
		if (changes[html] === page) throw new Error("Page template front matter is missing; no changes made.");
		changes[scss] = `/* generated-page:${slug} */\n`;
		changes[data] = `${JSON.stringify({ title, text: "Add your page description here." }, null, 2)}\n`;
		const header = block(slug, "html", `            <li class="cs-li"><a href="/${slug}/" class="cs-li-link {% if page.url == "/${slug}/" %} cs-active {% endif %}" {% if page.url == "/${slug}/" %} aria-current="page" {% endif %}>${title}</a></li>`);
		const footer = block(slug, "html", `            <li class="cs-nav-li"><a class="cs-nav-link" href="/${slug}/">${title}</a></li>`);
		changes[headerPath] = insertOnce(changes[headerPath], "                </ul>\n            </div>", header, headerPath);
		const sitemap = changes[footerPath].indexOf('<span class="cs-header">Sitemap</span>');
		const footerEnd = changes[footerPath].indexOf("        </ul>", sitemap);
		if (sitemap < 0 || footerEnd < 0) throw new Error("Footer sitemap insertion point missing; no changes made.");
		changes[footerPath] = changes[footerPath].slice(0, footerEnd) + footer + changes[footerPath].slice(footerEnd);
		if (withCms) {
			const parsed = yaml.load(changes[configPath]);
			const collection = parsed.collections.find((item) => item.name === "site_content");
			if (!collection || !Array.isArray(collection.files) || collection.files.some((item) => item.name === camel || item.file === data)) {
				throw new Error(`CMS collection missing or ${camel} already exists; no changes made.`);
			}
			const cms = block(slug, "yaml", `          - label: "${title} Page"\n            name: "${camel}"\n            file: "${data}"\n            fields:\n                - { label: "Title", name: "title", widget: "string", maxLength: 80, hint: "Page headline (80 characters max)" }\n                - { label: "Text", name: "text", widget: "text", maxLength: 500, hint: "Page description (500 characters max)" }`);
			changes[configPath] = insertOnce(changes[configPath], '          - label: "Business Info"', cms, configPath);
			const preview = block(slug, "js", `			CMS.registerPreviewTemplate("${camel}", GeneratedPagePreview);`);
			changes[adminPath] = insertOnce(changes[adminPath], '			CMS.registerPreviewStyle("/admin/decap-preview-styles.css");', preview, adminPath);
		}
		registry[slug] = { camel, html, scss, data, cms: withCms };
	}
}

function remove(pages, registry, changes, deletions) {
	for (const { slug } of pages) {
		const entry = registry[slug];
		if (!entry || entry.html !== `src/content/pages/${slug}.html` || entry.scss !== `src/assets/sass/${slug}.scss` || entry.data !== `src/_data/${entry.camel}.json` || !/^[a-z][a-zA-Z0-9]*$/.test(entry.camel)) {
			throw new Error(`${slug} is not a safely registered generated page; no changes made.`);
		}
		if (!exists(entry.html) || !read(entry.html).startsWith(`---\n# generated-page:${slug}\n`) ||
			!exists(entry.scss) || !read(entry.scss).startsWith(`/* generated-page:${slug} */`) || !exists(entry.data)) {
			throw new Error(`Generated files for ${slug} are missing or no longer marked; no changes made.`);
		}
		changes[headerPath] = removeBlock(changes[headerPath], slug, "html", headerPath);
		changes[footerPath] = removeBlock(changes[footerPath], slug, "html", footerPath);
		if (entry.cms && exists(configPath) && exists(adminPath)) {
			changes[configPath] = removeBlock(changes[configPath], slug, "yaml", configPath);
			changes[adminPath] = removeBlock(changes[adminPath], slug, "js", adminPath);
		} else if (exists(configPath) !== exists(adminPath)) {
			throw new Error("CMS files are incomplete; no changes made.");
		}
		deletions.push(entry.html, entry.scss, entry.data);
		delete registry[slug];
	}
}

function createPrompter() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
	let pendingAnswer;

	rl.on("close", () => {
		pendingAnswer?.("");
		pendingAnswer = null;
	});

	return {
		ask(question) {
			return new Promise((resolve) => {
				pendingAnswer = resolve;
				rl.question(question, (answer) => {
					pendingAnswer = null;
					resolve(answer);
				});
			});
		},
		close() {
			rl.close();
		},
	};
}

function readRegistry() {
	const registry = exists(registryPath) ? JSON.parse(read(registryPath)) : {};
	if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
		throw new Error("Generated page registry is invalid; fix scripts/generated-pages.json before continuing.");
	}
	return registry;
}

function registeredPages(registry) {
	return Object.keys(registry).sort();
}

function titleFromSlug(slug) {
	return slug.split("-").map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}

function selectedPages(selection, available) {
	const input = selection.trim();
	if (!input) throw new Error("Select at least one generated page.");
	if (input.toLowerCase() === "all") return available;

	const selected = [];
	for (const choice of input.split(",").map((item) => item.trim())) {
		let slug;
		if (/^\d+$/.test(choice)) {
			slug = available[Number(choice) - 1];
		} else {
			const [page] = names(choice);
			slug = page.slug;
		}
		if (!slug || !available.includes(slug)) {
			throw new Error(`"${choice}" is not one of the registered generated pages.`);
		}
		if (!selected.includes(slug)) selected.push(slug);
	}
	return selected;
}

function perform(action, input) {
	const pages = names(input);
	const registry = readRegistry();
	const changes = { [headerPath]: read(headerPath), [footerPath]: read(footerPath) };
	if (exists(configPath)) changes[configPath] = read(configPath);
	if (exists(adminPath)) changes[adminPath] = read(adminPath);
	const deletions = [];
	(action === "create" ? create : remove)(pages, registry, changes, deletions);
	if (changes[configPath]) yaml.load(changes[configPath]);
	changes[registryPath] = `${JSON.stringify(registry, null, 2)}\n`;
	for (const [file, content] of Object.entries(changes)) fs.writeFileSync(resolve(file), content);
	for (const file of deletions) fs.unlinkSync(resolve(file));
	console.log(`${action === "create" ? "Created" : "Removed"}: ${pages.map((page) => page.slug).join(", ")}`);
}

async function runWizard(action, prompter) {
	if (action === "create") {
		console.log("Create a page scaffold with its data, styles, navigation, and CMS wiring.");
		const input = await prompter.ask("Page name(s), separated by commas: ");
		const pages = names(input);
		console.log(`\nPages to create:\n${pages.map((page) => `- ${page.title} (/${page.slug}/)`).join("\n")}`);
		if ((await prompter.ask("\nCreate these pages? (y/N): ")).trim().toLowerCase() !== "y") {
			console.log("Page creation cancelled.");
			return;
		}
		perform(action, input);
		return;
	}

	const registry = readRegistry();
	const available = registeredPages(registry);
	if (available.length === 0) {
		throw new Error('No generated pages are registered. Create one with `npm run create-page` first.');
	}
	console.log("Generated pages available to remove:");
	available.forEach((slug, index) => console.log(`  ${index + 1}. ${titleFromSlug(slug)} (/${slug}/)`));
	const selection = await prompter.ask('\nChoose page numbers or names, separated by commas (or "all"): ');
	const slugs = selectedPages(selection, available);
	console.log(`\nPages to remove:\n${slugs.map((slug) => `- ${titleFromSlug(slug)} (/${slug}/)`).join("\n")}`);
	console.log("This removes their generated page, Sass, and data files, plus managed navigation and CMS entries.");
	if ((await prompter.ask("\nRemove these pages? (y/N): ")).trim().toLowerCase() !== "y") {
		console.log("Page removal cancelled.");
		return;
	}
	perform(action, slugs.join(","));
}

async function run(action) {
	const input = process.argv[2];
	let prompter;
	try {
		if (input) {
			perform(action, input);
			return;
		}
		prompter = createPrompter();
		await runWizard(action, prompter);
	} catch (error) {
		console.error(`${action} page failed: ${error.message}`);
		process.exitCode = 1;
	} finally {
		prompter?.close();
	}
}

module.exports = { run };
