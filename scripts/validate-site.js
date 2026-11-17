const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { collectHtmlFiles, extractTargets } = require("./utils/site-files");

const root = process.cwd();
const output = path.join(root, "public");
const isFile = (file) => fs.existsSync(file) && fs.statSync(file).isFile();

function outputPath(target) {
	const pathname = decodeURIComponent(new URL(target, "https://site.invalid").pathname);
	const relative = pathname.replace(/^\/+/, "");
	const file = path.resolve(output, relative);
	if (file !== output && !file.startsWith(`${output}${path.sep}`)) throw new Error(`Invalid path: ${target}`);
	return path.extname(file) ? file : path.join(file, "index.html");
}

function requiredRoutes() {
	const routes = ["/", "/robots.txt", "/sitemap.xml"];
	if (fs.existsSync(path.join(root, "src/admin/index.html"))) routes.push("/admin/");
	const pagesDir = path.join(root, "src/content/pages");
	for (const file of fs.readdirSync(pagesDir)) {
		if (!file.endsWith(".html")) continue;
		const contents = fs.readFileSync(path.join(pagesDir, file), "utf8");
		const match = contents.match(/^---\r?\n([\s\S]*?)\r?\n---/);
		if (!match) continue;
		const frontMatter = yaml.load(match[1]) || {};
		if (frontMatter.permalink === false) continue;
		const permalink = frontMatter.permalink;
		if (typeof permalink === "string" && !permalink.includes("{{")) routes.push(permalink);
		else routes.push(`/${path.basename(file, ".html")}/`);
	}
	return routes;
}

function validate() {
	if (!fs.existsSync(output)) throw new Error("public/ does not exist. Run npm run build first.");
	const errors = [];
	const routes = requiredRoutes();
	for (const route of routes) {
		if (!isFile(outputPath(route))) errors.push(`Missing required route: ${route}`);
	}
	const htmlFiles = collectHtmlFiles(output);
	for (const file of htmlFiles) {
		for (const target of extractTargets(fs.readFileSync(file, "utf8"))) {
			if (!target.startsWith("/") || target.startsWith("//")) continue;
			try {
				if (!isFile(outputPath(target))) errors.push(`${path.relative(root, file)}: missing ${target}`);
			} catch (error) {
				errors.push(`${path.relative(root, file)}: ${error.message}`);
			}
		}
	}
	if (errors.length) throw new Error(`Site validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
	console.log(`Site validation passed: ${routes.length} routes and ${htmlFiles.length} HTML files.`);
}

try {
	validate();
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
