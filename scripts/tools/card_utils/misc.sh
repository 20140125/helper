#!/bin/bash
# ======================================
# card_utils 子模块：通用工具 & 数据抓取 & 运行环境兜底
# ======================================
# 被 card_utils.sh 主入口 source，禁止直接执行
# 提供：fetch_url / fetch_with_referer / fetch_hn_ai_news_top / trunc_text / ensure_node_in_path
# ======================================

# 带超时的 curl 请求
# 参数: $1=URL $2=超时秒数(可选)
#       - 未传参时默认读取全局 CARD_CURL_TIMEOUT（由 .env/Web 表单配置，兑底 10）
fetch_url() {
  local url="$1" timeout="${2:-${CARD_CURL_TIMEOUT:-10}}"
  local body
  body=$(curl -s --max-time "$timeout" "$url" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)" \
    2>/dev/null)
  # 原始输出模式（data / json）：直接吐接口原始返回，不再渲染卡片
  if [ "${CARD_OUTPUT_MODE:-card}" != "card" ] && command -v emit_raw >/dev/null 2>&1; then
    emit_raw "$body"
  fi
  printf '%s' "$body"
}

# 带 Referer 的 curl 请求（用于腾讯视频等）
# 参数: $1=URL $2=Referer $3=超时秒数(可选，同上默认读 CARD_CURL_TIMEOUT)
fetch_with_referer() {
  local url="$1" referer="$2" timeout="${3:-${CARD_CURL_TIMEOUT:-10}}"
  local body
  body=$(curl -s --max-time "$timeout" "$url" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" \
    -H "Referer: ${referer}" \
    2>/dev/null)
  # 原始输出模式（data / json）：直接吐接口原始返回，不再渲染卡片
  if [ "${CARD_OUTPUT_MODE:-card}" != "card" ] && command -v emit_raw >/dev/null 2>&1; then
    emit_raw "$body"
  fi
  printf '%s' "$body"
}

# 带日内归档缓存的 GET（等价于 fetch_url，但命中缓存时不发请求）
# 参数: $1=api 名（不要带下划线） $2=key（城市/星座等，无则传空字符串）
#       $3=URL $4=超时秒数(可选，同上默认读 CARD_CURL_TIMEOUT)
# 归档位置: .cache/api_responses/<api>_<key>_<YYYY-MM>.json
# 说明: 需要小时级粒度时在前缀加 API_ARCHIVE_SLOT=hour，如
#       API_ARCHIVE_SLOT=hour fetch_url_cached air_quality shenzhen "$url" 15
fetch_url_cached() {
  local api="$1" key="$2" url="$3" timeout="${4:-${CARD_CURL_TIMEOUT:-10}}"
  local cache_file
  cache_file=$(api_cache_path "$api" "$key")
  cached_curl "$cache_file" -s --max-time "$timeout" "$url" \
    -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
    2>/dev/null
}

# 抓取 HN 热门 AI 新闻前 N 条
# 参数: $1=需要的条数（默认 10）
# 输出: 每行一条 "score|title|url"，按 score 降序
fetch_hn_ai_news_top() {
  local limit="${1:-10}"
  local ids
  ids=$(curl -s --max-time 10 "https://hacker-news.firebaseio.com/v0/topstories.json" 2>/dev/null | jq -r '.[0:100][]')
  [ -z "$ids" ] && return 0

  local ai_news="" count=0 id story title url score
  for id in $ids; do
    [ "$count" -ge "$limit" ] && break
    story=$(curl -s --max-time 5 "https://hacker-news.firebaseio.com/v0/item/${id}.json" 2>/dev/null)
    title=$(echo "$story" | jq -r '.title // empty')
    url=$(echo "$story" | jq -r '.url // empty')
    score=$(echo "$story" | jq -r '.score // 0')
    if echo "$title" | grep -qiE 'ai |ai$|artificial|gpt|llm|openai|anthropic|claude|gemini|deepseek|machine.?learn|neural|transformer|diffusion|language.?model|copilot|chatbot|deep.?learn|generat.*(ai|model)|agi |robot|automat|mlops|hugging|token|embedding|fine.?tun|prompt|rlhf|multimodal|vision.?model|agent|reasoning|coding.?ai|sora|midjourney|stable.?diffusion'; then
      ai_news="${ai_news}${score}|${title}|${url}
"
      count=$((count + 1))
    fi
  done

  [ -z "$ai_news" ] && return 0
  echo "$ai_news" | grep -v '^$' | sort -t'|' -k1 -rn | head -n "$limit"
}

# 截断字符串（node 实现，支持中文）
# 参数: $1=字符串 $2=最大长度
trunc_text() {
  local text="$1" max_len="${2:-28}"
  node -e "const s=process.argv[1];console.log(s.length>${max_len}?s.slice(0,${max_len})+'...':s)" "$text"
}

# crontab 等非交互 shell 下 PATH 不含 nvm，裸 `node` 会直接 command not found。
# 该函数扫描常见 nvm / 系统安装位置，把 node 所在目录补进 PATH。
# 返回值：0=当前 shell 已能找到 node；非 0=所有候选位置均未命中（调用方应给出可读错误）。
ensure_node_in_path() {
  command -v node >/dev/null 2>&1 && return 0
  local candidate dir
  for candidate in \
    /usr/local/lib/.nvm/versions/node/*/bin \
    "$HOME/.nvm/versions/node/*/bin" \
    /usr/local/bin \
    /opt/homebrew/bin; do
    # 展开 glob 后逐个试
    for dir in $candidate; do
      if [ -x "$dir/node" ]; then
        export PATH="$dir:$PATH"
        return 0
      fi
    done
  done
  return 1
}
