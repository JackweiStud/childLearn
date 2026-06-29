# 试卷排版与绘图模式

需要生成矢量 PDF、处理特殊符号或修复并排题目间距时读取本文件。

## 字体与特殊符号

正文与符号使用不同字体。不要假设正文字体中的 `□`、`○` 足够大。

优先用 `find_font.py` 的注册封装，它会自动带 `.ttc` 字体集合必需的 `subfontIndex`，避免取错子字体或加载失败：

```python
from find_font import register_with_reportlab

# 注册后即可在样式里使用 "Exam"（中文）与 "Shape"（符号）。
fonts = register_with_reportlab()

def symbol(char, size=15):
    name = fonts.get("symbol", fonts["cjk"])
    return f'<font name="{name}" size="{size}">{char}</font>'
```

若必须手动注册（例如自定义字体名），也要显式传 `subfontIndex`，不能省略：

```python
import json
from pathlib import Path

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

font_report = json.loads(Path("work/<卷名或工作名>/font-report.json").read_text(encoding="utf-8"))
pdfmetrics.registerFont(
    TTFont("Exam", font_report["cjk"]["path"], subfontIndex=font_report["cjk"]["index"] or 0)
)
pdfmetrics.registerFont(
    TTFont("Shape", font_report["symbol"]["path"], subfontIndex=font_report["symbol"]["index"] or 0)
)
```

优先嵌入字体。先运行 `scripts/find_font.py --require-exists` 生成 `font-report.json`；如果缺少中文或符号字体，先安装或指定字体目录，不要把 `/path/to/...` 留在生成脚本里。

## 并排小题

用固定列宽表格，不要用连续空格：

```python
from reportlab.platypus import Paragraph, Table, TableStyle

def subitem_row(items, style, available_width):
    column_width = available_width / len(items)
    table = Table(
        [[Paragraph(x, style) for x in items]],
        colWidths=[column_width] * len(items),
    )
    table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return table

# available_width 使用文档实际可用宽度，例如 SimpleDocTemplate 的 doc.width。

# 两项题和三项题使用同一个函数，不写死毫米数。
subitem_row(["<小题1>", "<小题2>"], style, available_width)
subitem_row(["<小题1>", "<小题2>", "<小题3>"], style, available_width)
```

## 选择题与判断题

- 三个选项使用三等分列，保持字号一致。
- 判断题使用正文列加固定宽度答案列，让括号统一右对齐。
- 图形选项把编号固定在图形下方或左下方，不让编号随图形尺寸漂移。

## 钟表

- 同时绘制外圆、小时刻度、分钟刻度、1-12 数字、时针、分针和中心点。
- 绘制数字前显式设置黑色填充；只设置描边颜色会导致数字继承白色填充而“消失”。
- 钟面下方的时间框使用矢量矩形，不使用字体字形 `□`。
- 在 200-220 DPI 渲染图中确认数字可读、指针没有遮挡关键数字。

## 方格与图形

- 方格用细灰线，题目轮廓用较粗黑线。
- 学生需要补画的线不要提前画入。
- 图形的语义必须与原卷一致；不能为了好看把“稳定结构”和“可变形结构”画反。

## 长题干换行

- 在自然句号、逗号或子问题边界插入受控换行。
- 禁止把姓名、单位、日期、算式或“机器人”等完整词拆开。
- 避免最后一行只剩一到三个字；必要时缩小该题字号 0.3-0.8 pt，而不是压缩全卷。

## 推荐渲染检查

```bash
pdftoppm -png -r 220 exam.pdf /tmp/exam-detail
pdftoppm -png -r 160 exam.pdf /tmp/exam-final
```

先放大检查修改区域，再检查所有页面。
