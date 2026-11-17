const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const http = require("node:http");
const yaml = require("js-yaml");

const root = path.resolve(__dirname, "../..");
const hasCms = fs.existsSync(path.join(root, "src/admin/config.yml")) && fs.existsSync(path.join(root, "src/admin/index.html"));
const script = (name) => path.join(root, "scripts", name);
const execute = (fixture, name, args = []) => spawnSync(process.execPath, [script(name), ...args], { cwd: fixture, encoding: "utf8" });

function fixture(t) {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eleventy-template-test-"));
	t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
	return dir;
}

function copy(dir, name) {
	const destination = path.join(dir, name);
	fs.mkdirSync(path.dirname(destination), { recursive: true });
	fs.copyFileSync(path.join(root, name), destination);
}

function write(dir, name, content) {
	const destination = path.join(dir, name);
	fs.mkdirSync(path.dirname(destination), { recursive: true });
	fs.writeFileSync(destination, content);
}

function pageFixture(t, cms = true) {
	const dir = fixture(t);
	for (const file of ["src/_includes/sections/header.html", "src/_includes/sections/footer.html", "src/content/pages/_template.txt"]) copy(dir, file);
	if (cms && hasCms) for (const file of ["src/admin/config.yml", "src/admin/index.html"]) copy(dir, file);
	fs.mkdirSync(path.join(dir, "scripts"), { recursive: true });
	fs.mkdirSync(path.join(dir, "src/assets/sass"), { recursive: true });
	fs.mkdirSync(path.join(dir, "src/_data"), { recursive: true });
	return dir;
}

test("page generation and removal round-trip with CMS and navigation", (t) => {
	if (!hasCms) return t.skip("CMS has been removed");
	const dir = pageFixture(t);
	const header = fs.readFileSync(path.join(dir, "src/_includes/sections/header.html"), "utf8");
	const config = fs.readFileSync(path.join(dir, "src/admin/config.yml"), "utf8");
	const created = execute(dir, "create-page.js", ["Our Team, Services"]);
	assert.equal(created.status, 0, created.stderr);
	assert.match(fs.readFileSync(path.join(dir, "src/content/pages/our-team.html"), "utf8"), /^---\n# generated-page:our-team/);
	assert.match(fs.readFileSync(path.join(dir, "src/content/pages/our-team.html"), "utf8"), /\{\{ ourTeam\.title \}\}/);
	const parsed = yaml.load(fs.readFileSync(path.join(dir, "src/admin/config.yml"), "utf8"));
	assert.ok(parsed.collections.find((item) => item.name === "site_content").files.some((item) => item.name === "ourTeam"));
	assert.match(fs.readFileSync(path.join(dir, "src/_includes/sections/header.html"), "utf8"), /href="\/our-team\/"/);
	const removed = execute(dir, "remove-page.js", ["Our Team, Services"]);
	assert.equal(removed.status, 0, removed.stderr);
	assert.equal(fs.readFileSync(path.join(dir, "src/_includes/sections/header.html"), "utf8"), header);
	assert.equal(fs.readFileSync(path.join(dir, "src/admin/config.yml"), "utf8"), config);
	assert.equal(fs.existsSync(path.join(dir, "src/_data/ourTeam.json")), false);
});

test("page operations refuse collisions, invalid names, and damaged markers without partial changes", (t) => {
	const dir = pageFixture(t);
	write(dir, "src/assets/sass/services.scss", "existing");
	assert.notEqual(execute(dir, "create-page.js", ["Our Team, Services"]).status, 0);
	assert.equal(fs.existsSync(path.join(dir, "src/content/pages/our-team.html")), false);
	assert.notEqual(execute(dir, "create-page.js", ["123"]).status, 0);
	assert.notEqual(execute(dir, "create-page.js", ["true"]).status, 0);
	assert.notEqual(execute(dir, "remove-page.js", ["About"]).status, 0);
	assert.equal(execute(dir, "create-page.js", ["Our Team"]).status, 0);
	const header = path.join(dir, "src/_includes/sections/header.html");
	fs.writeFileSync(header, fs.readFileSync(header, "utf8").replace("generated-page:our-team:end", "changed"));
	assert.notEqual(execute(dir, "remove-page.js", ["Our Team"]).status, 0);
	assert.equal(fs.existsSync(path.join(dir, "src/content/pages/our-team.html")), true);
});

test("generated pages build and smoke-check in an isolated project", { timeout: 120000 }, (t) => {
	const dir = pageFixture(t);
	fs.cpSync(path.join(root, "src/config"), path.join(dir, "src/config"), { recursive: true });
	copy(dir, "src/_data/clientData.json");
	copy(dir, "src/_data/client.js");
	write(dir, "src/_includes/sections/header.html", '<nav><ul>\n                </ul>\n            </div></nav>');
	write(dir, "src/_includes/sections/footer.html", '<ul><li><span class="cs-header">Sitemap</span></li>\n        </ul>');
	write(dir, "src/_includes/layouts/base.html", '{% include "sections/header.html" %}{% block body %}{% endblock %}{% include "sections/footer.html" %}');
	write(dir, "src/index.html", '---\npermalink: /\n---\nHome');
	write(dir, "src/robots.html", '---\npermalink: /robots.txt\n---\nUser-agent: *');
	write(dir, "src/sitemap.html", '---\npermalink: /sitemap.xml\n---\n<urlset></urlset>');
	write(dir, "src/_redirects", "");
	for (const file of [".eleventy.js", "package.json"]) copy(dir, file);
	fs.symlinkSync(path.join(root, "node_modules"), path.join(dir, "node_modules"), "dir");
	const create = execute(dir, "create-page.js", ["Our Team"]);
	assert.equal(create.status, 0, create.stderr);
	const build = spawnSync("npm", ["run", "build"], { cwd: dir, encoding: "utf8", timeout: 100000 });
	assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
	assert.match(fs.readFileSync(path.join(dir, "public/our-team/index.html"), "utf8"), /Our Team/);
	const smoke = execute(dir, "validate-site.js");
	assert.equal(smoke.status, 0, smoke.stderr);
});

test("pages can be created and removed after CMS removal", (t) => {
	const dir = pageFixture(t, false);
	assert.equal(execute(dir, "create-page.js", ["Our Team"]).status, 0);
	assert.equal(execute(dir, "remove-page.js", ["Our Team"]).status, 0);
});

test("Markdown escapes HTML and URL filter resolves internal and external images", () => {
	const markdown = require("../../src/config/filters/markdown");
	const absoluteUrl = require("../../src/config/filters/absoluteUrl");
	assert.match(markdown("**bold**\n<script>alert(1)</script>"), /<strong>bold<\/strong>/);
	assert.match(markdown("<script>alert(1)</script>"), /&lt;script&gt;/);
	assert.equal(absoluteUrl("/assets/image.png", "https://example.com/"), "https://example.com/assets/image.png");
	assert.equal(absoluteUrl("https://cdn.example.net/image.png", "https://example.com"), "https://cdn.example.net/image.png");
});

test("launch checks flag the starter and pass an intentionally configured fixture", (t) => {
	const dir = fixture(t);
	copy(dir, "src/_data/clientData.json");
	assert.notEqual(execute(dir, "check-launch.js").status, 0);
	write(dir, "src/_data/clientData.json", JSON.stringify({
		name: "Example Business", domain: "https://business.test", email: "hello@business.test",
		phoneForTel: "123", address: { lineOne: "1 Main Street" }, socialImage: "/custom.png",
	}));
	assert.equal(execute(dir, "check-launch.js").status, 0);
	write(dir, "src/content/pages/contact.html", '<form method="post"></form>');
	const unconfigured = execute(dir, "check-launch.js");
	assert.notEqual(unconfigured.status, 0);
	assert.match(unconfigured.stderr, /submission service/);
});

test("backup preflight does not overwrite existing backup", (t) => {
	const dir = fixture(t);
	const { preflightBackups } = require("../utils/backup");
	write(dir, "source", "new");
	write(dir, "backup", "old");
	assert.throws(() => preflightBackups([[path.join(dir, "source"), path.join(dir, "backup")]]), /Backup already exists/);
	assert.equal(fs.readFileSync(path.join(dir, "backup"), "utf8"), "old");
});

function interactive(dir, name, answers) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [script(name)], { cwd: dir });
		let output = "";
		let index = 0;
		child.stdout.on("data", (chunk) => {
			output += chunk;
			if (index < answers.length && output.includes(answers[index][0])) {
				const answer = `${answers[index++][1]}\n`;
				if (index === answers.length) child.stdin.end(answer);
				else child.stdin.write(answer);
			}
		});
		child.stderr.on("data", (chunk) => { output += chunk; });
		child.on("error", reject);
		child.on("close", (status) => resolve({ status, output }));
	});
}

test("demo removal preserves backups and refuses a repeated run", async (t) => {
	const dir = pageFixture(t);
	write(dir, "src/index.html", "original homepage");
	write(dir, "src/content/pages/about.html", "original about");
	const first = await interactive(dir, "remove-demo.js", [["Continue? (y/n):", "y"]]);
	assert.equal(first.status, 0, first.output);
	assert.equal(fs.readFileSync(path.join(dir, "scripts/deleted/index.html"), "utf8"), "original homepage");
	const second = await interactive(dir, "remove-demo.js", [["Continue? (y/n):", "y"]]);
	assert.notEqual(second.status, 0);
	assert.match(second.output, /Backup already exists/);
	assert.equal(fs.readFileSync(path.join(dir, "scripts/deleted/index.html"), "utf8"), "original homepage");
	assert.equal(execute(dir, "create-page.js", ["New Service"]).status, 0);
	assert.equal(execute(dir, "remove-page.js", ["New Service"]).status, 0);
});

test("CMS removal retains page tooling and explains lockfile synchronization", async (t) => {
	if (!hasCms) return t.skip("CMS has been removed");
	const dir = pageFixture(t);
	write(dir, "package.json", JSON.stringify({ scripts: { start: "run-p watch:*", "watch:cms": "decap-server" }, dependencies: { "decap-server": "1" } }));
	write(dir, ".eleventy.js", 'eleventyConfig.addPassthroughCopy("./src/admin"); // CMS\n');
	const result = await interactive(dir, "remove-decap.js", [["project? (y/n):", "y"], ["content? (y/n):", "n"]]);
	assert.equal(result.status, 0, result.output);
	assert.match(result.output, /npm install --package-lock-only/);
	assert.equal(fs.existsSync(path.join(dir, "src/admin")), false);
	assert.equal(execute(dir, "create-page.js", ["New Service"]).status, 0);
	assert.equal(execute(dir, "remove-page.js", ["New Service"]).status, 0);
});

test("CMS removal detects backup collisions before editing files", async (t) => {
	if (!hasCms) return t.skip("CMS has been removed");
	const dir = pageFixture(t);
	write(dir, "scripts/deleted/admin/keep.txt", "backup");
	write(dir, "package.json", JSON.stringify({ scripts: { start: "run-p watch:*", "watch:cms": "decap-server" }, dependencies: { "decap-server": "1" } }));
	const result = await interactive(dir, "remove-decap.js", [["project? (y/n):", "y"], ["content? (y/n):", "n"]]);
	assert.notEqual(result.status, 0);
	assert.match(result.output, /Backup already exists/);
	assert.ok(fs.existsSync(path.join(dir, "src/admin/config.yml")));
	assert.equal(fs.readFileSync(path.join(dir, "scripts/deleted/admin/keep.txt"), "utf8"), "backup");
});

test("external link checker reports failures and follows HEAD fallback", async (t) => {
	const dir = fixture(t);
	const server = http.createServer((req, res) => {
		if (req.url === "/fallback" && req.method === "HEAD") res.writeHead(405).end();
		else if (req.url === "/missing") res.writeHead(404).end();
		else res.writeHead(200).end();
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(() => server.close());
	const url = `http://127.0.0.1:${server.address().port}`;
	const run = () => new Promise((resolve) => {
		const child = spawn(process.execPath, [script("validate-external-links.js")], { cwd: dir });
		let stderr = "";
		child.stderr.on("data", (chunk) => { stderr += chunk; });
		child.on("close", (status) => resolve({ status, stderr }));
	});
	write(dir, "public/index.html", `<a href="${url}/fallback">test</a>`);
	assert.equal((await run()).status, 0);
	write(dir, "public/index.html", `<a href="${url}/missing">test</a>`);
	const result = await run();
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /HTTP 404/);
});
