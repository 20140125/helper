import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量（必须在所有业务 import 之前）
// 顺序：web/.env 优先，缺失时回退 scripts/.env（dotenv 不覆盖已加载的键，故 web/.env 优先生效）
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../scripts/.env') });

import express from 'express';
import cors from 'cors';
import http from 'http';

import { setupTimestampLogger } from '@/utils/logger';
import { getLocalIp } from '@/utils/network';
import {
  PROJECT_DIR,
  verifyJwt, 
  attachUserInfo, 
  withPermission, 
  accessLogMiddleware, 
  returnResponse, 
  ErrorCode,
  requireSuperAdmin,
} from '@/routes/utils';
import { Permission } from '@/types/permission';
import { AI_CHAT_SEND_BODY_LIMIT } from '@/types/ai-chat';

setupTimestampLogger();
import systemRouter from '@/routes/system';
import configRouter from '@/routes/config';
import aiModelConfigsRouter from '@/routes/ai-model-configs';
import logsRouter from '@/routes/logs';
import daemonRouter from '@/routes/daemon';
import triggerRouter from '@/routes/trigger';
import updateToolsRouter from '@/routes/update-tools';
import cacheRouter from '@/routes/cache';
import rulesRouter from '@/routes/rules';
import webhooksRouter from '@/routes/webhooks';
import webServiceRouter from '@/routes/web-service';
import authRouter from '@/routes/auth';
import launcherRouter from '@/routes/launcher';
import uploadRouter from '@/routes/upload';
import playgroundRouter from '@/routes/playground';
import templatesRouter from '@/routes/templates';
import rbacRolesRouter from '@/routes/rbac-roles';
import rbacUsersRouter from '@/routes/rbac-users';
import rbacPermissionsRouter from '@/routes/rbac-permissions';
import permissionApplyRouter from '@/routes/permission-apply';
import apiCategoriesRouter from '@/routes/api-categories';
import apiManagementRouter from '@/routes/api-management';
import greetingsRouter from '@/routes/greetings';
import reminderQuotesRouter from '@/routes/reminder-quotes';
import skillMapRouter from '@/routes/skill-map';
import aiChatRouter, { aiWebhookRouter } from '@/routes/ai-chat';
import knowledgeRouter from '@/routes/knowledge';
import databaseRouter from '@/routes/database';
import amapRouter from '@/routes/amap';
import { TOOLS_IMAGES_DIR, TOOLS_IMAGES_URL_PREFIX, pruneTraceFiles } from '@/routes/utils';
import { startInspectionScheduler } from '@/utils/ai-chat';
import { getAuthToken } from './utils/permission';

const app = express();
const PORT = Number(process.env.WEB_PORT) || 9527;
const DEV_MODE = process.env.NODE_ENV === 'development';
const VITE_PORT = Number(process.env.VITE_PORT) || 5173;

app.use(cors());
// AI Chat 发送接口会携带 base64 图片（数 MB 级），单独放宽 body 上限。
// 必须放在全局 express.json() 之前：body-parser 解析后置 req._body=true，
// 后续全局 parser 直接跳过，不会被默认的 100kb 上限截断成 413。
app.use('/api/ai-chat/send', express.json({ limit: AI_CHAT_SEND_BODY_LIMIT }));
app.use(express.json());

// uploads 目录始终提供静态文件访问（开发/生产均需要）
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// 技能地图生成的卡片图片（web/public/skill-images/）
// 生产模式下 web/public 已由下方 express.static 统一托管；开发模式下需此处单独挂载以让 URL 正常解析。
// 无鉴权：PNG 不含敏感数据，文件名由 skill-map utils 内部白名单控制（脚本产出文件名固定）。
app.use(TOOLS_IMAGES_URL_PREFIX, express.static(TOOLS_IMAGES_DIR, {
  etag: false,
  lastModified: false,
  setHeaders(res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  },
}));

if (!DEV_MODE) {
  app.use(
    express.static(path.join(__dirname, 'public'), {
      etag: false,
      lastModified: false,
      setHeaders(res) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      },
    }),
  );
}

// =================================================
// JWT 鉴权中间件（保护所有非 /api/auth 路由）
// =================================================

app.use('/api', (req, res, next) => {
  // 仅处理真正的 /api/ 路径
  if (!req.path.startsWith('/')) {
    return next();
  }

  // /api/auth/* 路由不需要鉴权
  if (req.path.startsWith('/auth/')) {
    return next();
  }

  // /api/ai-chat/webhook 为外部渠道入口（无登录态），由路由内的 AI_CHAT_WEBHOOK_TOKEN 令牌把关
  if (req.path.startsWith('/ai-chat/webhook')) {
    return next();
  }

  // 获取 token
  const token = getAuthToken(req);

  if (!token) {
    res.status(401).json({ code: 401, data: {}, message: '未登录，请先登录' });
    return;
  }

  const payload = verifyJwt(token);
  if (!payload) {
    res.status(401).json({ code: 401, data: {}, message: 'Token 无效或已过期，请重新登录' });
    return;
  }

  // 解析用户信息并挂载权限到 req 上
  attachUserInfo(req);

  return next();
});

// =================================================
// Access Log 中间件（记录所有 API 请求的用户、方法、路径、状态码和响应体）
// =================================================

app.use('/api', (req, res, next) => {
  // 仅处理真正的 /api/ 路径
  if (!req.path.startsWith('/')) {
    return next();
  }
  return accessLogMiddleware(req, res, next);
});

// =================================================
// 路由注册（通过 withPermission 统一配置读写权限）
// =================================================

// 系统相关路由
app.use('/api/system', ...withPermission(systemRouter, {
  read: Permission.DASHBOARD_VIEW,
}));

// 配置相关路由
app.use('/api/config', ...withPermission(configRouter, {
  read: Permission.CONFIG_VIEW,
  write: Permission.CONFIG_EDIT,
}));

// 自定义 AI 模型配置：权限收拢到超级管理员
// requireSuperAdmin 做身份兜底；withPermission 用专属权限码做 RBAC 校验
// /test-model 只做连通性探测、不修改配置，按只读权限放行
app.use('/api/ai-model-configs', requireSuperAdmin, ...withPermission(aiModelConfigsRouter, {
  read: Permission.AI_MODELS_VIEW,
  write: Permission.AI_MODELS_EDIT,
  readPaths: ['/test-model'],
}));

// 日志相关路由
app.use('/api/logs', ...withPermission(logsRouter, {
  read: Permission.LOGS_VIEW,
  write: Permission.LOGS_EDIT,
}));

// 守护进程相关路由（仅 POST 操作）
app.use('/api/daemon', ...withPermission(daemonRouter, {
  write: Permission.DAEMON_EDIT,
}));

// 触发器相关路由（GET 按 view 权限过滤脚本列表，POST 按 edit 权限校验执行——均在路由内部做细粒度检查）
app.use('/api/trigger', triggerRouter);

// 更新工具相关路由
app.use('/api/update-tools', ...withPermission(updateToolsRouter, {
  read: Permission.TRIGGER_ANNUAL_UPDATE_VIEW,
  write: Permission.TRIGGER_ANNUAL_UPDATE_EDIT,
}));

// 缓存相关路由
app.use('/api/cache', ...withPermission(cacheRouter, {
  read: Permission.CACHE_VIEW,
  write: Permission.CACHE_EDIT,
}));

// 规则相关路由
app.use('/api/rules', ...withPermission(rulesRouter, {
  read: Permission.RULES_VIEW,
  write: Permission.RULES_EDIT,
}));

// Webhooks 相关路由
app.use('/api/webhooks', ...withPermission(webhooksRouter, {
  read: Permission.CONFIG_VIEW,
  write: Permission.WEBHOOK_EDIT,
}));

// Web Service 相关路由
app.use('/api/web-service', ...withPermission(webServiceRouter, {
  read: Permission.WEB_SERVICE_VIEW,
  write: Permission.WEB_SERVICE_EDIT,
}));

// Launcher 相关路由
app.use('/api/launcher', ...withPermission(launcherRouter, {
  read: Permission.WEB_SERVICE_VIEW,
  write: Permission.WEB_SERVICE_EDIT,
}));

// Auth 相关路由
app.use('/api/auth', authRouter);

// 权限申请相关路由
// 各接口鉴权级别不同，在路由文件内各自配置 requirePermission
app.use('/api/permission-apply', permissionApplyRouter);

// 上传相关路由
app.use('/api/upload', ...withPermission(uploadRouter, {
  write: Permission.UPLOAD_EDIT,
}));

// 表单调试相关路由
app.use('/api/playground', ...withPermission(playgroundRouter, {
  read: Permission.PLAYGROUND_VIEW,
  write: Permission.PLAYGROUND_EDIT,
}));

// 消息模板相关路由
app.use('/api/templates', ...withPermission(templatesRouter, {
  read: Permission.TEMPLATES_VIEW,
  write: Permission.TEMPLATES_EDIT,
  readPaths: ['/preview'],
}));

// RBAC 角色相关路由
app.use('/api/rbac/roles', ...withPermission(rbacRolesRouter, {
  read: Permission.RBAC_ROLES_VIEW,
  write: Permission.RBAC_ROLES_EDIT,
}));

// RBAC 用户相关路由
app.use('/api/rbac/users', ...withPermission(rbacUsersRouter, {
  read: Permission.RBAC_USERS_VIEW,
  write: Permission.RBAC_USERS_EDIT,
}));

// RBAC 权限相关路由
app.use('/api/rbac/permissions', ...withPermission(rbacPermissionsRouter, {
  read: Permission.RBAC_PERMISSIONS_VIEW,
  write: Permission.RBAC_PERMISSIONS_EDIT,
}));

// 接口分类相关路由
app.use('/api/api-management/categories', ...withPermission(apiCategoriesRouter, {
  read: Permission.API_CATEGORY_VIEW,
  write: Permission.API_CATEGORY_EDIT,
}));

// API 条目相关路由（/execute 视为只读操作）
app.use('/api/api-management/items', ...withPermission(apiManagementRouter, {
  read: Permission.API_MANAGEMENT_VIEW,
  write: Permission.API_MANAGEMENT_EDIT,
  readPaths: ['/execute'],
}));

// 节日祝福语管理
app.use('/api/greetings', ...withPermission(greetingsRouter, {
  read: Permission.GREETINGS_VIEW,
  write: Permission.GREETINGS_EDIT,
}));

// 提醒寄语库管理
app.use('/api/reminder-quotes', ...withPermission(reminderQuotesRouter, {
  read: Permission.REMINDER_QUOTES_VIEW,
  write: Permission.REMINDER_QUOTES_EDIT,
}));

// 技能地图（GET 列表只需 VIEW；POST 执行在路由内部额外校验 SKILL_MAP_EDIT）
app.use('/api/skill-map', ...withPermission(skillMapRouter, {
  read: Permission.SKILL_MAP_VIEW,
  write: Permission.SKILL_MAP_VIEW,
}));

// AI 智能助手对话路由
// /send 是流式接口（POST，但视为读：只产生对话不修改业务数据）；/conversations 增删读统一按 view 鉴权
// 外部渠道入口必须注册在带权限的 aiChatRouter 之前：它没有登录态，靠令牌自证
app.use('/api/ai-chat', aiWebhookRouter);
app.use('/api/ai-chat', ...withPermission(aiChatRouter, {
  read: Permission.AI_CHAT_VIEW,
  write: Permission.AI_CHAT_VIEW,
  readPaths: ['/send', '/conversations'],
}));

// 知识库管理：文档维护与索引重建按 edit 权限；检索测试只是读操作，按 view 放行
app.use('/api/knowledge', ...withPermission(knowledgeRouter, {
  read: Permission.KNOWLEDGE_BASE_VIEW,
  write: Permission.KNOWLEDGE_BASE_EDIT,
  readPaths: ['/search'],
}));

// 数据库管理：页面与 API 均限超级管理员（可执行任意 SQL、初始化会重建全表）
// /query 是只读 SQL 查询，按 view 权限放行；/execute 与 /init 按 edit 权限校验
app.use('/api/database', requireSuperAdmin, ...withPermission(databaseRouter, {
  read: Permission.DATABASE_VIEW,
  write: Permission.DATABASE_EDIT,
  readPaths: ['/query'],
}));

// 高德静态地图代理（给贾维斯 / 前端出图；Key 只留在服务端）
app.use('/api/amap-static-map', ...withPermission(amapRouter, {
  read: Permission.AI_CHAT_VIEW,
  write: Permission.AI_CHAT_VIEW,
}));

// =================================================
// 前端路由（SPA fallback / 开发模式代理）
// =================================================

// 未匹配的 /api/* 请求统一返回 JSON 404，避免被 SPA fallback 吞成 index.html
// 触发场景：路径不存在、方法不匹配（如 GET /api/auth/verify-token，实际只接受 POST）
app.use('/api', (req, res) => {
  return returnResponse(
    res,
    ErrorCode.NOT_FOUND,
    {},
    `接口不存在或方法不允许：${req.method} ${req.originalUrl}`,
  );
});

if (DEV_MODE) {
  // 开发模式：将所有非 API 请求代理到 Vite dev server（支持 HMR）
  app.use('*', (req, res) => {
    const options: http.RequestOptions = {
      hostname: 'localhost',
      port: Number(VITE_PORT),
      path: req.originalUrl,
      method: req.method,
      headers: req.headers,
    };
    const proxy = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode ?? 200, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });
    proxy.on('error', () => {
      res.status(502).send('Vite dev server 未启动，请先运行：cd web/frontend && npm run dev');
      console.error('Vite dev server 未启动，请先运行：cd web/frontend && npm run dev');
    });
    req.pipe(proxy, { end: true });
  });
} else {
  // 生产模式：所有非 API 的 GET 请求返回 SPA index.html，由前端路由接管
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// =================================================
// 启动服务
// =================================================

app.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  // 启动时清理过期的 AI Trace 按月文件（只保留最近 N 个月，失败不影响启动）
  const removed = pruneTraceFiles();
  if (removed.length > 0) {
    console.log(`🧹 已清理过期 AI Trace 文件：${removed.join('、')}`);
  }
  // 启动 AI 定时巡检调度器（AI_INSPECTOR_ENABLED=true 时生效）
  startInspectionScheduler();
  console.log('✅ Helper Web 管理界面已启动');
  console.log(`🌐 访问地址: http://${localIp}:${PORT}  (可通过服务器 IP 访问)`);
  console.log(`📁 项目目录: ${PROJECT_DIR}`);
  if (DEV_MODE) {
    console.log(`🔥 开发模式：前端请求代理到 Vite dev server (http://${localIp}:${VITE_PORT})`);
    console.log('   请同时运行：cd web/frontend && npm run dev');
  }
});
