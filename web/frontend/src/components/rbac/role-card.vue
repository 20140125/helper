<template>
  <card-panel :title="role.name" icon="user-setting" :icon-theme="role.builtin ? 'amber' : 'primary'">
    <template #title-extra>
      <t-tag v-if="role.builtin" size="small" theme="warning" variant="light">{{ t.rbac.tagBuiltin }}</t-tag>
      <t-tag v-else size="small" theme="primary" variant="light">{{ t.rbac.tagCustom }}</t-tag>
    </template>

    <template v-if="isSuperAdmin && canEdit && role.id !== 'super_admin'" #actions>
      <t-button variant="text" shape="square" size="small" @click="$emit('edit')">
        <template #icon><t-icon name="edit" /></template>
      </t-button>
      <t-popconfirm
        v-if="!role.builtin"
        :content="t.rbac.deleteRoleConfirm"
        @confirm="$emit('delete')"
      >
        <t-button variant="text" shape="square" size="small" theme="danger">
          <template #icon><t-icon name="delete" /></template>
        </t-button>
      </t-popconfirm>
    </template>

    <div class="space-y-3">
      <!-- 描述 -->
      <p class="text-xs" style="color: var(--text-muted);">{{ role.description || t.rbac.noDescription }}</p>

      <!-- 权限统计 -->
      <div class="flex items-center gap-2">
        <div class="flex-1 h-1.5 rounded-full overflow-hidden" style="background: var(--bg-secondary);">
          <div
            class="h-full rounded-full transition-all duration-300"
            :style="{ width: permissionPercent + '%', background: progressColor }"
          />
        </div>
        <span class="text-xs font-medium flex-shrink-0" style="color: var(--text-muted);">
          {{ role.permissions.length }} / {{ totalPermissions }}
        </span>
      </div>

      <!-- 权限标签 -->
      <div>
        <div class="text-xs font-medium mb-2" style="color: var(--text-primary);">
          {{ t.rbac.permissionList }}
        </div>
        <div class="flex flex-wrap gap-1">
          <t-tag
            v-for="perm in displayPermissions"
            :key="perm"
            size="small"
            variant="light"
            theme="primary"
          >
            {{ getPermissionLabel(perm) }}
          </t-tag>
          <t-tag
            v-if="role.permissions.length > maxDisplayCount"
            size="small"
            variant="outline"
            style="color: var(--text-muted);"
          >
            +{{ role.permissions.length - maxDisplayCount }}
          </t-tag>
        </div>
      </div>

      <!-- 操作按钮区域 -->
      <div v-if="isSuperAdmin && canEdit && role.id !== 'super_admin'" class="pt-2" style="border-top: 1px solid var(--border-color);">
        <t-button variant="outline" size="small" block @click="$emit('edit')">
          <template #icon><t-icon name="edit" /></template>
          {{ t.rbac.editUserRole }}
        </t-button>
      </div>

      <!-- 超级管理员角色提示 -->
      <div v-else-if="role.id === 'super_admin'" class="pt-2" style="border-top: 1px solid var(--border-color);">
        <div class="flex items-center gap-1 text-xs" style="color: var(--text-muted);">
          <t-icon name="lock-on" size="14px" />
          <span>{{ t.rbac.superAdminLocked }}</span>
        </div>
      </div>

      <!-- 更新时间 -->
      <div class="text-xs" style="color: var(--text-muted);">
        {{ t.rbac.updatedAt(role.updated_at) }}
      </div>
    </div>
  </card-panel>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import CardPanel from '@/components/common/card-panel.vue';
import type { Locale } from '@/locales/zh';
import type { RoleConfig, PermissionMeta } from '@/types/rbac';

const props = defineProps<{
  /** i18n 翻译函数（由父组件通过 LocaleStore.t 传入，响应式） */
  t: Locale;
  /** 角色配置 */
  role: RoleConfig;
  /** 当前用户是否为超管 */
  isSuperAdmin: boolean;
  /** 是否允许编辑 */
  canEdit: boolean;
  /** 权限元数据列表（用于将权限码翻译为显示名） */
  permissionMetas: PermissionMeta[];
  /** 全量权限数量（用于计算占比与进度条） */
  totalPermissions: number;
}>();

defineEmits<{
  /** 编辑当前角色 */
  (e: 'edit'): void;
  /** 删除当前角色 */
  (e: 'delete'): void;
}>();

const maxDisplayCount = 8;

const displayPermissions = computed(() =>
  props.role.permissions.slice(0, maxDisplayCount),
);

/** 权限占比百分比 */
const permissionPercent = computed(() => {
  if (props.totalPermissions === 0) return 0;
  return Math.round((props.role.permissions.length / props.totalPermissions) * 100);
});

/** 进度条颜色：全部权限绿色，部分蓝色，无权限灰色 */
const progressColor = computed(() => {
  const percent = permissionPercent.value;
  if (percent === 100) return 'var(--accent-green, #22c55e)';
  if (percent > 50) return 'var(--accent-primary, #3b82f6)';
  if (percent > 0) return 'var(--accent-amber, #f59e0b)';
  return 'var(--text-muted)';
});

const getPermissionLabel = (code: string): string => {
  return props.permissionMetas.find((m) => m.code === code)?.label ?? code;
};
</script>
