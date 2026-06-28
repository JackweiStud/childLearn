# childLearn · 整体状态

*最后更新：2026-06-29*

---

## 目标

把孩子的学习沉淀成可复习、可扩展的本地知识库。**核心命题**：用第一性原理 + 工程化的方式辅助亲子教学，而不是替代亲子教学。

---

## 当前状态

| 维度 | 状态 |
|---|---|
| 活跃领域 | **mistakeNote**（二年级数学错题）—— 唯一在用的领域 |
| 错题归档数 | 3 道（邮票一样多 / 日历找星期 / 电影放映时长）|
| 阶段 | **Phase 0 完成，处于「积累期」**（多归档、按节奏复测、用真实数据校准 schema） |
| 工具链 | camera-capture（拍照采集）已可用；rebuild-clean-exam 已完成主线增强（中间 JSON、预检、字体发现、PDF 校验），非 AI 彩色擦除实验已回退出默认流程 |
| 测试 | `mistakeNote/_system/tests/` 5 个测试，最近一次跑全绿 |

---

## 工具链

| 工具 | 状态 | 路径 | 说明 |
|---|---|---|---|
| **camera-capture** | ✅ 1.0 收工 | `tools/camera-capture/` | 双通道（USB + iPhone Continuity）、4K、标注全套、刷新保留、自动重扫、iPhone 提示卡 |
| **rebuild-clean-exam** | ✅ 主线可用 | `tools/rebuild-clean-exam/` | skill，把孩子作答/批改过的试卷照片重建成干净 PDF；主线依赖 AI/人工识图确认 + ReportLab 重建，不默认做非 AI 颜色擦除 |

两个工具都**完全独立**于领域：camera-capture 默认输出 `tools/camera-capture/captures/`，给 mistakeNote 用就跑 `mistakeNote/拍照.sh`（包装脚本设 `CAMERA_CAPTURE_OUTPUT_DIR`）。未来加 englishNote 等领域，各自写 5 行套壳即可，**工具代码零改动**。

---

## 下一步计划（按 mistakeNote/CLAUDE.md 路线）

**当前阶段唯一该做的事**：

1. 孩子做错题 → 按 5 分钟流程归档（详见 `mistakeNote/CLAUDE.md`）
2. 每周日 5 分钟 grep 复测
3. 真实数据出现痛点后回头调 schema

**当前工作台状态（2026-06-29）**：

- `rebuild-clean-exam` 的主线增强已提交：新增 `questions.json` 中间层、源图预检、字体发现、运行时包装和 PDF 校验增强。
- 非 AI 彩色批改清理脚本实验已回退，不进入默认 Skill 流程；原因是实测会误伤原卷彩色图案，不能可靠区分“原卷彩色内容”和“后来批改”。
- `mistakeNote` 接下来不要继续加工具，除非真实归档中连续出现同一个痛点。

**下一步给用户的动作**：

1. 优先继续积累真实错题：每来一道新错题，按 `mistakeNote/CLAUDE.md` 的 5 分钟流程归档。
2. 如果只是想把做过的试卷变干净：使用 `rebuild-clean-exam` 主线流程，接受“AI/人工确认 + 矢量重建”，不要指望非 AI 自动擦图恢复原卷。
3. 每周日执行复测 grep，把会/不会写回 `review_log` 和 `next_review`。
4. 等错题数到 5-10 道后，只复盘 schema 是否被真实数据顶出问题；不要提前设计 dashboard。

**反目标提醒**（动手前再读一遍）：

- ❌ 不写 web 前端（Phase 2，需 ≥ 20 道错题才启动）
- ❌ 不接 Claude API / OCR / 自动化（Phase 3）
- ❌ 不"先把 schema 设计完美"——schema 由真实数据推
- ❌ 不在归档动作里加任何不直接服务"5 分钟流程"的步骤
- ❌ 不再做新工具或继续做图像擦除实验（camera-capture 和 rebuild-clean-exam 主线暂 freeze，等真实归档量到位）

---

## 升级到 Phase 1 的触发条件

往下一阶段（web 前端）走，需要**同时**满足：

1. 错题数量 ≥ 20 道
2. 复测节奏跑通 ≥ 4 周
3. 手动 grep 开始卡顿（找一道复测 > 30 秒）
4. schema 经过真实数据修正 ≥ 1 次

**距离**：错题数还差 17 道。其他三条需要时间。

---

## 未来扩展路径

如果出现第二个领域（如英语笔记、阅读笔记），按以下方式扩展：

- 在 `childLearn/` 根级新建 `englishNote/` 等平级目录（不要塞进 mistakeNote 下）
- 复用 `tools/camera-capture/`：启动时用 `CAMERA_CAPTURE_PROJECT_ROOT` 指向新领域
- 复用 `tools/rebuild-clean-exam/`：作为 skill 直接 invoke

但当前阶段**不要为此提前抽象**——只有 mistakeNote 一个真实用户时，复杂化结构就是过度工程。
