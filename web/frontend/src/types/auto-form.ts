/**
 * 表单字段类型枚举
 * @description 支持的所有表单控件类型
 */
export type AutoFormFieldType =
  | 'input'            // 单行文本输入
  | 'textarea'         // 多行文本输入
  | 'select'           // 下拉选择
  | 'multi-select'     // 多选下拉
  | 'checkbox'         // 多选框组
  | 'radio'            // 单选框组
  | 'date-picker'      // 日期选择器（YYYY-MM-DD）
  | 'date-range-picker'// 日期范围选择器（[startDate, endDate]）
  | 'month-day-picker' // 月日选择器（MM-DD，不含年份）
  | 'time-picker'      // 时间选择器（HH:mm）
  | 'time-range-picker'// 时间范围选择器（[startTime, endTime]）
  | 'switch'           // 开关
  | 'number'           // 数字输入
  | 'slider'           // 滑块
  | 'cascader'         // 级联选择
  | 'tree-select'      // 树形选择
  | 'upload'           // 文件/图片上传
  | 'map-picker'       // 高德地图选点（值格式「地名|经度,纬度」，未配置 JS Key 时降级为文本输入）
  | 'markdown'         // Markdown 编辑器（CodeMirror 源码 + 渲染预览双模式）
  | 'group';           // 横向分组（多个子字段排列在同一行）


export type AutoFormPasswordType = 'text' | 'password';

/** 下拉 / 单选 / 多选框 选项 */
export interface AutoFormOption {
  /** 选项值 */
  value: string;
  /** 显示标签 */
  label: string;
  /** 弱化说明文字（下拉面板里以小字显示在 label 后面，不参与取值/回显） */
  sub?: string;
  /** 是否禁用该选项 */
  disabled?: boolean;
  /**
   * 是否为全选选项（checkbox 有效）
   * @description 设为 true 时该选项作为"全选"控制项，勾选后自动选中所有其他选项
   */
  checkAll?: boolean;
}

/** 上传文件对象 */
export interface AutoFormUploadFile {
  /** 文件唯一标识 */
  uid: string;
  /** 文件名 */
  name: string;
  /** 文件访问地址（上传成功后由服务端返回） */
  url: string;
  /** 文件状态 */
  status?: 'waiting' | 'progress' | 'success' | 'fail';
  /** 文件大小（字节） */
  size?: number;
  /** 原始 File 对象 */
  raw?: File;
  /** 服务端响应数据 */
  response?: Record<string, unknown>;
}

/** 级联 / 树形选择 节点 */
export interface AutoFormTreeNode {
  /** 节点值 */
  value: string;
  /** 显示标签 */
  label: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 子节点 */
  children?: AutoFormTreeNode[];
}

/**
 * 自定义验证结果对象
 * @description 对应 TDesign CustomValidateObj
 */
export interface AutoFormCustomValidateObj {
  result: boolean;
  message: string;
  type?: 'error' | 'warning' | 'success';
}

/**
 * 自定义验证结果类型
 * @description 对应 TDesign CustomValidateResolveType
 */
export type AutoFormCustomValidateResolveType = boolean | AutoFormCustomValidateObj;

/**
 * 自定义验证函数类型
 * @description 对应 TDesign CustomValidator
 */
export type AutoFormCustomValidator = (val: unknown) => AutoFormCustomValidateResolveType | Promise<AutoFormCustomValidateResolveType>;

/**
 * 表单验证规则
 * @description 对应 TDesign Form 的 FormRule，支持在 JSON 配置中直接使用。
 * pattern 字段支持字符串形式（如 "^\\d+$"），组件内部会自动转为 RegExp。
 * 内置类型验证使用类型名作为 key（TDesign 原生格式）。
 *
 * @example
 * ```json
 * [
 *   { "required": true, "message": "不能为空" },
 *   { "min": 2, "max": 20, "message": "长度在 2-20 个字符" },
 *   { "pattern": "^[a-zA-Z0-9_]+$", "message": "只能包含字母、数字、下划线" },
 *   { "email": { "ignore_max_length": true }, "message": "请输入合法的邮箱地址" },
 *   { "url": {}, "message": "请输入合法的 URL" },
 *   { "number": {}, "message": "请输入数字" },
 *   { "integer": {}, "message": "请输入整数" },
 *   { "idcard": {}, "message": "请输入合法的身份证号" },
 *   { "telnumber": {}, "message": "请输入合法的手机号" }
 * ]
 * ```
 */
export interface AutoFormRule {
  /** 是否必填 */
  required?: boolean;
  /** 验证失败提示信息 */
  message?: string;
  /** 验证失败提示类型 */
  type?: 'error' | 'warning';
  /** 最小长度（字符串/数组）或最小值（数字） */
  min?: number;
  /** 最大长度（字符串/数组）或最大值（数字） */
  max?: number;
  /**
   * 正则表达式验证
   * @description 支持 RegExp 对象或字符串形式（JSON 中推荐使用字符串，如 "^\\d+$"）
   */
  pattern?: RegExp | string;
  /**
   * 邮箱格式验证（TDesign 原生内置类型）
   * @example { email: { ignore_max_length: true }, message: '请输入合法的邮箱地址' }
   */
  email?: { ignore_max_length?: boolean };
  /**
   * URL 格式验证（TDesign 原生内置类型）
   * @example { url: {}, message: '请输入合法的 URL' }
   */
  url?: Record<string, unknown>;
  /**
   * 数字验证（含小数，TDesign 原生内置类型）
   * @example { number: {}, message: '请输入数字' }
   */
  number?: Record<string, unknown>;
  /**
   * 整数验证（TDesign 原生内置类型）
   * @example { integer: {}, message: '请输入整数' }
   */
  integer?: Record<string, unknown>;
  /**
   * 中国大陆身份证验证（TDesign 原生内置类型）
   * @example { idcard: {}, message: '请输入合法的身份证号' }
   */
  idcard?: Record<string, unknown>;
  /**
   * 手机号验证（TDesign 原生内置类型，字段名为 telnumber）
   * @example { telnumber: {}, message: '请输入合法的手机号' }
   */
  telnumber?: Record<string, unknown>;
  /**
   * 日期格式验证（TDesign 原生内置类型）
   * @example { date: {}, message: '请输入合法的日期' }
   */
  date?: Record<string, unknown>;
  /**
   * 触发验证的时机，默认 'blur'
   * - `change` — 值变更时触发
   * - `blur`   — 失焦时触发
   */
  trigger?: 'change' | 'blur';
  /** 枚举值验证，值必须在此数组中 */
  enum?: string[];
  /** 精确长度验证（字符串/数组） */
  len?: number;
  /** 是否将空格视为有效字符，默认 false（即空格不算有效内容） */
  whitespace?: boolean;
  /**
   * 数字最小值验证（用于 number 类型字段的值范围验证）
   * @description 组件内部会自动转换为 validator 函数，验证数字值 >= numberMin
   * @example { numberMin: 0, message: '不能小于 0' }
   */
  numberMin?: number;
  /**
   * 数字最大值验证（用于 number 类型字段的值范围验证）
   * @description 组件内部会自动转换为 validator 函数，验证数字值 <= numberMax
   * @example { numberMax: 100, message: '不能大于 100' }
   */
  numberMax?: number;
  /**
   * 自定义验证函数
   * @description 对应 TDesign CustomValidator，返回 true / { result: true } 表示通过，返回 false / { result: false, message } 表示失败
   */
  validator?: AutoFormCustomValidator;
}

/**
 * group 类型的子字段配置
 * @description 描述 group 内每个子控件的配置，子字段不支持嵌套 group
 */
export interface AutoFormGroupChild {
  /** 字段名，对应 modelValue 对象的 key */
  name: string;
  /** 字段类型（不支持 group / textarea / markdown） */
  type: Exclude<AutoFormFieldType, 'group' | 'textarea' | 'markdown'>;
  /** 占位提示文本；范围选择器（date-range-picker / time-range-picker）可传 [开始, 结束] 数组分别配置 */
  placeholder?: string | [string, string];
  /** 下拉选项，支持静态数组或动态函数 */
  options?: AutoFormOption[] | ((formData: Record<string, unknown>) => AutoFormOption[]);
  /** 是否禁用，支持静态布尔或动态函数 */
  disabled?: boolean | ((formData: Record<string, unknown>) => boolean);
  /** 是否强制启用（即使全局 disabled 为 true 也不禁用该字段） */
  forceEnabled?: boolean;
  /** 是否显示清除按钮 */
  clearable?: boolean;
  /** 是否可搜索（select 有效） */
  filterable?: boolean;
  /** 日期选择器格式，默认 'YYYY-MM-DD' */
  dateFormat?: string;
  /** 时间选择器格式，默认 'HH:mm' */
  timeFormat?: string;
  /** 数字最小值（number / slider 有效） */
  min?: number;
  /** 数字最大值（number / slider 有效） */
  max?: number;
  /** 数字步长（number / slider 有效），默认 1 */
  step?: number;
  /** 小数位数（number 有效），默认不限制 */
  decimalPlaces?: number | { enableRound: boolean; places: number };
  /** 数字输入框对齐方式（number 有效） */
  align?: 'left' | 'center' | 'right';
  /** 数字输入框主题（number 有效）：column（上下加减）/ row（左右加减）/ normal（无加减按钮） */
  theme?: 'column' | 'row' | 'normal';
  /** 是否允许输入超出 min/max 范围（number 有效），默认 true */
  allowInputOverLimit?: boolean;
  /** 是否自动宽度（number 有效），默认 false */
  autoWidth?: boolean;
  /** 是否使用大数字模式（number 有效，value 将以字符串形式传递），默认 false */
  largeNumber?: boolean;
  /** 数字输入框左侧标签文字（number 有效） */
  numberLabel?: string;
  /** 数字输入框提示文字（number 有效，显示在输入框下方） */
  tips?: string;
  /** 子字段宽度，支持 CSS 值（如 '120px'）或 flex 比例（如 '1'），默认 flex: 1 */
  width?: string;
  /** 字段变更时的回调，可用于联动更新其他字段 */
  onChange?: (value: unknown, formData: Record<string, unknown>) => void;
}

/**
 * 表单字段配置
 * @description 描述单个表单字段的所有配置项
 */
export interface AutoFormField {
  /** 字段名，对应 modelValue 对象的 key（group 类型可不填） */
  name: string;
  /** 字段标签 */
  label: string;
  /** 字段类型 */
  type: AutoFormFieldType;
  /** 占位提示文本；范围选择器（date-range-picker / time-range-picker）可传 [开始, 结束] 数组分别配置 */
  placeholder?: string | [string, string];
  /** 输入框下方的帮助文字，支持字符串、HTML 字符串或动态函数（根据表单数据返回提示内容） */
  help?: string | ((formData: Record<string, unknown>) => string);
  /** 验证规则列表，支持静态数组或动态函数 */
  rules?: AutoFormRule[] | ((formData: Record<string, unknown>) => AutoFormRule[]);
  /** 下拉选项（type 为 select / multi-select 时使用），支持静态数组或动态函数 */
  options?: AutoFormOption[] | ((formData: Record<string, unknown>) => AutoFormOption[]);
  /** 是否禁用，支持静态布尔或动态函数 */
  disabled?: boolean | ((formData: Record<string, unknown>) => boolean);
  /** 是否强制启用（即使全局 disabled 为 true 也不禁用该字段） */
  forceEnabled?: boolean;
  /** 是否只读 */
  readonly?: boolean;
  /** input 的 type 属性（如 'text' / 'password'），支持动态函数 */
  inputType?: string | ((formData: Record<string, unknown>) => string);
  /** 最大输入字符数（input / textarea 有效） */
  maxlength?: number;
  /** 是否显示字数统计（input / textarea 有效，需配合 maxlength 使用） */
  showWordLimit?: boolean;
  /** 是否显示清除按钮（input / select 有效） */
  clearable?: boolean;
  /** 是否可搜索（select / multi-select / cascader / tree-select 有效） */
  filterable?: boolean;
  /** textarea 自动高度配置 */
  autosize?: { minRows?: number; maxRows?: number };
  /** Markdown 编辑器高度（type 为 markdown 时有效，默认 260px） */
  markdownHeight?: string;
  /** 日期选择器格式（date-picker / date-range-picker 有效），默认 'YYYY-MM-DD' */
  dateFormat?: string;
  /** 禁用特定日期的函数（date-picker / date-range-picker 有效） */
  disabledDate?: (date: Date) => boolean;
  /** 时间选择器格式（time-picker / time-range-picker 有效），默认 'HH:mm' */
  timeFormat?: string;
  /** 时间范围选择器分隔符（time-range-picker 有效），默认 '-' */
  timeRangeSeparator?: string;
  /** 数字最小值（number / slider 有效） */
  min?: number;
  /** 数字最大值（number / slider 有效） */
  max?: number;
  /** 数字步长（number / slider 有效），默认 1 */
  step?: number;
  /** 小数位数（number 有效），默认不限制 */
  decimalPlaces?: number | { enableRound: boolean; places: number };
  /** 数字输入框对齐方式（number 有效） */
  align?: 'left' | 'center' | 'right';
  /** 数字输入框主题（number 有效）：column（上下加减）/ row（左右加减）/ normal（无加减按钮） */
  theme?: 'column' | 'row' | 'normal';
  /** 是否允许输入超出 min/max 范围（number 有效），默认 true */
  allowInputOverLimit?: boolean;
  /** 是否自动宽度（number 有效），默认 false */
  autoWidth?: boolean;
  /** 是否使用大数字模式（number 有效，value 将以字符串形式传递），默认 false */
  largeNumber?: boolean;
  /** 数字输入框左侧标签文字（number 有效） */
  numberLabel?: string;
  /** 数字输入框提示文字（number 有效，显示在输入框下方） */
  tips?: string;
  /** 字段宽度，支持 CSS 值（如 '200px'、'50%'），不设置则默认 100% */
  width?: string;
  /** 输入框前缀文字（input 有效） */
  prefix?: string;
  /** 输入框后缀文字（input 有效） */
  suffix?: string;
  /** slider 是否显示输入框，默认 false */
  showInput?: boolean;
  /** slider 是否为范围选择，默认 false */
  range?: boolean;
  /** radio / checkbox 布局方向，默认 'horizontal' */
  layout?: 'horizontal' | 'vertical';
  /**
   * radio 按钮样式风格（radio 有效）
   * - `outline`：描边风格（默认）
   * - `primary-filled`：主色填充风格
   * - `default-filled`：默认填充风格（按钮组样式）
   */
  variant?: 'outline' | 'primary-filled' | 'default-filled';
  /** 是否允许取消选中（radio 有效），默认 false */
  allowUncheck?: boolean;
  /**
   * checkbox 最多可选数量（checkbox 有效）
   * @description 超出数量后其余选项自动禁用
   */
  checkboxMax?: number;
  /** 是否去除 checkbox 边框（checkbox 有效），默认 false */
  borderless?: boolean;
  /** 级联 / 树形选择 数据源，支持静态数组或动态函数 */
  treeData?: AutoFormTreeNode[] | ((formData: Record<string, unknown>) => AutoFormTreeNode[]);
  /** tree-select 是否多选，默认 false */
  multiple?: boolean;
  /** 允许上传的文件类型（upload 有效），如 'image/*' 或 '.pdf,.docx' */
  uploadAccept?: string;
  /** 是否允许多文件上传（upload 有效），默认 false */
  uploadMultiple?: boolean;
  /** 最多上传文件数量（upload 有效），默认不限制 */
  uploadMax?: number;
  /** 文件大小限制（upload 有效），单位 KB */
  uploadSizeLimit?: number | { size: number; unit: 'B' | 'KB' | 'MB' | 'GB'; message?: string };
  /** 是否支持拖拽上传（upload 有效），默认 false */
  uploadDraggable?: boolean;
  /** 展示风格（upload 有效）：file-input / file-flow / image / image-flow，默认 'file-input' */
  uploadTheme?: 'file-input' | 'file-flow' | 'image' | 'image-flow';
  /** 上传区域提示文字（upload 有效） */
  uploadTips?: string;
  /** 上传目标 URL（upload 有效）：传入后由 TDesign 内置方式发起上传（与 uploadRequestMethod 二选一） */
  uploadAction?: string;
  /** 上传请求头（upload 有效）：会与默认注入的 Authorization 浅合并，此处配置的优先级更高 */
  uploadHeaders?: Record<string, string>;
  /** 自定义上传方法（upload 有效），参数与返回值对齐 TDesign RequestMethodResponse（优先级高于 uploadAction） */
  uploadRequestMethod?: (files: AutoFormUploadFile | AutoFormUploadFile[]) => Promise<{ status: 'success' | 'fail'; error?: string; response: { url?: string; [key: string]: unknown } }>;
  /** 是否显示必填符号（*），优先级高于 Form.requiredMark，不设置则由组件自动根据 rules 决定 */
  requiredMark?: boolean;
  /** 控制字段是否显示，返回 false 则隐藏该字段 */
  visible?: boolean | ((formData: Record<string, unknown>) => boolean);
  /** 字段变更时的回调，可用于联动清空其他字段 */
  onChange?: (value: unknown, formData: Record<string, unknown>) => void;
  /**
   * group 类型的子字段列表
   * @description 仅 type === 'group' 时有效，子字段横向排列在同一行
   */
  children?: AutoFormGroupChild[];
  /** group 子字段之间的间距，默认 '8px' */
  gap?: string;
}

/**
 * AutoForm 组件 Props 类型
 */
export interface AutoFormProps {
  /** 表单数据（v-model） */
  modelValue: Record<string, unknown>;
  /** 字段配置列表 */
  fields: AutoFormField[];
  /** 是否显示冒号，默认 true */
  colon?: boolean;
  /** 表单内控件尺寸，默认 'medium' */
  size?: 'small' | 'medium' | 'large';
  /** 是否禁用整个表单 */
  disabled?: boolean;
  /** 表单标签宽度，默认 '120px'（移动端自动切换为 'auto'） */
  labelWidth?: string;
  /** 表单标签对齐方式，默认 'left'（移动端自动切换为 'top'） */
  labelAlign?: 'left' | 'right' | 'top';
  /** 是否显示必填符号（*），默认 true */
  requiredMark?: boolean;
}
