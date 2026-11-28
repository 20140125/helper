---
name: rbac-manage
description: 角色与用户授权的增删改（分配/收回角色、建角色、改角色权限）与权限码纪律；用户说「给他加个角色」「把这个角色的权限改一下」时加载
effect: mutation
permissions:
  - rbac:roles:edit
  - rbac:users:edit
tools:
  - manage_rbac
  - query_rbac
---

# 角色与用户授权

## 什么时候用

用户要**改动**角色或授权（分配 / 收回角色、新建角色、调整角色权限）。只是看有哪些角色 / 用户是什么角色 →
`query_rbac`，不必加载本技能。

## 操作与参数

`manage_rbac` 的 `action`：

| action | 用途 | 必填 |
|--------|------|------|
| `assign_role` | 给用户分配（或修改）角色 | 目标用户与 `role_id` |
| `revoke_role` | 收回用户的角色 | 目标用户与 `role_id` |
| `create_role` | 新建角色 | 角色名与权限码 |
| `update_role_permissions` | 调整某角色的权限码 | `role_id` + 权限码列表 |

## 纪律（不遵守就会报错或酿成事故）

- 【权限码不能编造】`role_id` 与权限码必须真实存在：不确定先 `query_rbac` 查清单（权限码清单 / 角色清单）
- 【内置角色不可删除】只能改权限，不能删
- 【影响面要先说】改角色权限会影响该角色下**所有人**，动手前先说明影响范围
- 【审批】严格模式下本类操作不当场执行，系统自动建审批单；只回 `approval_id` 并说明需超级管理员在
  「AI 审批」页通过，不要反复重试
- 【反馈】操作完成后回显改了什么（哪个用户 / 哪个角色 / 加了哪些权限），不要只说"已修改"

## 相关但不在这里

- 用户主动申请的权限记录 → `query_permission_requests`（只读，审批在「权限申请」页由管理员操作）
- 绕过 `manage_rbac` 直接改数据库 `hp_roles` / `hp_users` → 禁止（它带权限码校验）
