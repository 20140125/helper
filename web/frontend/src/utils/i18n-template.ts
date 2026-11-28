/**
 * i18n 插值函数的安全还原
 * @description 把语言包中保存的 JS 模板箭头函数源码解析成受限表达式后生成渲染函数；
 *   不使用 eval / new Function，数据库内容永远不会被当作代码执行。
 */

/** 合法参数名 */
const IDENTIFIER_PATTERN = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** 词法单元 */
interface Token {
  /** 单元类型 */
  type: 'number' | 'string' | 'identifier' | 'operator' | 'eof';
  /** 单元文本 */
  value: string;
}

/** 受限表达式求值器 */
type Evaluator = (env: Record<string, unknown>) => unknown;

/** 二元运算符优先级 */
const BINARY_PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '===': 3, '!==': 3, '>': 3, '<': 3, '>=': 3, '<=': 3,
  '+': 4, '-': 4,
  '*': 5, '/': 5, '%': 5,
};

/** 允许的运算符（长运算符必须排在短运算符之前） */
const OPERATORS = ['===', '!==', '==', '!=', '>=', '<=', '&&', '||', '?.', '+', '-', '*', '/', '%', '>', '<', '!', '?', ':', '(', ')', '.'];

/**
 * 词法分析：只识别数字、字符串、标识符与白名单运算符
 * @param {string} source - 单个插值表达式
 * @returns {Token[]} 词法单元序列
 * @description 遇到任何其它字符（含反斜杠转义、属性访问、函数调用）直接抛错，交给调用方回退
 */
const tokenize = (source: string): Token[] => {
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9]/.test(char)) {
      let number = '';
      while (index < source.length && /[0-9.]/.test(source[index])) {
        number += source[index];
        index += 1;
      }
      tokens.push({ type: 'number', value: number });
      continue;
    }
    if (char === "'" || char === '"') {
      const quote = char;
      let text = '';
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === '\\') throw new Error('不支持字符串转义');
        text += source[index];
        index += 1;
      }
      if (source[index] !== quote) throw new Error('字符串未闭合');
      index += 1;
      tokens.push({ type: 'string', value: text });
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      let identifier = '';
      while (index < source.length && /[A-Za-z0-9_$]/.test(source[index])) {
        identifier += source[index];
        index += 1;
      }
      tokens.push({ type: 'identifier', value: identifier });
      continue;
    }
    const operator = OPERATORS.find((candidate) => source.startsWith(candidate, index));
    if (!operator) throw new Error(`不支持的字符：${char}`);
    tokens.push({ type: 'operator', value: operator });
    index += operator.length;
  }
  tokens.push({ type: 'eof', value: '' });
  return tokens;
};

/**
 * 计算受限二元运算
 * @param {string} operator - 运算符
 * @param {unknown} left - 左值
 * @param {unknown} right - 右值
 * @returns {unknown} 运算结果
 * @description 仅支持数值、字符串拼接、比较与逻辑；不访问对象属性、不调用函数
 */
const applyBinary = (operator: string, left: unknown, right: unknown): unknown => {
  switch (operator) {
    case '+': return typeof left === 'string' || typeof right === 'string'
      ? String(left) + String(right)
      : Number(left) + Number(right);
    case '-': return Number(left) - Number(right);
    case '*': return Number(left) * Number(right);
    case '/': return Number(left) / Number(right);
    case '%': return Number(left) % Number(right);
    case '===': return left === right;
    case '!==': return left !== right;
    case '>': return Number(left) > Number(right);
    case '<': return Number(left) < Number(right);
    case '>=': return Number(left) >= Number(right);
    case '<=': return Number(left) <= Number(right);
    case '&&': return left && right;
    case '||': return left || right;
    default: throw new Error(`不支持的运算符：${operator}`);
  }
};

/**
 * 创建受限表达式解析器
 * @param {Token[]} tokens - 词法单元序列
 * @param {string[]} params - 允许出现的参数名
 * @returns {Evaluator} 编译后的求值函数
 * @description 支持变量、字面量、四则运算、比较、逻辑、三元与 n?.toLocaleString()；其它一律抛错
 */
const createParser = (tokens: Token[], params: string[]): Evaluator => {
  let index = 0;
  const peek = (): string => tokens[index].type === 'operator' ? tokens[index].value : '';
  const next = (): Token => {
    const token = tokens[index];
    index += 1;
    return token;
  };
  const expect = (operator: string): void => {
    if (next().value !== operator) throw new Error(`缺少 ${operator}`);
  };

  function parsePrimary(): Evaluator {
    const token = next();
    if (token.type === 'number') {
      const value = Number(token.value);
      if (Number.isNaN(value)) throw new Error('非法数字');
      return () => value;
    }
    if (token.type === 'string') {
      const value = token.value;
      return () => value;
    }
    if (token.type === 'identifier') {
      if (!params.includes(token.value)) throw new Error(`未知参数：${token.value}`);
      const name = token.value;
      let evaluator: Evaluator = (env) => env[name];
      if (peek() === '?.') {
        next();
        const method = next();
        if (method.type !== 'identifier' || method.value !== 'toLocaleString') {
          throw new Error('仅支持 toLocaleString 方法');
        }
        expect('(');
        expect(')');
        const base = evaluator;
        evaluator = (env) => {
          const value = base(env);
          return value === null || value === undefined ? undefined : Number(value).toLocaleString();
        };
      }
      return evaluator;
    }
    if (token.type === 'operator' && token.value === '(') {
      const inner = parseTernary();
      expect(')');
      return inner;
    }
    throw new Error(`不支持的表达式片段：${token.value}`);
  }

  function parseUnary(): Evaluator {
    const operator = peek();
    if (operator === '!' || operator === '-') {
      next();
      const operand = parseUnary();
      return operator === '!'
        ? (env) => !operand(env)
        : (env) => -Number(operand(env));
    }
    return parsePrimary();
  }

  function parseBinary(minPrecedence: number): Evaluator {
    let left = parseUnary();
    for (;;) {
      const operator = peek();
      const precedence = BINARY_PRECEDENCE[operator];
      if (!precedence || precedence < minPrecedence) break;
      next();
      const right = parseBinary(precedence + 1);
      const previous = left;
      left = (env) => applyBinary(operator, previous(env), right(env));
    }
    return left;
  }

  function parseTernary(): Evaluator {
    const condition = parseBinary(1);
    if (peek() !== '?') return condition;
    next();
    const whenTrue = parseTernary();
    expect(':');
    const whenFalse = parseTernary();
    return (env) => (condition(env) ? whenTrue(env) : whenFalse(env));
  }

  const evaluate = parseTernary();
  if (tokens[index].type !== 'eof') throw new Error('表达式未解析完');
  return evaluate;
};

/**
 * 把库内模板箭头函数源码还原为可执行渲染函数
 * @param {string} source - 形如 (n) => `共 ${n} 条` 的源码
 * @returns {Function | undefined} 渲染函数；源码形态或表达式不受支持时返回 undefined，由调用方回退内置实现
 * @description 只做词法/语法解析与数值运算，不执行数据库里的任意 JS 代码
 */
export const parseTemplateFunction = (source: string): ((...args: unknown[]) => string) | undefined => {
  const match = /^\(([^)]*)\)\s*=>\s*`([\s\S]*)`$/.exec(source.trim());
  if (!match) return undefined;
  const params = match[1].split(',').map((item) => item.trim()).filter(Boolean);
  if (params.some((param) => !IDENTIFIER_PATTERN.test(param))) return undefined;
  const template = match[2];

  const compiled: Array<{ raw: string; evaluate: Evaluator }> = [];
  try {
    for (const item of template.matchAll(/\$\{([^}]*)\}/g)) {
      const raw = item[1];
      compiled.push({ raw, evaluate: createParser(tokenize(raw.trim()), params) });
    }
  } catch {
    return undefined;
  }
  if (template.includes('${') && compiled.length === 0) return undefined;

  return (...args: unknown[]): string => {
    const env: Record<string, unknown> = {};
    params.forEach((name, position) => {
      env[name] = args[position];
    });
    return template.replace(/\$\{([^}]*)\}/g, (full, raw: string) => {
      const hit = compiled.find((entry) => entry.raw === raw);
      if (!hit) return full;
      const value = hit.evaluate(env);
      return value === null || value === undefined ? '' : String(value);
    });
  };
};
