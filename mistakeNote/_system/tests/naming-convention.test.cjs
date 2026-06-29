const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

// 防回退:2026-06-29 起,每道错题文件夹下必须用 <题目简称>.md / <题目简称>·变形.md
// 旧的 note.md / variations.md 命名已统一迁移(commit 4eb2f50),不允许再退化回来
const examRoot = path.resolve(__dirname, "../../二年级/数学/错题");
const forbidden = ["note.md", "variations.md"];

test("错题命名约定:不允许出现 note.md / variations.md 字面文件名", () => {
  const dirs = fs
    .readdirSync(examRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}-/.test(d.name))
    .map((d) => d.name);

  assert.ok(dirs.length > 0, `未找到任何错题目录,路径可能错了:${examRoot}`);

  const violations = [];
  for (const dir of dirs) {
    for (const name of forbidden) {
      const full = path.join(examRoot, dir, name);
      if (fs.existsSync(full)) violations.push(path.relative(examRoot, full));
    }
  }

  assert.equal(
    violations.length,
    0,
    `命名约定违规(应改为 <题目简称>.md / <题目简称>·变形.md,文件名 = 文件夹名去掉 YYYY-MM-DD- 前缀):\n  ${violations.join("\n  ")}`,
  );
});
