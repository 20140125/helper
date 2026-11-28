/**
 * 已有业务表 CLI（供 scripts/cache_db.sh 调用）
 * @description shell 通道的 stdout 是数据通道，除 read / list / mtime 外不产生任何输出
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getPool } from '@/utils/database/connection';
import {
  deleteTableKey,
  listTableEntries,
  readTableBody,
  tableKeyExists,
  tableKeyMtime,
  writeTableBody,
} from '@/utils/database/cache-tables';

dotenv.config({ path: path.join(__dirname, '../.env') });

const [op, key = ''] = process.argv.slice(2);

/** 命令入口 */
const main = async (): Promise<void> => {
  switch (op) {
    case 'read': {
      const body = await readTableBody(key);
      if (body !== null) process.stdout.write(body);
      break;
    }
    case 'write': {
      if (!key) throw new Error('缺少缓存键');
      await writeTableBody(key, fs.readFileSync(0, 'utf-8'));
      break;
    }
    case 'exists': {
      if (!(await tableKeyExists(key))) process.exitCode = 1;
      break;
    }
    case 'delete': {
      await deleteTableKey(key);
      break;
    }
    case 'list': {
      const keys = (await listTableEntries())
        .map((item) => item.key)
        .filter((item) => item.startsWith(key))
        .sort();
      if (keys.length > 0) process.stdout.write(`${keys.join('\n')}\n`);
      break;
    }
    case 'mtime': {
      process.stdout.write(String(await tableKeyMtime(key)));
      break;
    }
    default:
      throw new Error(`未知操作：${op}`);
  }
};

main()
  .catch((err: unknown) => {
    process.stderr.write(`缓存访问失败：${(err as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // 连接池未初始化时忽略，避免覆盖原始错误
    }
  });
