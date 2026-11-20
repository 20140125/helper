#!/usr/bin/env node

/**
 * Pinia Store 生成器
 *
 * 根据 helper-web 规范快速生成 Pinia Store 文件
 * 支持选项：添加持久化支持
 *
 * 用法: npx ts-node generate-store.ts <模块名> [选项]
 * 别名: npm run gen:store -- <模块名> [选项]
 */

import fs from 'fs';
import path from 'path';
import { frontendPath } from './lib/paths';
import { toPascalCase as pascalCase, toCamelCase as camelCase, toKebabCase as kebabCase, validateName } from './lib/naming';
import { logInfo, logSuccess, logWarning, logError, logStep } from './logger';

// ==================== 类型定义 ====================

interface ParsedArgs {
  name: string;
  outputDir: string;
  withPersistence: boolean;
}

// ==================== 工具函数 ====================

// ==================== 参数解析 ====================

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const result: ParsedArgs = {
    name: '',
    outputDir: '',
    withPersistence: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg === '-o' || arg === '--output') {
      result.outputDir = args[++i];
    } else if (arg === '--with-persistence') {
      result.withPersistence = true;
    } else if (!arg.startsWith('-')) {
      result.name = arg;
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
${colorize('cyan', '用法:')} npx ts-node generate-store.ts <模块名> [选项]
${colorize('cyan', '别名:')}   npm run gen:store -- <模块名> [选项]

${colorize('cyan', '描述:')}
  根据 helper-web 规范快速生成 Pinia Store 文件
  生成符合 Class-based + Setup Store 风格的定义

${colorize('cyan', '选项:')}
  -h, --help                 显示帮助信息
  -o, --output <dir>         指定输出目录 (默认: frontend/src/stores)
  --with-persistence         添加持久化支持 (需要安装 pinia-plugin-persistedstate)

${colorize('cyan', '示例:')}
  # 生成基础 Store
  npm run gen:store -- user

  # 生成带持久化的 Store
  npm run gen:store -- app --with-persistence

  # 指定输出目录
  npm run gen:store -- permission -o custom/path

${colorize('cyan', '输出文件:')}
  - frontend/src/stores/<name>.ts

${colorize('cyan', '依赖:')}
  --with-persistence 需要安装:
    npm install pinia-plugin-persistedstate
`);
}

function colorize(color: string, text: string): string {
  const colors: Record<string, string> = {
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
  };
  return `${colors[color] || ''}${text}${colors.reset}`;
}

// ==================== 生成 Store 内容 ====================

function generateStoreContent(name: string, options: ParsedArgs): string {
  const pascal = pascalCase(name);
  const camel = camelCase(name);

  // 按项目规范的正确导入顺序：vue -> pinia -> 项目内模块 -> type
  let content = `\
/**
 * ${pascal} Store
 * @description ${pascal} 模块的全局状态管理
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ${pascal}Service } from '@/services/${camel}-service';
import type { ${pascal}Item } from '@/types/${camel}';
`;

  if (options.withPersistence) {
    content += `\
import { persist } from 'pinia-plugin-persistedstate';
`;
  }

  content += `\n`;

  content += `\
/**
 * ${pascal} 管理全局Store类
 * @description 管理 ${pascal} 相关的全局状态，供多个页面/组件共享使用
 */
export class ${pascal}Store {
  // ==============================
  // 状态变量 (State) - 使用 public 修饰符
  // ==============================

  /** ${pascal} 列表数据 */
  public items = ref<${pascal}Item[]>([]);

  /** 加载状态 */
  public loading = ref<boolean>(false);

  /** 数据缓存 */
  public cache = ref<Record<string, unknown>>({});
`;

  if (options.withPersistence) {
    content += `\
  // 需要持久化的状态请在此定义 (会自动保存到 localStorage)
`;
  }

  content += `\
  
  // ==============================
  // 私有变量（不导出）
  // ==============================

  /** 轮询定时器 */
  private pollingTimer: ReturnType<typeof setInterval> | null = null;

  // ==============================
  // 依赖注入 (Services)
  // ==============================

  /** ${pascal} Service 实例 */
  private ${camel}Service: ${pascal}Service = new ${pascal}Service();

  // ==============================
  // 计算属性 (Getters) - 使用箭头函数+computed，便于 ...store 展开
  // ==============================
  
  /** 列表数量 */
  public itemCount = computed<number>(() => {
    return this.items.value.length;
  });

  /** 是否正在加载 */
  public isLoading = computed<boolean>(() => {
    return this.loading.value;
  });
`;

  content += `\
  // ==============================
  // 公共方法 (Actions)
  // ==============================

  /**
   * 获取${pascal}列表
   * @param {boolean} force - 是否强制刷新，默认 false（有缓存时跳过请求）
   * @returns {Promise<void>}
   * @description 从服务端获取数据并更新状态；有缓存时默认复用，避免重复请求
   */
  public fetchItems = async (force = false): Promise<void> => {
    if (!force && this.items.value.length > 0) return;
    this.loading.value = true;
    try {
      const { data } = await this.${camel}Service.fetchItems();
      this.items.value = data;
    } catch {
      // 请求失败时保持原有数据，不阻塞页面
    } finally {
      this.loading.value = false;
    }
  }

  /**
   * 设置加载状态
   * @param {boolean} value - 加载状态
   */
  public setLoading = (value: boolean): void => {
    this.loading.value = value;
  };

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {unknown} value - 缓存值
   */
  public setCache = (key: string, value: unknown): void => {
    this.cache.value[key] = value;
  };

  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {unknown} 缓存值
   */
  public getCache = (key: string): unknown => {
    return this.cache.value[key];
  };

  /**
   * 清除缓存
   * @param {string} [key] - 缓存键，不传则清除所有
   */
  public clearCache = (key?: string): void => {
    if (key) {
      delete this.cache.value[key];
    } else {
      this.cache.value = {};
    }
  };

  /**
   * 开始轮询
   * @param {number} interval - 轮询间隔（毫秒），默认30000
   * @returns {void}
   */
  public startPolling = (interval: number = 30000): void => {
    this.fetchItems(true);
    if (this.pollingTimer !== null) return;
    this.pollingTimer = setInterval(() => this.fetchItems(true), interval);
  }

  /**
   * 停止轮询
   * @returns {void}
   */
  public stopPolling = (): void => {
    if (this.pollingTimer !== null) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
  }

  /**
   * 重置所有状态
   * @returns {void}
   */
  public reset = (): void => {
    this.items.value = [];
    this.loading.value = false;
    this.cache.value = {};
    this.stopPolling();
  };
`;

  content += `}\n\n`;

  // ==============================
  // Pinia Store 工厂函数
  // ==============================

  content += `\
/**
 * 创建 ${pascal} Store 实例的工厂函数
 * @description 将 ${pascal}Store 类包装为 Pinia 可用的 Store
 */
`;

  if (options.withPersistence) {
    content += `\
export const use${pascal}Store = defineStore('${camel}', () => {
  const store = new ${pascal}Store();

  return {
    ...store,
  };
}, {
  persist: {
    key: '${camel}-store',
    storage: localStorage,
    paths: ['cache'],
  },
});
`;
  } else {
    content += `\
export const use${pascal}Store = defineStore('${camel}', () => {
  const store = new ${pascal}Store();

  return {
    ...store,
  };
});
`;
  }

  return content;
}

// ==================== 主函数 ====================

function main(): void {
  const options = parseArgs();

  // 验证模块名称
  if (!options.name) {
    logError('请指定模块名称');
    printUsage();
    process.exit(1);
  }

  const nameCheck = validateName(options.name);
  if (!nameCheck.ok) {
    logError(nameCheck.reason || '名称不合法');
    process.exit(1);
  }

  const pascal = pascalCase(options.name);
  const camel = camelCase(options.name);

  logInfo(`开始生成 ${pascal} Store...`);

  // 确定输出目录
  let outputDir = options.outputDir;
  if (!outputDir) {
    outputDir = frontendPath('stores');
  }

  // 创建目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    logInfo(`创建目录: ${outputDir}`);
  }

  // 生成文件名：项目约定一律 kebab（stores/ 下现存 auth.ts、permission.ts…）
  const fileName = `${kebabCase(options.name)}.ts`;
  const outputPath = path.join(outputDir, fileName);

  // 检查文件是否已存在
  if (fs.existsSync(outputPath)) {
    logError(`文件已存在: ${outputPath}`);
    logWarning('如需覆盖，请先删除现有文件');
    process.exit(1);
  }

  // 生成内容并写入文件
  const content = generateStoreContent(options.name, options);
  fs.writeFileSync(outputPath, content);

  logSuccess(`已生成 Store 文件: ${outputPath}`);

  // 输出后续建议
  logStep(1, 4, '完善 State、Getters 和 Actions');
  logStep(2, 4, `在组件中通过 use${pascal}Store() 使用`);
  logStep(3, 4, '确保对应的 Service 和 Type 定义已创建');
  if (options.withPersistence) {
    logStep(4, 4, '确保已安装 pinia-plugin-persistedstate');
  }
}

main();
