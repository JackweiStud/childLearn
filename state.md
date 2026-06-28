# childLearn · 整体状态

*最后更新：2026-06-28*

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
| 工具链 | camera-capture（拍照采集）+ rebuild-clean-exam（去涂鸦干净 PDF），均已完成 |
| 测试 | `mistakeNote/_system/tests/` 5 个测试，最近一次跑全绿 |

---

## 工具链

| 工具 | 状态 | 路径 | 说明 |
|---|---|---|---|
| **camera-capture** | ✅ 1.0 收工 | `tools/camera-capture/` | 双通道（USB + iPhone Continuity）、4K、标注全套、刷新保留、自动重扫、iPhone 提示卡 |
| **rebuild-clean-exam** | ✅ 已完成 | `tools/rebuild-clean-exam/` | skill，把孩子作答/批改过的试卷照片重建成干净 PDF |

两个工具都默认服务 mistakeNote，但都跨领域设计——未来加 englishNote 等领域时**不需要改工具代码**，通过参数/环境变量复用。

---

## 下一步计划（按 mistakeNote/CLAUDE.md 路线）

**当前阶段唯一该做的事**：

1. 孩子做错题 → 按 5 分钟流程归档（详见 `mistakeNote/CLAUDE.md`）
2. 每周日 5 分钟 grep 复测
3. 真实数据出现痛点后回头调 schema

**反目标提醒**（动手前再读一遍）：

- ❌ 不写 web 前端（Phase 2，需 ≥ 20 道错题才启动）
- ❌ 不接 Claude API / OCR / 自动化（Phase 3）
- ❌ 不"先把 schema 设计完美"——schema 由真实数据推
- ❌ 不在归档动作里加任何不直接服务"5 分钟流程"的步骤
- ❌ 不再做新工具（camera-capture 和 rebuild-clean-exam 暂 freeze 至少 1 个月，等真实归档量到位）

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
