const fs = require("fs");
const path = require("path");

function collectHtmlFiles(dir) {
	return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(dir, entry.name);
		return entry.isDirectory() ? collectHtmlFiles(file) : entry.isFile() && file.endsWith(".html") ? [file] : [];
	});
}

function extractTargets(html) {
	const targets = [];
	for (const match of html.matchAll(/\b(href|src|srcset)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
		const value = (match[2] ?? match[3]).replace(/&amp;/g, "&");
		if (match[1].toLowerCase() === "srcset") {
			targets.push(...value.split(",").map((candidate) => candidate.trim().split(/\s+/)[0]));
		} else {
			targets.push(value);
		}
	}
	return targets;
}

module.exports = { collectHtmlFiles, extractTargets };
