/**
 * md 技能（SKILL.md）相关类型
 * @description 技能 = 一份 Markdown 使用说明书 + 可选的脚本 / 参考资料，
 *   参考 Claude Agent Skills 的「渐进式披露」：平时只把 name + description 挂进提示词，
 *   命中了才由贾维斯调 load_skill 取回全文，避免把 41 个工具的用法一次全塞进上下文。
 *
 * @note 项目里有两套「技能」，不要混用：
 *   1) 卡片技能——`scripts/tools/*.sh` + `@/utils/skill-map`，负责外部数据抓取与出图，走 `card_skill` 工具
 *   2) md 技能——本类型描述的 `skills/<name>/SKILL.md`，负责「业务怎么查、故障怎么排」的操作说明，走 `load_skill` 工具
 */

/**
 * md 技能的副作用等级
 * @description 技能本身只是说明文档，不执行任何动作；等级用于**分发控制**：
 *   - `read`：查询类说明，巡检 / 群消息 / 子 Agent 都可加载
 *   - `action` / `mutation`：涉及推送、跑脚本、改数据的操作说明，只在主会话开放，
 *     巡检与群消息这类自动化入口一律不注入，避免文档把无人值守的 Agent 引向副作用
 */
export type AiSkillEffect = 'read' | 'action' | 'mutation';

/**
 * SKILL.md 的 YAML frontmatter
 * @description 只支持 `key: value` 与 `key:` + `- item` 列表两种写法（够用且不引 yaml 依赖），
 *   写在文件最开头，以 `---` 包裹。缺字段时按兜底处理，写错了也不会让技能加载失败。
 */
export interface AiSkillFrontmatter {
  /** 技能名（缺省取目录名） */
  name?: string;
  /** 一句话说明（会注入 system prompt，决定贾维斯何时加载它） */
  description?: string;
  /** 副作用等级（缺省 read） */
  effect?: string;
  /** 加载所需权限码（任一命中即可；不填表示所有人可见） */
  permissions?: string[];
  /** 本技能说明的工具名（用于从工具反查技能，见 findSkillDocByTool） */
  tools?: string[];
}

/** md 技能索引项（只有这些字段会进提示词） */
export interface AiSkillMeta {
  /** 技能名（load_skill 的入参） */
  name: string;
  /** 一句话说明 */
  description: string;
  /** 副作用等级 */
  effect: AiSkillEffect;
  /** 加载所需权限码（空数组表示无限制） */
  permissions: string[];
  /**
   * 本技能说明的工具名
   * @description 用于「工具 → 技能」反查：工具 description 精简后，
   *   用户在输入框锁定某个工具（pinned tool）时，工具表里已没有 load_skill，
   *   靠这份映射把对应技能的正文直接拼进提示词，保证参数口径不丢。
   */
  tools: string[];
  /** SKILL.md 绝对路径（排障用，不下发给模型） */
  file: string;
}

/** md 技能全文（索引 + 正文） */
export interface AiSkillDoc extends AiSkillMeta {
  /** 正文（已去掉 frontmatter） */
  body: string;
}
