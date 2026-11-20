/**
 * tools/ barrel：自动扫描并注册所有 AI Chat 工具实现
 * @description 【约定优于配置】新增工具只需两步，无需改动本文件：
 *              1) 在 tools/ 下新建 `xxx-tool.ts`（文件名必须以 -tool 结尾，下划线开头的内部模块会被忽略）
 *              2) 在文件中 `export const xxxTool: ToolImpl = { name, description, parameters, invoke }`
 *              启动时本文件会扫描目录、require 每个 *-tool 文件，自动收集所有 ToolImpl 导出并去重。
 *
 * 目录中的 `_xxx.ts`（如 _consent-guard）是内部辅助模块，不会被当作工具加载。
 */

import fs from 'fs';
import path from 'path';
import type { ToolImpl } from '@/types/ai-chat';

/** 工具文件名特征：`xxx-tool.ts`（同时兼容编译后的 .js） */
const TOOL_FILE_PATTERN = /-tool\.(ts|js)$/;

/**
 * 判断文件是否为工具实现文件
 * @param {string} file - 文件名
 * @returns {boolean} 是工具文件返回 true
 * @description 排除：下划线开头的内部模块、类型声明文件、非 -tool 结尾的文件
 */
const isToolFile = (file: string): boolean => {
  if (file.startsWith('_') || file.startsWith('.')) return false;
  if (file.endsWith('.d.ts')) return false;
  return TOOL_FILE_PATTERN.test(file);
};

/**
 * 判断某个模块导出是否为合法的 ToolImpl
 * @param {unknown} value - 模块导出值
 * @returns {boolean} 合法工具实现返回 true
 */
const isToolImpl = (value: unknown): value is ToolImpl => {
  if (!value || typeof value !== 'object') return false;
  const tool = value as Partial<ToolImpl>;
  return (
    typeof tool.name === 'string'
    && typeof tool.description === 'string'
    && typeof tool.invoke === 'function'
    && !!tool.parameters
    && typeof tool.parameters === 'object'
  );
};

/**
 * 扫描 tools 目录，自动加载所有 *-tool 文件中导出的工具实现
 * @returns {ToolImpl[]} 按文件名排序、按 name 去重后的工具列表
 * @description 单个文件加载失败只打印错误并跳过，不影响其他工具注册
 */
export const loadTools = (): ToolImpl[] => {
  const dir = __dirname;
  const files = fs.readdirSync(dir).filter(isToolFile).sort();
  const tools: ToolImpl[] = [];
  const seenNames = new Set<string>();

  files.forEach((file) => {
    let mod: Record<string, unknown>;
    try {
      // 动态 require：ts-node 下加载 .ts，编译产物下加载 .js
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      mod = require(path.join(dir, file)) as Record<string, unknown>;
    } catch (err) {
      console.error(`[ai-chat] 工具加载失败 ${file}：${(err as Error).message}`);
      return;
    }

    Object.values(mod).forEach((exp) => {
      if (!isToolImpl(exp)) return;
      if (seenNames.has(exp.name)) {
        console.warn(`[ai-chat] 工具 ${exp.name} 重复注册，已忽略 ${file}`);
        return;
      }
      seenNames.add(exp.name);
      tools.push(exp);
    });
  });

  return tools;
};

// ──────────────────────────
// 工具注册表 + 上下文过滤
// ──────────────────────────

/** 全部工具清单（注册中心，目录扫描自动构建） */
export const ALL_TOOLS: ToolImpl[] = loadTools();

/**
 * 根据用户权限过滤可用工具
 * @param {string[]} userPermissions - 用户拥有的权限码
 * @returns {ToolImpl[]} 用户当前会话可用的工具列表
 */
export const getAvailableTools = (userPermissions: string[]): ToolImpl[] => {
  return ALL_TOOLS.filter((tool) => {
    if (!tool.requiredPermissions || tool.requiredPermissions.length === 0) {
      return true;
    }
    return tool.requiredPermissions.some((p) => userPermissions.includes(p));
  });
};

/**
 * 将工具列表转换为 OpenAI 兼容的 tools 协议字段
 * @param {ToolImpl[]} tools - 工具列表
 * @returns {ToolDefinition[]} OpenAI 协议的工具定义数组
 */
export const buildToolDefinitions = (tools: ToolImpl[]): { type: 'function'; function: { name: string; description: string; parameters: ToolImpl['parameters'] } }[] => {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
};

/**
 * 按工具名查找工具
 * @param {string} name - 工具名
 * @returns {ToolImpl | undefined} 工具实例，找不到返回 undefined
 */
export const findTool = (name: string): ToolImpl | undefined => {
  return ALL_TOOLS.find((t) => t.name === name);
};
