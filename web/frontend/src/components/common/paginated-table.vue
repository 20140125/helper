<template>
  <!-- 表格与分页组合：列插槽、表格事件均原样透传给 t-table -->
  <div class="paginated-table">
    <t-table
      v-bind="$attrs"
      :data="displayData"
      :columns="columns"
      :row-key="rowKey"
      :size="size"
      :empty="empty"
      :loading="loading"
      :hover="hover"
      :stripe="stripe"
    >
      <template v-for="(_, name) in $slots" #[name]="slotProps">
        <slot :name="name" v-bind="slotProps ?? {}" />
      </template>
    </t-table>

    <div v-if="showPager" class="paginated-table__pager">
      <t-pagination
        v-model="page"
        :page-size="pageSize"
        :total="totalCount"
        :total-content="showTotal"
        :page-size-options="pageSizeOptions"
        :show-page-size="showPageSize"
        :disabled="loading"
        @change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import type { PageInfo } from 'tdesign-vue-next';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<{
  /** 表格数据，服务端分页传当前页数据，本地分页传全量数据 */
  data: unknown[];
  /** t-table 列定义，兼容页面现有的多种列描述符类型 */
  columns: unknown[];
  /** 服务端分页时的后端总条数，本地分页时忽略 */
  total?: number;
  /** 是否服务端分页，为 true 时组件只负责翻页事件、不切分数据 */
  remote?: boolean;
  /** 表格行唯一键 */
  rowKey?: string;
  /** 空状态文案，不传则使用 TDesign 内置文案 */
  empty?: string;
  /** 表格加载中状态 */
  loading?: boolean;
  /** 表格尺寸 */
  size?: 'small' | 'medium' | 'large';
  /** 是否显示行悬停高亮 */
  hover?: boolean;
  /** 是否显示斑马纹 */
  stripe?: boolean;
  /** 每页条数下拉选项，开启 showPageSize 时生效，默认包含项目常用的 15 / 20 */
  pageSizeOptions?: number[];
  /** 是否显示总条数文案，默认不显示（列表标题区已有总数） */
  showTotal?: boolean;
  /** 是否显示每页条数下拉，默认不显示 */
  showPageSize?: boolean;
  /** 数据不足一页时是否隐藏分页条 */
  hideOnSinglePage?: boolean;
}>(), {
  total: 0,
  remote: false,
  rowKey: 'id',
  loading: false,
  size: 'medium',
  hover: true,
  stripe: true,
  pageSizeOptions: () => [10, 15, 20, 50, 100],
  showTotal: false,
  showPageSize: false,
  hideOnSinglePage: true,
});

const emit = defineEmits<{
  /** 分页变化（页码或每页条数），服务端分页时在此重新加载数据 */
  (e: 'page-change', pageInfo: PageInfo): void;
}>();

/** 当前页码（v-model:page，Vue 3.4+ defineModel 语法糖） */
const page = defineModel<number>('page', { default: 1 });

/** 每页条数（v-model:pageSize，Vue 3.4+ defineModel 语法糖） */
const pageSize = defineModel<number>('pageSize', { default: 15 });

/** 展示总条数：服务端分页取 total，本地分页取数据长度 */
const totalCount = computed(() => props.remote ? props.total : props.data.length);

/** 实际渲染的数据：服务端分页直接用 data，本地分页按页码切片 */
const displayData = computed(() => props.remote
  ? props.data
  : props.data.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));

/** 是否显示分页条 */
const showPager = computed(() => !props.hideOnSinglePage || totalCount.value > pageSize.value);

/** 本地分页数据减少或每页条数变大时回退到最后一页，避免空白页 */
watch([totalCount, pageSize], () => {
  if (props.remote) return;
  const maxPage = Math.max(1, Math.ceil(totalCount.value / pageSize.value));
  if (page.value > maxPage) page.value = maxPage;
});

/** 同步页码与每页条数后通知父组件 */
const handlePageChange = (pageInfo: PageInfo): void => {
  page.value = pageInfo.current;
  pageSize.value = pageInfo.pageSize;
  emit('page-change', pageInfo);
};
</script>

<style scoped>
.paginated-table__pager {
  padding-top: 16px;
}
</style>
