# 1. 分层架构与新增流程

---

## 架构总览

```
前端
├── views/          ← 只写模板，调用 model
├── models/         ← 页面全部业务逻辑（ref、computed、事件、定时器）
├── stores/         ← 跨页面共享的全局状态（Pinia）
├── services/       ← HTTP 请求封装，对应后端 API
├── types/          ← TypeScript 类型定义
├── components/     ← 可复用 UI 组件
├── router/         ← 路由配置
├── constants/      ← 常量定义
└── utils/          ← 纯工具函数（无副作用）

后端
├── routes/         ← Express 路由（参数解析 + 响应）
│   └── utils.ts    ← 统一重导出入口（barrel file）
├── utils/          ← 业务逻辑实现（按功能拆分子模块）
└── types/          ← TypeScript 类型定义
```

每一层只做自己该做的事，不越层调用——这样改动影响范围可控。

---

## 新增前端页面流程

按顺序创建：`types/ → services/ → models/ → views/ → router/`（可选 `stores/`，仅跨页面共享时）

新增页面还要同步 `hp_nav_items`（或经 `/navigation-admin` 管理页维护）：路由名、路径、中文名、i18n key、分组、菜单显隐、图标、排序、权限码。侧边栏菜单与贾维斯 `query_pages` 都读这张表，只在 `router meta` 里写 `inMenu` 不会让页面出现在菜单中；接口不可用时 `home-model.ts` 才回退到路由派生。

---

## 新增后端路由流程

1. `web/types/example.ts` 定义类型
2. `web/utils/example.ts` 实现业务逻辑
3. `web/routes/example.ts` 创建路由
4. `web/server.ts` 注册

```typescript
import exampleRouter from './routes/example';
app.use('/api/example', exampleRouter);
```

> JWT 鉴权已全局注册，自动拦截 `/api/*`，跳过 `/api/auth/*`。新增路由无需添加 `verifyToken`。

---

## 最小骨架

### Model（`frontend/src/models/<模块>-model.ts`）

```typescript
import { ref, computed, onMounted, onBeforeUnmount, type Ref } from 'vue';
import { BaseModel } from '@/models/base-model';
import { ExampleService } from '@/services/example-service';
import type { ExampleItem } from '@/types/example';

export class ExampleModel extends BaseModel {
  exampleService = new ExampleService();
  list: Ref<ExampleItem[]> = ref([]);
  get enabledCount() { return this.list.value.filter(i => i.enabled).length; }

  loadList = async () => {
    this.pageLoading.value = true;
    try {
      const res = await this.exampleService.fetchList();
      this.list.value = res.data.items;
    } finally { this.pageLoading.value = false; }
  };
  mounted = () => { this.loadList(); };
  beforeUnmount = () => {};
}

export const useExampleModel = () => {
  const m = new ExampleModel();
  onMounted(() => m.mounted());
  onBeforeUnmount(() => m.beforeUnmount());
  return {
    pageLoading: m.pageLoading,
    list: m.list,
    enabledCount: computed(() => m.enabledCount),
    loadList: m.loadList,
  };
};
```

### Service（`frontend/src/services/<模块>-service.ts`）

```typescript
import { BaseService } from './base-service';
import type { ExampleListResponse } from '@/types/example';

export class ExampleService extends BaseService {
  fetchList = async () => this.get<ExampleListResponse>('/example');
}

export const createExampleService = () => new ExampleService();
export default createExampleService();
```

### 后端路由（`web/routes/<模块>.ts`）

```typescript
import { Router } from 'express';
import { returnResponse, ErrorCode, listExamples } from './utils';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    return returnResponse(res, ErrorCode.SUCCESS, { items: await listExamples() });
  } catch (err) {
    return returnResponse(res, ErrorCode.INTERNAL_ERROR, null, (err as Error).message);
  }
});

export default router;
```
