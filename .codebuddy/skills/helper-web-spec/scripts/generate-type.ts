#!/usr/bin/env node

/**
 * TypeScript 类型定义生成器
 *
 * 根据 helper-web 规范快速生成类型定义文件
 * 支持生成：Item、ListResponse、QueryParams、FormData、DetailResponse
 *
 * 用法: npx ts-node generate-type.ts <模块名> [选项]
 * 别名: npm run gen:type -- <模块名> [选项]
 */

import fs from 'fs';
import path from 'path';
import { frontendPath } from './lib/paths';
import { toPascalCase as pascalCase, toCamelCase as camelCase, toKebabCase as kebabCase, validateName } from './lib/naming';
import { generateTypeFile } from './lib/scaffold-templates';
import { logInfo, logSuccess, logWarning, logError, logStep } from './logger';

// ==================== 类型定义 ====================

interface ParsedArgs {
  name: string;
  outputDir: string;
  withList: boolean;
  withForm: boolean;
  withResponse: boolean;
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
    withList: true,
    withForm: true,
    withResponse: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg === '-o' || arg === '--output') {
      result.outputDir = args[++i];
    } else if (arg === '--no-list') {
      result.withList = false;
    } else if (arg === '--no-form') {
      result.withForm = false;
    } else if (arg === '--no-response') {
      result.withResponse = false;
    } else if (!arg.startsWith('-')) {
      result.name = arg;
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
${colorize('cyan', '用法:')} npx ts-node generate-type.ts <模块名> [选项]
${colorize('cyan', '别名:')}   npm run gen:type -- <模块名> [选项]

${colorize('cyan', '描述:')}
  根据 helper-web 规范快速生成 TypeScript 类型定义文件
  默认生成：Item、ListResponse、QueryParams、FormData、DetailResponse

${colorize('cyan', '选项:')}
  -h, --help               显示帮助信息
  -o, --output <dir>       指定输出目录 (默认: frontend/src/types)
  --no-list                不生成列表相关类型 (QueryParams)
  --no-form                不生成表单相关类型 (FormData)
  --no-response            不生成响应相关类型 (ListResponse)

${colorize('cyan', '示例:')}
  # 生成完整的类型定义
  npm run gen:type -- user

  # 只生成基础类型，不包含列表和表单
  npm run gen:type -- product --no-list --no-form

  # 指定输出目录
  npm run gen:type -- order -o custom/path

${colorize('cyan', '输出文件:')}
  - frontend/src/types/<name>.ts
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

  logInfo(`开始生成 ${pascal} 类型定义...`);

  // 确定输出目录
  let outputDir = options.outputDir;
  if (!outputDir) {
    outputDir = frontendPath('types');
  }

  // 创建目录
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    logInfo(`创建目录: ${outputDir}`);
  }

  // 文件名统一 kebab（types/ 下现存 ai-chat.ts、api-management.ts…）
  const fileName = `${kebabCase(options.name)}.ts`;
  const outputPath = path.join(outputDir, fileName);

  // 检查文件是否已存在
  if (fs.existsSync(outputPath)) {
    logError(`文件已存在: ${outputPath}`);
    logWarning('如需覆盖，请先删除现有文件');
    process.exit(1);
  }

  // 生成内容并写入文件（模板与 generate-page / generate-component 共用同一份）
  const content = generateTypeFile(options.name, {
    withList: options.withList,
    withForm: options.withForm,
    withListResponse: options.withResponse,
    withDetailResponse: true,
  });
  fs.writeFileSync(outputPath, content);

  logSuccess(`已生成类型定义文件: ${outputPath}`);

  // 输出后续建议
  logStep(1, 3, `完善 ${pascal}Item 接口的字段定义`);
  logStep(2, 3, `运行 npm run gen -- ${camel} -t service 生成 Service`);
  logStep(3, 3, `运行 npm run gen -- ${camel} -t model 生成 Model`);
}

main();
