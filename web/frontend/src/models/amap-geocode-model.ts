import { computed, onMounted, onBeforeUnmount, ref, type Ref, type ComputedRef } from 'vue';
import { MessagePlugin } from 'tdesign-vue-next';
import { BaseModel } from '@/models/base-model';
import { AmapGeocodeService } from '@/services/amap-geocode-service';
import { formatCacheTime } from '@/utils/cache-admin';
import type { AmapGeocodeEntry, AmapGeocodeWritePayload } from '@/types/amap-geocode';

/** 坐标格式：经度,纬度 */
const COORD_PATTERN = /^-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?$/;

/** 行内编辑草稿 */
interface AmapGeocodeDraft {
  /** 是否为表格顶部的新增行 */
  isCreate: boolean;
  /** 编辑前的原地址，用于重命名 */
  originalAddress: string;
  /** 地图选点组件值，格式为「地名|经度,纬度」 */
  pickValue: string;
  /** 地址文本 */
  address: string;
  /** 坐标「经度,纬度」，可由地图选点填充或手工输入 */
  coordinates: string;
}

/** 表格行（含展示与编辑状态） */
interface AmapGeocodeRow extends AmapGeocodeEntry {
  /** 本地化更新时间文本 */
  updatedText: string;
  /** 当前行是否处于编辑态 */
  isEditing: boolean;
  /** 是否为新增草稿行 */
  isDraft: boolean;
}

/** 构造一条空的新增草稿 */
const createDraft = (): AmapGeocodeDraft => ({
  isCreate: true,
  originalAddress: '',
  pickValue: '',
  address: '',
  coordinates: '',
});

/**
 * 高德地理编码缓存页面数据模型类
 * @description 管理地址坐标列表的加载、关键字筛选与表格行内新增 / 编辑 / 删除；
 *   编辑态通过地图选点组件产出「地名|经度,纬度」，不弹抽屉。
 */
export class AmapGeocodeModel extends BaseModel {
  /**
   * 高德地理编码缓存服务实例
   * @type {AmapGeocodeService}
   * @description 封装独立管理页的列表与单条读写接口
   */
  service: AmapGeocodeService = new AmapGeocodeService();

  /**
   * 地址坐标列表
   * @type {Ref<AmapGeocodeEntry[]>}
   * @description 后端返回的全部扁平行，按地址排序
   */
  entries: Ref<AmapGeocodeEntry[]> = ref([]);

  /**
   * 地址筛选关键字
   * @type {Ref<string>}
   * @description 回车或点击搜索时提交给后端做模糊匹配
   */
  keyword: Ref<string> = ref('');

  /**
   * 当前行内编辑草稿
   * @type {Ref<AmapGeocodeDraft | null>}
   * @description null 表示无编辑行；同一时刻只允许一行处于编辑态
   */
  draft: Ref<AmapGeocodeDraft | null> = ref(null);

  /**
   * 保存中状态
   * @type {Ref<boolean>}
   * @description 提交期间显示保存按钮 loading
   */
  saving: Ref<boolean> = ref(false);

  /**
   * 表格数据
   * @type {ComputedRef<AmapGeocodeRow[]>}
   * @description 新增草稿行插在首行；被编辑的已有行标记 isEditing
   */
  rows: ComputedRef<AmapGeocodeRow[]> = computed(() => {
    const draft = this.draft.value;
    const list: AmapGeocodeRow[] = this.entries.value.map((item) => ({
      ...item,
      updatedText: formatCacheTime(item.updatedAt),
      isEditing: Boolean(draft && !draft.isCreate && draft.originalAddress === item.address),
      isDraft: false,
    }));
    if (draft?.isCreate) {
      list.unshift({
        address: '',
        coordinates: '',
        updatedAt: 0,
        updatedText: '—',
        isEditing: true,
        isDraft: true,
      });
    }
    return list;
  });

  /**
   * 表格列定义
   * @type {ComputedRef<Array<Record<string, unknown>>>}
   * @description 列标题全部来自语言包
   */
  columns: ComputedRef<Array<Record<string, unknown>>> = computed(() => {
    const { t } = this.localeStore;
    return [
      { colKey: 'address', title: t.amapGeocode.colAddress },
      { colKey: 'coordinates', title: t.amapGeocode.colCoordinates, width: 260 },
      { colKey: 'updatedText', title: t.amapGeocode.colUpdated, width: 200 },
      { colKey: 'actions', title: t.amapGeocode.colActions, width: 150, fixed: 'right' },
    ];
  });

  /**
   * 地图选点值变化
   * @param {unknown} value - 组件值「地名|经度,纬度」或纯地名
   * @returns {void} 无返回值
   * @description 拆分出地址与坐标；未配置地图 Key 而手工输入地名时保留已填坐标
   */
  onPickChange = (value: unknown): void => {
    const draft = this.draft.value;
    if (!draft) return;
    const pickValue = String(value ?? '');
    const [name, coord] = pickValue.split('|');
    this.draft.value = {
      ...draft,
      pickValue,
      address: name ?? '',
      coordinates: coord || draft.coordinates,
    };
  };

  /**
   * 坐标手工输入
   * @param {unknown} value - 输入框值
   * @returns {void} 无返回值
   * @description 地图未配置 Key 或需要微调坐标时使用
   */
  onCoordChange = (value: unknown): void => {
    const draft = this.draft.value;
    if (!draft) return;
    this.draft.value = { ...draft, coordinates: String(value ?? '') };
  };

  /**
   * 加载地址坐标列表
   * @returns {Promise<void>} 无返回值
   * @description 关键字由后端做 LIKE 匹配，失败时给出提示并保留旧列表
   */
  load = async (): Promise<void> => {
    this.pageLoading.value = true;
    try {
      const res = await this.service.fetchEntries(this.keyword.value.trim());
      this.entries.value = res.data.items ?? [];
    } catch (err) {
      MessagePlugin.error((err as Error).message || this.localeStore.t.common.operationFailedRetry);
    } finally {
      this.pageLoading.value = false;
    }
  };

  /**
   * 在表格顶部插入一行新增草稿
   * @returns {void} 无返回值
   * @description 已有编辑行时不允许再开第二行，避免草稿状态互相覆盖
   */
  openCreate = (): void => {
    if (this.draft.value) return;
    this.draft.value = createDraft();
  };

  /**
   * 进入某行的行内编辑
   * @param {AmapGeocodeEntry} row - 待编辑的记录
   * @returns {void} 无返回值
   * @description 把地址与坐标拼成地图选点组件值，同时记住原地址用于重命名
   */
  openEdit = (row: AmapGeocodeEntry): void => {
    if (this.draft.value) return;
    this.draft.value = {
      isCreate: false,
      originalAddress: row.address,
      pickValue: `${row.address}|${row.coordinates}`,
      address: row.address,
      coordinates: row.coordinates,
    };
  };

  /**
   * 取消行内编辑
   * @returns {void} 无返回值
   * @description 丢弃草稿并让表格回到浏览态
   */
  cancelEdit = (): void => {
    this.draft.value = null;
  };

  /**
   * 提交行内新增或编辑
   * @returns {Promise<void>} 无返回值
   * @description 仅提交时校验地址与坐标格式，后端做最终校验；成功后刷新列表
   */
  submit = async (): Promise<void> => {
    if (!this.canEdit()) return;
    const draft = this.draft.value;
    if (!draft) return;
    const { t } = this.localeStore;
    const address = draft.address.trim();
    const coordinates = draft.coordinates.trim();
    if (!address || !coordinates) {
      MessagePlugin.warning(t.common.required);
      return;
    }
    if (!COORD_PATTERN.test(coordinates)) {
      MessagePlugin.warning(t.amapGeocode.invalidCoordinates);
      return;
    }
    const payload: AmapGeocodeWritePayload = {
      address,
      coordinates,
      originalAddress: draft.isCreate ? undefined : draft.originalAddress,
    };
    this.saving.value = true;
    try {
      await this.service.saveEntry(payload);
      MessagePlugin.success(t.common.saveSuccess);
      this.cancelEdit();
      await this.load();
    } catch (err) {
      MessagePlugin.error((err as Error).message || t.common.saveFailed);
    } finally {
      this.saving.value = false;
    }
  };

  /**
   * 删除一条地址坐标
   * @param {AmapGeocodeEntry} row - 待删除的记录
   * @returns {Promise<void>} 无返回值
   * @description 删除成功后关闭可能存在的编辑草稿并刷新列表
   */
  remove = async (row: AmapGeocodeEntry): Promise<void> => {
    if (!this.canEdit()) return;
    try {
      await this.service.deleteEntry(row.address);
      MessagePlugin.success(this.localeStore.t.common.deleteSuccess);
      this.cancelEdit();
      await this.load();
    } catch (err) {
      MessagePlugin.error((err as Error).message || this.localeStore.t.common.deleteFailed);
    }
  };

  /** 组件挂载时加载列表并注册响应式监听 */
  mounted = (): void => {
    this.startResizeListener();
    void this.load();
  };

  /** 组件卸载时清理响应式监听 */
  beforeUnmount = (): void => {
    this.stopResizeListener();
  };
}

/**
 * Composition API 包装函数
 * @description 将 AmapGeocodeModel 类包装为 Composition API 可用的函数
 */
export const useAmapGeocodeModel = () => {
  const model = new AmapGeocodeModel();
  onMounted(() => model.mounted());
  onBeforeUnmount(() => model.beforeUnmount());
  return { ...model };
};
