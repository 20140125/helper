/**
 * 组件实例类型声明
 * @description 在 .ts 模型层安全地调用 <script setup> 通过 defineExpose 暴露的方法。
 *
 * 背景：plain `tsc` 无法从 `*.vue` 的模块声明（shim 为 `DefineComponent<object, object, unknown>`）
 * 读取到 <script setup> 的 exposed 成员，导致 `InstanceType<typeof X>.resetEditor/validate`
 * 被识别为「不可调用」（TS2349）。项目官方的 `vue-tsc` 能正确读取，但本环境 vue-tsc 与
 * typescript 版本不兼容无法运行，因此这里显式声明实例接口，使 `tsc` 与 `vue-tsc` 下都类型正确。
 *
 * 方法签名需与对应组件 defineExpose 保持一致。
 */

/** common/file-content.vue 暴露的实例方法 */
export interface FileContentInstance {
  /** 获取编辑器当前内容 */
  getContent: () => string;
  /** 重新初始化编辑器（切换文件后调用） */
  resetEditor: (text: string) => Promise<void>;
}

/** components/auto-form/index.vue 暴露的实例方法 */
export interface AutoFormInstance {
  /** 触发表单验证，true 表示通过，否则返回错误信息对象 */
  validate: () => Promise<boolean | Record<string, unknown>>;
  /** 清除表单校验状态 */
  clearValidate?: (fields?: string[]) => void;
}
