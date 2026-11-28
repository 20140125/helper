<template>
  <card-panel :title="t.rbac.roleList" icon="user-setting">
    <template #title-extra>
      <span class="text-xs" style="color: var(--text-muted);">{{ t.rbac.roleCount(roles.length) }}</span>
    </template>
    <div v-if="roles.length === 0" class="flex flex-col items-center py-12" style="color: var(--text-muted);">
      <t-icon name="user-setting" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
      <p class="text-sm">{{ t.rbac.noRoles }}</p>
    </div>
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <role-card
        v-for="role in roles"
        :key="role.id"
        :t="t"
        :role="role"
        :is-super-admin="isSuperAdmin"
        :can-edit="canEdit"
        :permission-metas="permissionMetas"
        :total-permissions="allPermissions.length"
        @edit="$emit('editRole', role)"
        @delete="$emit('deleteRole', role)"
      />
    </div>
  </card-panel>
</template>

<script setup lang="ts">
import CardPanel from '@/components/common/card-panel.vue';
import RoleCard from '@/components/rbac/role-card.vue';
import type { Locale } from '@/types/locale';
import type { RoleConfig, PermissionMeta } from '@/types/rbac';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 角色列表 */
  roles: RoleConfig[];
  /** 当前用户是否为超管 */
  isSuperAdmin: boolean;
  /** 是否允许编辑 */
  canEdit: boolean;
  /** 权限元数据列表（用于角色卡片展示权限名） */
  permissionMetas: PermissionMeta[];
  /** 全量权限标识列表（用于计算覆盖率） */
  allPermissions: string[];
}>();

defineEmits<{
  /** 编辑角色，参数为角色配置 */
  (e: 'editRole', role: RoleConfig): void;
  /** 删除角色，参数为角色配置 */
  (e: 'deleteRole', role: RoleConfig): void;
}>();
</script>
