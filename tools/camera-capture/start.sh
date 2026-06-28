#!/usr/bin/env bash
# 一键启动拍照台（独立工具，默认输出到工具旁边的 captures/）
# 如需输出到其他位置，启动前 export CAMERA_CAPTURE_OUTPUT_DIR=<绝对路径>
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=8731
URL="http://localhost:${PORT}"

echo "启动拍照台..."
echo "输出目录: ${CAMERA_CAPTURE_OUTPUT_DIR:-${SCRIPT_DIR}/captures}"
echo "访问地址: ${URL}"
echo "按 Ctrl+C 停止服务"
echo "----------------------------------------"

cd "${SCRIPT_DIR}"
node src/server.cjs
