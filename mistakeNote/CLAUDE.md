# childLearn / mistakeNote

> 个人项目:抓取并教会孩子做错的题,沉淀成一份可复习、可扩展的知识库。
> 当前打样领域:**二年级数学**(目录 `mistakeNote/`),后续扩展到三年级数学、二年级英语等。

---

## 项目状态:**Phase 0 已完成,进入"积累期"**

骨架、模板、首道错题归档全部落地(commit `32abdfe`)。**现在唯一要做的事**:多归档真实错题、按节奏复测、用真实数据回头校准 schema。

**积累期不做的事**:
- ❌ web 前端(Phase 2,等真实错题攒到 20–30 道再启动)
- ❌ 接 Claude API、OCR、自动化(Phase 3)
- ❌ "先把 schema 设计完美"——schema 由真实数据推着改,别空想

详细的"什么不做"看 `mistakeNote/Readme.md` 第五节。

---

## 上下文文件(按这个顺序读)

1. **`mistakeNote/Readme.md`** —— 北极星文档。决策跟它冲突 = 决策错了。**改它要慎重**(第七节明确说)。
2. **`mistakeNote/二年级/数学/教学库/孩子数学应用题教学方案.md`** —— CPA 三层模型、家长指导、三天测试原则。教学法基础。
3. **`mistakeNote/_system/模板/错题模板.md`** —— 新错题严格按这个模板填,缺字段不要随手加。
4. **`mistakeNote/二年级/数学/错题/2026-06-19-邮票一样多/`** —— 首道归档样板,质感参考。

---

## 已锁定的架构决策(别推翻、别"优化")

- **Local-first**:数据是磁盘上的 markdown + 图片,文件就是真相,不上云、不上 SaaS
- **Git 管理**:仓库在 `childLearn/` 父级,`mistakeNote/` 是子目录
- **Obsidian 兼容**:YAML frontmatter + `[[wikilinks]]`,关系图是关键视图
- **两区结构**:每道错题分**题面区**(孩子看)+ **家长区**(家长看),用 `<details>` 折叠。**孩子真实入口是 `打开.html`,不会打开 markdown**——折叠保留作双重保险
- **不要写数据库**:文件本身就是数据库
- **互动版 = .html 自包含,不再用 .jsx**:历史上 `_seed/` 留过 jsx,因为浏览器双击打不开,从这道题起统一改用 .html(React 运行时内联,JSX 预编译为普通 JS,不依赖网络)
- **暂不建 `知识点/` 目录**:Phase 0 验证表明,二年级数学知识点颗粒度模糊,提前抽象会污染数据。错题里写 `topics:` 当 tag 就够,**等错题攒到 5-10 道再让知识点自然涌现**

---

## 日常归档操作规约(一道新题 5 分钟流程)

**触发**:孩子做完作业,出现错题。

1. **素材放 temp**:`mistakeNote/<年级>/<科目>/temp/`(已 .gitignore)是临时区。扔进任一组合:
   - 仅原题图 → 让 Claude 按教学库 CPA 三层生成讲解 md + 互动 .html + 变形题(**模式 A**)
   - 原题图 + .html(Claude 桌面版生成)→ 让 Claude 只整理归档(**模式 B**)
   - 原题图 + 完整讲解 md + .html → 让 Claude 只归档(**模式 C**,日历题就是这种)
   - **不论哪种模式,孩子的"真实错点"必须由家长口述给 Claude——不能让 Claude 编**(它看不到草稿,猜错就污染 mistakes 字段)
2. **(可选)清理原题**:手机拍照有涂鸦/倾斜 → 跑 `rebuild-clean-exam` 出干净版 PDF。截图清晰就跳过。
3. **读题文本**:从 PDF / 图片提取题目原文(模式 A 由 Claude 做,B/C 已经在素材里)
4. **互动教学 .html**:
   - 文件名:`打开.html`(不要再生成 .jsx)
   - 必须**自包含且离线可用**:不得保留 `<script src="...">` 或运行时 Babel
   - 内联 React 18 UMD 运行时,把 JSX 以 classic runtime 预编译为普通 JS,末尾调用 `ReactDOM.createRoot(...).render(...)`
   - 参考样板:`二年级/数学/错题/2026-06-19-邮票一样多/打开.html`
5. **新建错题文件夹**:`mistakeNote/二年级/数学/错题/YYYY-MM-DD-题目简称/`
   - `note.md`(按 `_system/模板/错题模板.md` 填)
   - `原题.png`、`干净版.pdf`、`打开.html`
6. **给孩子讲**:让他点开 `打开.html`,自己走一遍
7. **填 frontmatter 状态**:`未懂` / `讲过` / `已掌握`;设 `next_review`(+3 天)
8. **commit**:三要素中文 commit(解决什么 + 方案 + 修改点)。**不要 push**

**5 分钟讲不完一道题正常**——5 分钟讲完归档动作的"模式切换成本"。归档动作本身要永远控制在 5 分钟内。**慢了 = schema 太复杂,回去砍**。

---

## 互动版规则(从 2026-06-19 起)

- **核心硬约束**:**自包含且离线可用**——浏览器双击即开,零依赖、零编译,断网也能跑。**React 是手段,离线是目的,本末别倒**。
- **技术选型按需,vanilla JS 优先**:
  - **简单交互**(按钮、显隐、计数、日历高亮、表单校验)→ **vanilla JS + DOM API**,文件小、零运行时。参考:`二年级/数学/错题/2026-06-21-日历找星期/打开.html`(~30K)。
  - **复杂状态/动效**(多步骤动画、SVG 动态形变、组件复用)→ **React 18 + ReactDOM 18 UMD 内联**。参考:`二年级/数学/错题/2026-06-19-邮票一样多/打开.html`(~174K)。
  - **绝不引入 vue/svelte/htmx/任何外部框架**——选项越少越好。
- **如果用 React,代码结构**:
  - 源码顶部:`const { useState } = React;`(替代 import)
  - 主组件:`function XxxLesson() { ... }`(去掉 `export default`)
  - JSX 用 classic runtime 预编译,最终 HTML 里不应出现 `type="text/babel"`
  - 末尾:`ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(XxxLesson));`
- **.jsx 可选保留**:如果想留 jsx 源码给 Claude 后续修改用,放同一文件夹叫 `互动版.jsx`,note.md 里链上。但**孩子入口永远是 .html**
- **不做工程化**:不引 Vite、不写 package.json、不装 node_modules。一切退化到单文件 html
- **回归测试**:`_system/tests/` 下的测试断言"无外部 src、无 `type=text/babel`、内联 JS 无语法错误"——三条对 vanilla 和 React 都适用。新题互动版**建议**(非强制)补对应的 loading 测试。

---

## 复测操作规约

**每周日 5 分钟**:

```bash
grep -rE 'next_review: 2026-' mistakeNote/二年级/数学/错题/ | grep -v "next_review: $"
```

- 看本周该复测哪些题(找 `next_review` 日期 ≤ 本周日的)
- 遮住答案让孩子重做
  - **会** → `review_log` 追加 `{date: YYYY-MM-DD, result: 会}`,`next_review` 推到 +7 天
  - **不会** → `status` 改 `已遗忘`,`next_review` 改到 +1 天,**重新讲一遍互动版**
- 攒到 20 道再考虑写 dashboard / Obsidian dataview。**不要现在就写脚本**

---

## Frontmatter Schema(错题 note.md)

```yaml
---
title: 邮票一样多
date: 2026-06-19
grade: 二年级
subject: 数学
source: "学校试卷 第 6 题"
topics: [应用题, 和差问题]
difficulty: 难
status: 已掌握            # 未懂 / 讲过 / 已掌握 / 已遗忘
learned_at: 2026-06-19    # 真正学会的日期,掌握前留空
next_review: 2026-06-22   # 下次复测日期,YYYY-MM-DD
mistakes:
  - date: 2026-06-19
    note: "把差距 18 当单方向,没想到送出去 → 一来一回实际相差 2*18 = 36"
review_log: []            # 复测后追加 { date: YYYY-MM-DD, result: 会/不会 }
has_interactive: true
---
```

**状态值含义**:
- `未懂`:刚捕获,还没讲
- `讲过`:讲了一次但没把握真懂(比如孩子点头但说不清)
- `已掌握`:能独立讲出解题思路,且第一次复测通过
- `已遗忘`:复测翻车,需要重新讲

**字段增删原则**:**等真实需求出现再加**。比如有一天发现某类题都涉及"易混淆词"想专门标,那时再加 `confusing_words:` 字段;现在不要预占。

**`知识点` schema 暂不实施**——见架构决策。

---

## 命名约定

- 全部内容中文,文件夹、文件名也用中文(可读性优先)
- 错题文件夹 slug:`YYYY-MM-DD-题目简称`
- `[[wikilink]]` 的文本必须**精确等于**目标文件名(不带 `.md`),否则 Obsidian 链接会断
- 同一道错题文件夹内固定文件名:`note.md`、`原题.png`、`干净版.pdf`、`打开.html`、(可选)`互动版.jsx`、(可选)`variations.md`

---

## 决策点:什么时候离开"积累期"?

往下一阶段(Phase 1:web 浏览器项目)走,需要同时满足:

1. **错题数量** ≥ 20 道(单孩子)
2. **复测节奏跑通** ≥ 4 周(周日 grep 不再忘)
3. **手动 grep 开始卡顿**(找一道复测花 > 30 秒,或者忘了哪些已掌握)
4. **schema 经过真实数据修正** ≥ 1 次(说明真实需求在推动改动)

不满足上面 4 条就硬上 Phase 1 = 在空气中盖楼。

---

## 反目标(动手前再读一遍)

- ❌ 不写 web 前端(Phase 2)
- ❌ 不接 Claude API、不做 OCR、不做语音(Phase 3)
- ❌ 不建数据库 / 索引文件(Obsidian 自己会生成)
- ❌ 不做成绩跟踪 / 排名 / 跟别的孩子对比
- ❌ 不"先把 schema 设计完美"
- ❌ 不在归档动作里加任何不直接服务"5 分钟流程"的步骤
- ❌ 不给孩子看 markdown 原文,他的入口只有 `打开.html` 和未来的 web 项目"孩子模式"

---

## 工作风格说明

- 提建议时,**先 propose,再让我确认,再动手**——别一上来批量创建文件
- 任何不在本文件 + `Readme.md` 里写明的设计选择,**先问我**
- 改 schema 之前**必须先读 `Readme.md` 第三节**(8 条核心设计点)
- commit 用中文三要素(解决什么 + 方案 + 修改点)。**可以主动 commit,永远不主动 push**
- 范围纪律:只改与任务相关的代码,顺手发现的别的 bug 记着最后一次性报告
