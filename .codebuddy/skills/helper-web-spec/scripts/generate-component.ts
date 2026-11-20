#!/usr/bin/env node

/**
 * Vue 组件生成器
 *
 * 根据 helper-web 规范快速生成 Vue 组件脚手架
 * 支持生成：基础组件、卡片组件、表单抽屉、Model、Service
 *
 * 用法: npx ts-node generate-component.ts <组件名> [选项]
 * 别名: npm run gen -- <组件名> [选项]
 */

import fs from 'fs';
import path from 'path';
import { frontendPath } from './lib/paths';
import { toKebabCase, validateName } from './lib/naming';
import { generateModelFile, generateServiceFile } from './lib/scaffold-templates';
import { logInfo, logSuccess, logWarning, logError, logStep } from './logger';

// ==================== 类型定义 ====================

type ComponentType = 'basic' | 'card' | 'drawer' | 'model' | 'service';

interface TemplateOptions {
  /** 卡片图标名称（用于 card 类型） */
  icon?: string;
  /** 图标主题（用于 card 类型） */
  iconTheme?: string;
  /** i18n 前缀（用于 card 类型） */
  i18nPrefix?: string;
  /** 类型文件名（用于 model/service 类型） */
  typeFile?: string;
  /** 自定义输出目录（-o/--output），相对 cwd 或绝对路径 */
  output?: string;
}

interface ParsedArgs {
  type: ComponentType;
  name: string;
  options: TemplateOptions;
}

// ==================== 工具函数 ====================

function kebabToCamel(str: string): string {
  return str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function pascalCase(str: string): string {
  const camel = kebabToCamel(str);
  return camel.charAt(0).toUpperCase() + camel.slice(1);
}

function kebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

// ==================== 模板定义 ====================

type TemplateFn = (name: string, options: TemplateOptions) => string;

const templates: Record<ComponentType, TemplateFn> = {
  // ==================== 基础组件模板 ====================
  basic: (name) => `\
<template>
  <div class="${kebabToCamel(name)}-wrapper">
    <!-- 组件内容 -->
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useLocaleStore } from '@/stores/locale';

const props = withDefaults(defineProps<{
  /** 是否显示 */
  visible?: boolean;
}>(), {
  visible: false,
});

const emit = defineEmits<{
  /** 更新显示状态 */
  (e: 'update:visible', value: boolean): void;
}>();

const localeStore = useLocaleStore();
const t = computed(() => localeStore.t);
</script>

<style scoped>
</style>
`,

  // ==================== 卡片组件模板 ====================
  card: (name, options) => `\
<template>
  <card-panel
    :title="t.${options.i18nPrefix || 'common'}.title"
    icon="${options.icon || 'document'}"
    icon-theme="${options.iconTheme || 'primary'}"
  >
    <!-- 卡片内容 -->
  </card-panel>
</template>

<script setup lang="ts">
import CardPanel from '@/components/common/card-panel.vue';
import { computed } from 'vue';
import { useLocaleStore } from '@/stores/locale';

const props = withDefaults(defineProps<{
  /** 数据列表 */
  items?: unknown[];
  /** 是否加载中 */
  loading?: boolean;
}>(), {
  items: () => [],
  loading: false,
});

const emit = defineEmits<{
  /** 点击项目 */
  (e: 'itemClick', item: unknown): void;
  /** 刷新数据 */
  (e: 'refresh'): void;
}>();

const localeStore = useLocaleStore();
const t = computed(() => localeStore.t);
</script>

<style scoped>
</style>
`,

  // ==================== 表单抽屉模板 ====================
  drawer: (name) => `\
<template>
  <form-drawer
    :visible="props.visible"
    :title="drawerTitle"
    @confirm="handleConfirm"
    @close="handleClose"
  >
    <auto-form
      :fields="formFields"
      :model-value="formData"
      @update:model-value="handleFormChange"
    />
  </form-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';
import { useLocaleStore } from '@/stores/locale';
import type { AutoFormField } from '@/types/auto-form';

interface FormData {
  // TODO: 定义表单数据类型
}

const props = withDefaults(defineProps<{
  /** 是否显示抽屉 */
  visible: boolean;
  /** 编辑的数据（null 表示新增） */
  editData?: FormData | null;
}>(), {
  editData: null,
});

const emit = defineEmits<{
  /** 提交表单成功 */
  (e: 'success', data: FormData): void;
  /** 关闭抽屉 */
  (e: 'close'): void;
}>();

const localeStore = useLocaleStore();
const t = computed(() => localeStore.t);

const formData = ref<FormData>({} as FormData);

const drawerTitle = computed(() => {
  return props.editData ? t.value.common.edit : t.value.common.add;
});

const formFields: AutoFormField[] = [
  // TODO: 定义表单字段
];

function handleFormChange(value: FormData): void {
  formData.value = value;
}

function handleConfirm(): void {
  emit('success', formData.value);
}

function handleClose(): void {
  emit('close');
}
</script>
`,

  // ==================== Model 文件模板 ====================
  // Model / Service 模板已收敛到 lib/scaffold-templates.ts，与 generate-page 共用同一份，
  // 避免两边各写一套、产出内容漂移（历史上 generate-component 与 generate-page 生成的
  // model 连 BaseModel 的导入方式都不一致）
  model: (name, options) => generateModelFile(name, { withI18n: Boolean(options.i18nPrefix) }),
  service: (name) => generateServiceFile(name),
};

// ==================== 参数解析 ====================

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const result: ParsedArgs = {
    type: 'basic',
    name: '',
    options: {},
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-t' || arg === '--type') {
      result.type = args[++i] as ComponentType;
    } else if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg === '--icon') {
      result.options.icon = args[++i];
    } else if (arg === '--icon-theme') {
      result.options.iconTheme = args[++i];
    } else if (arg === '--i18n-prefix') {
      result.options.i18nPrefix = args[++i];
    } else if (arg === '--type-file') {
      result.options.typeFile = args[++i];
    } else if (arg === '-o' || arg === '--output') {
      // 自定义输出目录（相对 cwd 或绝对），用于试生成到项目外
      result.options.output = args[++i];
    } else if (!arg.startsWith('-')) {
      if (result.name) {
        logError(`多余的位置参数 "${arg}"（组件名只能有一个）`);
        process.exit(1);
      }
      result.name = arg;
    } else {
      // 旧实现会静默忽略不认识的选项，导致 -o /tmp/x 的值被当成组件名
      logError(`未知选项 "${arg}"，用 -h 查看用法`);
      process.exit(1);
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
${colorize('cyan', '用法:')} npx ts-node generate-component.ts <组件名> [选项]
${colorize('cyan', '别名:')}   npm run gen -- <组件名> [选项]

${colorize('cyan', '描述:')}
  根据 helper-web 规范快速生成 Vue 组件脚手架
  支持生成：基础组件、卡片组件、表单抽屉、Model、Service

${colorize('cyan', '选项:')}
  -t, --type <type>         组件类型: basic, card, drawer, model, service (默认: basic)
  -h, --help                 显示帮助信息
  --icon <name>              卡片图标名称 (用于 card 类型)
  --icon-theme <theme>       图标主题 (用于 card 类型)
  --i18n-prefix <prefix>    i18n 前缀 (用于 card 类型)
  --type-file <name>         类型文件名 (用于 model/service 类型)

${colorize('cyan', '示例:')}
  # 生成基础组件
  npm run gen -- my-component

  # 生成卡片组件
  npm run gen -- user-card -t card --icon user --icon-theme primary

  # 生成 Model
  npm run gen -- api -t model

  # 生成 Service
  npm run gen -- api -t service

${colorize('cyan', '输出目录:')}
  - basic/card/drawer → frontend/src/components/<name>/
  - model               → frontend/src/models/
  - service             → frontend/src/services/
`);
}

function colorize(color: string, text: string): string {
  const colors: Record<string, string> = {
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
  };
  return `${colors[color] || ''}${text}${colors.reset}`;
}

// ==================== 主函数 ====================

function main(): void {
  const { type, name, options } = parseArgs();

  // 验证组件类型
  if (!templates[type]) {
    logError(`不支持的组件类型 "${type}"`);
    logInfo(`支持的类型: ${Object.keys(templates).join(', ')}`);
    process.exit(1);
  }

  // 验证组件名称
  if (!name) {
    logError('请指定组件名称');
    printUsage();
    process.exit(1);
  }
  const nameCheck = validateName(name);
  if (!nameCheck.ok) {
    logError(nameCheck.reason || '组件名称不合法');
    process.exit(1);
  }

  // 统一归一化成 kebab：既符合项目全 kebab 的文件命名，也让含下划线/驼峰的输入
  // 在模板里产出合法标识符（api_v2 → api-v2 → ApiV2）
  const componentName = toKebabCase(name);
  if (componentName !== name) {
    logInfo(`组件名已归一化为 kebab-case: ${componentName}`);
  }

  logInfo(`开始生成 ${type} 类型组件: ${componentName}`);

  const template = templates[type](componentName, options);
  const fileName = type === 'model' ? `${componentName}-model.ts` :
                   type === 'service' ? `${componentName}-service.ts` :
                   `${componentName}.vue`;

  // 确定输出目录（-o/--output 优先，便于试生成到项目外）
  let outputDir = '';
  if (options.output) {
    outputDir = path.resolve(process.cwd(), options.output);
  } else if (type === 'model') {
    outputDir = frontendPath('models');
  } else if (type === 'service') {
    outputDir = frontendPath('services');
  } else {
    outputDir = frontendPath('components', componentName);
  }

  // 创建目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    logInfo(`创建目录: ${outputDir}`);
  }

  // 写入文件
  const outputPath = path.join(outputDir, fileName);
  if (fs.existsSync(outputPath)) {
    logError(`文件已存在: ${outputPath}`);
    logWarning('如需覆盖，请先删除现有文件');
    process.exit(1);
  }

  fs.writeFileSync(outputPath, template);
  logSuccess(`已生成: ${outputPath}`);

  // 输出后续建议
  logStep(1, 2, '完善生成的文件内容');
  if (type === 'model') {
    logStep(2, 2, '在 View 中通过 use' + pascalCase(name) + 'Model() 使用');
  } else if (type === 'service') {
    logStep(2, 2, '在 Model 中引入并调用 Service 方法');
  }
}

main();
