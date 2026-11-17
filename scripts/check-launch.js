const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = process.cwd();
const file = (name) => path.join(root, name);
const exists = (name) => fs.existsSync(file(name));
const read = (name) => fs.readFileSync(file(name), "utf8");
const findings = [];

function check() {
	const client = JSON.parse(read("src/_data/clientData.json"));
	if (!client.name || client.name === "Code Stitch Web Designs") findings.push("Set the business name in src/_data/clientData.json.");
	try {
		const domain = new URL(client.domain);
		if (!["https:", "http:"].includes(domain.protocol) || /(^|\.)example\.(com|org|net)$/.test(domain.hostname) || domain.hostname === "localhost") {
			findings.push("Set a real public domain in src/_data/clientData.json.");
		}
	} catch {
		findings.push("Set a valid full domain URL in src/_data/clientData.json.");
	}
	if (!client.email || client.email === "help@codestitch.app" || client.phoneForTel === "555-779-4407") {
		findings.push("Replace the demo email and phone in src/_data/clientData.json.");
	}
	if (client.address?.lineOne === "First Address Line") findings.push("Replace the demo business address.");
	if (!client.socialImage || client.socialImage === "/assets/favicons/web-app-manifest-512x512.png") {
		findings.push("Set a custom default social-sharing image in Business Info.");
	}
	if (exists("src/assets/favicons/site.webmanifest") && /Starter Kit/.test(read("src/assets/favicons/site.webmanifest"))) {
		findings.push("Replace the Starter Kit name in the web app manifest.");
	}
	for (const [asset, hash] of [
		["src/assets/svgs/logo-black.svg", "1eeed4f5bb94b77f756667ae5a9a1b98fae5740cd3f8316571a2b5bb909137a7"],
		["src/assets/favicons/favicon-96x96.png", "9e86bff5d49908ae9faac1aca68915f953b15135518a8839002c8d42a555b905"],
	]) {
		if (exists(asset) && crypto.createHash("sha256").update(fs.readFileSync(file(asset))).digest("hex") === hash) {
			findings.push(`Replace the starter branding in ${asset}.`);
		}
	}
	for (const folder of ["src/_data", "src/content/pages"]) {
		if (!exists(folder)) continue;
		for (const entry of fs.readdirSync(file(folder), { withFileTypes: true })) {
			if (!entry.isFile() || !/\.(json|html)$/.test(entry.name)) continue;
			const name = `${folder}/${entry.name}`;
			const content = read(name);
			if (/lorem ipsum|meta description for the page|add your page description here/i.test(content)) findings.push(`Replace placeholder content in ${name}.`);
			if (/<form\b[^>]*method=["']post["'][^>]*>/i.test(content)) {
				const forms = content.match(/<form\b[^>]*>/gi) || [];
				if (forms.some((form) => /\bmethod=["']post["']/i.test(form) && !/\baction=["'][^"']+["']|\bdata-netlify(?:=["']true["'])?|\bnetlify(?:\s|>)/i.test(form))) {
					findings.push(`Configure a submission service and test delivery for the form in ${name}.`);
				}
			}
		}
	}
	if (exists("src/index.html") && /lorem ipsum|meta description for the page/i.test(read("src/index.html"))) findings.push("Replace placeholder content in src/index.html.");
	if (exists("src/admin/config.yml") && read("src/admin/config.yml").includes('Replace the "backend" object below')) {
		findings.push("Configure the production Decap CMS backend and test authentication.");
	}
	if (findings.length) {
		console.error(`Launch readiness failed:\n${findings.map((item) => `- ${item}`).join("\n")}`);
		process.exitCode = 1;
	} else {
		console.log("Automated launch checks passed. Manually verify forms, CMS login, branding, SEO, and deployment before launch.");
	}
}

try {
	check();
} catch (error) {
	console.error(`Launch readiness could not be checked: ${error.message}`);
	process.exitCode = 1;
}
