<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.navigationAdmin.pageTitle"
    :subtitle="t.navigationAdmin.subtitle"
    :disable-anchor="true"
  >
    <template #actions>
      <t-button variant="outline" size="large" :loading="pageLoading" @click="load">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.common.refresh }}
      </t-button>
      <t-button v-if="canEditNav()" theme="primary" size="large" @click="openCreate('item')">
        <template #icon><t-icon name="add" /></template>
        {{ t.common.add }}
      </t-button>
    </template>

    <card-panel :title="t.navigationAdmin.groupsTitle" icon="menu" icon-theme="primary">
      <template #title-extra>
        <t-button v-if="canEditNav()" variant="text" theme="primary" size="small" @click="openCreate('group')">
          {{ t.common.add }}
        </t-button>
      </template>
      <div class="navigation-admin-table">
        <t-table
          :data="groups"
          :columns="groupColumns"
          row-key="groupKey"
          hover
          stripe
          size="medium"
          style="min-width: 820px;"
        >
        <template #enabled="{ row }">
          <t-tag :theme="row.enabled ? 'success' : 'default'" variant="light" size="small">
            {{ row.enabled ? '✓' : '—' }}
          </t-tag>
        </template>
        <template #actions="{ row }">
          <t-button
            v-if="canEditNav()"
            variant="text"
            size="small"
            @click="openEdit('group', row)"
          >
            {{ t.common.edit }}
          </t-button>
          <t-popconfirm :content="t.navigationAdmin.deleteConfirm" @confirm="remove('group', row)">
            <t-button v-if="canEditNav()" variant="text" theme="danger" size="small">
              {{ t.common.delete }}
            </t-button>
          </t-popconfirm>
        </template>
        </t-table>
      </div>
    </card-panel>

    <card-panel :title="t.navigationAdmin.itemsTitle" icon="app" icon-theme="secondary" class="navigation-admin-panel">
      <div class="navigation-admin-table">
        <t-table
          :data="items"
          :columns="itemColumns"
          row-key="routeName"
          hover
          stripe
          size="medium"
          style="min-width: 1220px;"
        >
        <template #label="{ row }">
          <span>{{ row.labelZh || row.labelKey }}</span>
        </template>
        <template #inMenu="{ row }">
          <t-tag :theme="row.inMenu ? 'success' : 'default'" variant="light" size="small">
            {{ row.inMenu ? '✓' : '—' }}
          </t-tag>
        </template>
        <template #enabled="{ row }">
          <t-tag :theme="row.enabled ? 'success' : 'default'" variant="light" size="small">
            {{ row.enabled ? '✓' : '—' }}
          </t-tag>
        </template>
        <template #actions="{ row }">
          <t-button
            v-if="canEditNav()"
            variant="text"
            size="small"
            @click="openEdit('item', row)"
          >
            {{ t.common.edit }}
          </t-button>
          <t-popconfirm :content="t.navigationAdmin.deleteConfirm" @confirm="remove('item', row)">
            <t-button v-if="canEditNav()" variant="text" theme="danger" size="small">
              {{ t.common.delete }}
            </t-button>
          </t-popconfirm>
        </template>
        </t-table>
      </div>
    </card-panel>

    <t-alert theme="info" :message="t.navigationAdmin.aiHint" class="navigation-admin-hint">
      <template #operation>
        <t-button variant="text" theme="primary" size="small" @click="goI18n">
          {{ t.navigationAdmin.aiLink }}
        </t-button>
      </template>
    </t-alert>

    <form-drawer
      v-model="drawerVisible"
      :t="t"
      :header="drawerHeader"
      :mode="formMode"
      :loading="saving"
      :readonly="!canEditNav()"
      @confirm="submit"
    >
      <auto-form v-model="formData" :fields="fields" label-align="top" />
    </form-drawer>
  </page-layout>
</template>

<script setup lang="ts">
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import FormDrawer from '@/components/common/form-drawer.vue';
import AutoForm from '@/components/auto-form/index.vue';
import { useNavigationAdminModel } from '@/models/navigation-admin-model';

const {
  t, pageLoading, groups, items, groupColumns, itemColumns,
  drawerVisible, drawerHeader, formMode, formData, fields, saving,
  canEditNav, load, openCreate, openEdit, submit, remove, goI18n,
} = useNavigationAdminModel();
</script>

<style scoped>
.navigation-admin-table {
  overflow-x: auto;
}

.navigation-admin-panel {
  margin-top: 18px;
}

.navigation-admin-hint {
  margin-top: 18px;
}
</style>
