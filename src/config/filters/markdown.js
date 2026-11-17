const MarkdownIt = require("markdown-it");

const markdown = new MarkdownIt({ html: false, breaks: true, linkify: true });

module.exports = (content) => markdown.render(content || "");
