import fs from 'fs';
import path from 'path';
import { PROJECT_DIR, WEB_DIR } from '@/utils/paths';
import type {
  AiSkillDoc,
  AiSkillEffect,
  AiSkillFrontmatter,
  AiSkillMeta,
} from '@/types/ai-chat-skill';

/**
 * md 技能（SKILL.md）加载器
 * @description 扫描技能目录，解析 frontmatter，产出「索引（name/description）」供提示词常驻，
 *   以及「全文」供 load_skill 按需取回。
 *
 * 目录约定：`web/skills/<技能名>/SKILL.md`，可用 `AI_SKILLS_DIR` 覆盖（相对项目根）。
 *   不放 docs/ 是为了不被知识库（BM25）重复索引——那套是给用户查文档的，这套是给 Agent 照着做的。
 */

/** 技能文件名（大小写不敏感匹配，兼容 Skill.md） */
const SKILL_FILE_NAMES = ['SKILL.md', 'Skill.md', 'skill.md'];

/** 合法的副作用等级 */
const EFFECTS: AiSkillEffect[] = ['read', 'action', 'mutation'];

/** 单个技能描述的最大长度（字符），防止写得太长把提示词撑爆 */
const MAX_DESCRIPTION_CHARS = 200;

/**
 * 在技能目录里定位 SKILL.md
 * @param {string} dir - 技能目录
 * @returns {string | null} 文件路径，不存在返回 null
 */
const findSkillFile = (dir: string): string | null => {
  for (const name of SKILL_FILE_NAMES) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) return file;
  }
  return null;
};

/**
 * 解析技能根目录
 * @returns {string} 技能根目录绝对路径
 * @description 默认 `web/skills`；`AI_SKILLS_DIR` 可指向项目根下的任意目录。
 */
export const resolveSkillsDir = (): string => {
  const raw = (process.env.AI_SKILLS_DIR ?? '').trim();
  return raw ? path.resolve(PROJECT_DIR, raw) : path.join(WEB_DIR, 'skills');
};

/**
 * 解析 SKILL.md 的 frontmatter
 * @param {string} raw - 文件全文
 * @returns {{ front: AiSkillFrontmatter; body: string }} frontmatter 与正文
 * @description 只支持两种写法：`key: value` 与 `key:` 换行后 `- item` 列表。
 *   没有 frontmatter 或格式不合法时，整篇当正文，不报错——技能文档写错了不该让 Agent 挂掉。
 */
export const parseSkillFrontmatter = (
  raw: string,
): { front: AiSkillFrontmatter; body: string } => {
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return { front: {}, body: raw.trim() };
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end === -1) return { front: {}, body: raw.trim() };

  const fields: Record<string, string | string[]> = {};
  let currentKey = '';
  for (let i = 1; i < end; i += 1) {
    const line = lines[i];
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && currentKey) {
      const prev = fields[currentKey];
      const arr = Array.isArray(prev) ? prev : (typeof prev === 'string' && prev ? [prev] : []);
      arr.push(item[1].trim());
      fields[currentKey] = arr;
      continue;
    }
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    currentKey = kv[1];
    // 值为空表示接下来是 `- item` 列表，先占位成空数组
    fields[currentKey] = kv[2].trim() ? kv[2].trim() : [];
  }

  const asString = (v: string | string[] | undefined): string | undefined =>
    (typeof v === 'string' && v ? v : undefined);
  const asArray = (v: string | string[] | undefined): string[] => {
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === 'string' && v) return v.split(',').map((s) => s.trim()).filter(Boolean);
    return [];
  };

  return {
    front: {
      name: asString(fields.name),
      description: asString(fields.description),
      effect: asString(fields.effect),
      permissions: asArray(fields.permissions),
      tools: asArray(fields.tools),
    },
    body: lines.slice(end + 1).join('\n').trim(),
  };
};

/** 索引缓存（签名 = 目录名:文件 mtime，改 md 无需重启 Web） */
let cached: { signature: string; docs: AiSkillDoc[] } | null = null;

/**
 * 读取全部技能全文（带缓存）
 * @returns {AiSkillDoc[]} 按技能名排序的技能全文列表
 * @description 每次调用只 stat 文件比对 mtime，内容不变复用缓存；
 *   单个技能解析失败只跳过并打日志，不影响其他技能。
 */
export const listSkillDocs = (): AiSkillDoc[] => {
  const dir = resolveSkillsDir();
  if (!fs.existsSync(dir)) return [];

  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
  const signature = entries
    .map((e) => {
      const file = findSkillFile(path.join(dir, e.name));
      const mtime = file ? fs.statSync(file).mtimeMs : 0;
      return `${e.name}:${mtime}`;
    })
    .sort()
    .join('|');
  if (cached && cached.signature === signature) return cached.docs;

  const docs: AiSkillDoc[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const file = findSkillFile(path.join(dir, entry.name));
    if (!file) continue;
    let raw: string;
    try {
      raw = fs.readFileSync(file, 'utf-8');
    } catch (err) {
      console.error(`[ai-chat] 技能读取失败 ${file}：${(err as Error).message}`);
      continue;
    }

    const { front, body } = parseSkillFrontmatter(raw);
    const name = (front.name ?? entry.name).trim();
    if (!name) continue;
    if (seen.has(name)) {
      console.warn(`[ai-chat] 技能名 ${name} 重复，已忽略 ${file}`);
      continue;
    }
    if (!body) {
      console.warn(`[ai-chat] 技能 ${name} 正文为空，已忽略 ${file}`);
      continue;
    }
    seen.add(name);

    const rawEffect = (front.effect ?? 'read').trim().toLowerCase();
    const effect: AiSkillEffect = EFFECTS.includes(rawEffect as AiSkillEffect)
      ? (rawEffect as AiSkillEffect)
      : 'read';
    if (front.effect && !EFFECTS.includes(rawEffect as AiSkillEffect)) {
      console.warn(`[ai-chat] 技能 ${name} 的 effect="${front.effect}" 不合法，已按 read 处理`);
    }

    docs.push({
      name,
      description: (front.description ?? '').slice(0, MAX_DESCRIPTION_CHARS),
      effect,
      permissions: front.permissions ?? [],
      tools: front.tools ?? [],
      file,
      body,
    });
  }

  docs.sort((a, b) => a.name.localeCompare(b.name));
  cached = { signature, docs };
  return docs;
};

/**
 * 列出可注入提示词的技能索引
 * @param {string[]} [permissions] - 当前用户权限码，用于过滤无权加载的技能
 * @param {AiSkillEffect} [effect] - 只看某一副作用等级的技能（如巡检只传 'read'）
 * @returns {AiSkillMeta[]} 技能索引列表（不含正文）
 */
export const listSkillMetas = (permissions?: string[], effect?: AiSkillEffect): AiSkillMeta[] => {
  return listSkillDocs()
    .filter((d) => (effect ? d.effect === effect : true))
    .filter((d) => (
      d.permissions.length === 0 || d.permissions.some((p) => (permissions ?? []).includes(p))
    ))
    .map(({ body: _body, ...meta }) => meta);
};

/**
 * 按名字查找技能全文
 * @param {string} name - 技能名
 * @returns {AiSkillDoc | undefined} 技能全文，找不到返回 undefined
 * @description 名称匹配大小写不敏感、忽略连字符差异，避免模型直译出 `Business_Query` 这类变体查不到。
 */
export const findSkillDoc = (name: string): AiSkillDoc | undefined => {
  const target = name.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (!target) return undefined;
  return listSkillDocs().find((d) => d.name.toLowerCase().replace(/[\s_-]/g, '') === target);
};

/**
 * 按工具名反查说明它的技能
 * @param {string} toolName - 工具名（如 create_rule）
 * @returns {AiSkillDoc | undefined} 技能全文，没有技能声明该工具时返回 undefined
 * @description 用于工具 description 精简后的兜底：锁定单个工具、或模型拿不到 load_skill 时，
 *   由调用方把这份正文直接拼进提示词。
 */
export const findSkillDocByTool = (toolName: string): AiSkillDoc | undefined => {
  const target = toolName.trim();
  if (!target) return undefined;
  return listSkillDocs().find((d) => d.tools.includes(target));
};

/**
 * 清空技能缓存（修改技能目录后手动刷新）
 * @returns {void}
 */
export const resetSkillDocsCache = (): void => {
  cached = null;
};
