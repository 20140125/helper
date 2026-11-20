/**
 * 脚手架模板（Type / Service / Model / View）
 *
 * 背景：generate-page 与 generate-component 各自维护了一套 model/service 模板，
 * 已经漂移出实质差异 —— generate-page 用的是 `import BaseModel from './base-model'`
 * （默认导入，而 base-model 只有具名导出），service 还引用了项目中根本不存在的
 * `returnResponse` 和 `this.http`，生成出来的文件直接编译不过。
 *
 * 现在收敛为一份，两个生成器共用，且严格按项目现状生成：
 *   - BaseModel：import { BaseModel } from '@/models/base-model'（具名导出）
 *   - BaseService：import { BaseService } from './base-service'（具名导出）
 *   - HTTP 快捷方法：this.get<T> / post<T> / put<T> / del<T>（注意是 del，不是 delete）
 *   - Service / Model 方法用箭头函数属性（与 services/ 现有写法一致）
 *   - 文件名与类型导入路径统一 kebab-case（types/greetings.ts、greetings-service.ts）
 */

import { toPascalCase as pascalCase, toCamelCase as camelCase, toKebabCase as kebabCase } from './naming';

/** 脚手架生成选项 */
export interface ScaffoldOptions {
  /** 是否接入 i18n（useLocaleStore + t） */
  withI18n?: boolean;
  /** 是否生成列表查询参数 QueryParams（默认 true） */
  withList?: boolean;
  /** 是否生成表单数据 FormData（默认 true） */
  withForm?: boolean;
  /** 是否生成列表响应 ListResponse（默认 true） */
  withListResponse?: boolean;
  /** 是否生成详情响应 DetailResponse（默认 false，Service 直接返回 Item） */
  withDetailResponse?: boolean;
}

// ==================== Type 文件 ====================

/**
 * 生成 types/<kebab>.ts
 *
 * 注意：这里不再 `import type { BaseListResponse, PaginationParams } from './base'` ——
 * 项目里并不存在 types/base.ts，生成出来必然 TS2307。列表响应 / 分页参数直接展开写。
 *
 * @param {string} name 模块名
 * @param {ScaffoldOptions} [options] 生成选项
 * @returns {string} 文件内容
 */
export function generateTypeFile(name: string, options: ScaffoldOptions = {}): string {
  const pascal = pascalCase(name);
  const withList = options.withList !== false;
  const withForm = options.withForm !== false;
  const withListResponse = options.withListResponse !== false;
  const withDetailResponse = Boolean(options.withDetailResponse);

  let content = `/**
 * ${pascal} 类型定义
 * 定义 ${pascal} 模块相关的 TypeScript 类型
 */

/**
 * ${pascal} 数据项
 */
export interface ${pascal}Item {
  /** 唯一标识 */
  id: string;
  /** 名称 */
  name: string;
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}
`;

  if (withListResponse) {
    content += `
/**
 * ${pascal} 列表响应
 */
export interface ${pascal}ListResponse {
  /** 数据列表 */
  list: ${pascal}Item[];
  /** 数据总数 */
  total: number;
}
`;
  }

  if (withList) {
    content += `
/**
 * ${pascal} 列表查询参数
 */
export interface ${pascal}QueryParams {
  /** 页码 */
  page?: number;
  /** 每页条数 */
  pageSize?: number;
  /** 搜索关键词 */
  keyword?: string;
}
`;
  }

  if (withForm) {
    content += `
/**
 * ${pascal} 表单数据（创建 / 更新共用）
 */
export interface ${pascal}FormData {
  /** 名称 */
  name: string;
}
`;
  }

  if (withDetailResponse) {
    content += `
/**
 * ${pascal} 详情响应
 */
export interface ${pascal}DetailResponse {
  /** 状态码 */
  code: number;
  /** 详情数据 */
  data: ${pascal}Item;
  /** 提示信息 */
  message: string;
}
`;
  }

  return content;
}

// ==================== Service 文件 ====================

/**
 * 生成 services/<kebab>-service.ts
 * @param {string} name 模块名
 * @returns {string} 文件内容
 */
export function generateServiceFile(name: string): string {
  const pascal = pascalCase(name);
  const camel = camelCase(name);
  const kebab = kebabCase(name);

  return `/**
 * ${pascal} Service
 * ${pascal} 相关的 API 请求
 */
import type { ${pascal}Item, ${pascal}ListResponse, ${pascal}QueryParams, ${pascal}FormData } from '@/types/${kebab}';
import { BaseService } from './base-service';

/**
 * ${pascal} 服务类
 * 封装所有 ${pascal} 相关的 HTTP 请求
 */
export class ${pascal}Service extends BaseService {
  /**
   * 获取 ${camel} 列表
   * @param {${pascal}QueryParams} params 查询参数
   * @returns {Promise<${pascal}ListResponse>} 列表响应
   */
  getList = async (params: ${pascal}QueryParams = {}): Promise<${pascal}ListResponse> => {
    return this.get<${pascal}ListResponse>('/${kebab}', { params });
  };

  /**
   * 获取 ${camel} 详情
   * @param {string} id 数据 ID
   * @returns {Promise<${pascal}Item>} 详情数据
   */
  getDetail = async (id: string): Promise<${pascal}Item> => {
    return this.get<${pascal}Item>(\`/${kebab}/\${encodeURIComponent(id)}\`);
  };

  /**
   * 创建 ${camel}
   * @param {${pascal}FormData} data 创建数据
   * @returns {Promise<${pascal}Item>} 创建后的数据
   */
  create = async (data: ${pascal}FormData): Promise<${pascal}Item> => {
    return this.post<${pascal}Item>('/${kebab}', data);
  };

  /**
   * 更新 ${camel}
   * @param {string} id 数据 ID
   * @param {${pascal}FormData} data 更新数据
   * @returns {Promise<${pascal}Item>} 更新后的数据
   */
  update = async (id: string, data: ${pascal}FormData): Promise<${pascal}Item> => {
    return this.put<${pascal}Item>(\`/${kebab}/\${encodeURIComponent(id)}\`, data);
  };

  /**
   * 删除 ${camel}
   * 注意：方法名不能用 delete，会覆盖基类同名语义且与 BaseService.del 混淆
   * @param {string} id 数据 ID
   * @returns {Promise<void>}
   */
  remove = async (id: string): Promise<void> => {
    await this.del<void>(\`/${kebab}/\${encodeURIComponent(id)}\`);
  };
}

/**
 * 创建 ${pascal}Service 实例的工厂函数
 * @returns {${pascal}Service} Service 实例
 */
export const create${pascal}Service = (): ${pascal}Service => new ${pascal}Service();
`;
}

// ==================== Model 文件 ====================

/**
 * 生成 models/<kebab>-model.ts
 * @param {string} name 模块名
 * @param {ScaffoldOptions} [options] 生成选项
 * @returns {string} 文件内容
 */
export function generateModelFile(name: string, _options: ScaffoldOptions = {}): string {
  const pascal = pascalCase(name);
  const camel = camelCase(name);
  const kebab = kebabCase(name);

  // 注意：这里不再自己声明 localeStore / t —— BaseModel 已经提供了
  // `t`（ComputedRef，取自 useLocaleStore），子类重复声明会与基类类型冲突（TS2416）。
  // 因此 withI18n 对 Model 模板不产生差异，仅保留参数以兼容调用方。

  let content = `/**
 * ${pascal} Model
 * ${pascal} 页面的业务逻辑
 */
import { ref } from 'vue';
import { BaseModel } from '@/models/base-model';
import type { ${pascal}Item, ${pascal}QueryParams } from '@/types/${kebab}';
`;

  content += '\n';

  content += `/**
 * ${pascal} 模型类
 * 负责 ${camel} 相关的业务逻辑和状态管理
 */
export class ${pascal}Model extends BaseModel {
  /** 数据列表 */
  public items = ref<${pascal}Item[]>([]);

  /** 加载状态 */
  public loading = ref<boolean>(false);

  /** 分页信息 */
  public pagination = ref<{
    current: number;
    pageSize: number;
    total: number;
  }>({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  /**
   * 获取 ${camel} 列表
   * @param {${pascal}QueryParams} _params 查询参数
   * @returns {Promise<${pascal}Item[]>} 数据列表
   */
  async fetchItems(_params: ${pascal}QueryParams = {}): Promise<${pascal}Item[]> {
    this.loading.value = true;
    try {
      // TODO: 调用 create${pascal}Service().getList(_params) 拉取数据，替换下面的占位实现
      const data: ${pascal}Item[] = [];
      this.items.value = data;
      return data;
    } catch (error) {
      console.error('Failed to fetch items:', error);
      return [];
    } finally {
      this.loading.value = false;
    }
  }

  /**
   * 重置分页
   */
  resetPagination(): void {
    this.pagination.value = {
      current: 1,
      pageSize: 10,
      total: 0,
    };
  }
}

/**
 * 创建 ${pascal}Model 实例的工厂函数
 * @returns {${pascal}Model} Model 实例
 */
export const create${pascal}Model = (): ${pascal}Model => new ${pascal}Model();
`;

  return content;
}

// ==================== View 文件 ====================

/**
 * 生成 views/<kebab>.vue
 * @param {string} name 页面名
 * @param {ScaffoldOptions} [options] 生成选项
 * @returns {string} 文件内容
 */
export function generateViewFile(name: string, options: ScaffoldOptions = {}): string {
  const pascal = pascalCase(name);
  const camel = camelCase(name);
  const kebab = kebabCase(name);
  const withI18n = Boolean(options.withI18n);

  // 文案：接入 i18n 时走 t，否则直接用中文常量，避免生成出来引用了不存在的 t
  const txt = (i18nKey: string, fallback: string): string => (withI18n ? `t.value.${i18nKey}` : `'${fallback}'`);
  const pageTitle = withI18n ? `t.${camel}.title` : `'${pascal}'`;

  let content = `<template>
  <page-layout :title="${pageTitle}">
    <!-- 搜索区域 -->
    <card-panel :title="${txt('common.search', '搜索')}">
      <!-- TODO: 添加搜索表单 -->
    </card-panel>

    <!-- 数据表格 -->
    <card-panel :title="${txt('common.list', '数据列表')}">
      <t-table
        :data="model.items.value"
        :columns="columns"
        :loading="model.loading.value"
        :pagination="pagination"
        @page-change="handlePageChange"
      >
        <template #operate="{ row }">
          <t-space>
            <t-button theme="primary" variant="text" @click="handleEdit(row)">
              {{ ${txt('common.edit', '编辑')} }}
            </t-button>
            <t-button theme="danger" variant="text" @click="handleDelete(row)">
              {{ ${txt('common.delete', '删除')} }}
            </t-button>
          </t-space>
        </template>
      </t-table>
    </card-panel>

    <!-- 表单抽屉 -->
    <${kebab}-form-drawer
      v-model:visible="drawerVisible"
      :edit-data="editData"
      @success="handleFormSuccess"
    />
  </page-layout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
`;

  if (withI18n) {
    content += `import { useLocaleStore } from '@/stores/locale';\n`;
  }

  content += `import { create${pascal}Model } from '@/models/${kebab}-model';
import type { ${pascal}Item } from '@/types/${kebab}';
`;

  if (withI18n) {
    content += `
const localeStore = useLocaleStore();
const t = computed(() => localeStore.t);
`;
  }

  content += `
const model = reactive(create${pascal}Model());
const drawerVisible = ref<boolean>(false);
const editData = ref<${pascal}Item | null>(null);

const columns = [
  { colKey: 'name', title: ${txt(`${camel}.name`, '名称')} },
  { colKey: 'createdAt', title: ${txt('common.createdAt', '创建时间')} },
  { colKey: 'operate', title: ${txt('common.operate', '操作')}, cell: 'operate' },
];

const pagination = computed(() => ({
  current: model.pagination.value.current,
  pageSize: model.pagination.value.pageSize,
  total: model.pagination.value.total,
}));

function handlePageChange(pageInfo: { current: number; pageSize: number }): void {
  model.pagination.value.current = pageInfo.current;
  model.pagination.value.pageSize = pageInfo.pageSize;
  model.fetchItems();
}

function handleEdit(row: ${pascal}Item): void {
  editData.value = row;
  drawerVisible.value = true;
}

async function handleDelete(_row: ${pascal}Item): Promise<void> {
  // TODO: 调用删除 API（create${pascal}Service().remove(_row.id)）
  await model.fetchItems();
}

function handleFormSuccess(): void {
  drawerVisible.value = false;
  editData.value = null;
  model.fetchItems();
}

onMounted(() => {
  model.fetchItems();
});
</script>

<style scoped>
</style>
`;

  return content;
}
