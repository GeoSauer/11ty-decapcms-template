const fs = require("fs");
const path = require("path");

function preflightBackups(pairs) {
	const conflicts = pairs.filter(([source, destination]) => fs.existsSync(source) && fs.existsSync(destination));
	if (conflicts.length) {
		throw new Error(`Backup already exists; move it before retrying:\n${conflicts.map(([, destination]) => `- ${path.relative(process.cwd(), destination)}`).join("\n")}`);
	}
}

module.exports = { preflightBackups };
