# _复习 · 打印复习卷归档

这个目录放**给孩子打印用的错题复习卷 HTML**,跟错题归档区分开:
- `错题/<日期>-题目名/` —— 单题完整资料(note + 互动版 + 变形题答案)
- `_复习/<日期>-错题复习卷.html` —— 多道题汇编,A4 排版,不含答案,Chrome ⌘P 另存 PDF 打印

---

## 下次怎么让 Claude 再生成一份

直接把下面这句话(改路径)发给 Claude:

> 把 `<错题文件夹路径列表>` 这几道题整理成**孩子打印复习卷 HTML**,按 `二年级/数学/_复习/2026-06-21-错题复习卷.html` 的样式:一题一页 A4,章节号 `一/1.1 原题/1.2 错点+考察点+解题思路/1.3 举一反三`,变形题不印答案。输出到 `二年级/数学/_复习/<日期>-错题复习卷.html`。

要调整就追加差异点,例如:
- "字号整体放大 2pt"
- "变形题扩到 5 道"
- "加一页家长答案放最后,印完撕掉"

---

## 打印操作

1. 浏览器双击 HTML
2. `⌘P` → 目标"另存为 PDF"
3. **关掉"页眉和页脚"**,边距"默认"
4. 保存 → 打印

---

## ⚠️ 已知坑(生成 HTML 时必须遵守)

### 坑 1:macOS Chrome 打印 PDF 时 PingFang SC 中文全消失

**症状**:Chrome ⌘P 另存 PDF 后,中文字全没了,只剩背景框、虚线、数学符号——文字位置一片空白。

**根因**:macOS (Sonoma / Sequoia) + Chrome (Skia PDF 引擎) 的已知 Bug——苹果系统字体 **PingFang SC / 苹方** 嵌入 PDF 失败,字符渲染为透明。屏幕预览正常,导出 PDF 才暴露。

**强制规则**(写新复习卷 HTML 时必须照做):
- **屏幕字体可以用 PingFang SC**(好看)
- **但 `@media print` 里必须强制覆盖成 STHeiti / Heiti SC** 等老牌系统字体

最小代码模板:

```css
@media print {
  body, .page, .question, .explain, .variation, h1, h2, p, ol, li, span {
    font-family: "STHeiti", "Heiti SC", "Hiragino Sans GB",
                 "Microsoft YaHei", "Source Han Sans SC",
                 sans-serif !important;
  }
}
```

**`!important` 不能省**——要覆盖元素内联 / 局部 font-family。

**验证**:每次生成完,自己 ⌘P 另存一次 PDF,用 Preview 打开看中文是不是真的在,**不要相信浏览器预览态**。

### 排版规则:字号梯度(关键!别用一个字号到底)

孩子打印卷上,**题面要醒目、讲解要紧凑**——讲解部分孩子扫一眼就行,不是用来逐字读的。字号梯度按下表来:

| 区域 | 字号 | 行距 |
|---|---|---|
| 题名 `一/二/三` | 24pt | 默认 |
| 原题题面 `.question` | 17pt | 1.85 |
| 变形题 `.variation` | 16pt | 2.0 |
| **节标题 `1.2/1.3` `.section`** | **14pt** | 紧 |
| **讲解正文 `.explain`** | **12pt** | **1.55**(段距 4px) |
| **解题步骤 `ol.solution`** | **12pt** | **1.6**(li 间距 2px) |

**别犯的错**:把"错点/考察点/解题思路"也用 14pt+,行距 1.85+——讲解块会占满半页,挤掉变形题。**讲解 12pt + 1.55 行距是底线,不要再放大**。

### 坑 2:相邻题想合并为同一页(可选,按需用)

默认 `.page { page-break-after: always }` 让每道题独占一页。如果某两题加起来排得下、想合并:

```css
.no-break {
  page-break-after: auto !important;
  break-after: auto !important;
}
```

需要合并的前一题 div 加 `class="page no-break"`,后一题保持 `class="page"`,顶部黄色提示条的"共 N 页"文案同步改。
