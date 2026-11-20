// ============================================================
// 高德地图 JS API 加载器（按需动态加载，不进首屏 bundle）
// ============================================================

/** 经纬度点 */
export interface AmapLngLat {
  /** 经度 */
  lng: number;
  /** 纬度 */
  lat: number;
}

/** 地图点击事件 */
export interface AmapClickEvent {
  /** 点击处的经纬度 */
  lnglat: AmapLngLat;
}

/** 标记点实例（只声明用到的最小接口） */
export interface AmapMarkerInstance {
  setPosition(pos: AmapLngLat | [number, number]): void;
  setMap(map: AmapMapInstance | null): void;
}

/** 信息窗实例 */
export interface AmapInfoWindowInstance {
  open(map: AmapMapInstance, pos: AmapLngLat | [number, number]): void;
  close(): void;
  setContent(content: string): void;
}

/** 地图实例 */
export interface AmapMapInstance {
  setCenter(center: AmapLngLat | [number, number]): void;
  setZoom(zoom: number): void;
  add(overlay: AmapMarkerInstance | AmapInfoWindowInstance): void;
  remove(overlay: AmapMarkerInstance | AmapInfoWindowInstance): void;
  clearMap(): void;
  on(event: string, handler: (e: AmapClickEvent) => void): void;
  destroy(): void;
}

/** 地理编码 / 逆地理编码结果 */
export interface AmapGeocodeResult {
  /** 状态说明（OK 表示成功） */
  info?: string;
  /** 逆地理编码结果 */
  regeocode?: { formattedAddress?: string };
  /** 地理编码结果列表 */
  geocodes?: Array<{ location?: string; formattedAddress?: string }>;
}

/** 输入提示结果 */
export interface AmapTipResult {
  /** 状态说明 */
  info?: string;
  /** 提示列表 */
  tips?: Array<{ name?: string; district?: string; address?: string }>;
}

/** POI 搜索结果 */
export interface AmapPlaceResult {
  /** 状态说明 */
  info?: string;
  /** POI 列表 */
  poiList?: { pois?: Array<{ name?: string; address?: string; location?: AmapLngLat | string }> };
}

/** 高德 SDK 命名空间（只声明用到的构造函数） */
export interface AmapSdk {
  Map: new (container: HTMLElement | string, opts: Record<string, unknown>) => AmapMapInstance;
  Marker: new (opts: Record<string, unknown>) => AmapMarkerInstance;
  InfoWindow: new (opts: Record<string, unknown>) => AmapInfoWindowInstance;
  Geocoder: new (opts?: Record<string, unknown>) => AmapGeocoderInstance;
  AutoComplete: new (opts?: Record<string, unknown>) => AmapAutoCompleteInstance;
  PlaceSearch: new (opts?: Record<string, unknown>) => AmapPlaceSearchInstance;
}

/** 地理编码实例 */
export interface AmapGeocoderInstance {
  getAddress(location: AmapLngLat | string, cb: (status: string, result: AmapGeocodeResult) => void): void;
  getLocation(address: string, cb: (status: string, result: AmapGeocodeResult) => void): void;
}

/** 输入提示实例 */
export interface AmapAutoCompleteInstance {
  search(keyword: string, cb: (status: string, result: AmapTipResult) => void): void;
}

/** POI 搜索实例 */
export interface AmapPlaceSearchInstance {
  setCity(city: string): void;
  search(keyword: string, cb: (status: string, result: AmapPlaceResult) => void): void;
}

declare global {
  interface Window {
    /** 高德 SDK 全局对象（加载成功后由 SDK 自己挂载） */
    AMap?: AmapSdk;
    /** JS API 安全密钥配置（必须在加载 SDK 之前写入） */
    _AMapSecurityConfig?: { securityJsCode?: string };
  }
}

/** 加载中 / 已加载的 SDK Promise（同进程只加载一次） */
let sdkPromise: Promise<AmapSdk> | null = null;

/** 当前已加载使用的 Key（Key 变化需重新加载） */
let loadedKey = '';

/** 默认加载的插件：输入提示 + POI 搜索 + 逆地理编码 */
export const AMAP_PLUGINS = ['AMap.AutoComplete', 'AMap.PlaceSearch', 'AMap.Geocoder'];

/**
 * 加载高德 JS API SDK
 * @param {string} jsKey - 高德「Web端(JS API)」Key
 * @param {string} securityCode - JS API 安全密钥（可为空，表示未开启）
 * @returns {Promise<AmapSdk>} SDK 命名空间
 * @description
 *   - 安全密钥必须在 script 加载前写入 `window._AMapSecurityConfig`，否则 SDK 直接拒绝服务
 *   - 同一 Key 只加载一次；Key 变化（如改配置后刷新配置）会重新加载
 *   - 失败时清空缓存，允许下次重试
 */
export const loadAmapSdk = (jsKey: string, securityCode: string): Promise<AmapSdk> => {
  if (window.AMap && loadedKey === jsKey) return Promise.resolve(window.AMap);
  if (sdkPromise && loadedKey === jsKey) return sdkPromise;

  window._AMapSecurityConfig = { securityJsCode: securityCode || '' };
  loadedKey = jsKey;
  sdkPromise = new Promise<AmapSdk>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(jsKey)}&plugin=${AMAP_PLUGINS.join(',')}`;
    script.async = true;
    script.onload = () => {
      if (window.AMap) resolve(window.AMap);
      else reject(new Error('AMAP_SDK_MISSING'));
    };
    script.onerror = () => {
      sdkPromise = null;
      loadedKey = '';
      reject(new Error('AMAP_SDK_LOAD_FAILED'));
    };
    document.head.appendChild(script);
  });
  return sdkPromise;
};

/**
 * 把 SDK 返回的 location 统一成 "经度,纬度" 字符串
 * @param {AmapLngLat | string | undefined} location - SDK 返回的坐标（对象或字符串）
 * @returns {string} "经度,纬度"；无法解析时返回空串
 */
export const formatLocation = (location: AmapLngLat | string | undefined): string => {
  if (!location) return '';
  if (typeof location === 'string') return location;
  if (typeof location.lng === 'number' && typeof location.lat === 'number') {
    return `${location.lng},${location.lat}`;
  }
  return '';
};
