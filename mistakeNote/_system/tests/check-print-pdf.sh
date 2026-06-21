#!/usr/bin/env bash
# 验证打印用 HTML 的中文字体能正确嵌入 PDF(防 PingFang SC 翻车坑)
#
# 用法:
#   ./_system/tests/check-print-pdf.sh <html路径> [中文测试词1] [中文测试词2] ...
# 不传测试词时,默认抽几个常见中文字标(原题 / 错点 / 举一反三)
#
# 退出码:0 = 字体嵌入正常;1 = 中文丢失(字体翻车);2 = 用法/依赖错误

set -euo pipefail

HTML="${1:-}"

if [ -z "$HTML" ]; then
  echo "用法: $0 <html路径> [中文测试词...]"
  exit 2
fi

if [ ! -f "$HTML" ]; then
  echo "❌ 文件不存在: $HTML"
  exit 2
fi

if ! command -v pdftotext &> /dev/null; then
  echo "❌ 缺依赖 pdftotext。装一下: brew install poppler"
  exit 2
fi

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ ! -x "$CHROME" ]; then
  echo "❌ Chrome 找不到: $CHROME"
  exit 2
fi

shift || true
TEST_WORDS=("$@")
if [ ${#TEST_WORDS[@]} -eq 0 ]; then
  TEST_WORDS=("原题" "错点" "举一反三")
fi

TMP_PDF="$(mktemp -t print-font-check).pdf"
ABS_HTML="$(cd "$(dirname "$HTML")" && pwd)/$(basename "$HTML")"

echo "→ headless chrome 渲染 PDF..."
"$CHROME" --headless --disable-gpu --no-sandbox \
  --print-to-pdf="$TMP_PDF" "file://$ABS_HTML" 2>/dev/null

if [ ! -s "$TMP_PDF" ]; then
  echo "❌ PDF 生成失败(0 字节)"
  exit 1
fi

echo "→ pdftotext 抽文字..."
TEXT="$(pdftotext "$TMP_PDF" - 2>/dev/null)"

FAIL=0
for word in "${TEST_WORDS[@]}"; do
  if echo "$TEXT" | grep -q "$word"; then
    echo "  ✅ '$word' 在 PDF 中可被搜索"
  else
    echo "  ❌ '$word' 在 PDF 里搜不到 → 字体可能没嵌入"
    FAIL=1
  fi
done

CHARS="$(printf %s "$TEXT" | wc -c | tr -d ' ')"
echo ""
if [ $FAIL -eq 1 ]; then
  echo "❌ 字体嵌入检查失败(总抽出 $CHARS 字符)"
  echo "   可能原因:"
  echo "     - @media print 没强制覆盖到 STHeiti / Heiti SC + !important"
  echo "     - Chrome / 系统版本变了又引入新坑"
  echo "   PDF 留在: $TMP_PDF  (用 Preview 打开,看中文是不是空白)"
  exit 1
fi

rm -f "$TMP_PDF"
echo "✅ 字体嵌入检查通过(共抽出 $CHARS 字符)"
