<template>
  <page-layout
    :page-loading="pageLoading"
    :title="t.amapGeocode.pageTitle"
    :subtitle="t.amapGeocode.subtitle"
    :disable-anchor="true"
  >
    <template #actions>
      <t-button variant="outline" size="large" :loading="pageLoading" @click="load">
        <template #icon><t-icon name="refresh" /></template>
        {{ t.common.refresh }}
      </t-button>
      <t-button
        v-if="canEdit()"
        theme="primary"
        size="large"
        :disabled="Boolean(draft)"
        @click="openCreate"
      >
        <template #icon><t-icon name="add" /></template>
        {{ t.common.add }}
      </t-button>
    </template>

    <card-panel :title="t.amapGeocode.listTitle" icon="location" icon-theme="secondary">
      <template #title-extra>
        <span class="amap-geocode-total">{{ t.amapGeocode.totalLabel }} {{ entries.length }}</span>
      </template>

      <div class="amap-geocode-filters">
        <t-input
          v-model="keyword"
          clearable
          :placeholder="t.amapGeocode.keywordPlaceholder"
          style="width: 260px;"
          @enter="load"
        />
        <t-button theme="primary" @click="load">
          <template #icon><t-icon name="search" /></template>
          {{ t.common.search }}
        </t-button>
      </div>

      <t-table
        :data="rows"
        :columns="columns"
        row-key="address"
        hover
        stripe
        size="medium"
      >
        <template #address="{ row }">
          <auto-map-picker
            v-if="row.isEditing && draft"
            :model-value="draft?.pickValue ?? ''"
            :placeholder="t.amapGeocode.fieldAddress"
            :compact="true"
            @update:model-value="onPickChange"
          />
          <span v-else>{{ row.address }}</span>
        </template>

        <template #coordinates="{ row }">
          <t-input
            v-if="row.isEditing && draft"
            :model-value="draft?.coordinates ?? ''"
            :placeholder="t.amapGeocode.coordinatesHint"
            @change="onCoordChange"
          />
          <span v-else>{{ row.coordinates }}</span>
        </template>

        <template #actions="{ row }">
          <div v-if="row.isEditing" class="flex gap-2">
            <t-button size="small" theme="primary" :loading="saving" @click="submit">
              {{ t.common.save }}
            </t-button>
            <t-button size="small" variant="outline" @click="cancelEdit">
              {{ t.common.cancel }}
            </t-button>
          </div>
          <div v-else class="flex gap-2">
            <t-button
              v-if="canEdit()"
              variant="text"
              size="small"
              :disabled="Boolean(draft)"
              @click="openEdit(row)"
            >
              <template #icon><t-icon name="edit" /></template>
            </t-button>
            <t-popconfirm :content="t.amapGeocode.deleteConfirm" @confirm="remove(row)">
              <t-button
                v-if="canEdit()"
                variant="text"
                theme="danger"
                size="small"
                :disabled="Boolean(draft)"
              >
                <template #icon><t-icon name="delete" /></template>
              </t-button>
            </t-popconfirm>
          </div>
        </template>
      </t-table>
    </card-panel>
  </page-layout>
</template>

<script setup lang="ts">
import PageLayout from '@/components/common/page-layout.vue';
import CardPanel from '@/components/common/card-panel.vue';
import AutoMapPicker from '@/components/auto-form/auto-map-picker.vue';
import { useAmapGeocodeModel } from '@/models/amap-geocode-model';

const {
  t, pageLoading, entries, keyword, rows, columns, draft, saving, canEdit,
  load, openCreate, openEdit, cancelEdit, onPickChange, onCoordChange, submit, remove,
} = useAmapGeocodeModel();
</script>

<style scoped>
@import "@/styles/common.css";

.amap-geocode-total {
  color: var(--text-muted);
  font-size: 12px;
}

.amap-geocode-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

:deep(.amap-picker) {
  width: 100%;
}
</style>
