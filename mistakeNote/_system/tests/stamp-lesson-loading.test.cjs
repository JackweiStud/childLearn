const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const lessonPath = path.resolve(
  __dirname,
  "../../二年级/数学/错题/2026-06-19-邮票一样多/打开.html",
);

test("邮票互动课无需联网即可加载", () => {
  const html = fs.readFileSync(lessonPath, "utf8");

  assert.doesNotMatch(
    html,
    /<script\b[^>]*\bsrc\s*=/i,
    "互动课仍依赖外部脚本，断网时会一直停在加载页",
  );
  assert.doesNotMatch(
    html,
    /<script\b[^>]*type=["']text\/babel["']/i,
    "浏览器不应在打开课程时临时编译 JSX",
  );

  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .join("\n");

  assert.ok(scripts.length > 100_000, "React 运行时没有内联到课程文件");
  assert.doesNotThrow(() => new Function(scripts), "内联脚本存在语法错误");
});
