#!/usr/bin/env node

/**
 * Model/Service 分层检查器
 * 检查 Model 和 Service 分层是否规范
 * 用法: npx ts-node check-model-service.ts [目录路径] [选项]
 */

import fs from 'fs';
import path from 'path';
import { frontendPath } from './lib/paths';
import { scanFiles } from './lib/fs';
import { logInfo, logSuccess, logWarning, logError } from './logger';

interface LayerIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning';
  message: string;
  rule: string;
}

interface ParsedArgs {
  targets: string[];
}

// 解析命令行参数
function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {
    targets: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg === '--fix' || arg === '--dry-run') {
      logWarning(`本脚本只做检查，不支持 ${arg}；分层问题请按下方提示手动调整`);
    } else if (!arg.startsWith('-')) {
      result.targets.push(arg);
    }
  }

  // 默认扫描 frontend/src/models 和 frontend/src/services
  if (result.targets.length === 0) {
    result.targets.push(
      frontendPath('models'),
      frontendPath('services'),
    );
  }

  return result;
}

function printUsage(): void {
  logInfo(`
用法: npx ts-node check-model-service.ts [目录路径] [选项]

选项:
  -h, --help      显示帮助信息

说明:
  本脚本只做检查，不改写文件：Model/Service 的继承与依赖注入靠正则改风险太高。

示例:
  npx ts-node check-model-service.ts
  npx ts-node check-model-service.ts frontend/src/models
`);
}

// 检查 Model 文件
function checkModelFile(filePath: string): LayerIssue[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues: LayerIssue[] = [];
  const fileName = path.basename(filePath);

  // 检查是否继承 BaseModel
  if (fileName !== 'base-model.ts' && !content.includes('extends BaseModel')) {
    issues.push({
      file: filePath,
      line: 1,
      severity: 'error',
      message: 'Model 类应继承 BaseModel',
      rule: 'model-extends-base',
    });
  }

  // 检查是否包含直接的 HTTP 请求（应该通过 Service）
  const httpMethods = ['http.get', 'http.post', 'http.put', 'http.delete', 'axios.'];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const method of httpMethods) {
      if (line.includes(method) && !line.trim().startsWith('//')) {
        issues.push({
          file: filePath,
          line: i + 1,
          severity: 'warning',
          message: `Model 不应直接调用 HTTP 请求，应通过 Service 调用 (发现: ${method})`,
          rule: 'model-no-http',
        });
        break;
      }
    }
  }

  // 检查是否导出 Composition Hook：useXxxModel（项目约定，与 Vue 3 setup 写法一致）
  // 同时兼容 createXxxModel 工厂函数命名
  const pascalName = fileName
    .replace('-model.ts', '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  const hasUseHook = content.includes(`use${pascalName}Model`);
  const hasFactory = content.includes(`create${pascalName}Model`);
  if (!hasUseHook && !hasFactory) {
    issues.push({
      file: filePath,
      line: 1,
      severity: 'warning',
      message: `建议导出 use${pascalName}Model（Composition Hook）或 create${pascalName}Model（工厂函数）`,
      rule: 'model-export-convention',
    });
  }

  return issues;
}

// 检查 Service 文件
function checkServiceFile(filePath: string): LayerIssue[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues: LayerIssue[] = [];
  const fileName = path.basename(filePath);

  // 检查是否继承 BaseService
  if (fileName !== 'base-service.ts' && !content.includes('extends BaseService')) {
    issues.push({
      file: filePath,
      line: 1,
      severity: 'error',
      message: 'Service 类应继承 BaseService',
      rule: 'service-extends-base',
    });
  }

  // 检查是否包含业务逻辑（简单的启发式检查）
  const businessLogicPatterns = [
    'if.*total.*>.*0',
    'items\.value',
    'state\.',
    'store\.',
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of businessLogicPatterns) {
      const regex = new RegExp(pattern);
      if (regex.test(line) && !line.trim().startsWith('//')) {
        issues.push({
          file: filePath,
          line: i + 1,
          severity: 'warning',
          message: 'Service 应包含纯 HTTP 请求，业务逻辑应放在 Model 中',
          rule: 'service-no-business-logic',
        });
        break;
      }
    }
  }

  // 检查是否有 export function createXxxService
  const pascalName = fileName
    .replace('-service.ts', '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  if (!content.includes(`create${pascalName}Service`)) {
    issues.push({
      file: filePath,
      line: 1,
      severity: 'warning',
      message: `建议添加工厂函数 create${pascalName}Service`,
      rule: 'service-factory-function',
    });
  }

  return issues;
}

// 递归扫描目录
function scanDirectory(dirPath: string, pattern: RegExp): string[] {
  return scanFiles(dirPath, { pattern });
}

// 主函数
function main(): void {
  const options = parseArgs();
  const allIssues: LayerIssue[] = [];

  logInfo('检查 Model/Service 分层规范...');

  // 名称识别规则（与项目约定对齐）：
  //   - Model: 位于 models/ 目录，文件名以 -model.ts 结尾
  //   - Service: 位于 services/ 目录，文件名以 -service.ts 结尾
  //   - 白名单：base-model.ts / base-service.ts / http.ts 等工具文件不参与检查
  //   - types/ 下的文件（即使名叫 x-service.ts）是纯类型定义，全部跳过
  const SERVICE_FILE_RE = /[\\/]services[\\/][^\\/]+-service\.ts$/;
  const MODEL_FILE_RE = /[\\/]models[\\/][^\\/]+-model\.ts$/;
  const SKIP_FILES = new Set(['base-model.ts', 'base-service.ts', 'http.ts']);

  for (const target of options.targets) {
    if (!fs.existsSync(target)) {
      logWarning(`路径不存在: ${target}`);
      continue;
    }

    const stats = fs.statSync(target);
    let files: string[] = [];

    if (stats.isDirectory()) {
      // 全量扫描，后续用正则过滤。不再仅凭“路径含 model/service”进行区分（避免误识 types/ 下的文件）
      files = scanDirectory(target, /\.ts$/);
    } else {
      files = [target];
    }

    for (const file of files) {
      const baseName = path.basename(file);
      if (SKIP_FILES.has(baseName)) {
        continue;
      }
      if (MODEL_FILE_RE.test(file)) {
        const issues = checkModelFile(file);
        allIssues.push(...issues);
      } else if (SERVICE_FILE_RE.test(file)) {
        const issues = checkServiceFile(file);
        allIssues.push(...issues);
      }
      // 其余文件（types/、stores/、utils/ 等）一律跳过
    }
  }

  // 输出结果
  if (allIssues.length === 0) {
    logSuccess('Model/Service 分层符合规范');
    process.exit(0);
  }

  // 按文件分组
  const issuesByFile = new Map<string, LayerIssue[]>();
  for (const issue of allIssues) {
    if (!issuesByFile.has(issue.file)) {
      issuesByFile.set(issue.file, []);
    }
    issuesByFile.get(issue.file)!.push(issue);
  }

  for (const [file, issues] of issuesByFile) {
    const relativePath = path.relative(process.cwd(), file);
    logInfo(`文件: ${relativePath}`);

    for (const issue of issues) {
      const icon = issue.severity === 'error' ? '❌' : '⚠️';
      logWarning(`  Line ${issue.line}: ${icon} [${issue.rule}] ${issue.message}`);
    }

    // 给出可执行的修复指引（不改写文件）
    const inheritIssues = issues.filter(i => i.rule === 'model-extends-base' || i.rule === 'service-extends-base');
    if (inheritIssues.length > 0) {
      logInfo('  修复指引: 让类继承对应基类并在构造函数里注入依赖');
      logInfo('    Model   → export class XxxModel extends BaseModel { constructor(private svc: XxxService) { super(); } }');
      logInfo('    Service → export class XxxService extends BaseService { ... }');
    }
  }

  // 总结
  logInfo('='.repeat(60));
  const errorCount = allIssues.filter((i) => i.severity === 'error').length;
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length;

  if (errorCount === 0 && warningCount === 0) {
    logSuccess('所有文件符合分层规范');
  } else {
    const summary = `发现 ${errorCount} 个错误, ${warningCount} 个警告`;
    if (errorCount > 0) logError(summary);
    else logWarning(summary);
    logInfo('分层规范:');
    logInfo('  - Model: 业务逻辑 + 状态管理，继承 BaseModel');
    logInfo('  - Service: 纯 HTTP 请求，继承 BaseService');
    logInfo('  - View: 模板渲染，调用 Model');
  }

  if (errorCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
