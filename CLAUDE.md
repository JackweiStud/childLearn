# childLearn

> Jack 的个人项目：把孩子的学习沉淀成可复习、可扩展的本地知识库。

---

## 仓库结构

```
childLearn/                       ← Git 根 + Obsidian vault 根
├── CLAUDE.md                     ← 你正在读
├── state.md                      ← 整体状态/计划
│
├── tools/                        ← 跨领域通用工具（与具体内容解耦）
│   ├── camera-capture/           # 纸质 → 数字（拍照台）
│   └── rebuild-clean-exam/       # 数字 → 干净 PDF（去除涂鸦/批改痕迹）
│
└── <领域>/                       ← 具体学习内容（数据 + 文档）
    └── mistakeNote/              # 错题项目（当前唯一打样领域）
        ├── CLAUDE.md             # 错题项目专属 Claude 指导
        ├── Readme.md             # 错题项目北极星文档
        ├── _inbox/               # 拍照原始素材
        ├── _system/              # 模板 + 测试
        ├── docs/                 # 设计文档
        └── 二年级/数学/           # 错题归档
```

**`tools/` 与领域解耦**：camera-capture 默认服务 mistakeNote，将来扩展英语 / 阅读等新领域时，通过环境变量复用同一份工具代码，不重复造轮子。

---

## 上下文文件（按领域读）

- **当前唯一活跃领域 = mistakeNote**：进它的目录前先读 `mistakeNote/CLAUDE.md` 和 `mistakeNote/Readme.md`，这两个文件是错题项目的北极星文档。
- **跨领域工具开发**：进 `tools/<工具名>/` 前先读该工具的 `README.md` + `state.md`。

---

## 已锁定的顶层架构决策

- **Local-first**：数据是磁盘上的 markdown + 图片，文件就是真相，不上云、不上 SaaS
- **Obsidian vault 在根级**（`.obsidian/`），整个 childLearn 是一个 vault
- **Git 仓库根 = childLearn/**，所有领域和工具共一个 repo
- **工具与数据解耦**：`tools/` 跨领域复用，`<领域>/` 只放数据 + 该领域专属文档
- **未来扩展走平级目录**：要加 `englishNote/` / `readingNote/` 等就在根级新建，不要塞进 mistakeNote 下

---

## 工作风格

- 提建议时**先 propose，再让我确认，再动手**
- commit 用中文三要素：解决什么 + 方案 + 修改点
- **可以主动 commit，永远不主动 push**
- 范围纪律：只改与任务相关的代码，顺手发现的别的 bug 记到最后一次性报告
