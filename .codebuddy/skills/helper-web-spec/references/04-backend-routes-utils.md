# 4. 后端规范（路由 / 工具函数 / 类型）

---

## 路由文件

**职责**：参数解析、校验、调用工具函数、返回响应。业务逻辑放 `utils/`，路由保持薄——便于测试且职责清晰。

```typescript
import { Router } from 'express';
import type { Request, Response } from 'express';
import { returnResponse, ErrorCode, attachUserInfo, requirePermission, Permission, readItems, writeItems } from './utils';
import type { CreateItemBody } from '../types/example';

const router = Router();

/** @route GET / */
router.get('/', attachUserInfo, requirePermission(Permission.DASHBOARD_VIEW), (_req, res) => {
  return returnResponse(res, ErrorCode.SUCCESS, { items: readItems() }, '');
});

/** @route POST / */
router.post('/', attachUserInfo, requirePermission(Permission.DASHBOARD_VIEW), (req, res) => {
  const { name } = req.body as CreateItemBody;
  if (!name) return returnResponse(res, ErrorCode.BAD_REQUEST, {}, '缺少必填字段：name');
  // 业务逻辑...
  return returnResponse(res, ErrorCode.SUCCESS, {}, '创建成功');
});

export default router;
```

**鉴权两种模式**（选其一）：

| 模式 | 用法 | 适用场景 |
|------|------|---------|
| `withPermission`（推荐） | `server.ts` 注册时 `app.use('/api/xxx', ...withPermission(router, { read, write }))` | 路由内全部接口都需要鉴权 |
| `requirePermission`（路由内） | 每个 handler 单独加 `attachUserInfo, requirePermission(...)` | 混合型：部分接口公开，部分需鉴权（如 `permission-apply`） |

不要再加 `verifyToken`——JWT 已全局注册，重复鉴权无意义。当前用户 email 用 `req.userEmail`（由 `attachUserInfo` 注入）。

每个接口加 `/** @route METHOD /path */` 注释，响应统一 `returnResponse(res, ErrorCode.xxx, data, msg)`。

---

## 工具函数（barrel 重导出）

`routes/utils.ts` 聚合所有工具函数，路由文件统一从 `./utils` 导入——集中管理依赖，重构时只改一处。

```typescript
// ✅
import { returnResponse, ErrorCode, readRules } from './utils';
// ❌ 绕过 barrel 会导致依赖分散
import { readRules } from '../utils/storage';
```

新增模块：`utils/` 创建实现 → `routes/utils.ts` 添加重导出。

---

## 后端 utils 子目录组织

`utils/<模块>.ts` 超过 200 行或有多个独立职责时拆为子目录：

```
web/utils/
├── rbac/                    # 303行→拆分
│   ├── index.ts             # barrel 重导出
│   ├── permission-meta.ts
│   ├── config.ts
│   ├── user-role.ts
│   ├── validation.ts
│   └── middleware.ts
├── templates/               # 665行→拆分
│   ├── index.ts
│   ├── core.ts
│   ├── helpers.ts
│   ├── holiday-parser.ts
│   └── placeholder-builder.ts
└── response.ts              # 单职责小文件，保持单文件
```

**规则**：
- 目录下有 `index.ts` barrel 重导出外部符号
- `routes/utils.ts` 的 import 路径不变（`from '../utils/rbac'` 自动解析 `rbac/index.ts`）
- 目录内每个文件 < 200 行

---

## 类型定义

放 `web/types/`，请求体类型以 `Body` 结尾（`CreateRuleBody`）。纯类型，不含运行时逻辑。

**utils 文件只放函数**——interface/type 定义放 `types/`，大写常量放对应模块的 `constants/`（如有）。
utils 里出现 `export interface` 或 `export type Xxx` 属于违规，迁移时源文件可保留 re-export 保持向后兼容。
