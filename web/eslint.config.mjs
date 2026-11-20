/**
 * ESLint 配置（flat config，ESLint 9）—— web 全仓统一入口
 *
 * 覆盖范围：
 *   前端  frontend/src（Vue + TS）
 *   后端  server.ts / web-launcher.ts / routes / types / utils
 *
 * 定位：项目真实的 lint 规则来源。skill 的 auto-fix.ts 调用本配置下的
 * eslint --fix，保证「修复」与「检查」用的是同一套规则。
 *
 * 说明：
 *   - 用 .mjs：web/package.json 未声明 "type": "module"（后端走 CommonJS），
 *     .js 会被 Node 当 CJS 解析再重parse，报 MODULE_TYPELESS_PACKAGE_JSON 警告
 *   - 高噪音规则先设为 warn（不阻断提交），等存量清完再收紧为 error
 *   - Vue 模板规则只作用于 frontend/src 下的 .vue 文件，后端代码不受影响
 *   - 组件命名、属性顺序这类风格问题由 skill 自有脚本（lint:style 等）管，此处不重复
 */

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      'public/**',
      'frontend/dist/**',
      'data/**',
      '**/*.config.js',
      '**/*.config.cjs',
      '**/*.config.mjs',
      'vite.config.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        // .vue 的 <script> 块交给 TS parser 解析
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      // ── TypeScript ──
      // 存量代码里 any 较多，先 warn；新增代码应避免使用
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-empty-object-type': 'warn',
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      '@typescript-eslint/ban-ts-comment': 'warn',
      // declare global / declare namespace 是类型声明（如扩展 Express Request），不是实现性 namespace
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],

      // ── 通用 ──
      'no-console': 'off',
    },
  },

  // Vue 模板规则只作用于前端组件，避免套到后端 TS 上
  // （vue/ 前缀的规则必须与插件注册在同一个配置对象里）
  ...pluginVue.configs['flat/essential'].map(config => ({
    ...config,
    files: ['frontend/src/**/*.vue'],
    rules: {
      ...config.rules,
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'warn',
    },
  })),
);
