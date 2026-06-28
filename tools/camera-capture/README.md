# 拍照台（独立采集工具）

把纸质试卷/作业拍下来，按日期归档为 JPG + JSON 配对文件。

**完全独立**：工具不假设任何"项目结构"，默认输出到工具自己旁边的 `captures/` 目录。调用方按需通过环境变量接入自己的目录。

## 启动

### 裸跑（默认输出到 `tools/camera-capture/captures/`）

```bash
cd /Users/jackwl/Code/childLearn/tools/camera-capture
npm run camera
# 或
bash start.sh
```

默认打开：`http://localhost:8731`，输出到工具旁边的 `captures/YYYY-MM-DD/`。

### 给某个项目用（指定输出目录）

启动前 export 环境变量 `CAMERA_CAPTURE_OUTPUT_DIR` 指向目标绝对路径：

```bash
# 例：给 mistakeNote 用（写到错题归档入口）
CAMERA_CAPTURE_OUTPUT_DIR=/Users/jackwl/Code/childLearn/mistakeNote/_inbox/scans \
  npm run camera
```

`mistakeNote` 提供了开箱即用的包装脚本：

```bash
bash /Users/jackwl/Code/childLearn/mistakeNote/拍照.sh
```

未来 `englishNote` / `readingNote` 等领域同理——各自写个 `拍照.sh` 套壳即可，工具代码零改动。

浏览器第一次访问会请求摄像头权限。允许后，页面优先选名称含 `USB Camera` 的设备。

## 输出格式

每次拍照生成两份配对文件：

```text
<outputDir>/YYYY-MM-DD/YYYYMMDD-HHMMSS-usb-camera-001.jpg   ← 原始图（含标注）
<outputDir>/YYYY-MM-DD/YYYYMMDD-HHMMSS-usb-camera-001.json  ← 元数据
```

元数据 JSON 里 `status: 'unprocessed'` 表示还没被下游消费。下游处理完后应更新此字段。

## 能力清单（当前实际支持的功能）

### 📷 采集
- USB 摄像头 + iPhone Continuity Camera 双通道（WebRTC 优先 / ffmpeg AVFoundation 兜底）
- 摄像头切换、刷新设备列表
- **启动后 3 秒自动静默重扫**——捕获 macOS 异步注册的 iPhone（Continuity Camera 经常迟到）
- **iPhone 未检测时主动提示**——列表里没看到 iPhone 时显示橙色提示卡，列出 5 条 macOS Continuity Camera 触发条件
- 4K / 1080p / 720p 分辨率切换（native 通道自动灰显，仅 WebRTC 可选）
- 实时预览 + 显示实际分辨率
- 默认不开摄像头，放好试卷后手动开启

### 🖊️ 标注（全部画入保存的 JPG）
- 矩形、圆形、自由画笔、橡皮擦、**插入文字**
- **多色画笔**：红 / 蓝 / 绿 / 黑 / 黄
- **文字工具**：5 种字体（系统/宋/黑/楷/等宽）× 6 种字号（16-64px）× 复用颜色选择
- 撤销上一笔（⌘Z）、清空全部（ESC）
- **区域截图**：crop 工具画框 → 拖把手微调 → 确认即保存为独立 JPG，蓝色虚线 + 遮罩反馈

### 🎛️ 画质调节
- 硬件控制：缩放/亮度/对比度/饱和度/锐度/曝光/焦距/色温（取决于设备 `getCapabilities()` 暴露）
- 硬件枚举：对焦/曝光/白平衡模式
- 软件兜底：缩放（1×–3×，中心裁剪）/ 亮度 / 对比度 / 饱和度（CSS filter，同时影响预览和保存）
- 硬件优先，缺什么补什么
- 自动过曝/过暗检测（每 1.5 秒采样）

### 🚧 拍摄辅助
- A4 参考框（竖版/横版/关闭）
- 画面旋转 90°（含旋转后标注坐标的正确映射）
- 全屏取景标注（含全屏后 canvas 重绘）

### 💾 存储与回看
- 自动按日期建目录 `_inbox/scans/YYYY-MM-DD/`
- JPG + JSON 配对保存，同秒文件序号防碰撞
- 元数据包含：时间、设备、分辨率、质量、阶段、subject/difficulty/notes 等
- 最近拍摄列表（最多 10 条）：
  - **刷新页面后保留**（启动时拉 `GET /api/captures?limit=10` 扫今天目录）
  - 双击调用 macOS 原生 Preview 看大图
  - 单击「复制」按钮复制绝对路径
  - 单击「删除」按钮物理删除 JPG + JSON
- 一键 Finder 打开保存目录

### ⌨️ 快捷键
- `⌘S`：拍照保存
- `⌘Z`：撤销最近一笔
- `ESC`：清空所有标注

### 🎨 UI
- 暖色调主题 + 暗色工具栏（与黑色视频画板融洽）
- 左右工具栏可折叠（边缘 toggle 按钮）
- 底部日志抽屉（fixed bottom sheet，向上遮挡不撑页面）
- 全屏按钮固定右上角

## iPhone Continuity Camera 现状

工具已经做到的两条通道：

1. **Continuity Camera Webcam → WebRTC 通道** ✅
   - iPhone 在 macOS 注册成功后会出现在浏览器 `enumerateDevices` 列表里
   - 走 `getUserMedia` 拉流，跟普通 USB 摄像头一样用
   - 优点：可控的分辨率、可用硬件 control

2. **AVFoundation 兜底 → native 通道** ✅
   - 若浏览器没把 iPhone 暴露出来，工具会通过 `ffmpeg -list_devices` 检测，并作为 `[系统原生]` 选项追加
   - 后端通过 ffmpeg MJPEG 推流给前端轮询
   - 适用：iPhone 在 macOS AVFoundation 注册了但浏览器没拿到

工具未做（**且按设计明确不做**）：

- ❌ Continuity Camera Scan Documents 导入（iPhone 端的扫描文档功能）
  - 它不是普通 webcam 流，不能直接嵌进浏览器
  - 计划方向：监听 `_inbox/` 文件夹接收扫描结果（state.md 中期方向，未实现）

## 摄像头调节边界

页面在摄像头开启后读取浏览器 `getCapabilities()`，按设备能力动态渲染硬件 control。

**能力受限场景**：某些 USB 摄像头硬件支持调节但浏览器没暴露接口，页面会明确显示「当前设备/浏览器没有暴露硬件调节项」，自动切到软件兜底。

**软件兜底**：CSS filter 实现，能调亮度/对比度/饱和度/缩放，但**不能替代光学行为**——焦距、自动对焦、真正的镜头变焦做不到。文字糊了还是要调摄像头距离或换设备。

## 测试

```bash
# 后端核心逻辑
node mistakeNote/_system/tests/camera-capture.test.cjs

# UI 关键交互
node mistakeNote/_system/tests/camera-capture-ui.test.cjs

# 软件滤镜参数转换
node mistakeNote/_system/tests/camera-capture-effects.test.cjs
```

## 当前不做的事（明确边界）

下面这些属于错题管线的下游，不在 camera-capture 范围内：

- ✗ OCR 文字识别
- ✗ 自动识别错题（区分题目和评卷批注）
- ✗ 自动切题（从整张试卷裁出单道题）
- ✗ 自动归档到 `二年级/数学/错题/`
- ✗ 生成复习卷

`status: 'unprocessed'` 这个字段就是给下游用的——下游处理完应该改成对应状态。
