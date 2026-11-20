<template>
  <card-panel :title="title" icon="browse" icon-theme="green" class="templates-card" full-height>
    <div class="preview-panel">
      <div v-if="hasContent" class="preview-result">
        <div class="preview-result-header">
          <span class="preview-result-title">
            <t-icon name="check-circle" size="14px" style="color: var(--accent-green); margin-right: 4px;" />
            {{ typeLabel }} · {{ styleLabel }}
          </span>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -- 模板预览：内容经 message-templates-model 渲染并已由 DOMPurify 净化 -->
        <!-- 图片由后端以 Markdown 语法拼进正文，随正文一起渲染，不再单独出图片块 -->
        <div class="preview-content markdown-body" v-html="htmlContent" />
      </div>
    </div>
  </card-panel>
</template>

<script setup lang="ts">
import CardPanel from '@/components/common/card-panel.vue';

defineProps<{
  /** 卡片标题 */
  title: string;
  /** 类型标签（用于结果头部展示） */
  typeLabel: string;
  /** 风格标签（用于结果头部展示） */
  styleLabel: string;
  /** 是否有可预览的内容 */
  hasContent: boolean;
  /** 渲染后的 HTML 字符串 */
  htmlContent: string;
}>();
</script>

<style scoped>
@import "@/styles/common.css";

.templates-card {
  flex: 1;
  min-width: 0;
}

/* ── 预览区 ── */
.preview-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 22px;
  overflow: hidden;
}

/* 预览结果 */
.preview-result {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.preview-result-header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  flex-wrap: wrap;
  gap: 8px;
}

.preview-result-title {
  font-size: 13px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
}

.preview-content {
  padding: 16px;
  font-size: 14px;
  line-height: 1.8;
  word-break: break-word;
  color: var(--text-primary);
  margin: 0;
}

/* ── 正文里的图片 ── */
.preview-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  margin: 6px 0;
}

/* 列表条目自带的封面：与文字同行的缩略图，保证「一条数据配一张图」 */
.preview-content :deep(li img) {
  display: inline-block;
  max-height: 64px;
  width: auto;
  vertical-align: middle;
  margin: 2px 8px 2px 0;
}

/* ── 移动端适配（≤768px） ── */
@media (max-width: 768px) {
  /* 预览 Card：缩小 padding */
  .preview-panel {
    padding: 14px;
  }

  /* 预览结果区域设置固定最小高度 */
  .preview-result {
    min-height: 200px;
  }

  /* 预览头部缩小 */
  .preview-result-header {
    padding: 6px 10px;
  }

  .preview-result-title {
    font-size: 12px;
  }

  /* 预览内容缩小间距 */
  .preview-content {
    padding: 12px;
    font-size: 13px;
    line-height: 1.7;
  }
}
</style>
