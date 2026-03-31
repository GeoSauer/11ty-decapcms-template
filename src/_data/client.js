const clientData = require("./clientData.json");

module.exports = {
	...clientData,
	// Passing the isProduction variable for use in HTML templates
	isProduction: process.env.ELEVENTY_ENV === "PROD",
};
