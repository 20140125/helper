#!/usr/bin/env node

/**
 * 项目代码规范检查脚本
 * 检查 Vue 组件的 Props/Emits 注释、defineProps/defineEmits 写法等
 * 用法: npx ts-node check-code-style.ts [目录路径] [选项]
 */

import fs from 'fs';
import path from 'path';
import { FRONTEND_SRC } from './lib/paths';
import { scanFiles } from './lib/fs';
import { logInfo, logSuccess, logWarning, logError } from './logger';

interface StyleError {
  file: string;
  line: number;
  rule: string;
  message: string;
  /** 修复建议（用于自动修复） */
  fix?: () => void;
}

interface ParsedArgs {
  targets: string[];
  fix: boolean;
  dryRun: boolean;
}

// ==================== 参数解析 ====================

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
      // 停用：正则改写 props/emits 可能写坏文件，可自动修复的问题走 npm run auto-fix
      logWarning(`本脚本只做检查，${arg} 已停用`);
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
用法: npx ts-node check-code-style.ts [目录路径] [选项]

选项:
  -h, --help      显示帮助信息

说明:
  本脚本只做检查，不改写文件（--fix / --dry-run 已停用）。
  可自动修复的问题请用 npm run auto-fix（走项目 ESLint 规则）。

示例:
  npx ts-node check-code-style.ts
  npx ts-node check-code-style.ts frontend/src/views
`);
}

type RuleFn = (root: null, content: string, filePath: string) => StyleError[];

/**
 * 判断指定行紧邻上方是否存在 JSDoc 注释块。
 * 从当前行的上一行开始向上回溯：
 *  - 允许跳过空行
 *  - 允许遇到星号开头（含闭合行）的 JSDoc 中间行
 *  - 遇到以斜杠加双星号开头的行 -> 认为存在 JSDoc，返回所有注释内容
 *  - 遇到其他任意代码行 -> 认为不存在，返回 null
 *  - 同时兼容单行 JSDoc 的情况
 * @param {string[]} lines 文件全部行
 * @param {number} index 当前代码所在行下标
 * @returns {string | null} 拼接后的注释文本（含所有 JSDoc 内容行），不存在则返回 null
 */
function getJSDocAbove(lines: string[], index: number): string | null {
  const collected: string[] = [];
  let i = index - 1;
  while (i >= 0) {
    const trimmed = lines[i].trim();
    if (trimmed === '') {
      i--;
      continue;
    }
    // 单行 JSDoc：/** ... */
    if (trimmed.startsWith('/**') && trimmed.endsWith('*/')) {
      collected.unshift(trimmed);
      return collected.join('\n');
    }
    // 多行 JSDoc 起点：/**
    if (trimmed.startsWith('/**')) {
      collected.unshift(trimmed);
      return collected.join('\n');
    }
    // JSDoc 中间行：* xxx 或 */
    if (trimmed.startsWith('*')) {
      collected.unshift(trimmed);
      i--;
      continue;
    }
    // 其他任何代码行 → 上方不存在 JSDoc
    return null;
  }
  return null;
}

// ==================== 自动修复函数 ====================

/**
 * 为 Prop 字段添加 JSDoc 注释
 */
function fixPropComment(lines: string[], index: number, propLine: string): string[] {
  const newLines = [...lines];
  const propName = propLine.match(/^\s+(\w+)\??\s*:/)?.[1] || 'field';
  const indent = propLine.match(/^(\s+)/)?.[1] || '  ';
  
  // 生成默认 JSDoc 注释
  const jsdoc = [
    `${indent}/**`,
    `${indent} * ${propName} 属性`,
    `${indent} * @description ${propName} 的描述`,
    `${indent} */`,
  ];
  
  newLines.splice(index, 0, ...jsdoc);
  return newLines;
}

/**
 * 为 Emit 事件添加 JSDoc 注释
 */
function fixEmitComment(lines: string[], index: number, emitLine: string): string[] {
  const newLines = [...lines];
  const emitName = emitLine.match(/^\s+\(e:\s*["'](\w+)["']/)?.[1] || 'event';
  const indent = emitLine.match(/^(\s+)/)?.[1] || '  ';
  
  // 生成默认 JSDoc 注释
  const jsdoc = [
    `${indent}/**`,
    `${indent} * ${emitName} 事件`,
    `${indent} * @description ${emitName} 事件触发时的回调`,
    `${indent} * @param {unknown} params - 事件参数`,
    `${indent} */`,
  ];
  
  newLines.splice(index, 0, ...jsdoc);
  return newLines;
}

/**
 * 为 Model 成员添加 JSDoc 注释
 */
function fixModelMemberComment(lines: string[], index: number, memberLine: string): string[] {
  const newLines = [...lines];
  const memberName = memberLine.match(/\s+(\w+)\s*=/)?.[1] || 'member';
  const indent = memberLine.match(/^(\s+)/)?.[1] || '  ';
  
  const jsdoc = [
    `${indent}/**`,
    `${indent} * ${memberName} 成员`,
    `${indent} * @description ${memberName} 的描述`,
    `${indent} */`,
  ];
  
  newLines.splice(index, 0, ...jsdoc);
  return newLines;
}

/**
 * 为 Service 方法添加 JSDoc 注释
 */
function fixServiceMethodComment(lines: string[], index: number, methodLine: string): string[] {
  const newLines = [...lines];
  const methodName = methodLine.match(/\s+(async\s+)?(\w+)\s*\(/)?.[2] || 'method';
  const indent = methodLine.match(/^(\s+)/)?.[1] || '  ';
  
  // 提取参数
  const paramsMatch = methodLine.match(/\(([^)]*)\)/);
  const params = paramsMatch ? paramsMatch[1].trim() : '';
  const hasParams = params !== '';
  
  const jsdocLines = [
    `${indent}/**`,
    `${indent} * ${methodName} 方法`,
    `${indent} * @description ${methodName} 的描述`,
  ];
  
  if (hasParams) {
    // 简单添加 param 注释
    const paramNames = params.split(',').map(p => p.trim().split(':')[0].trim());
    for (const paramName of paramNames) {
      if (paramName) {
        jsdocLines.push(`${indent} * @param {unknown} ${paramName} - 参数描述`);
      }
    }
  }
  
  // 检查返回类型
  const returnsVoid = methodLine.includes('): void') || methodLine.includes(': void');
  if (!returnsVoid) {
    jsdocLines.push(`${indent} * @returns {unknown} 返回值描述`);
  }
  
  jsdocLines.push(`${indent} */`);
  
  newLines.splice(index, 0, ...jsdocLines);
  return newLines;
}

/**
 * 将 interface Props 转换为内联泛型写法
 */
function fixDefinePropsInline(content: string): string {
  // 查找 interface Props 定义
  const interfaceMatch = content.match(/interface\s+Props\s*\{([\s\S]*?)\}\s*/);
  if (!interfaceMatch) return content;
  
  const propsContent = interfaceMatch[1];
  // 转换为内联泛型
  const inlineProps = propsContent
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('//'))
    .join('\n  ');
  
  // 替换 defineProps
  let newContent = content.replace(/interface\s+Props\s*\{[\s\S]*?\}\s*/, '');
  newContent = newContent.replace(
    /defineProps\s*\(\s*\)/,
    `defineProps<{\n  ${inlineProps}\n}>()`
  );
  
  return newContent;
}

// ==================== 检查规则 ====================

const rules: Record<string, RuleFn> = {
  // 检查 defineProps 是否使用内联泛型
  checkDefinePropsInline(_root, content, filePath) {
    const errors: StyleError[] = [];
    // 检查是否使用了 interface Props
    if (content.includes('interface Props')) {
      errors.push({
        file: filePath,
        line: 0,
        rule: 'defineProps-inline',
        message: '应使用内联泛型 defineProps<{...}>() 而非 interface Props',
        fix: () => {
          const newContent = fixDefinePropsInline(content);
          fs.writeFileSync(filePath, newContent, 'utf-8');
        },
      });
    }
    return errors;
  },

  // 检查 defineEmits 是否使用长签名写法
  checkDefineEmitsLongHand(_root, content, filePath) {
    const errors: StyleError[] = [];
    const emitsMatch = content.match(/defineEmits<\{[\s\S]*?\}>\(\)/);
    if (emitsMatch) {
      const emitsContent = emitsMatch[0];
      // 检查是否使用了短元组写法 (key: [])
      if (/^\s+\w+\s*:/.test(emitsContent)) {
        errors.push({
          file: filePath,
          line: 0,
          rule: 'defineEmits-longhand',
          message: '应使用长签名写法 (e: "event"): void; 而非短元组写法',
        });
      }
    }
    return errors;
  },

  // 检查 Props 字段是否有注释
  checkPropsComments(_root, content, filePath) {
    const errors: StyleError[] = [];
    const propsMatch = content.match(/defineProps<\{[\s\S]*?\}>\(\)/);
    if (propsMatch) {
      const propsContent = propsMatch[0];
      const lines = propsContent.split('\n');
      lines.forEach((line, index) => {
        // 检查是否是 prop 定义行（包含 ?: 或 : 但不是注释行）
        if (/^\s+\w+\??\s*:/.test(line) && !line.trim().startsWith('//')) {
          if (!getJSDocAbove(lines, index)) {
            errors.push({
              file: filePath,
              line: 0,
              rule: 'props-comments',
              message: `Prop 字段缺少 JSDoc 注释: ${line.trim()}`,
              fix: () => {
                const fullLines = fs.readFileSync(filePath, 'utf-8').split('\n');
                const newLines = fixPropComment(fullLines, index, line);
                fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
              },
            });
          }
        }
      });
    }
    return errors;
  },

  // 检查 Emits 事件是否有注释
  checkEmitsComments(_root, content, filePath) {
    const errors: StyleError[] = [];
    const emitsMatch = content.match(/defineEmits<\{[\s\S]*?\}>\(\)/);
    if (emitsMatch) {
      const emitsContent = emitsMatch[0];
      const lines = emitsContent.split('\n');
      lines.forEach((line, index) => {
        // 检查是否是 emit 定义行
        if (/^\s+\(e:/.test(line)) {
          if (!getJSDocAbove(lines, index)) {
            errors.push({
              file: filePath,
              line: 0,
              rule: 'emits-comments',
              message: `Emit 事件缺少 JSDoc 注释: ${line.trim()}`,
              fix: () => {
                const fullLines = fs.readFileSync(filePath, 'utf-8').split('\n');
                const newLines = fixEmitComment(fullLines, index, line);
                fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
              },
            });
          }
        }
      });
    }
    return errors;
  },

  // 检查 Model 文件是否有 JSDoc 注释
  checkModelJSDoc(_root, content, filePath) {
    const errors: StyleError[] = [];
    const lines = content.split('\n');

    // 检查类注释
    let classFound = false;
    let classDocFound = false;
    lines.forEach((line, index) => {
      if (/export\s+class\s+\w+/.test(line)) {
        classFound = true;
        if (getJSDocAbove(lines, index)) {
          classDocFound = true;
        }
      }
    });

    if (classFound && !classDocFound) {
      errors.push({
        file: filePath,
        line: 0,
        rule: 'model-jsdoc-class',
        message: 'Model 类缺少 JSDoc 注释',
        fix: () => {
          const newLines = [...lines];
          // 查找 export class 行
          for (let i = 0; i < newLines.length; i++) {
            if (/export\s+class\s+\w+/.test(newLines[i])) {
              const indent = newLines[i].match(/^(\s*)/)?.[1] || '';
              newLines.splice(i, 0, 
                `${indent}/**`,
                `${indent} * ${newLines[i].match(/class\s+(\w+)/)?.[1] || 'Class'} 类`,
                `${indent} * @description 描述此类的作用`,
                `${indent} */`
              );
              break;
            }
          }
          fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
        },
      });
    }

    // 检查公共字段和方法注释
    lines.forEach((line, index) => {
      if (/^\s+public\s+\w+/.test(line) || /^\s+\w+\s*=\s*ref/.test(line)) {
        if (!getJSDocAbove(lines, index)) {
          errors.push({
            file: filePath,
            line: index + 1,
            rule: 'model-jsdoc-member',
            message: `Model 成员缺少 JSDoc 注释: ${line.trim()}`,
            fix: () => {
              const fullLines = fs.readFileSync(filePath, 'utf-8').split('\n');
              const newLines = fixModelMemberComment(fullLines, index, line);
              fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
            },
          });
        }
      }
    });

    return errors;
  },

  // 检查 Service 文件是否有 JSDoc 注释
  checkServiceJSDoc(_root, content, filePath) {
    const errors: StyleError[] = [];
    const lines = content.split('\n');

    // 检查类描述
    lines.forEach((line, index) => {
      if (/export\s+class\s+\w+/.test(line)) {
        const doc = getJSDocAbove(lines, index);
        if (!doc || !doc.includes('@description')) {
          errors.push({
            file: filePath,
            line: index + 1,
            rule: 'service-jsdoc-class',
            message: 'Service 类注释缺少 @description',
            fix: () => {
              const newLines = [...lines];
              // 查找 export class 行
              for (let i = 0; i < newLines.length; i++) {
                if (/export\s+class\s+\w+/.test(newLines[i])) {
                  const indent = newLines[i].match(/^(\s*)/)?.[1] || '';
                  if (getJSDocAbove(newLines, i)) {
                    // 已有 JSDoc 但缺少 @description，添加它
                    for (let j = i - 1; j >= 0; j--) {
                      if (newLines[j].trim().startsWith('*')) {
                        newLines[j] = newLines[j].replace('*/', ` * @description 描述此类的作用\n */`);
                        break;
                      }
                    }
                  } else {
                    // 没有 JSDoc，添加完整的
                    newLines.splice(i, 0,
                      `${indent}/**`,
                      `${indent} * ${newLines[i].match(/class\s+(\w+)/)?.[1] || 'Class'} Service`,
                      `${indent} * @description 描述此 Service 的作用`,
                      `${indent} */`
                    );
                  }
                  break;
                }
              }
              fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
            },
          });
        }
      }
    });

    // 检查方法注释
    lines.forEach((line, index) => {
      if (/^\s+async\s+\w+\s*\(/.test(line) || /^\s+\w+\s*\([^)]*\)\s*:\s*\w/.test(line)) {
        const doc = getJSDocAbove(lines, index);
        if (!doc) {
          errors.push({
            file: filePath,
            line: index + 1,
            rule: 'service-jsdoc-method',
            message: `Service 方法缺少 JSDoc 注释: ${line.trim()}`,
            fix: () => {
              const fullLines = fs.readFileSync(filePath, 'utf-8').split('\n');
              const newLines = fixServiceMethodComment(fullLines, index, line);
              fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
            },
          });
          return;
        }
        // 仅在有实际入参时才检查 @param
        const paramMatch = line.match(/\(([^)]*)\)/);
        const hasParams = !!(paramMatch && paramMatch[1].trim() !== '');
        if (hasParams && !doc.includes('@param')) {
          errors.push({
            file: filePath,
            line: index + 1,
            rule: 'service-jsdoc-param',
            message: `方法缺少 @param 注释: ${line.trim()}`,
          });
        }
        if (!doc.includes('@returns') && !line.includes('void')) {
          errors.push({
            file: filePath,
            line: index + 1,
            rule: 'service-jsdoc-returns',
            message: `方法缺少 @returns 注释: ${line.trim()}`,
          });
        }
      }
    });

    return errors;
  },
};

// 递归扫描目录
function scanDirectory(dir: string, extensions: string[] = ['.vue', '.ts']): string[] {
  return scanFiles(dir, { extensions });
}

// ==================== 主函数 ====================

function main(): void {
  const options = parseArgs();
  
  const allErrors: StyleError[] = [];
  
  // 扫描目标目录
  for (let i = 0; i < options.targets.length; i++) {
    const target = options.targets[i];
    if (!fs.existsSync(target)) {
      logWarning(`目录不存在: ${target}`);
      continue;
    }
    
    const files = scanDirectory(target);
    
    for (let j = 0; j < files.length; j++) {
      const file = files[j];
      const relativePath = path.relative(process.cwd(), file);
      const content = fs.readFileSync(file, 'utf-8');
      
      // 根据文件类型执行不同的检查
      if (file.includes('components/') && file.endsWith('.vue')) {
        const errors1 = rules.checkDefinePropsInline(null, content, relativePath);
        const errors2 = rules.checkDefineEmitsLongHand(null, content, relativePath);
        const errors3 = rules.checkPropsComments(null, content, relativePath);
        const errors4 = rules.checkEmitsComments(null, content, relativePath);
        allErrors.push(...errors1, ...errors2, ...errors3, ...errors4);
      } else if (file.includes('models/') && file.endsWith('.ts')) {
        const errors = rules.checkModelJSDoc(null, content, relativePath);
        allErrors.push(...errors);
      } else if (file.includes('services/') && file.endsWith('.ts')) {
        const errors = rules.checkServiceJSDoc(null, content, relativePath);
        allErrors.push(...errors);
      }
    }
  }

  // 输出结果
  logInfo('\n检查结果:');
  logInfo('='.repeat(60));

  if (allErrors.length === 0) {
    logSuccess('所有文件符合规范！');
    process.exit(0);
  }

  logError(`发现 ${allErrors.length} 个问题:`);

  const grouped = allErrors.reduce<Record<string, StyleError[]>>((acc, err) => {
    if (!acc[err.rule]) acc[err.rule] = [];
    acc[err.rule].push(err);
    return acc;
  }, {});

  const entries = Object.entries(grouped);
  for (let i = 0; i < entries.length; i++) {
    const [rule, errors] = entries[i];
    logWarning(`规则: ${rule} (${errors.length} 个):`);
    for (let j = 0; j < errors.length; j++) {
      const err = errors[j];
      logInfo(`   ${err.file}:${err.line}`);
      logInfo(`   → ${err.message}`);
    }
  }

  // 不改写文件：props/emits 结构靠正则改写风险太高 ——
  // `interface Props { a: { b: string } }` 的非贪婪匹配会在内层 } 处截断，直接把文件写坏。
  // 可自动修复的问题已统一交给项目 ESLint（npm run auto-fix）。
  logInfo('='.repeat(60));
  if (options.fix || options.dryRun) {
    logWarning('本脚本已停用 --fix / --dry-run，只做检查不做改写');
  }
  logInfo('修复渠道:');
  logInfo('  - 可自动修复的问题 → npm run auto-fix（走项目 ESLint 规则）');
  logInfo('  - props/emits 写法与注释 → 按 references/11-vue-props-emits-comments.md 手动调整');

  // 走到这里说明存在风格问题
  process.exit(1);
}

main();
