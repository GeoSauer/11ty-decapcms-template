const fs = require("fs");
const path = require("path");
const { collectHtmlFiles, extractTargets } = require("./utils/site-files");

const timeout = 10000;
const accepted = new Set([401, 403, 429]);

async function request(url, method) {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeout);
	try {
		return await fetch(url, { method, redirect: "follow", signal: controller.signal, headers: { "user-agent": "eleventy-template-link-checker/1.0" } });
	} finally {
		clearTimeout(timer);
	}
}

async function check(url) {
	try {
		let response;
		try {
			response = await request(url, "HEAD");
		} catch {
			response = await request(url, "GET");
		}
		if (response.status === 405 || response.status === 501) response = await request(url, "GET");
		return response.ok || accepted.has(response.status) ? null : `${url}: HTTP ${response.status}`;
	} catch (error) {
		return `${url}: ${error.name === "AbortError" ? `timeout after ${timeout}ms` : error.message}`;
	}
}

async function run() {
	const output = path.join(process.cwd(), "public");
	if (!fs.existsSync(path.join(output, "index.html"))) throw new Error("Build output missing. Run npm run build first.");
	const skips = (process.env.EXTERNAL_LINK_CHECK_SKIP || "").split(",").map((item) => item.trim()).filter(Boolean);
	const urls = new Set();
	for (const file of collectHtmlFiles(output)) {
		for (let target of extractTargets(fs.readFileSync(file, "utf8"))) {
			if (target.startsWith("//")) target = `https:${target}`;
			if (!/^https?:\/\//i.test(target) || skips.some((skip) => target.includes(skip))) continue;
			const url = new URL(target);
			url.hash = "";
			urls.add(url.href);
		}
	}
	const items = [...urls];
	let index = 0;
	const failures = [];
	await Promise.all(Array.from({ length: Math.min(6, items.length) }, async () => {
		while (index < items.length) {
			const url = items[index++];
			const failure = await check(url);
			if (failure) failures.push(failure);
		}
	}));
	if (failures.length) throw new Error(`External link validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
	console.log(`External link validation passed: ${items.length} URLs checked.`);
}

run().catch((error) => {
	console.error(error.message);
	process.exitCode = 1;
});
