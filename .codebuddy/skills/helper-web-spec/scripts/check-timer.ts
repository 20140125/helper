#!/usr/bin/env node

/**
 * Timer 清理检查器
 * 检查 setTimeout/setInterval 是否在 onUnmounted 中正确清理
 * 用法: npx ts-node check-timer.ts [目录路径] [选项]
 */

import fs from 'fs';
import path from 'path';
import { FRONTEND_SRC } from './lib/paths';
import { scanFiles } from './lib/fs';
import { logInfo, logSuccess, logWarning, logError } from './logger';

interface TimerInfo {
  file: string;
  line: number;
  type: 'setInterval' | 'setTimeout';
  hasCleanup: boolean;
  cleanupLine?: number;
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
用法: npx ts-node check-timer.ts [目录路径] [选项]

选项:
  -h, --help      显示帮助信息

示例:
  npx ts-node check-timer.ts
  npx ts-node check-timer.ts frontend/src/views
`);
}

// 检查文件中的 timer 使用情况
// 范围：仅检查 .vue 组件的 <script setup>（这是唯一需要 onUnmounted 清理的场景）
// Model/Store 是 OOP 单例，自带 start/stop 生命周期方法，不适用本检查。
function checkFile(filePath: string): TimerInfo[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const ext = path.extname(filePath);
  // 只检查 Vue 单文件组件
  if (ext !== '.vue') {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const timers: TimerInfo[] = [];

  // 只检查 <script setup>（选项式 API 走传统 options.beforeUnmount，不在本检查中）
  const scriptMatch = content.match(/<script[^>]*setup[^>]*>/);
  if (!scriptMatch) {
    return [];
  }

  // 查找 timer 调用
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const intervalMatch = line.match(/(\w+)\s*=\s*setInterval\s*\(/);
    const timeoutMatch = line.match(/(\w+)\s*=\s*setTimeout\s*\(/);

    if (intervalMatch || timeoutMatch) {
      const varName = intervalMatch ? intervalMatch[1] : timeoutMatch![1];
      const type = intervalMatch ? 'setInterval' : 'setTimeout';
      const lineNum = i + 1;

      // 检查是否有清理代码
      const hasCleanup = checkCleanup(lines, varName);

      timers.push({
        file: filePath,
        line: lineNum,
        type,
        hasCleanup,
        cleanupLine: hasCleanup ? findCleanupLine(lines, varName) : undefined,
      });
    }
  }

  return timers;
}

// 检查是否有清理代码
function checkCleanup(lines: string[], varName: string): boolean {
  const cleanupPatterns = [
    new RegExp(`clearInterval\\s*\\(\\s*${varName}\\s*\\)`),
    new RegExp(`clearTimeout\\s*\\(\\s*${varName}\\s*\\)`),
  ];

  // 查找 onUnmounted
  let inOnUnmounted = false;
  for (const line of lines) {
    if (line.includes('onUnmounted')) {
      inOnUnmounted = true;
    }
    if (inOnUnmounted) {
      for (const pattern of cleanupPatterns) {
        if (pattern.test(line)) {
          return true;
        }
      }
      // 如果遇到下一个函数或返回，结束检查
      if (line.includes('})') || line.includes('return') || line.includes('function ')) {
        break;
      }
    }
  }

  return false;
}

// 查找清理代码的行号
function findCleanupLine(lines: string[], varName: string): number | undefined {
  const cleanupPatterns = [
    new RegExp(`clearInterval\\s*\\(\\s*${varName}\\s*\\)`),
    new RegExp(`clearTimeout\\s*\\(\\s*${varName}\\s*\\)`),
  ];

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of cleanupPatterns) {
      if (pattern.test(lines[i])) {
        return i + 1;
      }
    }
  }

  return undefined;
}

// 递归扫描目录
function scanDirectory(dirPath: string): string[] {
  return scanFiles(dirPath, { extensions: ['.vue'] });
}

// 主函数
function main(): void {
  const options = parseArgs();
  const allTimers: TimerInfo[] = [];

  logInfo('检查 Timer 清理规范...');

  for (const target of options.targets) {
    const stats = fs.statSync(target);
    let files: string[] = [];

    if (stats.isDirectory()) {
      files = scanDirectory(target);
    } else {
      files = [target];
    }

    for (const file of files) {
      const timers = checkFile(file);
      allTimers.push(...timers);
    }
  }

  // 输出结果
  if (allTimers.length === 0) {
    logInfo('未发现 timer 使用');
    process.exit(0);
  }

  // 按文件分组
  const timersByFile = new Map<string, TimerInfo[]>();
  for (const timer of allTimers) {
    if (!timersByFile.has(timer.file)) {
      timersByFile.set(timer.file, []);
    }
    timersByFile.get(timer.file)!.push(timer);
  }

  let problemCount = 0;

  for (const [file, timers] of timersByFile) {
    const relativePath = path.relative(process.cwd(), file);
    logInfo(`文件: ${relativePath}`);

    for (const timer of timers) {
      if (timer.hasCleanup) {
        logSuccess(`Line ${timer.line}: ${timer.type} -> 清理于行 ${timer.cleanupLine}`);
      } else {
        logError(`Line ${timer.line}: ${timer.type} -> 缺少清理代码!`);
        problemCount++;

        // 执行修复（实验性）
        if (options.fix || options.dryRun) {
          if (options.dryRun) {
            logInfo(`[Dry Run] 将添加 onUnmounted 清理代码: ${relativePath}:${timer.line}`);
          } else {
            logInfo(`自动添加 onUnmounted 清理功能正在开发中: ${relativePath}:${timer.line}`);
            logInfo(`建议手动添加: onUnmounted(() => { clear${timer.type === 'setInterval' ? 'Interval' : 'Timeout'}(${timer.type === 'setInterval' ? 'interval' : 'timeout'}Id); });`);
          }
        }
      }
    }
  }

  // 总结
  if (problemCount > 0) {
    logWarning(`发现 ${problemCount} 处潜在的 timer 内存泄漏风险!`);
    
    if (!options.fix && !options.dryRun) {
      logInfo('\n建议修复方法:');
      logInfo('  1. 保存 setTimeout/setInterval 的返回值');
      logInfo('  2. 在 onUnmounted 中调用 clearTimeout/clearInterval');
      logInfo('示例:');
      logInfo(`\
  import { onUnmounted } from 'vue';

  const timer = setInterval(() => {
    // do something
  }, 1000);

  onUnmounted(() => {
    clearInterval(timer);
  });
`);
      logInfo('提示:');
      logInfo('  添加 --fix 参数可以尝试自动修复（实验性）');
      logInfo('  添加 --dry-run 参数可以预览修复内容');
    }
    
    process.exit(1);
  } else {
    logSuccess('所有 timer 都已正确清理');
    process.exit(0);
  }
}

main();
