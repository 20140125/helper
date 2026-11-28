/**
 * Web 服务启动器（独立守护进程）
 * 监听 3001 端口，提供以下接口：
 *   GET  /api/launcher/status  — 查询 Web 服务（9527）运行状态
 *   POST /api/launcher/start   — 启动 Web 服务
 *   POST /api/launcher/restart — 重启 Web 服务（异步执行，立即响应）
 * 当主 Web 服务（9527）停止时，前端可通过此进程重新启动主服务
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

import { setupTimestampLogger } from '@/utils/logger';
import { flushRunLogs } from '@/utils/run-log';
import { LAUNCHER_PID_FILE } from '@/types/web-service';
import { ensureRuntimeDir } from '@/utils/runtime';
import launcherRouter from '@/routes/launcher';

// 启动器是独立进程，需自己加载 DB_* 才能把 console 日志写入 hp_run_logs
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../scripts/.env') });

// 与主服务区分来源：启动器的 console 日志写 hp_run_logs(source='web_launcher')
process.env.LOG_CONSOLE_SOURCE = 'web_launcher';

setupTimestampLogger();

const LAUNCHER_PORT = 3001;

// 写入自身 PID（运行时目录在 web/.runtime，缺失时自动创建）
ensureRuntimeDir();
fs.writeFileSync(LAUNCHER_PID_FILE, String(process.pid), 'utf-8');

const app = express();

app.use(cors());
app.use(express.json());

// =================================================
// 路由注册
// =================================================

app.use('/api/launcher', launcherRouter);

app.use((_req, res) => {
  res.status(404).json({ code: 404, data: {}, message: 'Not found' });
});

// =================================================
// 启动服务
// =================================================

app.listen(LAUNCHER_PORT, () => {
  console.log(`✅ Web 启动器已就绪，监听端口 ${LAUNCHER_PORT}`);
});

// 进程退出时清理 PID 文件
const cleanup = () => {
  try {
    fs.unlinkSync(LAUNCHER_PID_FILE);
  } catch {
    // 忽略
  }
  // 退出前排空在途日志写入，避免最后几条丢失
  void flushRunLogs().finally(() => process.exit(0));
};

process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);
