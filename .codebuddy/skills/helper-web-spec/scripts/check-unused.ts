#!/usr/bin/env node

/**
 * 检查未使用的导入和未注册的 Vue 组件
 * 需要 TypeScript 编译器 API
 * 用法: npx ts-node check-unused.ts <目录或文件路径> [...更多路径]
 *
 * 功能：
 * 1. 检测引入了但未使用的 import 语句（使用 TypeChecker）
 * 2. 检测 Vue 模板中使用了但未在 script 中导入的组件
 */

import fs from 'fs';
import path from 'path';
import { FRONTEND_SRC, displayPath } from './lib/paths';
import { overwriteText, readText, scanFiles } from './lib/fs';
import { logError, logInfo, logSuccess, logWarning } from './logger';

// TypeScript 模块类型导入和运行时加载
import type * as TS from 'typescript';

// 运行时加载的 typescript 模块实例（类型为 TS）
let ts: typeof TS;

function loadTypeScriptModule(): typeof TS {
  // 首先尝试从当前工作目录查找
  const cwd = process.cwd();
  const possiblePaths = [
    path.join(cwd, 'node_modules/typescript'),
    // web/frontend 目录（Vite 前端项目）
    path.join(cwd, '../node_modules/typescript'),
    path.join(cwd, '../../web/node_modules/typescript'),
    // __dirname 相对路径
    path.join(__dirname, '../../../web/node_modules/typescript'),
    path.join(__dirname, '../../../../web/node_modules/typescript'),
    path.join(__dirname, '../node_modules/typescript'),
    'typescript',
  ];

  // 先尝试直接用 require 解析（会尊重 NODE_PATH 和 node_modules）
  try {
    return require('typescript');
  } catch (e) {
    // ignore
  }

  for (let i = 0; i < possiblePaths.length; i++) {
    try {
      return require(possiblePaths[i]);
    } catch (e) {
      // continue
    }
  }

  logError('无法加载 typescript 模块，请确保在项目根目录或 web 目录下运行此脚本');
  logError(`   尝试的路径: ${possiblePaths.join(', ')}`);
  process.exit(1);
}

ts = loadTypeScriptModule();

// 跳过列表
interface UnusedImport {
  /** 导入名（in-scope 标识符） */
  name: string;
  /** 导入种类 */
  kind: 'default' | 'named' | 'namespace';
  /** 来源模块路径 */
  module: string;
  /** 在文件中的行号 */
  line: number;
  /** 如果是命名空间导入，对应的属性名 */
  propertyName?: string;
}

interface UnregisteredComponent {
  /** 组件名 */
  name: string;
  /** 在模板中的行号 */
  line: number;
}

interface FileCheckResult {
  file: string;
  unusedImports: UnusedImport[];
  unregisteredComponents: UnregisteredComponent[];
}

// 扫描目录
// 收集多个入参（目录或单文件）下的全部待扫描文件
function collectFiles(targets: string[]): string[] {
  const collected: string[] = [];
  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    if (!fs.existsSync(target)) {
      logWarning(`跳过不存在的路径: ${target}`);
      continue;
    }
    // 公共扫描：忽略目录按「目录名」精确匹配（旧实现对整条路径做子串匹配，
    // 仓库路径里只要出现 dist/build 字样就会静默跳过），且目标不存在时返回空数组
    collected.push(...scanFiles(target, { extensions: ['.ts', '.tsx', '.vue'] }));
  }
  return collected;
}

// 解析 Vue SFC 文件，提取 template 和 script 内容
function parseVueFile(file: string): { template: string; script: string; scriptSetup: string } {
  const content = fs.readFileSync(file, 'utf-8');
  let template = '';
  let script = '';
  let scriptSetup = '';

  // 更健壮地提取 template 部分
  // 使用简单的字符串查找而不是正则，避免贪婪/非贪婪匹配问题
  const templateStart = content.indexOf('<template');
  if (templateStart !== -1) {
    const templateTagEnd = content.indexOf('>', templateStart);
    if (templateTagEnd !== -1) {
      const templateEnd = content.lastIndexOf('</template>');
      if (templateEnd !== -1 && templateEnd > templateTagEnd) {
        template = content.substring(templateTagEnd + 1, templateEnd);
      }
    }
  }

  // 提取 script setup 部分
  const setupStart = content.search(/<script[^>]*\bsetup\b/);
  if (setupStart !== -1) {
    const setupTagEnd = content.indexOf('>', setupStart);
    if (setupTagEnd !== -1) {
      const setupEnd = content.indexOf('</script>', setupTagEnd);
      if (setupEnd !== -1) {
        scriptSetup = content.substring(setupTagEnd + 1, setupEnd);
      }
    }
  }

  // 提取普通 script 部分（排除 setup）
  if (!scriptSetup) {
    const scriptStart = content.indexOf('<script');
    if (scriptStart !== -1) {
      // 确保不是 script setup
      const scriptTag = content.substring(scriptStart, content.indexOf('>', scriptStart) + 1);
      if (!scriptTag.includes('setup')) {
        const scriptTagEnd = content.indexOf('>', scriptStart);
        if (scriptTagEnd !== -1) {
          const scriptEnd = content.indexOf('</script>', scriptTagEnd);
          if (scriptEnd !== -1) {
            script = content.substring(scriptTagEnd + 1, scriptEnd);
          }
        }
      }
    }
  }

  return { template, script, scriptSetup };
}

// 从模板中提取使用的组件名
function extractTemplateComponents(template: string): string[] {
  const components: string[] = [];

  // 匹配 PascalCase 组件标签，如 <MyComponent>、<ElButton>
  const pascalCaseRegex = /<([A-Z][A-Za-z0-9]*)/g;
  let match: any[];
  while ((match = pascalCaseRegex.exec(template)) !== null) {
    const tag = match[1];
    components.push(tag);
  }

  // 匹配 kebab-case 组件标签，如 <my-component>、<el-button>、<app-sidebar>
  // 需要排除 TDesign 组件（t- 开头）和 HTML 标签
  const kebabCaseRegex = /<([a-z][a-z0-9]*-[a-z0-9-]*)/g;
  while ((match = kebabCaseRegex.exec(template)) !== null) {
    const tag = match[1];
    // 排除 TDesign 组件（全局注册）
    if (tag.startsWith('t-')) {
      continue;
    }
    // 转换为 PascalCase 以便后续比较
    const pascalName = kebabToPascal(tag);
    components.push(pascalName);
  }

  return [...new Set(components)]; // 去重
}

// 判断是否为 HTML 原生标签
function isHtmlTag(tag: string): boolean {
  const htmlTags = [
    'div', 'span', 'p', 'a', 'img', 'button', 'input', 'form', 'table', 'tr', 'td', 'th',
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'br', 'textarea',
    'select', 'option', 'label', 'fieldset', 'legend', 'iframe', 'script', 'style',
    'link', 'meta', 'title', 'head', 'body', 'html', 'header', 'footer', 'main', 'nav',
    'section', 'article', 'aside', 'details', 'summary', 'figure', 'figcaption',
    'video', 'audio', 'canvas', 'svg', 'path', 'circle', 'rect', 'line', 'text',
    'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre', 'blockquote', 'cite',
    'dl', 'dt', 'dd', 'menu', 'menuitem', 'map', 'area', 'object', 'param',
    'source', 'track', 'wbr', 'ruby', 'rt', 'rp', 'bdi', 'bdo', 'data', 'time',
    'mark', 'ins', 'del', 'sup', 'sub', 'small', 'dfn', 'abbr', 'q', 'kbd',
    'samp', 'var', 'output', 'progress', 'meter', 'details', 'summary',
  ];
  const lowerTag = tag.toLowerCase();
  // HTML 标签都是纯小写，不含大写字母和连字符（除了自定义元素，但标准 HTML 不含 -）
  // 如果标签包含大写字母或者是 kebab-case（含 -），则不是 HTML 原生标签
  if (tag !== lowerTag || tag.includes('-')) {
    return false;
  }
  return htmlTags.includes(lowerTag);
}

// 全局注册的组件（不需要导入即可使用）
const GLOBAL_COMPONENTS: string[] = [
  // Vue Router
  'RouterView',
  'RouterLink',
  // TDesign 全局注册的可能组件（根据项目配置）
  'TLayout',
  'TContent',
  'TConfigProvider',
  'TAside',
  'THeader',
  'TFooter',
  'TRow',
  'TCol',
  'TButton',
  'TInput',
  'TSelect',
  'TOption',
  'TDialog',
  'TMessage',
  'TLoading',
  'TWatermark',
];

// 将 kebab-case 转换为 PascalCase
function kebabToPascal(kebab: string): string {
  return kebab
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

// 从 script 中提取导入的组件名（针对 Vue 文件）
function extractImportedComponents(script: string, scriptSetup: string): string[] {
  const components: string[] = [];
  const combinedScript = script + '\n' + scriptSetup;

  // 匹配 import 语句中的组件名
  // 如: import MyComponent from './MyComponent.vue'
  // 如: import { ElButton, ElInput } from 'element-plus'
  // 修复：使用更健壮的正则，处理换行等情况
  const importRegex = /import\s+(?:(\w+)|{([^}]+)})\s+from\s+['"]([^'"]+)['"]/gm;
  let match: string[];
  while ((match = importRegex.exec(combinedScript)) !== null) {
    if (match[1]) {
      // default import - 只添加组件名（PascalCase）
      const name = match[1];
      if (isComponentName(name)) {
        components.push(name);
      }
    }
    if (match[2]) {
      // named imports
      const names = match[2].split(',').map((n: string) => n.trim());
      for (let i = 0; i < names.length; i++) {
        const name = names[i].split(' as ')[0].trim();
        if (isComponentName(name)) {
          components.push(name);
        }
      }
    }
  }

  // 匹配 components 注册对象（非 setup 模式）
  // 如: components: { MyComponent, AnotherComponent }
  const componentsRegRegex = /components\s*:\s*{([^}]+)}/;
  const compMatch = combinedScript.match(componentsRegRegex);
  if (compMatch) {
    const names = compMatch[1].split(',').map(n => n.trim());
    for (let i = 0; i < names.length; i++) {
      const name = names[i].split(':')[0].trim();
      if (name && isComponentName(name)) {
        components.push(name);
      }
    }
  }

  return [...new Set(components)];
}

// 判断是否为组件名（PascalCase）
function isComponentName(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

// 使用 TypeScript TypeChecker 检查未使用的导入
function checkUnusedImportsWithTypeChecker(file: string): UnusedImport[] {
  const content = fs.readFileSync(file, 'utf-8');

  // 创建 TypeScript 源文件
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
  );

  // 创建简单的编译器选项
  const compilerOptions: TS.CompilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Node10,
    jsx: ts.JsxEmit.Preserve,
    strict: false,
    esModuleInterop: true,
    allowJs: true,
    checkJs: false,
  };

  // 创建编译器主机
  const host = ts.createCompilerHost(compilerOptions);
  const originalGetSourceFile = host.getSourceFile;
  host.getSourceFile = (filename, languageVersion) => {
    if (filename === file) {
      return sourceFile;
    }
    return originalGetSourceFile.call(host, filename, languageVersion);
  };
  host.fileExists = (filename) => {
    if (filename === file) return true;
    return fs.existsSync(filename);
  };
  host.readFile = (filename) => {
    if (filename === file) return content;
    try {
      return fs.readFileSync(filename, 'utf-8');
    } catch (e) {
      return undefined;
    }
  };

  // 创建程序
  const program = ts.createProgram([file], compilerOptions, host);
  const typeChecker = program.getTypeChecker();

  const unusedImports: UnusedImport[] = [];

  // 遍历源文件，找到所有 import 声明
  function visit(node: TS.Node): void {
    if (ts.isImportDeclaration(node)) {
      const moduleSpecifier = (node.moduleSpecifier as TS.StringLiteral).text;
      const importClause = node.importClause;

      if (importClause) {
        // 检查 default import
        if (importClause.name) {
          const symbol = typeChecker.getSymbolAtLocation(importClause.name);
          let isUsed = false;
          
          if (symbol) {
            const declarations = symbol.getDeclarations() || [];
            // 检查是否有使用（除了导入声明本身）
            isUsed = declarations.some(d => d !== importClause.name);
          }
          
          // 额外检查：在文件中搜索标识符的使用（作为备用检测）
          if (!isUsed) {
            const name = importClause.name.text;
            isUsed = isIdentifierUsedInFile(sourceFile, name, importClause.name.getStart());
          }
          
          if (!isUsed) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(importClause.name.getStart());
            unusedImports.push({
              name: importClause.name.text,
              kind: 'default',
              module: moduleSpecifier,
              line: line + 1,
            });
          }
        }

        // 检查 named imports
        if (importClause.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
          const elements = importClause.namedBindings.elements;
          for (let i = 0; i < elements.length; i++) {
            const element = elements[i];
            const symbol = typeChecker.getSymbolAtLocation(element.name);
            let isUsed = false;
            
            if (symbol) {
              const declarations = symbol.getDeclarations() || [];
              isUsed = declarations.some(d => d !== element);
            }
            
            // 额外检查：在文件中搜索标识符的使用
            if (!isUsed) {
              const name = element.name.text;
              isUsed = isIdentifierUsedInFile(sourceFile, name, element.getStart());
            }
            
            if (!isUsed) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(element.getStart());
              unusedImports.push({
                name: element.name.text,
                kind: 'named',
                module: moduleSpecifier,
                line: line + 1,
                propertyName: element.propertyName ? element.propertyName.text : undefined,
              });
            }
          }
        }

        // 检查 namespace import
        if (importClause.namedBindings && ts.isNamespaceImport(importClause.namedBindings)) {
          const namespaceName = importClause.namedBindings.name;
          const symbol = typeChecker.getSymbolAtLocation(namespaceName);
          let isUsed = false;
          
          if (symbol) {
            const declarations = symbol.getDeclarations() || [];
            isUsed = declarations.some(d => d !== namespaceName);
          }
          
          if (!isUsed) {
            const { line } = sourceFile.getLineAndCharacterOfPosition(namespaceName.getStart());
            unusedImports.push({
              name: namespaceName.text,
              kind: 'namespace',
              module: moduleSpecifier,
              line: line + 1,
            });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return unusedImports;
}

// 检查标识符是否在文件中被使用（除了导入声明本身）
function isIdentifierUsedInFile(sourceFile: TS.SourceFile, name: string, importPos: number): boolean {
  let found = false;
  
  function visit(node: TS.Node): void {
    // 跳过导入声明本身
    if (node.getStart() === importPos) {
      return;
    }
    
    // 检查标识符节点
    if (ts.isIdentifier(node) && node.text === name) {
      found = true;
      return;
    }
    
    // 检查类型引用
    if (ts.isTypeReferenceNode(node)) {
      const typeName = node.typeName;
      if (ts.isIdentifier(typeName) && typeName.text === name) {
        found = true;
        return;
      }
    }
    
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
  return found;
}

// 检查 Vue 文件的模板组件使用
function checkVueFile(file: string): { unusedImports: UnusedImport[]; unregisteredComponents: UnregisteredComponent[] } {
  const { template, script, scriptSetup } = parseVueFile(file);

  // 从模板中提取使用的组件（PascalCase 和 kebab-case）
  const templateComponents = extractTemplateComponents(template);

  // 从 script 中提取导入/注册的组件
  const importedComponents = extractImportedComponents(script, scriptSetup);

  // 额外检查：模板中使用的小写标签是否对应导入的组件
  // 例如 <watermark> 对应导入的 Watermark 组件
  const lowerCaseTagRegex = /<([a-z]+)\b/g;
  let match: RegExpExecArray | null;
  while ((match = lowerCaseTagRegex.exec(template)) !== null) {
    const tag = match[1];
    // 排除 HTML 标签和 TDesign 组件
    if (!isHtmlTag(tag) && !tag.startsWith('t-')) {
      // 转换为 PascalCase 并检查是否在导入的组件中
      const pascalName = tag.charAt(0).toUpperCase() + tag.slice(1);
      if (importedComponents.includes(pascalName) && !templateComponents.includes(pascalName)) {
        templateComponents.push(pascalName);
      }
    }
  }

  // 检查：模板中使用了但未导入的组件（排除全局组件和 HTML 标签）
  const unregistered: UnregisteredComponent[] = [];
  for (let i = 0; i < templateComponents.length; i++) {
    const comp = templateComponents[i];
    // 排除全局组件
    if (GLOBAL_COMPONENTS.includes(comp)) {
      continue;
    }
    if (!importedComponents.includes(comp)) {
      // 找到在模板中的行号
      const lines = template.split('\n');
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].includes(comp) || lines[j].includes(pascalToKebab(comp))) {
          unregistered.push({ name: comp, line: j + 1 });
          break;
        }
      }
    }
  }

  // 对于 Vue 文件，使用基于文本的分析来检测未使用的导入
  // TypeChecker 对 .vue 文件支持不好
  const unusedImports = checkUnusedImportsWithTextAnalysis(file, script + '\n' + scriptSetup);

  return { unusedImports, unregisteredComponents: unregistered };
}

// 使用基于文本的分析检查未使用的导入（用于 Vue 文件）
function checkUnusedImportsWithTextAnalysis(file: string, scriptContent: string): UnusedImport[] {
  const content = fs.readFileSync(file, 'utf-8');
  const unusedImports: UnusedImport[] = [];

  // 提取模板内容（用于检查标识符是否在模板中使用）
  let templateContent = '';
  const templateStart = content.indexOf('<template');
  if (templateStart !== -1) {
    const templateTagEnd = content.indexOf('>', templateStart);
    if (templateTagEnd !== -1) {
      const templateEnd = content.lastIndexOf('</template>');
      if (templateEnd !== -1 && templateEnd > templateTagEnd) {
        templateContent = content.substring(templateTagEnd + 1, templateEnd);
      }
    }
  }

  // 提取所有 import 语句（排除纯类型导入，但保留混合导入）
  // 匹配 import { ... } from '...' 或 import defaultExport from '...'
  // 支持混合导入：import { value, type Type } from '...'
  const importRegex = /import\s+(?!type\s)(?:(\w+)|{([^}]+)})\s+from\s+['"]([^'"]+)['"]/gm;
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(scriptContent)) !== null) {
    const moduleSpecifier = match[3];
    
    if (match[1]) {
      // default import
      const name = match[1];
      // 检查是否在脚本或模板中被使用
      if (!isUsedInScriptOrTemplate(scriptContent, match[0], name, templateContent)) {
        const line = getLineNumber(scriptContent, match.index);
        unusedImports.push({
          name,
          kind: 'default',
          module: moduleSpecifier,
          line,
        });
      }
    }
    
    if (match[2]) {
      // named imports - 需要排除 type 开头的导入
      const importItems = match[2].split(',').map(n => n.trim());
      
      for (let i = 0; i < importItems.length; i++) {
        const item = importItems[i];
        // 跳过纯类型导入（type 开头）
        if (item.startsWith('type ')) {
          continue;
        }
        
        const parts = item.split(/\s+as\s+/);
        const original = parts[0].trim();
        const alias = parts[1] ? parts[1].trim() : original;
        
        // 检查是否在脚本或模板中被使用
        if (!isUsedInScriptOrTemplate(scriptContent, match[0], alias, templateContent)) {
          const line = getLineNumber(scriptContent, match.index);
          unusedImports.push({
            name: alias,
            kind: 'named',
            module: moduleSpecifier,
            line,
            propertyName: original !== alias ? original : undefined,
          });
        }
      }
    }
  }

  return unusedImports;
}

// 检查标识符是否在脚本或模板中被使用
function isUsedInScriptOrTemplate(scriptContent: string, importStatement: string, name: string, templateContent: string): boolean {
  // 1. 检查在脚本中是否被使用（排除导入语句本身）
  const importIndex = scriptContent.indexOf(importStatement);
  if (importIndex !== -1) {
    const importEndIndex = importIndex + importStatement.length;
    const afterImport = scriptContent.substring(importEndIndex);
    
    // 使用正则查找标识符的使用（作为单词）
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    const matches = afterImport.match(regex);
    if (matches !== null && matches.length > 0) {
      return true;
    }
  }
  
  // 2. 检查在模板中是否被使用（PascalCase 或 kebab-case）
  if (templateContent) {
    const kebabName = pascalToKebab(name);
    if (templateContent.includes(name) || templateContent.includes(kebabName)) {
      return true;
    }
  }
  
  return false;
}
// 获取行号
function getLineNumber(text: string, index: number): number {
  const before = text.substring(0, index);
  return before.split('\n').length;
}

// 检查标识符是否在模板中被使用
function isIdentifierUsedInTemplate(content: string, name: string): boolean {
  // 使用更健壮的方法提取模板
  const templateStart = content.indexOf('<template');
  if (templateStart === -1) return false;  
  const templateTagEnd = content.indexOf('>', templateStart);
  if (templateTagEnd === -1) return false;  
  const templateEnd = content.lastIndexOf('</template>');
  if (templateEnd === -1 || templateEnd <= templateTagEnd) return false;  
  const template = content.substring(templateTagEnd + 1, templateEnd);
  
  // 检查 PascalCase 或 kebab-case
  const kebabName = pascalToKebab(name);
  return template.includes(name) || template.includes(kebabName);
}

// 将 PascalCase 转换为 kebab-case
function pascalToKebab(pascal: string): string {
  return pascal.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * 从文件中删除未使用的导入
 *
 * 旧实现：只要某一行「包含」未使用的名字就整行删除 —— `import { A, B } from 'x'`
 * 里 A 没用到，会把仍在使用的 B 一起删掉，直接改坏文件。
 * 现在按 specifier 精确移除：只去掉这一个名字，删完为空才整行删除；
 * 跨行 import 无法安全定位，跳过并提示手动处理。
 *
 * @returns true=文件已修改（或 dry-run 下有可修项）
 */
function removeUnusedImports(filePath: string, unusedImports: UnusedImport[], dryRun: boolean): boolean {
  const content = readText(filePath);
  if (!content) return false;

  const relativePath = displayPath(filePath);
  const lines = content.split('\n');
  const skipped: string[] = [];
  let modified = false;

  // 行号从大到小处理，避免前面删行影响后面的行号
  const sorted = [...unusedImports].sort((a, b) => b.line - a.line);

  for (const unused of sorted) {
    const lineIndex = unused.line - 1;
    if (lineIndex < 0 || lineIndex >= lines.length) continue;

    const plan = planImportRemoval(lines[lineIndex], unused);

    if (plan.type === 'skip') {
      skipped.push(`${unused.name} — ${plan.reason}`);
      continue;
    }

    if (dryRun) {
      const action = plan.type === 'delete' ? '删除整行' : '移除该导入';
      logInfo(`[Dry Run] ${relativePath}:${unused.line} 将${action}: ${unused.name}`);
      modified = true;
      continue;
    }

    if (plan.type === 'delete') {
      lines.splice(lineIndex, 1);
      logWarning(`已删除导入行: ${relativePath}:${unused.line} — ${unused.name}`);
    } else {
      lines[lineIndex] = plan.text;
      logWarning(`已移除导入: ${relativePath}:${unused.line} — ${unused.name}`);
    }
    modified = true;
  }

  for (const reason of skipped) {
    logWarning(`跳过（需手动处理）: ${relativePath} ${reason}`);
  }

  if (modified && !dryRun) {
    if (!overwriteText(filePath, lines.join('\n'))) return false;
    logSuccess(`已修复: ${relativePath}`);
  }

  return modified;
}

type RemovalPlan =
  | { type: 'delete' }
  | { type: 'replace'; text: string }
  | { type: 'skip'; reason: string };

/**
 * 规划如何移除一个 import 行里的某个 specifier
 * 只处理单行 import；跨行 import 的起止行无法用单一行号定位，一律跳过
 */
function planImportRemoval(line: string, unused: UnusedImport): RemovalPlan {
  if (!/^\s*import\b/.test(line)) {
    return { type: 'skip', reason: '目标行不是 import 语句（可能是跨行 import 的中间行）' };
  }

  const brace = line.match(/\{([^}]*)\}/);
  // 默认导入 / 命名空间导入 / 副作用导入：整行都归它，直接删整行
  if (!brace || brace.index === undefined) {
    return { type: 'delete' };
  }

  const specs = brace[1].split(',').map(s => s.trim()).filter(Boolean);
  const isTarget = (spec: string): boolean => {
    // 兼容 `type A` 与 `A as B` 两种写法
    const clean = spec.replace(/^type\s+/, '');
    const parts = clean.split(/\s+as\s+/).map(s => s.trim());
    const local = parts[parts.length - 1];
    const origin = parts[0];
    return local === unused.name && (!unused.propertyName || origin === unused.propertyName);
  };

  const rest = specs.filter(spec => !isTarget(spec));
  if (rest.length === specs.length) {
    return { type: 'skip', reason: '未在该行匹配到该导入（可能是跨行 import）' };
  }
  if (rest.length === 0) {
    return { type: 'delete' };
  }

  const head = line.slice(0, brace.index + 1);
  const tail = line.slice(brace.index + brace[0].length - 1);
  return { type: 'replace', text: `${head} ${rest.join(', ')} ${tail}` };
}

// 检查 TS/TSX 文件的未使用导入
function checkTsFile(file: string): UnusedImport[] {
  return checkUnusedImportsWithTypeChecker(file);
}

// 主函数
function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fix = args.includes('--fix');
  const nonFlagArgs = args.filter(arg => !arg.startsWith('--'));
  
  // 兼容历史单参用法；未传入时退回前端默认目录
  const defaultFrontendSrc = FRONTEND_SRC;
  const targets = nonFlagArgs.length > 0
    ? nonFlagArgs
    : [defaultFrontendSrc];

  logInfo(`检查未使用的导入和未注册的组件: ${targets.join(', ')}`);
  logInfo('='.repeat(60));

  const files = collectFiles(targets);
  logInfo(`找到 ${files.length} 个文件`);

  let totalUnused = 0;
  let totalUnregistered = 0;
  const results: FileCheckResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = path.relative(path.join(__dirname, '../../'), file);

    if (file.endsWith('.vue')) {
      const { unusedImports, unregisteredComponents } = checkVueFile(file);
      if (unusedImports.length > 0 || unregisteredComponents.length > 0) {
        results.push({
          file: relativePath,
          unusedImports,
          unregisteredComponents,
        });
        totalUnused += unusedImports.length;
        totalUnregistered += unregisteredComponents.length;
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      const unusedImports = checkTsFile(file);
      if (unusedImports.length > 0) {
        results.push({
          file,
          unusedImports,
          unregisteredComponents: [],
        });
        totalUnused += unusedImports.length;
      }
    }
  }

  // 输出结果
  logInfo('\n' + '='.repeat(60));

  if (results.length === 0) {
    logSuccess('没有发现未使用的导入或未注册的组件！');
  } else {
    let fixedCount = 0;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      logInfo(`文件: ${displayPath(result.file)}`);

      // 输出未使用的导入
      if (result.unusedImports.length > 0) {
        for (let j = 0; j < result.unusedImports.length; j++) {
          const item = result.unusedImports[j];
          const nameStr = item.propertyName ? `${item.propertyName} as ${item.name}` : item.name;
          logWarning(`   未使用: ${nameStr} (from "${item.module}") [line ${item.line}]`);
        }

        // 执行修复
        if (fix || dryRun) {
          // result.file 已是扫描得到的绝对路径，不要再用 path.resolve 基于 cwd 拼一次
          const fixed = removeUnusedImports(result.file, result.unusedImports, dryRun);
          if (fixed) fixedCount++;
        }
      }

      // 输出未注册的组件
      if (result.unregisteredComponents.length > 0) {
        for (let j = 0; j < result.unregisteredComponents.length; j++) {
          const comp = result.unregisteredComponents[j];
          logWarning(`   使用了但未导入: ${comp.name} [template line ${comp.line}]`);
        }
      }
    }

    logInfo('\n' + '='.repeat(60));
    logWarning(`共发现 ${totalUnused} 个未使用的导入, ${totalUnregistered} 个未注册的组件`);
    logInfo('提示:');
    logInfo('   - 未使用的导入可以使用 IDE 的 "Organize Imports" 功能自动清理');
    logInfo('   - 未注册的组件需要在 script 中导入并注册（或使用 script setup）');

    if (fix || dryRun) {
      logInfo('='.repeat(60));
      if (dryRun) {
        logWarning(`[Dry Run] 将修复 ${fixedCount} 个文件`);
        logInfo('添加 --fix 参数实际执行修复');
      } else {
        logSuccess(`已修复 ${fixedCount} 个文件`);
      }
    }
  }

  // 退出码：只在「没执行修复」时才以 1 结束 ——
  // 旧实现永远退出 0，接进 CI 等于没接
  if ((totalUnused > 0 || totalUnregistered > 0) && !fix) {
    process.exit(1);
  }
}

main();
