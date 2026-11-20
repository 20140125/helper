# 3. Service 层与 Type 层规范

---

## Service 层

**职责**：封装所有 HTTP 请求，对应后端 API。继承 `BaseService` 使用 `this.get`/`this.post`/`this.put`/`this.del`——统一错误处理和请求配置。

**规则**：
- 方法用箭头函数属性 + JSDoc
- 命名：`fetchXxx`(GET)、`createXxx`(POST)、`updateXxx`(PUT)、`deleteXxx`(DELETE)
- 提供 `createXxxService` 工厂函数 + 默认导出

### 标准模板

```typescript
import type { ExampleItem, ExampleListResponse, ExampleResponse } from '@/types/example';
import { BaseService } from './base-service';

/** 示例资源 Service */
export class ExampleService extends BaseService {
  /** 获取列表 */
  fetchList = async (): Promise<ExampleListResponse> => {
    return this.get<ExampleListResponse>('/example');
  };

  /** 创建条目 */
  createItem = async (payload: Partial<ExampleItem>): Promise<ExampleResponse> => {
    return this.post<ExampleResponse>('/example', payload);
  };

  /** 更新条目 */
  updateItem = async (id: string, payload: Partial<ExampleItem>): Promise<ExampleResponse> => {
    return this.put<ExampleResponse>(`/example/${id}`, payload);
  };

  /** 删除条目 */
  deleteItem = async (id: string): Promise<ExampleResponse> => {
    return this.del<ExampleResponse>(`/example/${id}`);
  };
}

export const createExampleService = (): ExampleService => new ExampleService();
export default createExampleService();
```

### 额外配置

```typescript
// 自定义 timeout
fetchWithTimeout = async (): Promise<DataResponse> => {
  return this.get<DataResponse>('/slow-endpoint', { timeout: 60000 });
};

// 查询参数
fetchLogContent = async (key: string, lines = 200): Promise<LogContentResponse> => {
  return this.get<LogContentResponse>(`/logs/${key}`, { params: { lines } });
};
```

**嵌套 data 解包**：axios 拦截器已解包一层 `{ code, data, message }`，若 data 还有嵌套则手动解包：

```typescript
fetchConfig = async (): Promise<TemplateConfig> => {
  const response = await this.get<{ code: number; data: TemplateConfig; message: string }>('/templates');
  return response.data;
};
```

---

## Type 层

**职责**：TypeScript 类型定义，作为前后端接口契约。

| 规则 | 原因 |
|------|------|
| 优先 `interface`，联合类型等场景才用 `type` | interface 可扩展合并，IDE 提示更友好 |
| 断言用 `as`，不用 `<Type>` | 与 JSX 兼容 |
| 基本类型依赖推断 | 减少噪音 |
| 响应类型含 `code: number` | 与后端 `returnResponse` 格式对齐 |

```typescript
export interface ExampleItem {
  id: string;
  name: string;
  enabled: boolean;
  created_at: string;
}

export interface ExampleListResponse {
  code: number;
  data: { items: ExampleItem[]; total: number };
  message: string;
}

export interface ExampleResponse {
  code: number;
  data: { item?: ExampleItem };
  message: string;
}
```
