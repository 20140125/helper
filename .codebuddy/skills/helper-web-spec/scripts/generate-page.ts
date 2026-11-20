#!/usr/bin/env node

/**
 * 完整页面脚手架生成器
 *
 * 一键生成包含 View、Model、Service、Type 的完整页面
 * 支持选项：是否生成 Service、是否使用 Store、是否添加 i18n、是否生成常量
 *
 * 用法: npx ts-node generate-page.ts <页面名> [选项]
 * 别名: npm run gen:page -- <页面名> [选项]
 */

import fs from 'fs';
import path from 'path';
import { FRONTEND_SRC } from './lib/paths';
import { toPascalCase as pascalCase, toKebabCase as kebabCase, validateName } from './lib/naming';
import { generateModelFile, generateServiceFile, generateTypeFile, generateViewFile } from './lib/scaffold-templates';
import { logInfo, logSuccess, logWarning, logError, logStep } from './logger';

// ==================== 类型定义 ====================

interface ParsedArgs {
  name: string;
  outputDir: string;
  withService: boolean;
  withStore: boolean;
  withI18n: boolean;
  withConstants: boolean;
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
    withService: true,
    withStore: false,
    withI18n: true,
    withConstants: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg === '-o' || arg === '--output') {
      result.outputDir = args[++i];
    } else if (arg === '--no-service') {
      result.withService = false;
    } else if (arg === '--with-store') {
      result.withStore = true;
    } else if (arg === '--no-i18n') {
      result.withI18n = false;
    } else if (arg === '--with-constants') {
      result.withConstants = true;
    } else if (!arg.startsWith('-')) {
      result.name = arg;
    }
  }

  return result;
}

function printUsage(): void {
  console.log(`
${colorize('cyan', '用法:')} npx ts-node generate-page.ts <页面名> [选项]
${colorize('cyan', '别名:')}   npm run gen:page -- <页面名> [选项]

${colorize('cyan', '描述:')}
  一键生成包含 View、Model、Service、Type 的完整页面脚手架
  根据 helper-web 规范生成符合架构标准的代码

${colorize('cyan', '选项:')}
  -h, --help                 显示帮助信息
  -o, --output <dir>         指定输出根目录 (默认: web/frontend/src)
  --no-service               不生成 Service 文件
  --with-store                生成 Store 文件（替代 Model）
  --no-i18n                  不生成 i18n 相关代码
  --with-constants           生成 constants 文件

${colorize('cyan', '示例:')}
  # 生成完整页面（含 Service、i18n）
  npm run gen:page -- user

  # 生成页面（使用 Store 替代 Model，并生成常量文件）
  npm run gen:page -- product --with-store --with-constants

  # 生成页面（不包含 Service）
  npm run gen:page -- order --no-service

${colorize('cyan', '生成文件:')}
  - frontend/src/types/<name>.ts
  - frontend/src/services/<name>-service.ts (默认)
  - frontend/src/models/<name>-model.ts (默认)
  - frontend/src/stores/<name>.ts (--with-store)
  - frontend/src/views/<name>.vue
  - frontend/src/constants/<name>.ts (--with-constants)
  注：<name> 统一转为 kebab-case（如 userProfile -> user-profile）
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

  // 验证页面名称
  if (!options.name) {
    logError('请指定页面名称');
    printUsage();
    process.exit(1);
  }

  const nameCheck = validateName(options.name);
  if (!nameCheck.ok) {
    logError(nameCheck.reason || '名称不合法');
    process.exit(1);
  }

  const pascal = pascalCase(options.name);
  const kebab = kebabCase(options.name);

  logInfo(`开始生成 ${pascal} 页面脚手架...`);
  logInfo(`输出目录: ${options.outputDir || 'web/frontend/src'}`);

  // 确定输出根目录
  let baseDir = options.outputDir;
  if (!baseDir) {
    baseDir = FRONTEND_SRC;
  }

  let step = 0;
  const totalSteps = 4 + (options.withConstants ? 1 : 0);

  let servicePath = '';
  let modelPath = '';
  let viewPath = '';
  let typePath = '';

  // 生成 Type 文件
  step++;
  logStep(step, totalSteps, `生成类型文件: ${kebab}.ts`);
  const typesDir = path.join(baseDir, 'types');
  if (!fs.existsSync(typesDir)) {
    fs.mkdirSync(typesDir, { recursive: true });
  }
  typePath = path.join(typesDir, `${kebab}.ts`);
  if (!fs.existsSync(typePath)) {
    fs.writeFileSync(typePath, generateTypeFile(options.name));
    logSuccess(`已生成: ${typePath}`);
  } else {
    logWarning(`已存在: ${typePath}，跳过`);
  }

  // 生成 Service 文件
  if (options.withService) {
    step++;
    logStep(step, totalSteps, `生成 Service 文件: ${kebab}-service.ts`);
    const servicesDir = path.join(baseDir, 'services');
    if (!fs.existsSync(servicesDir)) {
      fs.mkdirSync(servicesDir, { recursive: true });
    }
    servicePath = path.join(servicesDir, `${kebab}-service.ts`);
    if (!fs.existsSync(servicePath)) {
      fs.writeFileSync(servicePath, generateServiceFile(options.name));
      logSuccess(`已生成: ${servicePath}`);
    } else {
      logWarning(`已存在: ${servicePath}，跳过`);
    }
  }

  // 生成 Model 文件
  step++;
  logStep(step, totalSteps, `生成 Model 文件: ${kebab}-model.ts`);
  const modelsDir = path.join(baseDir, 'models');
  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }
  modelPath = path.join(modelsDir, `${kebab}-model.ts`);
  if (!fs.existsSync(modelPath)) {
    fs.writeFileSync(modelPath, generateModelFile(options.name, { withI18n: options.withI18n }));
    logSuccess(`已生成: ${modelPath}`);
  } else {
    logWarning(`已存在: ${modelPath}，跳过`);
  }

  // 生成 View 文件
  step++;
  logStep(step, totalSteps, `生成 View 文件: ${kebab}.vue`);
  const viewsDir = path.join(baseDir, 'views');
  if (!fs.existsSync(viewsDir)) {
    fs.mkdirSync(viewsDir, { recursive: true });
  }
  viewPath = path.join(viewsDir, `${kebab}.vue`);
  if (!fs.existsSync(viewPath)) {
    fs.writeFileSync(viewPath, generateViewFile(options.name, { withI18n: options.withI18n }));
    logSuccess(`已生成: ${viewPath}`);
  } else {
    logWarning(`已存在: ${viewPath}，跳过`);
  }

  // 生成 Constants 文件（可选）
  if (options.withConstants) {
    step++;
    logStep(step, totalSteps, `生成常量文件: ${kebab}.ts`);
    const constantsDir = path.join(baseDir, 'constants');
    if (!fs.existsSync(constantsDir)) {
      fs.mkdirSync(constantsDir, { recursive: true });
    }
    const constantsPath = path.join(constantsDir, `${kebab}.ts`);
    if (!fs.existsSync(constantsPath)) {
      // 生成基础的常量文件
      const constantsContent = `\
/**
 * ${pascal} 常量定义
 * 定义 ${pascal} 模块的常量、枚举、UI 映射
 */

/** ${pascal} 状态枚举 */
export const ${pascal.toUpperCase()}_STATUS = {
  ACTIVE: 1,
  INACTIVE: 0,
} as const;

/** ${pascal} 状态标签映射 */
export const ${pascal.toUpperCase()}_STATUS_LABEL: Record<number, string> = {
  [${pascal.toUpperCase()}_STATUS.ACTIVE]: '启用',
  [${pascal.toUpperCase()}_STATUS.INACTIVE]: '禁用',
};
`;
      fs.writeFileSync(constantsPath, constantsContent);
      logSuccess(`已生成: ${constantsPath}`);
    } else {
      logWarning(`已存在: ${constantsPath}，跳过`);
    }
  }

  // 输出后续建议
  console.log('\n' + colorize('cyan', '🎉 页面脚手架生成完成!'));
  console.log('\n' + colorize('cyan', '建议下一步:'));
  logStep(1, 4, `完善 ${typePath} 中的类型定义`);
  if (options.withService) {
    logStep(2, 4, `完善 ${servicePath} 中的 API 调用`);
  } else {
    logStep(2, 4, `完善 ${modelPath} 中的业务逻辑`);
  }
  logStep(3, 4, `完善 ${viewPath} 中的表格列和表单`);
  logStep(4, 4, '添加路由配置到 router/index.ts');
}

main();
