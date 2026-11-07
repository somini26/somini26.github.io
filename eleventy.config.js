import fs from "node:fs";
import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import Prism from "prismjs";
import loadLanguages from "prismjs/components/index.js";
loadLanguages([
  "python",
  "java",
  "bash",
  "yaml",
  "json",
  "markup",
  "css",
  "javascript",
  "c",
]);
const categories = JSON.parse(fs.readFileSync("src/_data/topics.json", "utf8"));
const strip = (value) =>
  String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
export default function (config) {
  config.setNunjucksEnvironmentOptions({ autoescape: true });
  config.addPassthroughCopy("src/assets");
  config.addPassthroughCopy({ "src/robots.txt": "robots.txt" });
  config.addPassthroughCopy({ "src/.nojekyll": ".nojekyll" });
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    highlight(code, lang) {
      return lang && Prism.languages[lang]
        ? Prism.highlight(code, Prism.languages[lang], lang)
        : md.utils.escapeHtml(code);
    },
  }).use(anchor, {
    permalink: false,
    slugify: (value) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, ""),
  });
  const fence = md.renderer.rules.fence;
  md.renderer.rules.fence = (...args) =>
    fence(...args).replace("<code", '<code tabindex="0"');
  config.setLibrary("md", md);
  config.addCollection("posts", (api) =>
    api
      .getFilteredByGlob("src/posts/*.md")
      .filter((p) => !p.data.draft)
      .sort(
        (a, b) =>
          Number(b.data.recordOrder) - Number(a.data.recordOrder) ||
          a.url.localeCompare(b.url),
      ),
  );
  config.addFilter("dateISO", (d) => new Date(d).toISOString().slice(0, 10));
  config.addFilter("dateRSS", (d) => new Date(d).toUTCString());
  config.addFilter("plain", strip);
  config.addFilter("readingTime", (content) =>
    Math.max(1, Math.ceil(strip(content).length / 700)),
  );
  config.addFilter("inCategory", (posts, name) =>
    posts.filter((p) => p.data.categories?.includes(name)),
  );
  config.addFilter(
    "categorySlug",
    (name) => categories.find((c) => c.name === name)?.slug || "",
  );
  config.addFilter("take", (items, count) => items.slice(0, count));
  config.addFilter("recordLabel", (value) =>
    String(Number(value) || 0).padStart(3, "0"),
  );
  config.addFilter("previousRecord", (posts, recordOrder) =>
    [...posts]
      .filter((post) => Number(post.data.recordOrder) < Number(recordOrder))
      .sort((a, b) => b.data.recordOrder - a.data.recordOrder)[0],
  );
  config.addFilter("nextRecord", (posts, recordOrder) =>
    [...posts]
      .filter((post) => Number(post.data.recordOrder) > Number(recordOrder))
      .sort((a, b) => a.data.recordOrder - b.data.recordOrder)[0],
  );
  config.addFilter("json", (value) =>
    JSON.stringify(value).replace(/</g, "\\u003c"),
  );
  config.addFilter("searchData", (posts) =>
    posts.map((p) => ({
      title: p.data.title,
      description: p.data.description || "",
      recordOrder: Number(p.data.recordOrder),
      url: p.url,
      date: new Date(p.date).toISOString().slice(0, 10),
      categories: p.data.categories || [],
      tags: p.data.tags || [],
      readingTime: Math.max(
        1,
        Math.ceil(strip(p.templateContent).length / 700),
      ),
      categoryLinks: (p.data.categories || []).map((name) => ({
        name,
        slug: categories.find((c) => c.name === name)?.slug,
      })),
      text: strip(p.templateContent),
    })),
  );
  config.on("eleventy.before", async () => {
    // Fail early on invalid metadata instead of silently losing posts from category pages.
    const { default: matter } = await import("gray-matter");
    const seenOrders = new Map();
    for (const file of fs
      .readdirSync("src/posts")
      .filter((f) => f.endsWith(".md"))) {
      const { data } = matter(fs.readFileSync(`src/posts/${file}`, "utf8"));
      if (
        !data.title ||
        !data.description ||
        !data.date ||
        Number.isNaN(new Date(data.date).getTime())
      )
        throw new Error(`${file}: title, description, date가 필요합니다.`);
      if (
        !Array.isArray(data.categories) ||
        !data.categories.length ||
        data.categories.some((c) => !categories.some((item) => item.name === c))
      )
        throw new Error(`${file}: categories를 확인하세요.`);
      if (
        !Array.isArray(data.tags) ||
        data.tags.some((t) => typeof t !== "string")
      )
        throw new Error(`${file}: tags 배열을 확인하세요.`);
      if (!data.draft) {
        if (!Number.isInteger(data.recordOrder) || data.recordOrder < 1)
          throw new Error(`${file}: 공개 글에는 양의 정수 recordOrder가 필요합니다.`);
        if (seenOrders.has(data.recordOrder))
          throw new Error(
            `${file}: recordOrder ${data.recordOrder}가 ${seenOrders.get(data.recordOrder)}와 중복됩니다.`,
          );
        seenOrders.set(data.recordOrder, file);
      }
    }
  });
  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: false,
    htmlTemplateEngine: "njk",
    templateFormats: ["md", "njk"],
  };
}
