#!/usr/bin/env node

/**
 * 导入顺序检查器
 * 检查并自动修复导入语句顺序
 * 用法: npx ts-node check-import-order.ts [目录路径] [选项]
 */

import fs from 'fs';
import path from 'path';
import { FRONTEND_SRC } from './lib/paths';
import { scanFiles } from './lib/fs';
import { logInfo, logSuccess, logWarning } from './logger';

interface ImportStatement {
  text: string;
  startLine: number;
  endLine: number;
  category: ImportCategory;
}

type ImportCategory = 'vue' | 'third-party' | 'project' | 'relative' | 'type';

interface ParsedArgs {
  targets: string[];
  fix: boolean;
  dryRun: boolean;
}

// 导入顺序规范
const IMPORT_ORDER: ImportCategory[] = ['vue', 'third-party', 'project', 'relative', 'type'];

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
    } else if (arg === '--fix') {
      result.fix = true;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
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
  logInfo(`
用法: npx ts-node check-import-order.ts [目录路径] [选项]

选项:
  -h, --help      显示帮助信息
  --fix           自动修复导入顺序
  --dry-run       预览修复内容，不实际修改文件

示例:
  npx ts-node check-import-order.ts
  npx ts-node check-import-order.ts frontend/src/components
  npx ts-node check-import-order.ts --dry-run --fix
`);
}

// 判断导入语句的类别
function getImportCategory(importText: string): ImportCategory {
  // import type 语句
  if (importText.startsWith('import type')) {
    return 'type';
  }

  // 提取模块路径
  const match = importText.match(/from\s+['"]([^'"]+)['"]/);
  if (!match) return 'relative';

  const modulePath = match[1];

  // Vue 核心库
  if (modulePath === 'vue' || modulePath.startsWith('vue-')) {
    return 'vue';
  }

  // 第三方库（不是相对路径，也不是 @/ 开头）
  if (!modulePath.startsWith('.') && !modulePath.startsWith('@/')) {
    return 'third-party';
  }

  // 项目内部模块
  if (modulePath.startsWith('@/')) {
    return 'project';
  }

  // 相对路径导入
  return 'relative';
}

// 从文件中提取导入语句
function extractImports(filePath: string): ImportStatement[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const ext = path.extname(filePath);
  if (!['.ts', '.vue', '.js', '.tsx', '.jsx'].includes(ext)) {
    return [];
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const imports: ImportStatement[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // 检查是否是导入语句的开始
    if (line.startsWith('import ') || line.startsWith('import\t')) {
      const startLine = i + 1;
      let importText = line;

      // 处理多行导入
      while (!line.endsWith(';') && i + 1 < lines.length) {
        i++;
        importText += ' ' + lines[i].trim();
        if (lines[i].includes(';')) break;
      }

      const category = getImportCategory(importText);
      imports.push({
        text: importText,
        startLine,
        endLine: i + 1,
        category,
      });
    } else if (line !== '' && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*')) {
      // 遇到非导入、非注释、非空行，停止扫描
      break;
    }

    i++;
  }

  return imports;
}

// 检查导入顺序是否正确
function checkImportOrder(imports: ImportStatement[]): boolean {
  for (let i = 1; i < imports.length; i++) {
    const prevIndex = IMPORT_ORDER.indexOf(imports[i - 1].category);
    const currIndex = IMPORT_ORDER.indexOf(imports[i].category);

    if (currIndex < prevIndex) {
      return false;
    }
  }
  return true;
}

// 排序导入语句
function sortImports(imports: ImportStatement[]): ImportStatement[] {
  return [...imports].sort((a, b) => {
    const aIndex = IMPORT_ORDER.indexOf(a.category);
    const bIndex = IMPORT_ORDER.indexOf(b.category);
    return aIndex - bIndex;
  });
}

// 修复文件中的导入顺序
function fixImportOrder(filePath: string, imports: ImportStatement[], dryRun: boolean): boolean {
  const sorted = sortImports(imports);

  // 检查是否已经在正确顺序
  const alreadyCorrect = imports.every((imp, idx) => imp.text === sorted[idx].text);
  if (alreadyCorrect) {
    return false;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  // 找到要替换的行范围
  const startLine = imports[0].startLine - 1; // 转换为 0-based
  const endLine = imports[imports.length - 1].endLine - 1; // 转换为 0-based

  // 把注释与空行绑定到紧随其后的那条 import，排序时跟着一起走 ——
  // 旧实现只把 import 行本身重排，import 之间的「// 第三方库」这类分节注释和空行会被直接丢掉
  const chunkByImport = new Map<ImportStatement, string[]>();
  for (let i = 0; i < imports.length; i++) {
    const imp = imports[i];
    const prefixStart = i === 0 ? startLine : imports[i - 1].endLine;
    const prefix = lines.slice(prefixStart, imp.startLine - 1);
    const body = lines.slice(imp.startLine - 1, imp.endLine);
    chunkByImport.set(imp, [...prefix, ...body]);
  }

  const sortedTexts: string[] = [];
  for (const imp of sorted) {
    const chunk = chunkByImport.get(imp);
    if (chunk) sortedTexts.push(...chunk);
  }

  // 替换
  const newLines = [
    ...lines.slice(0, startLine),
    ...sortedTexts,
    ...lines.slice(endLine + 1)
  ];

  const newContent = newLines.join('\n');
  const relativePath = path.relative(process.cwd(), filePath);

  if (dryRun) {
    logInfo(`\n[Dry Run] 将修复: ${relativePath}`);
    logInfo('变更预览:');
    logInfo('-'.repeat(60));
    sortedTexts.forEach(text => logInfo(text));
    logInfo('-'.repeat(60));
  } else {
    fs.writeFileSync(filePath, newContent, 'utf-8');
    logSuccess(`已修复: ${relativePath}`);
  }

  return true;
}

// 递归扫描目录
function scanDirectory(dirPath: string): string[] {
  return scanFiles(dirPath, { extensions: ['.ts', '.vue', '.js', '.tsx', '.jsx'] });
}

// 主函数
function main(): void {
  const options = parseArgs();
  const filesWithIssues: { file: string; imports: ImportStatement[] }[] = [];

  logInfo('检查导入顺序规范...');

  for (const target of options.targets) {
    const stats = fs.statSync(target);
    let files: string[] = [];

    if (stats.isDirectory()) {
      files = scanDirectory(target);
    } else {
      files = [target];
    }

    for (const file of files) {
      const imports = extractImports(file);

      if (imports.length > 1 && !checkImportOrder(imports)) {
        filesWithIssues.push({ file, imports });
      }
    }
  }

  // 输出结果
  if (filesWithIssues.length === 0) {
    logSuccess('所有文件的导入顺序符合规范');
    process.exit(0);
  }

  logInfo(`发现 ${filesWithIssues.length} 个文件导入顺序不规范:\n`);

  let fixedCount = 0;
  for (const { file, imports } of filesWithIssues) {
    const relativePath = path.relative(process.cwd(), file);
    logInfo(`文件: ${relativePath}`);

    const sorted = sortImports(imports);
    for (let i = 0; i < imports.length; i++) {
      if (imports[i].text !== sorted[i].text) {
        logWarning(`  Line ${imports[i].startLine}: ${imports[i].category} -> 应移到 ${IMPORT_ORDER.indexOf(sorted[i].category) + 1} 位置`);
      }
    }

    // 执行修复
    if (options.fix || options.dryRun) {
      const fixed = fixImportOrder(file, imports, options.dryRun);
      if (fixed) fixedCount++;
    }
  }

  // 总结
  logInfo('\n' + '='.repeat(60));
  logInfo('导入顺序规范:');
  IMPORT_ORDER.forEach((cat, idx) => {
    logInfo(`  ${idx + 1}. ${cat}`);
  });

  if (options.fix || options.dryRun) {
    logInfo('='.repeat(60));
    if (options.dryRun) {
      logWarning(`[Dry Run] 将修复 ${fixedCount} 个文件`);
      logInfo('添加 --fix 参数实际执行修复');
    } else {
      logSuccess(`已修复 ${fixedCount} 个文件`);
    }
  } else {
    logInfo('='.repeat(60));
    logWarning('添加 --fix 参数可以自动修复');
    logInfo('添加 --dry-run 参数可以预览修复内容');
  }

  process.exit(options.fix || options.dryRun ? 0 : 1);
}

main();
