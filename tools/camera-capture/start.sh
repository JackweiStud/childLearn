#!/usr/bin/env bash
# 一键启动拍照台：启动后端服务 + 自动打开浏览器
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8731
URL="http://localhost:${PORT}"

echo "启动拍照台..."
echo "输出目录: ${CAMERA_CAPTURE_PROJECT_ROOT:-$SCRIPT_DIR/../../mistakeNote}/_inbox/scans/"
echo "访问地址: ${URL}"
echo "按 Ctrl+C 停止服务"
echo "----------------------------------------"

cd "${SCRIPT_DIR}"
node src/server.cjs
