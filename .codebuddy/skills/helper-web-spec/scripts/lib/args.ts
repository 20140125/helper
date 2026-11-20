/**
 * 命令行参数解析
 *
 * 背景：5 个脚本各写一份解析骨架，行为还不一致 ——
 * `check-route` 多个路径只留最后一个，`check-unused` 把 `-h` 当成扫描路径，
 * `add-i18n` 干脆不支持 help。这里统一：短选项、长选项、`--no-x` 布尔开关、
 * 带值选项（值缺失要报错而不是静默吞掉）。
 */

export type ParsedArgs = {
  /** 位置参数（按出现顺序，全部保留） */
  positionals: string[];
  /** 标记：--fix / --dry-run → true；--icon xxx → 'xxx' */
  flags: Record<string, string | boolean>;
  /** 未识别的选项（用于提示用户，避免拼错被静默忽略） */
  unknown: string[];
};

export type ParseOptions = {
  /** 需要取值的选项名，如 ['output', 'icon']（同时支持 -o / --output） */
  valueFlags?: string[];
  /** 布尔开关名，如 ['fix', 'dry-run', 'force'] */
  booleanFlags?: string[];
  /** 短选项映射，如 { o: 'output', t: 'type' } */
  shortMap?: Record<string, string>;
};

/**
 * 解析 process.argv.slice(2)
 *
 * 规则：
 *   - `--no-xxx` → flags.xxx = false
 *   - `--xxx` / `-x` → 在 booleanFlags 里为 true；在 valueFlags 里取下一个参数
 *   - `--xxx=yyy` → flags.xxx = 'yyy'
 *   - 其余以 `-` 开头的归入 unknown
 */
export const parseArgs = (argv: string[], options: ParseOptions = {}): ParsedArgs => {
  const { valueFlags = [], booleanFlags = [], shortMap = {} } = options;
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const unknown: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (!arg.startsWith('-')) {
      positionals.push(arg);
      continue;
    }

    const eqIndex = arg.indexOf('=');
    const hasInlineValue = eqIndex > 0;
    const rawName = (hasInlineValue ? arg.slice(0, eqIndex) : arg).replace(/^--?/, '');
    const name = shortMap[rawName] || rawName;

    // --no-xxx：显式关闭
    if (!hasInlineValue && rawName.startsWith('no-')) {
      flags[rawName.slice(3)] = false;
      continue;
    }

    if (hasInlineValue) {
      flags[name] = arg.slice(eqIndex + 1);
      continue;
    }

    if (valueFlags.includes(name)) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('-')) {
        throw new Error(`选项 --${name} 缺少取值`);
      }
      flags[name] = next;
      i += 1;
      continue;
    }

    if (booleanFlags.includes(name)) {
      flags[name] = true;
      continue;
    }

    unknown.push(arg);
  }

  return { positionals, flags, unknown };
};

/** 取布尔标记（兼容 --no-x） */
export const getFlag = (args: ParsedArgs, name: string, defaultValue = false): boolean => {
  const value = args.flags[name];
  return typeof value === 'boolean' ? value : defaultValue;
};

/** 取字符串标记 */
export const getStringFlag = (args: ParsedArgs, name: string): string | undefined => {
  const value = args.flags[name];
  return typeof value === 'string' ? value : undefined;
};

/** 是否请求帮助 */
export const wantsHelp = (args: ParsedArgs, argv: string[]): boolean =>
  getFlag(args, 'help') || argv.includes('-h');
