module.exports = (value, domain) => {
	if (!value) return "";
	return new URL(value, `${domain.replace(/\/+$/, "")}/`).href;
};
