# childLearn

> 个人项目:抓取并教会孩子做错的题,沉淀成一份可复习、可扩展的知识库。
> 当前打样领域:**二年级数学**(目录 `mistakeNote/`),后续扩展到三年级数学、二年级英语等。

---

## 项目状态: **Phase 0(骨架搭建)**

正在搭目录结构、写模板、把样板错题归档。**不要**写 web 前端、不要接 API、不要做自动化——那是 Phase 2/3 的事。详细的"什么不做"见 `mistakeNote/README.md` 第五节。

---

## 上下文文件(按这个顺序读)

1. **`mistakeNote/README.md`** —— 北极星文档:愿景、价值、设计原则、边界。任何决策跟它冲突,就是决策错了。
2. **`mistakeNote/二年级/数学/教学库/孩子数学应用题教学方案.md`** —— 教学法基础:CPA 三层模型、家长指导、三天测试原则。
3. **`mistakeNote/_seed/`** 下两个 `.jsx` —— 互动教学样板(邮票题的两种讲法:实物计数版、线段图版),展示了对孩子的输出该有的"质感"。

---

## 已锁定的架构决策(别推翻、别"优化")

- **Local-first**:数据是磁盘上的 markdown + 图片,文件就是真相,不上云、不上 SaaS
- **Git 管理**:这个目录是 Git 仓库
- **Obsidian 兼容**:笔记用 YAML frontmatter + `[[wikilinks]]`,关系图是关键视图
- **两区结构**:每道错题分**题面区**(孩子看)+ **教师区**(家长看),用 `<details>` 或 Obsidian callout 折叠;孩子绝对不能不小心看见教师区
- **不要写数据库**:文件本身就是数据库
- **现阶段不写代码,只写文件**:Phase 0 只动 markdown、目录、Git

---

## Phase 0 具体任务清单

### 1. 搭目录骨架(在 `mistakeNote/` 下)

```
mistakeNote/
├── README.md                    ✅ 已有
├── 二年级/
│   └── 数学/
│       ├── 错题/                ← 一道题一个文件夹
│       ├── 知识点/              ← 概念笔记,错题链到这里
│       └── 教学库/              ← 通用教学法、家长指导
├── _system/
│   └── 模板/
│       ├── 错题模板.md
│       └── 知识点模板.md
└── _seed/                       ← 起步用的样板文件
```

### 2. 写两个模板(在 `_system/模板/`)

- **`错题模板.md`** —— 含完整 frontmatter + 两区 body 骨架
- **`知识点模板.md`** —— 概念笔记 + 反向链接区(Obsidian 自动填)

### 3. 归档第一道真实错题

把"邮票一样多"按结构归档:

- 路径:`mistakeNote/二年级/数学/错题/2026-06-19-邮票一样多/`
- 内含:
  - `note.md`(按模板,frontmatter 填好,状态 `已掌握`)
  - `photo.png`(原始拍照,如果有)
  - `stamp_math_lesson.jsx`、`stamp_math_linesegment.jsx`(从 `_seed/` 复制过来)
  - `variations.md`(留空,以后追加变体题)
- `note.md` 里用 `[[和差问题]]` 链到知识点

### 4. 创建第一个知识点笔记

`mistakeNote/二年级/数学/知识点/和差问题.md`(按模板,挂在 `[[应用题]]` 之下)

### 5. 把教学方案文档归位

把 `孩子数学应用题教学方案.md` 从 `mistakeNote/` 根目录挪到 `mistakeNote/二年级/数学/教学库/`(它是数学专属的)。

### 6. Git 初始化

`git init` + 写 `.gitignore`(忽略 `.DS_Store`、`.obsidian/workspace.json`、`node_modules/` 等)+ 首次 commit。

---

## Frontmatter Schema

### 错题(`note.md`)

```yaml
---
title: 邮票一样多
date: 2026-06-19
grade: 二年级
subject: 数学
source: "期末复习卷 P12 第 5 题"
topics: [应用题, 和差问题]
difficulty: 难
status: 未懂          # 未懂 / 讲过 / 已掌握 / 已遗忘
mistakes:
  - date: 2026-06-19
    note: "没理解'原来'是哪个时刻"
review_log:
  - { date: 2026-06-22, result: 会 }
has_interactive: true
---
```

### 知识点(`和差问题.md`)

```yaml
---
title: 和差问题
grade: 二年级
subject: 数学
parent_concepts: [应用题]
common_traps:
  - "学生分不清'原来'和'现在'两个时刻"
  - "误以为差距只缩小一个 18,而非两个"
---
```

---

## 命名约定

- 全部内容中文,文件夹、文件名也用中文(可读性优先)
- 错题文件夹 slug:`YYYY-MM-DD-题目简称`
- `[[wikilink]]` 的文本必须**精确等于**目标文件名(不带 `.md`),否则 Obsidian 链接会断

---

## Phase 0 完成标准

走完一遍能向自己讲清楚:

> "下一道错题来了,我 5 分钟内知道:它放哪个文件夹、文件叫什么、frontmatter 怎么填、要不要做互动版。"

讲不清楚 = 结构还没对,**回去调,不要硬上 Phase 1**。

---

## 反目标(动手前再读一遍)

- ❌ 不写 web 前端(Phase 2,等真实错题攒到 20–30 道之后)
- ❌ 不接 Claude API(Phase 3)
- ❌ 不建数据库/索引文件(Obsidian 自己会生成)
- ❌ 不做 OCR、不做语音、不做扫描自动化(Phase 3)
- ❌ 不做成绩跟踪、不做排名、不做和别的孩子的对比
- ❌ 不要"先把 schema 设计完美"——等真实数据来推着改,空想会改死

---

## 工作风格说明

- 提建议时,**先 propose,再让我确认,再动手**——别一上来就批量创建文件
- 任何不在本文件 + `README.md` 里写明的设计选择,**先问我**
- 改 schema 之前**必须先读 README.md 第三节**(8 条核心设计点)