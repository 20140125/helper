# 7. 新建页面·数据配置清单（`.cache/*.json` 同步）

新建页面时最隐蔽的坑，不在代码里，而在运行时数据里。

`web/` 的几个管理页（权限管理、角色管理、接口管理）并不是扫描代码生成数据的，而是**从 `.cache/*.json` 现读现渲染**。这意味着：你在 `types/permission.ts` 里加了枚举、在 `routes/xxx.ts` 里加了路由，**服务重启后新页面能打开、接口能调通**——但权限管理页看不到新权限、管理员菜单不出现入口、接口管理页查不到这条 API。用户以为功能没做完，其实只是 JSON 没补。

所以，**凡是新增 Permission 枚举或新增后端 API，都要走一遍这 4 个 JSON**：

| # | 文件 | 触发条件 | 漏改后果 |
|---|------|----------|----------|
| 1 | `.cache/permission_metas.json` | 每个新 Permission 枚举 | 权限管理页看不到新权限，无法分配 |
| 2 | `.cache/rbac.json` | 每个新 Permission 枚举 | `admin` / `viewer` 菜单缺入口（`super_admin` 有代码自愈兜底，但仍建议写入） |
| 3 | `.cache/api_categories.json` | 新模块没有合适分类时 | 接口管理页分类缺失；能复用就复用，不要为 1 条 API 单开 |
| 4 | `.cache/api_items.json` | **每条**新后端路由 | 接口管理页查不到，无法代理调用/调试 |

改动顺序就是上表从 1 到 4。

> ⚠️ **改完 `rbac.json` 必须退出并重新登录才能看到新菜单**：前端菜单是 `router.getRoutes()` 按 `route.meta.permissions` 过滤得到的（见 [home-model.ts](/projects/helper/web/frontend/src/models/home-model.ts) `allMenuItems` / `menuItems`），而 `permissionStore.permissions` 是**登录时一次性**从后端拉取的。你改了 `rbac.json` 但当前浏览器会话里的 permissions 数组还是旧的，新菜单会被过滤掉——表现就是"权限都配了，页面也开发完了，但左侧菜单还是没有入口"。

---

## 7.1 字段与规范（一张表看完）

| 文件 | 关键字段 | 规范 / 取值 |
|------|----------|-------------|
| `permission_metas.json` | `code` | 与 `web/types/permission.ts` 的枚举值完全一致，形如 `<模块>:<动作>` |
| | `group_id` / `group_name` | 同 `group_id` 下的权限在 UI 上聚合为权限组；`group_id` 用短横线模块名 |
| | `label` / `description` | UI 直接展示，写给最终用户看 |
| | `type` | 仅 `"view"` 或 `"edit"` |
| | `route` | **仅** `type: "view"` 且是页面入口时填；非页面权限（如 `upload:edit`）不写 |
| `rbac.json` | `roles[].permissions` | `admin` = view+edit；`viewer` = 仅 view；`super_admin` 建议也写全 |
| `api_categories.json` | `id` | `cat_<模块>`，下划线小写 |
| | `name` / `description` | 中文友好名，接口管理页左侧分类列直接显示 |
| `api_items.json` | `id` | `api_<模块>_<动作>`，如 `api_skill_map_run` |
| | `category_id` | 必须是 `api_categories.json` 里已存在的 `id` |
| | `method` | 大写，`GET` / `POST` / `PUT` / `DELETE` / `PATCH` 之一 |
| | `path` | 与 `routes/<模块>.ts` 里 `router.<method>('<path>')` **完全一致**，含 `:id` / `:key` 占位符 |
| | `enabled` | `true` 才会生效 |

> 三条通用字段：`created_at` / `updated_at` 用 `YYYY-MM-DD HH:MM:SS`，新条目两者相同即可。

完整示例可直接在各 JSON 里搜已有条目对照，不必在本文里重复。

---

## 7.2 一键补全脚本（推荐方式）

**为什么不用编辑工具直接改 JSON**：`.cache/` 下的文件被运行中的 web 服务实时读写（用户改权限、调接口都会触发后端持久化）。你读完到写回之间，文件可能已被后端改动，`replace_in_file` 经常在这里失败。采用"写临时文件 → `os.replace` 原子切换 inode"的方式可以规避竞争，已在 `rbac.json` 高频改写场景下验证可靠。

把下面的脚本另存或直接执行，**只需改顶部 `MOD` / `CAT_NAME` / `ROUTES` 三项**，就能同步 4 张表：

```bash
python3 <<'PY'
import json, os, time

# ===== 按新模块改这 3 项 =====
MOD         = 'skill-map'                 # Permission 前缀，短横线
CAT_NAME    = '技能地图'                   # 接口分类中文名
ROUTES      = [                            # (method, path, 动作中文, 描述)
    ('GET',  '/api/skill-map',      '列表',  '获取技能脚本列表'),
    ('POST', '/api/skill-map/:key', '执行',  '执行指定技能脚本'),
]
PERMS       = [                            # (动作, type, label, description, route_or_None)
    ('view', 'view', f'查看{CAT_NAME}', f'查看{CAT_NAME}页面', f'/{MOD}'),
    ('edit', 'edit', f'操作{CAT_NAME}', f'在{CAT_NAME}页面执行操作', None),
]
# ============================

BASE = '/projects/helper/.cache'
NOW  = time.strftime('%Y-%m-%d %H:%M:%S')
CAT_ID = f'cat_{MOD.replace("-", "_")}'

def atomic_write(path, data):
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

# 1) permission_metas.json
p = f'{BASE}/permission_metas.json'
metas = json.load(open(p, encoding='utf-8'))
existing_codes = {m['code'] for m in metas}
for action, typ, label, desc, route in PERMS:
    code = f'{MOD}:{action}'
    if code in existing_codes: continue
    item = {'code': code, 'group_id': MOD, 'group_name': CAT_NAME,
            'label': label, 'description': desc, 'type': typ}
    if route: item['route'] = route
    metas.append(item)
atomic_write(p, metas)

# 2) rbac.json
p = f'{BASE}/rbac.json'
rbac = json.load(open(p, encoding='utf-8'))
grant = {'super_admin': ['view','edit'], 'admin': ['view','edit'], 'viewer': ['view']}
for r in rbac['roles']:
    for a in grant.get(r['id'], []):
        c = f'{MOD}:{a}'
        if c not in r['permissions']: r['permissions'].append(c)
atomic_write(p, rbac)

# 3) api_categories.json
p = f'{BASE}/api_categories.json'
cats = json.load(open(p, encoding='utf-8'))
if not any(c['id'] == CAT_ID for c in cats):
    cats.append({'id': CAT_ID, 'name': CAT_NAME,
                 'description': f'{CAT_NAME}相关接口',
                 'created_at': NOW, 'updated_at': NOW})
    atomic_write(p, cats)

# 4) api_items.json
p = f'{BASE}/api_items.json'
items = json.load(open(p, encoding='utf-8'))
existing_ids = {i['id'] for i in items}
for method, path, act, desc in ROUTES:
    aid = f'api_{MOD.replace("-", "_")}_{act}'
    # act 是中文时请改成英文 key；这里仅为占位示意
    if aid in existing_ids: continue
    items.append({'id': aid, 'category_id': CAT_ID, 'name': f'{act}接口',
                  'method': method, 'path': path, 'description': desc,
                  'enabled': True, 'created_at': NOW, 'updated_at': NOW})
atomic_write(p, items)

print('done')
PY
```

> `api_items` 的 `id` 建议用英文单词而非中文动作（脚本里是占位示意），例如 `list` / `run` / `delete`。

---

## 7.3 完成自检（粘贴即跑）

写完代码、补完 JSON 后执行，4 项都应**至少 1 行输出**；任何一项为空就是漏了：

```bash
MOD='skill-map'; CAT="cat_${MOD//-/_}"
echo '--- permission_metas ---'; grep -E "\"${MOD}:(view|edit)\"" /projects/helper/.cache/permission_metas.json
echo '--- rbac roles       ---'; grep -E "\"${MOD}:"              /projects/helper/.cache/rbac.json
echo '--- api_categories   ---'; grep    "\"id\": \"${CAT}\""     /projects/helper/.cache/api_categories.json
echo '--- api_items        ---'; grep    "\"category_id\": \"${CAT}\"" /projects/helper/.cache/api_items.json
```

---

## 7.4 与"代码层"的边界

本清单只管 `.cache/` 数据层。新建页面的**代码层**同步项（`types/` / `services/` / `models/` / `views/` / `constants/` / `locales/` / `router/`；后端的 `routes/utils.ts` barrel + `server.ts` 注册）见 `01-architecture-overview.md`《新增页面完整流程》与 `06-common-pitfalls-checklist.md`《i18n / 常量 / 拆分》。两者都做完，页面才真正"接入完成"。
