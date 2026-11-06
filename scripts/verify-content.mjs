import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const file = "src/posts/2099-01-01-verification-only.md";
assert(!fs.existsSync(file), "검증용 파일 이름이 이미 존재합니다.");
const source = `---
title: "자동 반영 검사 전용"
date: 2099-01-01
categories: ["개발", "CTF/Wargame"]
tags: ["Verification"]
description: "발행하지 않는 임시 검증 파일입니다."
---
## 검증
새 글 자동 반영을 확인하는 임시 콘텐츠입니다.
`;
function build() {
  try {
    execFileSync("npm", ["run", "build"], { stdio: "pipe" });
  } catch (error) {
    throw new Error(error.stderr?.toString() || error.message);
  }
}
try {
  fs.writeFileSync(file, source);
  build();
  const posts = JSON.parse(fs.readFileSync("_site/search.json", "utf8"));
  assert.equal(posts[0].title, "자동 반영 검사 전용");
  assert.equal(posts[0].url, "/posts/verification-only/");
  assert.equal(posts[0].categories.length, 2);
  assert(posts[0].tags.includes("Verification"));
  const expectedSequence = String(posts.length).padStart(3, "0");
  assert(
    fs
      .readFileSync("_site/posts/verification-only/index.html", "utf8")
      .includes(
        `<span class="article-sequence" aria-hidden="true">${expectedSequence}</span>`,
      ),
    "게시글 순번이 발행 순서에 맞게 동적으로 증가해야 합니다.",
  );
  for (const slug of ["development", "ctf-wargame"]) {
    assert(
      fs
        .readFileSync(`_site/categories/${slug}/index.html`, "utf8")
        .includes("자동 반영 검사 전용"),
    );
  }
  for (const filename of [
    "index.html",
    "archive/index.html",
    "feed.xml",
    "sitemap.xml",
  ]) {
    assert(
      fs
        .readFileSync(`_site/${filename}`, "utf8")
        .includes(
          filename === "sitemap.xml"
            ? "/posts/verification-only/"
            : "자동 반영 검사 전용",
        ),
    );
  }
  fs.writeFileSync(file, source.replace("date:", "draft: true\ndate:"));
  build();
  assert(!fs.existsSync("_site/posts/verification-only/index.html"));
  for (const filename of [
    "search.json",
    "index.html",
    "archive/index.html",
    "feed.xml",
    "sitemap.xml",
  ]) {
    assert(
      !fs
        .readFileSync(`_site/${filename}`, "utf8")
        .includes(
          filename === "sitemap.xml"
            ? "/posts/verification-only/"
            : "자동 반영 검사 전용",
        ),
    );
  }
  fs.writeFileSync(
    file,
    source.replace('"개발", "CTF/Wargame"', '"Unknown Category"'),
  );
  assert.throws(build, /categories/);
  console.log(
    "PASS: Markdown auto-publishing, safe URL, newest-first order, multiple categories, tags, RSS, sitemap, draft exclusion, stale output removal, invalid category rejection.",
  );
} finally {
  fs.rmSync(file, { force: true });
  build();
}
