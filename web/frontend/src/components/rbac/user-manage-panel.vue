<template>
  <card-panel :title="t.rbac.userList" icon="user">
    <template #title-extra>
      <span class="text-xs" style="color: var(--text-muted);">{{ t.rbac.userCount(users.length) }}</span>
    </template>
    <div v-if="users.length === 0" class="flex flex-col items-center py-12" style="color: var(--text-muted);">
      <t-icon name="user" size="40px" style="opacity: 0.3; margin-bottom: 12px;" />
      <p class="text-sm">{{ t.rbac.noUsers }}</p>
    </div>
    <div v-else class="space-y-3">
      <div
        v-for="user in users"
        :key="user.email"
        class="flex items-center justify-between p-3 rounded-lg"
        style="background: var(--bg-secondary);"
      >
        <div class="flex items-center gap-3">
          <div class="flex items-center justify-center w-8 h-8 rounded-full text-white" style="background: var(--accent-primary); font-size: 12px;">
            {{ user.email.charAt(0).toUpperCase() }}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-medium" style="color: var(--text-primary);">{{ user.email }}</span>
              <t-tag v-if="user.isSuperAdmin" size="small" theme="warning" variant="light">{{ t.rbac.tagSuperAdmin }}</t-tag>
            </div>
            <div class="flex items-center gap-3 mt-1 text-xs" style="color: var(--text-muted);">
              <span>{{ t.rbac.userRole(getRoleName(user.roleId)) }}</span>
              <span>{{ t.rbac.userLastLogin(user.lastLoginAt) }}</span>
            </div>
          </div>
        </div>
        <t-tooltip :content="t.rbac.editUserRole">
          <t-button
            v-if="isSuperAdmin && canEdit && !user.isSuperAdmin"
            variant="outline"
            size="small"
            shape="square"
            @click="$emit('editUserRole', user)"
          >
            <template #icon><t-icon name="edit" /></template>
          </t-button>
        </t-tooltip>
      </div>
    </div>
  </card-panel>
</template>

<script setup lang="ts">
import CardPanel from '@/components/common/card-panel.vue';
import type { UserInfo } from '@/types/rbac';
import type { Locale } from '@/locales/zh';

defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 用户列表 */
  users: UserInfo[];
  /** 当前用户是否为超管 */
  isSuperAdmin: boolean;
  /** 是否允许编辑 */
  canEdit: boolean;
  /** 通过 roleId 取角色显示名 */
  getRoleName: (roleId: string) => string;
}>();

defineEmits<{
  /** 编辑用户角色，参数为目标用户 */
  (e: 'editUserRole', user: UserInfo): void;
}>();
</script>
