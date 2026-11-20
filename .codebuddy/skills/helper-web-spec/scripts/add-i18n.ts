#!/usr/bin/env node

/**
 * 批量添加 i18n 翻译脚本
 * 扫描代码中的中文硬编码，自动包装为 i18n 调用
 * 用法: npx ts-node add-i18n.ts <目录路径> [--dry-run] [--fix]
 */

import fs from 'fs';
import path from 'path';
import { FRONTEND_SRC } from './lib/paths';
import { scanFiles as scanSourceFiles } from './lib/fs';
import { logInfo, logSuccess, logWarning, logError } from './logger';

interface I18nFinding {
  /** 相对项目根目录的文件路径 */
  file: string;
  /** 命中行号（1-based） */
  line: number;
  /** 命中的中文文本 */
  text: string;
  /** 建议的 i18n key（含模块前缀） */
  key: string;
  /** 命中的整行内容 */
  fullLine: string;
  /** 修复后的行内容 */
  fixedLine?: string;
}

// 匹配中文正则（包括中文、中文标点）
const chineseRegex = /[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]+/g;

// 需要跳过的文件/目录
const skipPatterns: string[] = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'locales',
  '.codebuddy',
];

// 扫描目录中的 Vue/TS/JS 文件
function scanFiles(dir: string): string[] {
  // 保留原有的跳过规则（如 locales 目录），其余交给公共扫描
  return scanSourceFiles(dir, { extensions: ['.vue', '.ts', '.js'] })
    .filter(file => !skipPatterns.some(p => file.includes(p)));
}

// 从文件路径生成 i18n 前缀
function getI18nPrefix(filePath: string): string {
  const srcIndex = filePath.indexOf('src/');
  if (srcIndex === -1) return 'common';

  const relativePath = filePath.slice(srcIndex + 4);
  const parts = relativePath.split('/');

  // 特殊处理
  if (parts[0] === 'views') {
    return parts[1] || 'common';
  }
  if (parts[0] === 'components') {
    return parts[1] || 'common';
  }

  return parts[0] || 'common';
}

// 生成合法的 i18n key（小写+下划线）
function generateI18nKey(text: string, prefix: string): string {
  // 取前10个中文字符，转拼音首字母或直接使用描述性英文
  const normalized = text.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
  const key = normalized.length > 20 ? normalized.slice(0, 20) : normalized;
  return `${prefix}.${key}`;
}

// 检查行是否需要跳过（已在i18n调用中、在注释中等）
function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim();
  
  // 跳过注释行
  if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
    return true;
  }
  
  // 跳过已经使用 i18n 的行
  if (line.includes('t(') || line.includes('$t(') || line.includes('localeStore') || line.includes('i18n')) {
    return true;
  }
  
  // 跳过 import 语句
  if (trimmed.startsWith('import ')) {
    return true;
  }
  
  return false;
}

// 修复行中的中文硬编码
function fixLine(line: string, text: string, key: string): string {
  let fixedLine = line;
  
  // 场景1: 在模板中 {{ }} 插值
  if (fixedLine.includes('{{')) {
    const pattern = `{{${text}}}`;
    if (fixedLine.includes(pattern)) {
      fixedLine = fixedLine.replace(pattern, `{{ t('${key}') }}`);
      return fixedLine;
    }
    
    // 处理 {{ xxx + '中文' }} 或 {{ '中文' + xxx }} 的情况
    const templatePattern = new RegExp(`{{[^}]*?${escapeRegExp(text)}[^}]*?}}`);
    if (templatePattern.test(fixedLine)) {
      // 在模板中，需要把整个表达式替换为使用计算属性或方法
      // 简单处理：直接替换中文部分为 t() 调用
      fixedLine = fixedLine.replace(
        new RegExp(escapeRegExp(text), 'g'),
        `{{ t('${key}') }}`
      );
      return fixedLine;
    }
  }
  
  // 场景2: 在属性绑定中 :xxx="..."
  const attrBindingRegex = /:(\w+)="([^"]*)"/g;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrBindingRegex.exec(fixedLine)) !== null) {
    const attrValue = attrMatch[2];
    if (attrValue.includes(text)) {
      // 替换属性绑定中的中文
      const newAttrValue = attrValue.replace(text, `t('${key}')`);
      fixedLine = fixedLine.replace(attrMatch[0], `:${attrMatch[1]}="${newAttrValue}"`);
      return fixedLine;
    }
  }
  
  // 场景3: 在字符串中（单引号或双引号）
  // 匹配 '...中文...' 或 "...中文..."
  const stringRegex = new RegExp(`(['"])([^'"]*?)${escapeRegExp(text)}([^'"]*?)\\1`);
  const stringMatch = fixedLine.match(stringRegex);
  if (stringMatch) {
    const before = stringMatch[2];
    const after = stringMatch[3];
    const quote = stringMatch[1];
    
    // 替换为模板字符串
    fixedLine = fixedLine.replace(
      stringRegex,
      `\`${before}\${t('${key}')}${after}\``
    );
    return fixedLine;
  }
  
  // 场景4: 在模板文本中（不在插值中）
  if (fixedLine.includes('<template')) {
    // 模板中的纯文本节点
    const textNodeRegex = new RegExp(`>([^<]*?)${escapeRegExp(text)}([^>]*?)<`);
    if (textNodeRegex.test(fixedLine)) {
      fixedLine = fixedLine.replace(
        textNodeRegex,
        `>{{ t('${key}') }}<`
      );
      return fixedLine;
    }
  }
  
  // 默认：直接替换中文为 t() 调用
  fixedLine = fixedLine.replace(text, `t('${key}')`);
  
  return fixedLine;
}

// 转义正则特殊字符
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 分析文件中的中文硬编码
function analyzeFile(filePath: string): I18nFinding[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const results: I18nFinding[] = [];
  
  // 判断文件类型，确定如何导入 t
  const isVueFile = filePath.endsWith('.vue');
  const isTsFile = filePath.endsWith('.ts') || filePath.endsWith('.tsx');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 跳过不需要处理的行
    if (shouldSkipLine(line)) continue;
    
    let match: RegExpExecArray | null;
    const lineCopy = line;
    chineseRegex.lastIndex = 0; // 重置正则索引
    
    while ((match = chineseRegex.exec(lineCopy)) !== null) {
      const text = match[0];
      const prefix = getI18nPrefix(filePath);
      const key = generateI18nKey(text, prefix);
      
      // 生成修复后的行
      const fixedLine = fixLine(line, text, key);
      
      results.push({
        file: path.relative(process.cwd(), filePath),
        line: i + 1,
        text,
        key,
        fullLine: line.trim(),
        fixedLine,
      });
    }
  }

  return results;
}

// 为文件添加 i18n 导入
function addI18nImport(content: string, filePath: string): string {
  const lines = content.split('\n');
  
  // 检查是否已有 i18n 导入
  const hasI18nImport = lines.some(line => 
    line.includes('useI18n') || 
    line.includes('localeStore') ||
    line.includes('from \'@/locales\'')
  );
  
  if (hasI18nImport) return content;
  
  const isVueFile = filePath.endsWith('.vue');
  const isTsFile = filePath.endsWith('.ts');
  
  if (isVueFile) {
    // Vue 文件：在 script setup 中添加 useI18n
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('<script') && lines[i].includes('setup')) {
        // 找到 script 标签的结束位置（> 字符）
        let j = i;
        while (j < lines.length && !lines[j].includes('>')) {
          j++;
        }
        // 在 script 标签后添加导入
        const importLines = [
          "import { useI18n } from 'vue-i18n';",
          'const { t } = useI18n();',
          '',
        ];
        lines.splice(j + 1, 0, ...importLines);
        return lines.join('\n');
      }
    }
  } else if (isTsFile) {
    // TS 文件：添加 localeStore 导入
    // 找到最后一个 import 语句
    let lastImportIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) {
        lastImportIndex = i;
      }
    }
    
    if (lastImportIndex !== -1) {
      const importLines = [
        "import { useLocaleStore } from '@/stores/locale';",
        'const localeStore = useLocaleStore();',
        '',
      ];
      lines.splice(lastImportIndex + 1, 0, ...importLines);
      return lines.join('\n');
    }
  }
  
  return lines.join('\n');
}

// 主函数
function printUsage(): void {
  logInfo(`
用法: npx ts-node add-i18n.ts [目录路径] [选项]

选项:
  -h, --help      显示帮助信息
  --dry-run       只报告，不写入 locales 文件
  --fix           按建议 key 写入 locales（默认行为，保留该参数只为兼容旧用法）

说明:
  扫描 .vue / .ts / .js 中的硬编码中文，给出建议 key 与修法。

示例:
  npx ts-node add-i18n.ts
  npx ts-node add-i18n.ts frontend/src/components
`);
}

function main(): void {
  const args = process.argv.slice(2);

  // 旧实现不认 -h/--help，传了也会被当成普通参数，直接开跑全量扫描
  if (args.includes('-h') || args.includes('--help')) {
    printUsage();
    return;
  }

  const dryRun = args.includes('--dry-run');
  const fix = args.includes('--fix');
  const nonFlagArgs = args.filter(arg => !arg.startsWith('--'));
  const targetDir = nonFlagArgs[0] || FRONTEND_SRC;

  logInfo(`扫描 i18n 硬编码: ${targetDir}`);
  logInfo('='.repeat(60));

  const files = scanFiles(targetDir);
  logInfo(`找到 ${files.length} 个文件`);

  const allResults: I18nFinding[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const results = analyzeFile(file);
    if (results.length > 0) {
      allResults.push(...results);
    }
  }

  // 输出结果
  if (allResults.length === 0) {
    logSuccess('没有发现硬编码的中文！');
    return;
  }

  logError(`发现 ${allResults.length} 处硬编码中文:`);

  // 按文件分组
  const grouped = allResults.reduce<Record<string, I18nFinding[]>>((acc, r) => {
    if (!acc[r.file]) acc[r.file] = [];
    acc[r.file].push(r);
    return acc;
  }, {});

  const suggestions: Record<string, string> = {};

  const entries = Object.entries(grouped);
  for (let i = 0; i < entries.length; i++) {
    const [file, items] = entries[i];
    logInfo(`\n文件: ${file}`);
    for (let j = 0; j < items.length; j++) {
      const item = items[j];
      logInfo(`  行 ${item.line}: "${item.text}"`);
      logInfo(`  → 建议 key: ${item.key}`);
      logInfo(`    代码: ${item.fullLine.slice(0, 80)}${item.fullLine.length > 80 ? '...' : ''}`);
      if (item.fixedLine && item.fixedLine !== item.fullLine) {
        logInfo(`    修复: ${item.fixedLine.slice(0, 80)}${item.fixedLine.length > 80 ? '...' : ''}`);
      }
      // 收集建议的翻译
      suggestions[item.key] = item.text;
    }
  }

  // 生成翻译文件建议
  logInfo('\n' + '='.repeat(60));
  logInfo('建议添加到 locales/zh.ts:');
  logInfo('');
  logInfo('```typescript');

  const modules = Object.entries(suggestions).reduce<Record<string, string[]>>((acc, entry) => {
    const key = entry[0];
    const text = entry[1];
    const parts = key.split('.');
    const module = parts[0];
    if (!acc[module]) acc[module] = [];
    acc[module].push("  " + parts.slice(1).join('.') + ": '" + text + "',");
    return acc;
  }, {});

  const moduleEntries = Object.entries(modules);
  for (let i = 0; i < moduleEntries.length; i++) {
    const [module, lines] = moduleEntries[i];
    logInfo(module + ": {");
    for (let j = 0; j < lines.length; j++) {
      logInfo(lines[j]);
    }
    logInfo("},");
    logInfo("");
  }
  logInfo("```");

  // 执行自动修复
  if (fix && !dryRun) {
    logInfo('\n' + '='.repeat(60));
    logInfo('开始自动修复...');
    
    let fixedFiles = 0;
    const fileSet = new Set<string>();
    
    for (let i = 0; i < allResults.length; i++) {
      const result = allResults[i];
      if (!fileSet.has(result.file)) {
        fileSet.add(result.file);
        const filePath = path.resolve(process.cwd(), result.file);
        
        try {
          let content = fs.readFileSync(filePath, 'utf-8');
          
          // 添加 i18n 导入
          content = addI18nImport(content, filePath);
          
          // 替换中文文本
          const fileResults = allResults.filter(r => r.file === result.file);
          for (let j = 0; j < fileResults.length; j++) {
            const r = fileResults[j];
            // 使用正则表达式替换，确保只替换字符串中的中文
            const regex = new RegExp(escapeRegExp(r.text), 'g');
            content = content.replace(regex, `t('${r.key}')`);
          }
          
          fs.writeFileSync(filePath, content, 'utf-8');
          fixedFiles++;
          logSuccess(`已修复: ${result.file}`);
        } catch (error) {
          logError(`修复失败 ${result.file}: ${error}`);
        }
      }
    }
    
    logSuccess(`共修复 ${fixedFiles} 个文件`);
  } else if (dryRun) {
    logInfo('\n' + '='.repeat(60));
    logWarning("添加 --fix 参数可以自动修复");
  } else {
    logInfo('\n' + '='.repeat(60));
    logWarning('添加 --fix 参数可以自动修复（实验性功能）');
  }
}

main();
