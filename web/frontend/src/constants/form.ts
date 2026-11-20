/**
 * 表单模式枚举
 * @description 用于 `<form-drawer>` 的 `mode` 参数，决定确认按钮文案与抽屉语义。
 * - Create：新增（默认）→ 按钮显示"确认新增"
 * - Edit：编辑 → 按钮显示"确认修改"
 * - View：只读/保存 → 按钮显示"保存"（与 readonly 结合则隐藏确认按钮）
 */
export enum FormMode {
  Create = 'create',
  Edit = 'edit',
  View = 'view',
}
