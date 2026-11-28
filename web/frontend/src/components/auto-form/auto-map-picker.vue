<template>
  <div class="amap-picker">
    <!-- 输入框：显示已选地名，可直接手输地址（未配置地图时的兜底用法） -->
    <div class="amap-picker__row">
      <t-input
        :model-value="displayText"
        :placeholder="placeholder"
        :disabled="disabled"
        :clearable="true"
        @change="onManualInput"
      />
      <!-- 浏览态（disabled）只显示输入框，选点入口编辑时才出现 -->
      <t-button
        v-if="!disabled"
        theme="default"
        variant="outline"
        :disabled="!ready"
        :title="t.skillMap.mapPickOnMap"
        @click="openDialog"
      >
        <template #icon><t-icon name="location" /></template>
        {{ compact ? '' : t.skillMap.mapPickOnMap }}
      </t-button>
    </div>

    <!-- 未就绪提示：未配置 Key 或 SDK 加载失败（仅编辑态提示，浏览态保持安静） -->
    <p v-if="!ready && !disabled && !compact" class="amap-picker__hint">{{ hintText }}</p>

    <!-- 常用地点快捷选择（来自地理编码缓存，命中即跳过一次在线解析） -->
    <div v-if="!disabled && ready && recentPlaces.length > 0 && !compact" class="amap-picker__recent">
      <span class="amap-picker__recent-label">{{ t.skillMap.mapRecent }}</span>
      <t-button
        v-for="p in recentPlaces"
        :key="p.name"
        variant="text"
        size="small"
        class="amap-picker__recent-item"
        @click="applyValue(p.name, p.location)"
      >
        {{ p.name }}
      </t-button>
    </div>

    <!-- 地图选点对话框：搜索 + 点击地图 + 逆地理编码回显具体地名 -->
    <!-- attach="body"：必须挂到 body，否则会被卡片展开区的 overflow:hidden 裁剪成一个细长条 -->
    <t-dialog
      v-model:visible="dialogVisible"
      :header="t.skillMap.mapDialogTitle"
      :confirm-btn="t.common.save"
      :cancel-btn="t.common.cancel"
      width="min(720px, 92vw)"
      attach="body"
      @opened="initMap"
      @confirm="confirmPick"
    >
      <div class="amap-picker__dialog">
        <div class="amap-picker__search">
          <t-input
            v-model="keyword"
            :placeholder="t.skillMap.mapSearchPlaceholder"
            clearable
            @change="searchPlaces"
          >
            <template #prefix-icon><t-icon name="search" /></template>
          </t-input>
        </div>

        <!-- 搜索结果：名称 + 详细地址（比纯输入框更具体，便于选对楼栋/出入口） -->
        <div v-if="suggestions.length > 0" class="amap-picker__suggest">
          <div
            v-for="(s, i) in suggestions"
            :key="i"
            class="amap-picker__suggest-item"
            @click="pickSuggestion(s)"
          >
            <span class="amap-picker__suggest-name">{{ s.name }}</span>
            <span class="amap-picker__suggest-addr">{{ s.address }}</span>
          </div>
        </div>
        <p v-else-if="searched" class="amap-picker__empty">{{ t.skillMap.mapNoResult }}</p>

        <div ref="mapContainer" class="amap-picker__map" />
        <p class="amap-picker__tip">{{ t.skillMap.mapClickHint }}</p>
        <p v-if="pickedName" class="amap-picker__picked">
          {{ t.skillMap.mapPicked }}{{ pickedName }}
        </p>
      </div>
    </t-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { useLocaleStore } from '@/stores/locale';
import skillMapService from '@/services/skill-map-service';
import {
  loadAmapSdk,
  formatLocation,
  type AmapMapInstance,
  type AmapMarkerInstance,
  type AmapInfoWindowInstance,
  type AmapSdk,
} from '@/utils/map/amap-loader';
import type { AmapRecentPlace } from '@/types/skill-map';

/** 组件值（v-model）：格式为「地名|经度,纬度」，兼容纯地址 / 纯坐标 / 别名 */
const model = defineModel<string>({ default: '' });

defineProps<{
  /** 占位提示 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 紧凑模式：隐藏常用地点与提示，选点按钮只留图标，适合表格行内编辑 */
  compact?: boolean;
}>();

/** 语言 store（保持响应式：切语言时文案跟着变） */
const localeStore = useLocaleStore();

/** i18n 文案（响应式，整包：模板里用 t.skillMap.xxx / t.common.xxx） */
const t = computed(() => localeStore.t);

/** 高德配置：JS Key / 城市 / 常用地点（按需拉取，不做首屏依赖） */
const jsKey = ref('');
const securityCode = ref('');
const city = ref('深圳');
const recentPlaces = ref<AmapRecentPlace[]>([]);

/** SDK 是否可用（未配置 Key 或加载失败时为 false，降级为纯输入） */
const ready = ref(false);
/** 加载失败文案（区分「未配置」与「加载失败」） */
const loadError = ref('');

/** 对话框开关 */
const dialogVisible = ref(false);
/** 搜索关键字 */
const keyword = ref('');
/** 搜索结果：名称 + 详细地址 */
const suggestions = ref<Array<{ name: string; address: string; location: string }>>([]);
/** 是否已执行过一次搜索（用于区分「没结果」与「还没搜」） */
const searched = ref(false);
/** 地图内已选中的地名与坐标 */
const pickedName = ref('');
const pickedLocation = ref('');

/** 地图容器 DOM */
const mapContainer = ref<HTMLDivElement | null>(null);
/** 地图 / 标记 / 信息窗实例 */
let sdk: AmapSdk | null = null;
let map: AmapMapInstance | null = null;
let marker: AmapMarkerInstance | null = null;
let infoWindow: AmapInfoWindowInstance | null = null;

/** 显示文本：值里的地名部分（"地名|经纬度" → 地名） */
const displayText = computed(() => model.value.split('|')[0] ?? '');

/** 搜索防抖定时器（免费 Key 有 QPS 限制，避免每敲一个字都打接口） */
let searchTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 转义 HTML（地名要拼进信息窗，避免内容里的尖括号被当成标签）
 * @param {string} s - 原始文本
 * @returns {string} 转义后的文本
 */
const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 未就绪时的提示文案 */
const hintText = computed(() => {
  if (loadError.value) return loadError.value;
  return t.value.skillMap.mapNotConfigured;
});

/**
 * 拉取高德前端配置
 * @returns {Promise<void>}
 * @description 只在组件挂载时拉一次；configured=false 时不加载 SDK，保持纯输入框可用
 */
const loadConfig = async (): Promise<void> => {
  try {
    const res = await skillMapService.fetchAmapConfig();
    if (res.code !== 0 || !res.data) return;
    const { configured, jsKey: key, securityCode: code, city: c, recentPlaces: places } = res.data;
    city.value = c || '深圳';
    recentPlaces.value = places ?? [];
    if (!configured || !key) return;
    jsKey.value = key;
    securityCode.value = code ?? '';
    try {
      sdk = await loadAmapSdk(key, code ?? '');
      ready.value = true;
    } catch {
      loadError.value = t.value.skillMap.mapLoadFailed;
    }
  } catch {
    // 拉取失败不阻断表单：保持纯输入可用
  }
};

/**
 * 手动输入地址（兜底用法）
 * @param {string} val - 输入内容
 * @returns {void}
 */
const onManualInput = (val: string): void => {
  suggestions.value = [];
  model.value = val ?? '';
};

/**
 * 写入选中结果
 * @param {string} name - 地名
 * @param {string} location - 坐标 "经度,纬度"
 * @returns {void}
 */
const applyValue = (name: string, location: string): void => {
  if (!location) return;
  model.value = name ? `${name}|${location}` : location;
};

/**
 * 打开地图对话框（重置搜索与选点状态）
 * @returns {void}
 * @description 地图初始化交给 t-dialog 的 @opened：动画结束、容器尺寸就绪后再建图，避免 0 尺寸渲染异常
 */
const openDialog = (): void => {
  dialogVisible.value = true;
  keyword.value = displayText.value;
  suggestions.value = [];
  searched.value = false;
  pickedName.value = displayText.value;
  pickedLocation.value = model.value.includes('|') ? (model.value.split('|')[1] ?? '') : '';
};

/**
 * 初始化地图：以配置城市为中心，绑定点击事件
 * @returns {void}
 * @description 重复打开对话框时复用实例，避免多次 new Map 造成容器错乱
 */
const initMap = (): void => {
  if (!sdk || !mapContainer.value) return;
  if (map) {
    map.clearMap();
    return;
  }
  map = new sdk.Map(mapContainer.value, { zoom: 13, resizeEnable: true });
  map.on('click', onMapClick);
  const geocoder = new sdk.Geocoder({ city: city.value });
  geocoder.getLocation(city.value, (status, result) => {
    const first = result.geocodes?.[0]?.location;
    if (status === 'complete' && first) {
      const [lng, lat] = first.split(',').map(Number);
      if (!Number.isNaN(lng) && !Number.isNaN(lat)) map?.setCenter([lng, lat]);
    }
  });
};

/**
 * 地图点击 → 逆地理编码出具体地名并打点
 * @param {{ lnglat: { lng: number; lat: number } }} e - 点击事件
 * @returns {void}
 */
const onMapClick = (e: { lnglat: { lng: number; lat: number } }): void => {
  if (!sdk || !map || !e?.lnglat) return;
  const { lng, lat } = e.lnglat;
  const geocoder = new sdk.Geocoder();
  geocoder.getAddress({ lng, lat }, (status, result) => {
    if (status !== 'complete') return;
    const addr = result.regeocode?.formattedAddress ?? '';
    pickedName.value = addr || `${lng.toFixed(6)},${lat.toFixed(6)}`;
    pickedLocation.value = `${lng},${lat}`;
    markPoint({ lng, lat }, pickedName.value);
  });
};

/**
 * 在地图上打点并弹出信息窗
 * @param {{ lng: number; lat: number }} pos - 坐标
 * @param {string} title - 信息窗文案（具体地名）
 * @returns {void}
 */
const markPoint = (pos: { lng: number; lat: number }, title: string): void => {
  if (!sdk || !map) return;
  if (!marker) {
    marker = new sdk.Marker({ position: [pos.lng, pos.lat], title });
    map.add(marker);
  } else {
    marker.setPosition([pos.lng, pos.lat]);
    marker.setMap(map);
  }
  map.setCenter([pos.lng, pos.lat]);
  const html = `<div class="amap-picker__iw">${escapeHtml(title)}</div>`;
  if (!infoWindow) {
    infoWindow = new sdk.InfoWindow({ content: html, offset: [0, -32] });
  } else {
    infoWindow.setContent(html);
  }
  infoWindow.open(map, [pos.lng, pos.lat]);
};

/**
 * 关键字搜索：输入提示 + POI 详情，展示「名称 + 详细地址」
 * @param {string} val - 搜索关键字
 * @returns {void}
 */
const searchPlaces = (val: string): void => {
  keyword.value = val ?? '';
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 300);
};

/**
 * 真正发起搜索（防抖后执行）
 * @returns {void}
 */
const runSearch = (): void => {
  const kw = keyword.value.trim();
  // 取局部引用：闭包里 TS 无法保留对模块级 let 的收窄判断
  const sdkRef = sdk;
  if (!sdkRef || kw.length === 0) {
    suggestions.value = [];
    searched.value = false;
    return;
  }
  const auto = new sdkRef.AutoComplete({ city: city.value });
  auto.search(kw, (status, result) => {
    const tips = (status === 'complete' ? result.tips ?? [] : []).slice(0, 8);
    searched.value = true;
    if (tips.length === 0) {
      suggestions.value = [];
      return;
    }
    // 先渲染列表（地址用输入提示自带的），坐标再用 POI 搜索异步补齐；
    // 不限定城市：用户可能搜外地地点（如在深圳搜「孝感站」），限城市会查不到坐标
    suggestions.value = tips.map((tip) => ({
      name: tip.name ?? '',
      address: typeof tip.address === 'string' && tip.address ? tip.address : (tip.district ?? ''),
      location: '',
    }));
    suggestions.value.forEach((item) => {
      const place = new sdkRef.PlaceSearch({ pageSize: 5 });
      place.search(item.name, (s2, r2) => {
        const poi = (s2 === 'complete' ? r2.poiList?.pois ?? [] : [])
          .find((p) => formatLocation(p?.location));
        if (!poi) return;
        item.location = formatLocation(poi.location);
        if (!item.address) item.address = poi.address ?? '';
      });
    });
  });
};

/**
 * 选中搜索结果：地图定位打点 + 记录待确认值
 * @param {{ name: string; address: string; location: string }} item - 搜索项
 * @returns {void}
 * @description POI 搜索没补到坐标时（跨城市 / 冷门地点），用地理编码按「地址+名称」兜底解析
 */
const pickSuggestion = (item: { name: string; address: string; location: string }): void => {
  if (!sdk || !map) return;
  if (item.location) {
    applyPick(item);
    return;
  }
  const sdkRef = sdk;
  const geocoder = new sdkRef.Geocoder();
  const query = item.address ? `${item.address}${item.name}` : item.name;
  geocoder.getLocation(query, (status, result) => {
    const loc = status === 'complete' ? (result.geocodes?.[0]?.location ?? '') : '';
    if (!loc) {
      MessagePlugin.warning(t.value.skillMap.mapNoResult);
      return;
    }
    applyPick({ ...item, location: loc });
  });
};

/**
 * 应用选中的地点：记录待确认值、地图定位打点、收起候选列表
 * @param {{ name: string; address: string; location: string }} item - 已带坐标的搜索项
 * @returns {void}
 */
const applyPick = (item: { name: string; address: string; location: string }): void => {
  pickedName.value = item.name;
  pickedLocation.value = item.location;
  const [lng, lat] = item.location.split(',').map(Number);
  if (!Number.isNaN(lng) && !Number.isNaN(lat)) {
    const title = item.address ? `${item.name}（${item.address}）` : item.name;
    markPoint({ lng, lat }, title);
  }
  suggestions.value = [];
};

/** 确认选点：把「地名|坐标」写回表单，并关闭对话框 */
const confirmPick = (): void => {
  if (pickedLocation.value) applyValue(pickedName.value, pickedLocation.value);
  dialogVisible.value = false;
};

// 对话框关闭时收起信息窗，避免下次打开残留
watch(dialogVisible, (open) => {
  if (!open && infoWindow) infoWindow.close();
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
  if (infoWindow) infoWindow.close();
  map?.destroy();
  map = null;
});

void loadConfig();
</script>

<style scoped>
.amap-picker {
  width: 100%;
}

.amap-picker__row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.amap-picker__row :deep(.t-input) {
  flex: 1;
  min-width: 0;
}

/* 未就绪提示 */
.amap-picker__hint {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
}

/* 常用地点快捷入口 */
.amap-picker__recent {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  margin-top: 2px;
}

.amap-picker__recent-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-right: 2px;
}

.amap-picker__recent-item {
  font-size: 11px;
  --td-comp-paddingLR-s: 6px;
}

/* 对话框内部 */
.amap-picker__dialog {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.amap-picker__map {
  width: 100%;
  height: 380px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  overflow: hidden;
}

/* 搜索结果列表 */
.amap-picker__suggest {
  max-height: 150px;
  overflow-y: auto;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.amap-picker__suggest-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 10px;
  cursor: pointer;
}

.amap-picker__suggest-item:hover {
  background: var(--bg-secondary);
}

.amap-picker__suggest-name {
  font-size: 13px;
  color: var(--text-primary);
}

.amap-picker__suggest-addr {
  font-size: 11px;
  color: var(--text-muted);
}

.amap-picker__empty,
.amap-picker__tip {
  margin: 0;
  font-size: 11px;
  color: var(--text-muted);
}

.amap-picker__picked {
  margin: 0;
  font-size: 12px;
  color: var(--accent-green);
}

/* 移动端：地图高度收敛 */
@media (max-width: 768px) {
  .amap-picker__map {
    height: 280px;
  }
}
</style>

<style>
/* 地图信息窗文案（由 SDK 注入到非 scoped 的 DOM 中） */
.amap-picker__iw {
  padding: 4px 8px;
  font-size: 12px;
  line-height: 1.5;
  color: #333;
  background: #fff;
  border-radius: 4px;
  max-width: 240px;
}
</style>
