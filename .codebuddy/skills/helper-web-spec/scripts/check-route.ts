#!/usr/bin/env node

/**
 * 路由配置检查器
 * 检查路由配置是否符合项目规范
 * 用法: npx ts-node check-route.ts [目录路径] [选项]
 */

import fs from 'fs';
import path from 'path';
import { frontendPath } from './lib/paths';
import { scanFiles } from './lib/fs';
import { logInfo, logSuccess, logWarning, logError } from './logger';

interface RouteIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning';
  message: string;
}

interface ParsedArgs {
  target: string;
  fix: boolean;
  dryRun: boolean;
}

// 解析命令行参数
function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {
    target: '',
    fix: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg === '--fix') {
      result.fix = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (!arg.startsWith('-')) {
      result.target = arg;
    }
  }

  // 默认检查 frontend/src/router
  if (!result.target) {
    result.target = frontendPath('router');
  }

  return result;
}

function printUsage(): void {
  console.log(`
用法: npx ts-node check-route.ts [路由文件或目录] [选项]

选项:
  -h, --help      显示帮助信息
  --fix           自动修复（实验性）
  --dry-run       预览修复内容，不实际修改文件

示例:
  npx ts-node check-route.ts
  npx ts-node check-route.ts frontend/src/router/index.ts
  npx ts-node check-route.ts --dry-run --fix
`);
}

// 检查路由文件
function checkRouteFile(filePath: string): RouteIssue[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const ext = path.extname(filePath);
  if (ext !== '.ts' && ext !== '.js') {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues: RouteIssue[] = [];

  // 检查路由命名是否为 kebab-case
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检查 name 字段
    const nameMatch = line.match(/name:\s*['"]([^'"]+)['"]/);
    if (nameMatch) {
      const routeName = nameMatch[1];
      if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(routeName)) {
        issues.push({
          file: filePath,
          line: i + 1,
          severity: 'warning',
          message: `路由 name "${routeName}" 应使用 kebab-case 命名`,
        });
      }
    }
  }

  // 检查是否有 meta.label（项目使用 label 作为 i18n key，对齐 SKILL.md 命名约定）
  // 注：helper 项目使用顶部 import + 变量引用的路由组件模式（内网工具站，懒加载收益低，TS 类型友好），故不检查动态导入
  if (content.includes('meta:')) {
    // 简单切分每个 meta 对象（按行扫描，找到 meta: { ... } 的内容片段）
    // 这里采用宽松匹配：只要文件存在不含 label 的 meta 对象，就报一次警告
    const metaBlockRegex = /meta:\s*\{([^{}]*)\}/g;
    let metaMatch: RegExpExecArray | null;
    let hasMissingLabel = false;
    while ((metaMatch = metaBlockRegex.exec(content)) !== null) {
      const inner = metaMatch[1];
      if (!/\blabel\s*:/.test(inner)) {
        hasMissingLabel = true;
        break;
      }
    }
    if (hasMissingLabel) {
      issues.push({
        file: filePath,
        line: 1,
        severity: 'warning',
        message: '路由配置建议包含 meta.label 用于 i18n',
      });
    }
  }

  return issues;
}

// 递归扫描目录
function scanDirectory(dirPath: string): string[] {
  return scanFiles(dirPath, { extensions: ['.ts', '.js'] });
}

// 主函数
function main(): void {
  const options = parseArgs();
  const allIssues: RouteIssue[] = [];

  logInfo('检查路由配置规范...');

  const stats = fs.statSync(options.target);
  let files: string[] = [];

  if (stats.isDirectory()) {
    files = scanDirectory(options.target);
  } else {
    files = [options.target];
  }

  for (const file of files) {
    const issues = checkRouteFile(file);
    allIssues.push(...issues);
  }

  // 输出结果
  if (allIssues.length === 0) {
    logSuccess('路由配置符合规范');
    process.exit(0);
  }

  // 按文件分组
  const issuesByFile = new Map<string, RouteIssue[]>();
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
      if (issue.severity === 'error') {
        logError(`Line ${issue.line}: ${issue.message}`);
      } else {
        logWarning(`Line ${issue.line}: ${issue.message}`);
      }
    }

    // 执行修复
    let content = fs.readFileSync(file, 'utf-8');
    let modified = false;

    // 修复1: kebab-case 命名
    if (options.fix || options.dryRun) {
      const lines = content.split('\n');
      let lineModified = false;

      for (const issue of issues) {
        if (issue.message.includes('kebab-case')) {
          const lineIndex = issue.line - 1;
          const line = lines[lineIndex];
          const nameMatch = line.match(/name:\s*['"]([^'"]+)['"]/);
          
          if (nameMatch) {
            const oldName = nameMatch[1];
            const newName = oldName.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
            
            if (oldName !== newName) {
              if (options.dryRun) {
                logInfo(`[Dry Run] 将重命名路由: ${oldName} -> ${newName}`);
              } else {
                lines[lineIndex] = line.replace(oldName, newName);
                lineModified = true;
                logSuccess(`已修复: ${relativePath}:${issue.line} - ${oldName} -> ${newName}`);
              }
            }
          }
        }
      }

      if (lineModified) {
        content = lines.join('\n');
        modified = true;
      }
    }

    // 修复2: 添加 meta.label（用于 i18n）
    if ((options.fix || options.dryRun) && issues.some((i) => i.message.includes('meta.label'))) {
      if (options.dryRun) {
        logInfo(`[Dry Run] 将为缺失 label 的 meta 对象添加 meta.label 到 ${relativePath}`);
      } else {
        // 遍历所有 meta: { ... } 块，给缺少 label 的注入占位 label
        const metaBlockRegex = /meta:\s*\{([^{}]*)\}/g;
        let injectedCount = 0;
        const newContent = content.replace(metaBlockRegex, (full, inner) => {
          if (/\blabel\s*:/.test(inner)) {
            return full;
          }
          injectedCount += 1;
          // 单行 / 多行 meta 都统一改成单行注入：保留原内容，把 label 放在最前面
          const trimmedInner = inner.trim();
          const newInner = trimmedInner ? ` label: '', ${trimmedInner}${trimmedInner.endsWith(',') ? '' : ','} ` : ` label: '' `;
          return `meta: {${newInner}}`;
        });
        if (injectedCount > 0) {
          content = newContent;
          modified = true;
          logSuccess(`已修复: ${relativePath} - 为 ${injectedCount} 个 meta 添加占位 label（请补全 i18n key）`);
        } else {
          logWarning(`未能自动修复 ${relativePath} 的 meta.label，请手动添加`);
        }
      }
    }

    // 修复完成（kebab-case 与 meta.label；项目不要求动态导入，该检查项已移除）

    // 写入文件
    if (modified && !options.dryRun) {
      fs.writeFileSync(file, content, 'utf-8');
    }
  }

  // 总结
  const errorCount = allIssues.filter((i) => i.severity === 'error').length;
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length;

  logInfo(`发现 ${errorCount} 个错误, ${warningCount} 个警告`);

  if (allIssues.length > 0 && !options.fix && !options.dryRun) {
    logInfo('\n提示:');
    logInfo('  添加 --fix 参数可以尝试自动修复（实验性）');
    logInfo('  添加 --dry-run 参数可以预览修复内容');
  }

  if (errorCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
