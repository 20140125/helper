#!/usr/bin/env node

/**
 * 自动修复代码规范问题（以项目自身 ESLint 规则为准）
 *
 * 用法:
 *   npx ts-node -P .../scripts/tsconfig.json auto-fix.ts <目录路径> [--dry-run]
 *   npm run auto-fix              # web 下别名，默认 frontend/src
 *   npm run auto-fix -- --dry-run # 只预览将修复哪些，不落盘
 */

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { logInfo, logSuccess, logWarning, logError } from './logger';

/** 项目根（helper）: scripts → helper-web-spec → skills → .codebuddy → helper */
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

/** ESLint 配置文件候选名（flat config 优先，兼容传统 .eslintrc） */
const ESLINT_CONFIG_NAMES = [
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  '.eslintrc.js',
  '.eslintrc.cjs',
  '.eslintrc.json',
  '.eslintrc',
];

type EslintMessage = {
  ruleId: string | null;
  severity: number;
  message: string;
  line: number;
  column: number;
  fix?: unknown;
};

type EslintResult = {
  filePath: string;
  errorCount: number;
  warningCount: number;
  /** 可被 --fix 自动修复的问题数（仅 --fix / --fix-dry-run 之外的普通 lint 输出中存在） */
  fixableErrorCount?: number;
  fixableWarningCount?: number;
  /** 修复后的源码：--fix-dry-run 下，字段存在即代表该文件会被改写 */
  output?: string;
  messages: EslintMessage[];
};

/** 从 startDir 逐级向上找带 ESLint 配置的目录（即 lint 规则所属项目） */
function findEslintProject(startDir: string): string | null {
  let dir = path.resolve(startDir);
  for (;;) {
    if (ESLINT_CONFIG_NAMES.some(name => fs.existsSync(path.join(dir, name)))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** 定位 eslint 可执行文件：优先项目内 .bin，缺失时回退 npx */
function resolveEslintRunner(projectDir: string): { cmd: string; prefix: string[] } {
  const localBin = path.join(projectDir, 'node_modules', '.bin', 'eslint');
  if (fs.existsSync(localBin)) {
    return { cmd: localBin, prefix: [] };
  }
  return { cmd: 'npx', prefix: ['eslint'] };
}

/**
 * 目标目录解析
 * 兼容三种传参基准：绝对路径 / 相对当前 cwd（npm alias 传 frontend/src，cwd=web）/ 相对项目根
 */
function resolveTargetDir(targetArg: string): string | null {
  const candidates = [
    path.resolve(targetArg),
    path.resolve(PROJECT_ROOT, targetArg),
    path.resolve(PROJECT_ROOT, 'web', targetArg),
  ];
  return candidates.find(p => fs.existsSync(p) && fs.statSync(p).isDirectory()) || null;
}

/** 执行 eslint 并解析 JSON 输出（eslint 有问题时退出码非 0，用 spawnSync 不抛异常） */
function runEslint(
  runner: { cmd: string; prefix: string[] },
  projectDir: string,
  target: string,
  extraArgs: string[],
): { results: EslintResult[]; raw: string } {
  const res = spawnSync(runner.cmd, [...runner.prefix, target, ...extraArgs, '-f', 'json'], {
    cwd: projectDir,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });

  const raw = `${res.stdout || ''}${res.stderr || ''}`;
  let results: EslintResult[] = [];
  try {
    const parsed = JSON.parse(res.stdout || '[]');
    if (Array.isArray(parsed)) results = parsed as EslintResult[];
  } catch {
    // 配置错误等情况会输出非 JSON，交由调用方展示原始输出
    results = [];
  }
  return { results, raw };
}

/** 汇总问题数 */
function countProblems(results: EslintResult[]): { total: number; errors: number; warnings: number; files: number } {
  let total = 0;
  let errors = 0;
  let warnings = 0;
  for (const r of results) {
    total += r.messages.length;
    for (const m of r.messages) {
      if (m.severity === 2) errors += 1;
      else warnings += 1;
    }
  }
  return { total, errors, warnings, files: results.length };
}

/** 打印剩余需人工处理的问题（最多 20 条） */
function printRemaining(results: EslintResult[], limit = 20): void {
  const items: string[] = [];
  for (const r of results) {
    const rel = path.relative(PROJECT_ROOT, r.filePath);
    for (const m of r.messages) {
      items.push(`  ${rel}:${m.line}:${m.column}  ${m.ruleId || '(fatal)'}  ${m.message}`);
    }
  }
  if (items.length === 0) return;
  logWarning(`以下 ${items.length} 处需手动处理${items.length > limit ? `（先列 ${limit} 条）` : ''}:`);
  console.log(items.slice(0, limit).join('\n'));
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const targetArg = args.find(arg => !arg.startsWith('--')) || path.join('web', 'frontend', 'src');

  const targetDir = resolveTargetDir(targetArg);
  if (!targetDir) {
    logError(`目标目录不存在: ${targetArg}`);
    process.exit(1);
  }

  const projectDir = findEslintProject(targetDir);
  if (!projectDir) {
    logError(`未在 ${targetDir} 及其上级目录找到 ESLint 配置（eslint.config.js / .eslintrc*`);
    logInfo('当前项目 web/frontend 已内置 eslint.config.js，请确认依赖已安装：cd web/frontend && npm i');
    process.exit(1);
  }

  const runner = resolveEslintRunner(projectDir);
  const target = path.relative(projectDir, targetDir) || '.';
  const configName = ESLINT_CONFIG_NAMES.find(name => fs.existsSync(path.join(projectDir, name))) || '';

  logInfo(`🔧 ${dryRun ? '[DRY RUN] ' : ''}自动修复: ${path.relative(PROJECT_ROOT, targetDir)}`);
  logInfo(`规则来源: ${path.relative(PROJECT_ROOT, path.join(projectDir, configName))}（项目自身 ESLint 配置）`);
  logInfo('='.repeat(60));

  // 1) 基线：当前有多少问题
  const baseline = runEslint(runner, projectDir, target, []);
  if (baseline.results.length === 0 && baseline.raw.trim()) {
    // JSON 解析不出来说明 eslint 本身没跑起来（配置错误/依赖缺失）
    logError('ESLint 执行失败，原始输出：');
    console.log(baseline.raw.trim());
    process.exit(1);
  }
  const base = countProblems(baseline.results);
  logInfo(`扫描 ${base.files} 个文件，发现 ${base.total} 处问题（${base.errors} error / ${base.warnings} warning）`);

  // 2) 修复（或预览）
  if (dryRun) {
    // --fix-dry-run 的 JSON 里 messages 已是「修复后剩余」，判断哪些文件会被改写要看 output；
    // 可修复条数取自基线输出的 fixableErrorCount / fixableWarningCount
    const preview = runEslint(runner, projectDir, target, ['--fix-dry-run']);
    const baseByPath = new Map(baseline.results.map(r => [r.filePath, r]));
    const plan: Array<{ file: string; count: number }> = [];
    let total = 0;

    for (const r of preview.results) {
      if (r.output === undefined || r.output === null) continue;
      const base = baseByPath.get(r.filePath);
      const count = (base?.fixableErrorCount ?? 0) + (base?.fixableWarningCount ?? 0);
      plan.push({ file: path.relative(PROJECT_ROOT, r.filePath), count });
      total += count;
    }

    if (plan.length === 0) {
      logSuccess('没有可自动修复的问题（其余需人工处理）');
    } else {
      logInfo(`将修复 ${total} 处，涉及 ${plan.length} 个文件（移除 --dry-run 实际执行）:`);
      for (const item of plan.slice(0, 30)) {
        console.log(`  ${item.file}  ${item.count} 处`);
      }
      if (plan.length > 30) console.log(`  ... 另有 ${plan.length - 30} 个文件`);
    }
  } else {
    const fixed = runEslint(runner, projectDir, target, ['--fix']);
    // --fix 的 JSON 输出即修复后剩余的问题
    const remain = countProblems(fixed.results);
    const fixedCount = base.total - remain.total;
    if (fixedCount > 0) {
      logSuccess(`已自动修复 ${fixedCount} 处问题`);
    } else {
      logInfo('没有可自动修复的问题');
    }
    if (remain.total > 0) {
      logWarning(`仍有 ${remain.total} 处需手动处理（${remain.errors} error / ${remain.warnings} warning）`);
      printRemaining(fixed.results);
    } else {
      logSuccess('🎉 全部问题已清除');
    }
  }

  logInfo('='.repeat(60));
  if (base.total > 0) {
    logInfo('提示：Props/Emits 写法与注释属项目规范（非 ESLint 能力），用 npm run lint:style 巡检后按 references/11 修正');
  }
}

main();
