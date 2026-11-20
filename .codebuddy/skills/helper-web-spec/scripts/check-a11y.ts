#!/usr/bin/env node

/**
 * 无障碍访问检查器
 * 检查 Vue 组件的无障碍访问属性
 * 用法: npx ts-node check-a11y.ts [目录路径] [选项]
 */

import fs from 'fs';
import path from 'path';
import { FRONTEND_SRC } from './lib/paths';
import { scanFiles } from './lib/fs';
import { logInfo, logSuccess, logWarning, logError } from './logger';

interface A11yIssue {
  file: string;
  line: number;
  severity: 'error' | 'warning';
  message: string;
  rule: string;
}

interface ParsedArgs {
  targets: string[];
  fix: boolean;
  dryRun: boolean;
}

// 解析命令行参数
function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {
    targets: [],
    fix: false,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-h' || arg === '--help') {
      printUsage();
      process.exit(0);
    } else if (arg === '--fix' || arg === '--dry-run') {
      // 本脚本只做检查：--fix / --dry-run 从未实现（旧版解析了参数却什么都没做）
      logWarning(`本脚本只做检查，不支持 ${arg}`);
    } else if (!arg.startsWith('-')) {
      result.targets.push(arg);
    }
  }

  // 默认扫描 frontend/src
  if (result.targets.length === 0) {
    result.targets.push(FRONTEND_SRC);
  }

  return result;
}

function printUsage(): void {
  console.log(`
用法: npx ts-node check-a11y.ts [目录路径] [选项]

选项:
  -h, --help      显示帮助信息

示例:
  npx ts-node check-a11y.ts
  npx ts-node check-a11y.ts frontend/src/components
`);
}

// 检查 Vue 文件的无障碍问题
function checkVueFile(filePath: string): A11yIssue[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const ext = path.extname(filePath);
  if (ext !== '.vue' && ext !== '.tsx' && ext !== '.jsx') {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const issues: A11yIssue[] = [];

  // 提取 template 部分
  const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/);
  if (!templateMatch) {
    return issues;
  }

  const template = templateMatch[1];
  const templateLines = template.split('\n');

  // 旧实现直接把「template 内的行号」当成文件行号，报告出来的行号整体偏小。
  // 这里算出 <template> 内容首行在文件中的真实行号（1-based），再叠加。
  const templateOffset =
    content.slice(0, (templateMatch.index || 0) + '<template>'.length).split('\n').length;

  // 检查图片是否有 alt 属性
  for (let i = 0; i < templateLines.length; i++) {
    const line = templateLines[i];

    // 检查 <img> 标签
    const imgMatch = line.match(/<img[^>]*>/g);
    if (imgMatch) {
      for (const img of imgMatch) {
        if (!img.includes('alt=') && !img.includes(':alt=')) {
          issues.push({
            file: filePath,
            line: templateOffset + i,
            severity: 'error',
            message: '<img> 标签缺少 alt 属性',
            rule: 'img-alt',
          });
        }
      }
    }

    // 检查按钮是否有 aria-label 或文字内容
    const buttonMatch = line.match(/<(t-button|button)[^>]*>/g);
    if (buttonMatch) {
      for (const btn of buttonMatch) {
        const hasAriaLabel = btn.includes('aria-label') || btn.includes(':aria-label');
        const hasContent = line.includes('>') && !line.includes('></button>') && !line.includes('/>');

        if (!hasAriaLabel && !hasContent) {
          issues.push({
            file: filePath,
            line: templateOffset + i,
            severity: 'warning',
            message: '按钮缺少 aria-label 或文字内容',
            rule: 'button-aria-label',
          });
        }
      }
    }

    // 检查输入框是否有 label 或 aria-label
    const inputMatch = line.match(/<(t-input|input|t-textarea|textarea)[^>]*>/g);
    if (inputMatch) {
      for (const input of inputMatch) {
        const hasAriaLabel = input.includes('aria-label') || input.includes(':aria-label');
        const hasLabel = input.includes('label=') || input.includes(':label=');

        if (!hasAriaLabel && !hasLabel) {
          issues.push({
            file: filePath,
            line: templateOffset + i,
            severity: 'warning',
            message: '输入框缺少 label 或 aria-label',
            rule: 'input-label',
          });
        }
      }
    }

    // 检查链接是否有有意义的文本
    const linkMatch = line.match(/<(a|t-link)[^>]*>/g);
    if (linkMatch) {
      for (const link of linkMatch) {
        const hasAriaLabel = link.includes('aria-label');
        const hasContent = line.includes('>') && !line.includes('></a>');

        if (!hasAriaLabel && !hasContent && !line.includes('aria-hidden')) {
          issues.push({
            file: filePath,
            line: templateOffset + i,
            severity: 'warning',
            message: '链接缺少有意义的文本或 aria-label',
            rule: 'link-meaningful',
          });
        }
      }
    }
  }

  return issues;
}

// 递归扫描目录
// 主函数
function main(): void {
  const options = parseArgs();
  const allIssues: A11yIssue[] = [];

  logInfo('检查无障碍访问规范...');

  for (const target of options.targets) {
    // 公共扫描：忽略名单与其余脚本一致；目标不存在时返回空数组，不再因 statSync 抛错
    const files = scanFiles(target, { extensions: ['.vue', '.tsx', '.jsx'] });

    for (const file of files) {
      const issues = checkVueFile(file);
      allIssues.push(...issues);
    }
  }

  // 输出结果
  if (allIssues.length === 0) {
    logSuccess('未发现无障碍访问问题');
    process.exit(0);
  }

  // 按文件分组
  const issuesByFile = new Map<string, A11yIssue[]>();
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
        logError(`Line ${issue.line}: [${issue.rule}] ${issue.message}`);
      } else {
        logWarning(`Line ${issue.line}: [${issue.rule}] ${issue.message}`);
      }
    }
  }

  // 总结
  const errorCount = allIssues.filter((i) => i.severity === 'error').length;
  const warningCount = allIssues.filter((i) => i.severity === 'warning').length;

  logInfo(`发现 ${errorCount} 个错误, ${warningCount} 个警告`);
  logInfo('无障碍检查规则:');
  logInfo('  - img-alt: 图片必须有 alt 属性');
  logInfo('  - button-aria-label: 按钮应有 aria-label 或文字');
  logInfo('  - input-label: 输入框应有 label 或 aria-label');
  logInfo('  - link-meaningful: 链接应有意义明确的文本');

  if (errorCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main();
