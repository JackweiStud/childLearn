#!/usr/bin/env bash
# 错题拍照台 - mistakeNote 专用启动脚本
# 把通用的 camera-capture 工具接入 mistakeNote 的归档结构：
#   输出到 mistakeNote/_inbox/scans/YYYY-MM-DD/，保持 5 分钟流程不变
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export CAMERA_CAPTURE_OUTPUT_DIR="${SCRIPT_DIR}/_inbox/scans"

mkdir -p "${CAMERA_CAPTURE_OUTPUT_DIR}"
exec bash "${SCRIPT_DIR}/../tools/camera-capture/start.sh"
