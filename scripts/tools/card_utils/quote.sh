#!/bin/bash
# ======================================
# card_utils 子模块：腾讯行情统一取数
# ======================================
# 被 card_utils.sh 主入口 source，禁止直接执行
# 提供：fetch_gtimg_quotes
# ======================================
#
# 背景：A股 / 港股 / 美股 / 黄金白银四张卡片原本各自请求
#   https://qt.gtimg.cn/q=<自己的代码>
# 标的完全不同，但接口是同一个、支持一次传多个代码。四个脚本是独立进程，
# 一天内被各调用一次就是 4 趟 HTTP。这里改成：一次请求拉全量代码，
# 结果落到「分钟级」共享缓存，同一分钟内其余卡片直接命中，4 趟变 1 趟。
#
# 为什么是分钟级而不是小时级：行情是实时数据，小时级会让卡片显示一小时内
# 的旧价；分钟级既能合并同一批次的请求，又不会让用户看到明显滞后的价格。
#
# 数据格式：腾讯返回 GBK 文本，形如
#   v_sh000001="1~上证指数~000001~3808.05~...";
# 本模块统一 iconv 成 UTF-8 再吐出，调用方按自己的代码 grep 行即可。

# 全量行情代码（A股指数 + 港股指数 + 美股指数 + 黄金白银）
# 新增行情卡片时把代码追加到这里，即可自动共享同一次请求
GTIMG_ALL_CODES="sh000001,sz399001,sz399006,sh000688,sh000698,sh000680,hkHSI,hkHSCEI,hkHSTECH,usNDX,usDJI,usINX,hf_GC,hf_SI"

# 拉取行情原始文本（GBK 已转 UTF-8）
# 参数：$@... 可选，只保留这些代码的行（如 sh000001 hkHSI）；不传则返回全量。
#       传代码能让 data / json 原始输出模式只吐本卡片相关的数据，不夹带其它市场
# 输出：stdout 输出腾讯原始响应（UTF-8）；失败或无匹配行返回 1 且无输出
# 用法：raw=$(fetch_gtimg_quotes hf_GC hf_SI) || exit 1
fetch_gtimg_quotes() {
    local cache_file
    cache_file=$(api_cache_path gtimgquotes all)

    # 先读分钟级共享缓存：同一分钟内的其它行情卡片直接复用，不再发请求。
    # slot 粒度必须在读/写调用上显式指定（只加在 api_cache_path 上不生效，
    # 因为槽位是在 python 侧按环境变量算的）
    # 读共享缓存时临时把输出模式切成 card：read_cached_api_response 在 data / json
    # 模式下会顺手 emit_raw 整份原始响应，而共享缓存里存的是全市场 14 个代码，
    # emit_raw 又「只保留第一个数据源」—— 那样本卡片过滤后的数据会被挤掉，
    # data 模式吐出别的市场行情。这里屏蔽掉，由调用方自己 emit 过滤后的结果。
    local saved_mode="${CARD_OUTPUT_MODE:-card}"
    local body=""
    export CARD_OUTPUT_MODE=card
    if ! body=$(API_ARCHIVE_SLOT=minute read_cached_api_response "${cache_file}") \
        || [ -z "${body}" ]; then
        # 未命中 → 一次请求拉全量代码（GBK → UTF-8 后再缓存，避免乱码入库）
        body=$(curl -s --max-time 10 "https://qt.gtimg.cn/q=${GTIMG_ALL_CODES}" 2>/dev/null \
            | iconv -f GBK -t UTF-8 2>/dev/null)
        if [ -z "${body}" ]; then
            return 1
        fi
        # 归档失败不阻断（数据已拿到，缓存只是优化）
        API_ARCHIVE_SLOT=minute archive_api_response "${cache_file}" "${body}" 2>/dev/null || true
    fi
    export CARD_OUTPUT_MODE="${saved_mode}"

    # 未指定代码 → 返回全量；否则只保留指定代码的行
    if [ "$#" -eq 0 ]; then
        printf '%s' "${body}"
        return 0
    fi

    local pattern="" code
    for code in "$@"; do
        if [ -n "${pattern}" ]; then
            pattern="${pattern}|"
        fi
        pattern="${pattern}v_${code}="
    done
    printf '%s' "${body}" | grep -E "^(${pattern})" || return 1
}
