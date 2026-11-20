/** 标签项（项目信息卡片中的标签列表元素） */
export interface TagItem {
  /** 标签文案 */
  label: string;
  /** 计数 */
  count: number;
}

export interface TagProps {
  /** 卡片标签 */
  label: string;
  /** 主题色 */
  theme: 'violet' | 'indigo';
  /** 主值 */
  value: number | string;
  /** 描述文字 */
  desc: string;
  /** 右上角图标 */
  icon: string;
  /** 点击跳转的路由名 */
  routeName: string;
  /** 路径展示（缓存文件模式） */
  extraPath?: string;
  /** 标签列表（规则模式），传入空数组显示空状态 */
  tags?: TagItem[];
  /** 空状态文案 */
  emptyText?: string;
}

/** 日志条目（接口访问日志的一行记录） */
export interface LogEntry {
  /** 日志时间 */
  time: string;
  /** HTTP 方法 */
  method: string;
  /** 请求 URL */
  url: string;
  /** 请求者身份（邮箱或匿名） */
  user: string;
  /** HTTP 状态码 */
  status: string;
  /** 响应耗时 */
  duration: string;
  /** 请求体摘要或完整 JSON */
  body: string;
}
