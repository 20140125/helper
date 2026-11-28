<template>
  <div class="access-log-viewer flex-fill-col">
    <!-- 空状态 -->
    <div v-if="!content" class="empty-tip">
      <t-icon name="file-unknown" size="40px" style="color: var(--text-muted);" />
      <p style="color: var(--text-muted);">{{ displayEmptyText }}</p>
    </div>

    <!-- 加载中 -->
    <div v-else-if="loading" class="empty-tip">
      <loading-spinner :t="t" :size="20" text="" />
    </div>

    <!-- 日志条目列表 -->
    <div v-else-if="entries.length > 0" ref="scrollRef" class="log-entries custom-scrollbar">
      <div v-for="(entry, idx) in entries" :key="idx" class="log-entry">
        <!-- 头部：方法 + 路径 + 时间 -->
        <div class="entry-header">
          <span :class="['method-badge', `method-${entry.method.toLowerCase()}`]">{{ entry.method }}</span>
          <span class="entry-url">{{ entry.url }}</span>
          <span class="entry-spacer" />
          <span :class="['status-badge', statusClass(entry.status)]">{{ entry.status }}</span>
          <span class="entry-duration">{{ entry.duration }}</span>
        </div>

        <!-- 元信息：用户 + 时间 -->
        <div class="entry-meta">
          <span class="meta-item">
            <t-icon name="user" size="12px" />
            {{ entry.user }}
          </span>
          <span class="meta-item">
            <t-icon name="time" size="12px" />
            {{ entry.time }}
          </span>
        </div>

        <!-- 响应体 -->
        <div v-if="entry.body" class="entry-body">
          <div class="body-label">{{ props.t.logs.accessLogBody }}</div>
          <pre class="body-content custom-scrollbar-sm">{{ formatJsonBody(entry.body) }}</pre>
        </div>
      </div>
    </div>

    <!-- 内容无法解析时 fallback 到纯文本 -->
    <pre v-else ref="scrollRef" class="plain-text custom-scrollbar">{{ content }}</pre>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import LoadingSpinner from '@/components/common/loading-spinner.vue';
import type { Locale } from '@/locales/zh';
import {
  ACCESS_LOG_USER_MARKER,
  ACCESS_LOG_STATUS_MARKER,
  ACCESS_LOG_DURATION_MARKER,
  ACCESS_LOG_BODY_MARKER,
} from '@/constants/access-log';
import type { LogEntry } from '@/types/common';

const props = withDefaults(defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 日志文本内容 */
  content: string;
  /** 是否加载中 */
  loading?: boolean;
  /** 空状态文案 */
  emptyText?: string;
}>(), {
  loading: false,
  emptyText: '',
});

/** 日志为空时的提示（prop 优先，fallback 到 locale） */
const displayEmptyText = computed(() => props.emptyText || props.t.logs.accessLogEmpty);

const scrollRef = ref<HTMLElement | null>(null);


/**
 * 解析 access log 文本为结构化的日志条目
 *
 * 格式示例：
 * ────────────────────────────────────────────────────────
 * ▸ 2026-04-03 11:30:00  GET /api/trigger
 *   用户: admin@example.com  |  状态: 200  |  耗时: 12ms
 *   响应:
 *   {
 *     "ok": true
 *   }
 */
const entries = computed<LogEntry[]>(() => {
  if (!props.content) return [];

  try {
    // 按分隔线分割为区块
    const blocks = props.content.split(/─{10,}/);
    const result: LogEntry[] = [];

    for (const block of blocks) {
      const trimmed = block.trim();
      if (!trimmed) continue;

      // 匹配头部行：▸ 2026-04-03 11:30:00  GET /api/trigger
      const headerMatch = trimmed.match(/▸\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\w+)\s+(.+?)$/m);
      if (!headerMatch) continue;

      const [, time, method, url] = headerMatch;

      // 匹配元信息行：用户: xxx  |  状态: 200  |  耗时: 12ms
      const metaPattern = new RegExp(
        `${ACCESS_LOG_USER_MARKER}\\s*(.+?)\\s*\\|\\s*${ACCESS_LOG_STATUS_MARKER}\\s*(\\d+)\\s*\\|\\s*${ACCESS_LOG_DURATION_MARKER}\\s*(.+?)$`,
        'm',
      );
      const metaMatch = trimmed.match(metaPattern);
      const user = metaMatch?.[1] ?? '-';
      const status = metaMatch?.[2] ?? '-';
      const duration = metaMatch?.[3] ?? '-';

      // 提取响应体（在 BODY_MARKER 之后的内容）
      let body = '';
      const bodyIdx = trimmed.indexOf(ACCESS_LOG_BODY_MARKER);
      if (bodyIdx !== -1) {
        body = trimmed.slice(bodyIdx + ACCESS_LOG_BODY_MARKER.length).trim();
        // 去除每行开头的 2 空格缩进
        body = body.split('\n').map(line =>
          line.startsWith('  ') ? line.slice(2) : line
        ).join('\n').trim();
      }

      result.push({ time, method, url: url.trim(), user: user.trim(), status, duration: duration.trim(), body });
    }

    return result;
  } catch {
    return [];
  }
});

const statusClass = (status: string): string => {
  const code = parseInt(status, 10);
  if (code >= 200 && code < 300) return 'status-ok';
  if (code >= 300 && code < 400) return 'status-redirect';
  if (code >= 400 && code < 500) return 'status-client-err';
  return 'status-server-err';
};

/**
 * 递归展开嵌套 JSON：若某字段值为一段合法 JSON 字符串，则解析为对象，
 * 以便外层 stringify 时能作为结构化 JSON 展示，而不是一整行转义字符串。
 *
 * 典型场景：API 代理响应体 `data.body` 的值是子接口返回的 JSON 字符串
 * （如 `"{\"code\":0,...}"`），肉眼阅读非常困难。
 */
const expandNestedJson = (input: unknown): unknown => {
  if (typeof input === 'string') {
    const trimmed = input.trim();
    // 仅当字符串以 { 或 [ 开头，才尝试解析，避免把普通字符串（如日期）误当 JSON
    if (
      (trimmed.startsWith('{') && trimmed.endsWith('}'))
      || (trimmed.startsWith('[') && trimmed.endsWith(']'))
    ) {
      try {
        return expandNestedJson(JSON.parse(trimmed));
      } catch {
        return input;
      }
    }
    return input;
  }
  if (Array.isArray(input)) {
    return input.map((item) => expandNestedJson(item));
  }
  if (input && typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      result[key] = expandNestedJson(value);
    }
    return result;
  }
  return input;
};

/**
 * 对 body 文本做二次美化：
 * - 如果是合法 JSON 字符串则重新格式化（修正后端截断导致的单行问题）
 * - 嵌套字段值若本身也是 JSON 字符串则递归展开为结构化 JSON
 * - 否则原样返回
 */
const formatJsonBody = (body: string): string => {
  try {
    const parsed = JSON.parse(body);
    return JSON.stringify(expandNestedJson(parsed), null, 2);
  } catch {
    return body;
  }
};

// 内容变化后滚到底部
watch(
  () => [props.content, props.loading],
  async ([newContent, newLoading]) => {
    if (newLoading || !newContent) return;
    await nextTick();
    if (scrollRef.value) {
      scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
    }
  },
);
</script>

<style scoped>
@import "@/styles/common.css";
@import "@/styles/scrollbar.css";



.log-entries {
  flex: 1;
  overflow: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}


/* ── 单条日志卡片 ── */
.log-entry {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px 14px;
  transition: border-color 0.15s;
}

.log-entry:hover {
  border-color: var(--border-hover);
}

/* ── 头部行 ── */
.entry-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
}

.method-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 4px;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.method-get {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}
.method-post {
  background: rgba(99, 102, 241, 0.15);
  color: #818cf8;
}
.method-put, .method-patch {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}
.method-delete {
  background: rgba(244, 63, 94, 0.15);
  color: #f43f5e;
}

.entry-url {
  color: var(--text-primary);
  font-weight: 500;
  word-break: break-all;
  min-width: 0;
}

.entry-spacer {
  flex: 1;
}

.status-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 1px 8px;
  border-radius: 4px;
  flex-shrink: 0;
}

.status-ok {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}
.status-redirect {
  background: rgba(34, 211, 238, 0.15);
  color: #22d3ee;
}
.status-client-err {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}
.status-server-err {
  background: rgba(244, 63, 94, 0.15);
  color: #f43f5e;
}

.entry-duration {
  color: var(--text-muted);
  font-size: 12px;
  flex-shrink: 0;
}

/* ── 元信息行 ── */
.entry-meta {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

/* ── 响应体 ── */
.entry-body {
  margin-top: 8px;
  border-top: 1px solid var(--border-color);
  padding-top: 8px;
}

.body-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.body-content {
  margin: 0;
  padding: 8px 10px;
  background: var(--bg-primary);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--log-code-color);
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 200px;
  overflow: auto;
}



/* ── 移动端适配 ── */
@media (max-width: 768px) {
  .log-entries {
    padding: 8px 10px;
    gap: 6px;
  }

  .log-entry {
    padding: 10px 12px;
  }

  .entry-header {
    flex-wrap: wrap;
  }

  .entry-url {
    font-size: 12px;
  }

  .entry-spacer {
    display: none;
  }

  .entry-meta {
    flex-wrap: wrap;
    gap: 8px;
  }
}
</style>