#!/bin/bash

# ======================================
# 项目路径统一配置
# ======================================
#
# 功能说明：
#   通过本文件自身的位置自动推导项目根目录，
#   无需手动修改，项目移到任何目录都自动适配。
#
# 提供的变量：
#   PROJECT_DIR  - scripts 目录（本文件所在目录）
#   ROOT_DIR     - 项目根目录（scripts 的上级目录）
#   CACHE_DIR    - 缓存目录（项目根目录下的 .cache）
#   ENV_FILE     - 环境变量文件路径（web/.env 优先，缺失时回退 scripts/.env）
#
# 使用方式（在其他脚本开头添加）：
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "${SCRIPT_DIR}/project_config.sh"
#
# 对于 scripts/update-tools/ 子目录下的脚本：
#   SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
#   source "${SCRIPT_DIR}/../project_config.sh"
#
# 作者：智能提醒系统
# 更新：2026-03-10
# ======================================

# scripts 目录（本文件所在目录）
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 项目根目录（scripts 的上级目录）
ROOT_DIR="$(cd "${PROJECT_DIR}/.." && pwd)"

# 缓存目录
CACHE_DIR="${ROOT_DIR}/.cache"

# 环境变量文件：与 Web 服务保持同一优先级——web/.env 优先，缺失时回退 scripts/.env
# 这样脚本与 Web 读到的永远是同一份配置，不会出现「页面改了、提醒没生效」
if [ -f "${ROOT_DIR}/web/.env" ]; then
    ENV_FILE="${ROOT_DIR}/web/.env"
else
    ENV_FILE="${PROJECT_DIR}/.env"
fi

export PROJECT_DIR ROOT_DIR CACHE_DIR ENV_FILE
