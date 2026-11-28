<!--
  AutoForm 通用表单组件
  =====================
  通过 JSON 配置驱动表单渲染，无需手写重复的 t-form 模板。
  支持条件联动：visible / onChange / 动态 options / 动态 disabled / 动态 rules / group 横向分组。

  ## 基本用法

  ```vue
  <auto-form v-model="formData" :fields="fields" ref="formRef" />
  ```

  ## 字段配置示例

  ```ts
  import type { AutoFormField } from '@/types/auto-form';

  const fields: AutoFormField[] = [
    {
      name: 'name',
      label: '名称',
      type: 'input',
      placeholder: '请输入名称',
      rules: [{ required: true, message: '名称不能为空' }],
    },
    {
      name: 'type',
      label: '类型',
      type: 'select',
      options: [
        { value: 'a', label: '选项A' },
        { value: 'b', label: '选项B' },
      ],
      onChange: (val, data) => { data.condition = ''; },
    },
    // 动态 options：根据 type 字段联动
    {
      name: 'condition',
      label: '条件',
      type: 'select',
      options: (data) => data.type === 'a' ? aOptions : bOptions,
      visible: (data) => data.type !== 'c',
    },
    // 动态 rules：根据 type 字段联动验证规则
    {
      name: 'value',
      label: '值',
      type: 'input',
      rules: (data) => data.type === 'a'
        ? [{ required: true, message: '值不能为空' }]
        : [],
    },
    // group：多个子字段横向排列（如农历月+日联动）
    {
      name: 'lunarDate',
      label: '农历日期',
      type: 'group',
      rules: [{ required: true, message: '请选择农历日期' }],
      children: [
        {
          name: 'lunarMonth',
          type: 'select',
          placeholder: '选择月份',
          options: lunarMonthOptions,
        },
        {
          name: 'lunarDay',
          type: 'select',
          placeholder: '选择日期',
          options: (data) => getLunarDayOptions(data.lunarMonth as string),
        },
      ],
    },
  ];
  ```

  ## 插槽

  ### #content-[fieldName] — 只替换控件内容，label 仍由 auto-form 渲染

  适用场景：字段只读展示（如身份证号不可修改，显示为纯文本而非输入框）。
  slot props：field（字段配置）、value（当前值）、formData（整个表单数据）。

  ### #field-[fieldName] — 替换整个 form-item（含 label 和 content）

  适用场景：需要完全自定义某个字段的展示方式，包括 label 区域。
  slot props：field（字段配置）、value（当前值）、formData（整个表单数据）。

  ### #append — 在所有字段后追加自定义内容（仍位于 t-form 内部）

  适用场景：在表单最后追加非字段型展示内容（如只读预览、联动说明），保持与表单统一的布局节奏。
  slot props：formData（整个表单数据）。

  ## 调用验证

  ```ts
  const formRef = ref();
  const result = await formRef.value?.validate(); // true 表示通过
  ```

  ## 支持的字段类型

  | type              | 控件              | 说明                          |
  |-------------------|-------------------|-------------------------------|
  | input             | t-input           | 单行文本                      |
  | textarea          | t-textarea        | 多行文本                      |
  | select            | t-select          | 单选下拉                      |
  | multi-select      | t-select          | 多选下拉                      |
  | checkbox          | t-checkbox-group  | 多选框组                      |
  | radio             | t-radio-group     | 单选框组                      |
  | date-picker       | t-date-picker     | 日期选择（YYYY-MM-DD）        |
  | date-range-picker  | t-date-range-picker| 日期范围选择（[start, end]）      |
  | month-day-picker  | t-date-picker     | 月日选择（MM-DD，无年份）         |
  | time-picker       | t-time-picker     | 时间选择（HH:mm）             |
  | time-range-picker | t-time-range-picker| 时间范围选择（[start, end]）      |
  | switch            | t-switch          | 开关                          |
  | number            | t-input-number    | 数字输入                      |
  | slider            | t-slider          | 滑块                          |
  | cascader          | t-cascader        | 级联选择                      |
  | tree-select       | t-tree-select     | 树形选择                      |
  | upload            | auto-upload       | 文件/图片上传                  |
  | markdown          | markdown-editor   | Markdown 源码编辑 + 渲染预览   |
  | group             | 横向分组          | 多个子字段排列在同一行        |

  ## 联动能力

  | 能力              | 配置方式                                                    |
  |-------------------|-------------------------------------------------------------|
  | 显示/隐藏         | `visible: (data) => boolean`                                |
  | 值变更回调        | `onChange: (val, data) => void`                             |
  | 动态选项          | `options: (data) => AutoFormOption[]`                       |
  | 动态禁用          | `disabled: (data) => boolean`                               |
  | 动态验证规则      | `rules: (data) => AutoFormRule[]`                           |
  | 横向分组          | `type: 'group'`, `children: AutoFormGroupChild[]`           |
-->
<template>
  <t-form
    ref="formRef"
    :data="modelValue"
    :label-align="labelAlign"
    :label-width="labelWidth"
    :colon="colon"
    :disabled="disabled"
    :required-mark="requiredMark"
    :layout="layout"
    :scroll-to-first-error="scrollToFirstError"
    :prevent-submit-default="preventSubmitDefault"
    validate-on-rule-change
    :class="['auto-form', `auto-form--${layout}`, `auto-form--label-${labelAlign}`]"
    :style="{ '--auto-form-label-width': labelWidth }"
  >
    <template v-for="field in visibleFields" :key="field.name">
      <!-- #field-[name] 插槽：替换整个 form-item（含 label 和 content） -->
      <slot
        v-if="$slots[`field-${field.name}`]"
        :name="`field-${field.name}`"
        :field="field"
        :value="modelValue[field.name]"
        :form-data="modelValue"
      />

      <!-- 默认渲染：使用 t-form-item 渲染 label 和控件 -->
      <t-form-item
        v-else
        :label="resolveRequiredMark(field) ? field.label : undefined"
        :name="field.name"
        :rules="resolveRules(field)"
        :required-mark="resolveRequiredMark(field)"
        class="auto-form-item"
      >
        <!-- help 插槽：支持纯文本、HTML（如含 <a> 链接）和动态函数 -->
        <!-- 注意：必须始终渲染 #help slot，不能用 v-if 控制 template 存在性 -->
        <!-- 否则 TDesign t-form-item 首次渲染后不会重新检测 slot 的有无 -->
        <template #help>
          <!-- eslint-disable-next-line vue/no-v-html -- help 文案来自字段配置（开发者维护），需支持 <a> 等标签 -->
          <span v-if="resolveHelp(field)" v-html="resolveHelp(field)" />
        </template>
        <!-- label 插槽：需要显示选填标记时使用 -->
        <template v-if="!resolveRequiredMark(field)" #label>
          <div>
            {{ field.label }}
            <t-tag size="small" variant="light">{{ t.optional }}</t-tag>
          </div>
        </template>
        
        <!-- #content-[name] 插槽：只替换控件内容，label 仍由 auto-form 渲染 -->
        <slot
          v-if="$slots[`content-${field.name}`]"
          :name="`content-${field.name}`"
          :field="field"
          :value="modelValue[field.name]"
          :form-data="modelValue"
        />

        <!-- group：横向分组，多个子字段排列在同一行 -->
        <div
          v-else-if="field.type === 'group'"
          class="auto-form-group"
          :style="{ gap: field.gap ?? '8px' }"
        >
          <template v-for="child in field.children" :key="child.name">
            <!-- group 子字段：select -->
            <t-select
              v-if="child.type === 'select'"
              :value="getStringValue(child.name)"
              :size="size"
              :placeholder="child.placeholder"
              :clearable="child.clearable"
              :disabled="resolveDisabled(child)"
              :filterable="child.filterable"
              :popup-props="{
                zIndex: 9527,
                overlayInnerStyle: selectOverlayStyle,
              }"
              :style="resolveChildStyle(child)"
              @change="(val: string) => handleChildChange(child, val)"
            >
              <t-option
                v-for="opt in resolveOptions(child)"
                :key="opt.value"
                :value="opt.value"
                :label="opt.label"
              >
                <span class="auto-form-opt">
                  <span>{{ opt.label }}</span>
                  <span v-if="opt.sub" class="auto-form-opt__sub">{{ opt.sub }}</span>
                </span>
              </t-option>
            </t-select>

            <!-- group 子字段：multi-select -->
            <t-select
              v-else-if="child.type === 'multi-select'"
              :value="getArrayValue(child.name)"
              :size="size"
              :placeholder="child.placeholder"
              :clearable="child.clearable !== false"
              :disabled="resolveDisabled(child)"
              :filterable="child.filterable"
              multiple
              :popup-props="{
                zIndex: 9527,
                overlayInnerStyle: selectOverlayStyle,
              }"
              :style="resolveChildStyle(child)"
              @change="(val: string[]) => handleChildChange(child, val)"
            >
              <t-option
                v-for="opt in resolveOptions(child)"
                :key="opt.value"
                :value="opt.value"
                :label="opt.label"
              >
                <span class="auto-form-opt">
                  <span>{{ opt.label }}</span>
                  <span v-if="opt.sub" class="auto-form-opt__sub">{{ opt.sub }}</span>
                </span>
              </t-option>
            </t-select>

            <!-- group 子字段：input -->
            <t-input
              v-else-if="child.type === 'input'"
              :value="getStringValue(child.name)"
              :size="size"
              :placeholder="child.placeholder"
              :clearable="child.clearable !== false"
              :disabled="resolveDisabled(child)"
              :style="resolveChildStyle(child)"
              @change="(val: string) => handleChildChange(child, val)"
              @blur="(val: string) => handleChildChange(child, val)"
            />

            <!-- group 子字段：date-picker -->
            <t-date-picker
              v-else-if="child.type === 'date-picker'"
              :value="getStringValue(child.name)"
              :size="size"
              mode="date"
              :format="child.dateFormat ?? 'YYYY-MM-DD'"
              value-type="format"
              :placeholder="child.placeholder"
              :disabled="resolveDisabled(child)"
              :style="resolveChildStyle(child)"
              :popup-props="{ zIndex: 9527 }"
              @change="(val: string) => handleChildChange(child, val)"
            />

            <!-- group 子字段：date-range-picker -->
            <t-date-range-picker
              v-else-if="child.type === 'date-range-picker'"
              :value="getDateRangeValue(child.name)"
              :size="size"
              mode="date"
              :format="child.dateFormat ?? 'YYYY-MM-DD'"
              value-type="format"
              :placeholder="child.placeholder"
              :disabled="resolveDisabled(child)"
              :style="resolveChildStyle(child)"
              :popup-props="{ zIndex: 9527 }"
              @change="(val: string[]) => handleChildChange(child, val)"
            />

            <!-- group 子字段：month-day-picker -->
            <t-date-picker
              v-else-if="child.type === 'month-day-picker'"
              :value="getStringValue(child.name)"
              :size="size"
              mode="date"
              format="MM-DD"
              value-type="format"
              :placeholder="child.placeholder"
              :year="false"
              :disabled="resolveDisabled(child)"
              :style="resolveChildStyle(child)"
              :popup-props="{ zIndex: 9527 }"
              @change="(val: string) => handleChildChange(child, val)"
            />

            <!-- group 子字段：time-picker -->
            <t-time-picker
              v-else-if="child.type === 'time-picker'"
              :value="getStringValue(child.name)"
              :size="size"
              :format="child.timeFormat ?? 'HH:mm'"
              :placeholder="child.placeholder"
              :disabled="resolveDisabled(child)"
              :style="resolveChildStyle(child)"
              :popup-props="{ zIndex: 9527 }"
              @change="(val: string) => handleChildChange(child, val)"
            />

            <!-- group 子字段：time-range-picker -->
            <t-time-range-picker
              v-else-if="child.type === 'time-range-picker'"
              :value="getDateRangeValue(child.name)"
              :size="size"
              :format="child.timeFormat ?? 'HH:mm'"
              :placeholder="child.placeholder"
              :disabled="resolveDisabled(child)"
              :style="resolveChildStyle(child)"
              :popup-props="{ zIndex: 9527 }"
              @change="(val: string[]) => handleChildChange(child, val)"
            />

            <!-- group 子字段：switch -->
            <t-switch
              v-else-if="child.type === 'switch'"
              :value="modelValue[child.name]"
              :size="size"
              :disabled="resolveDisabled(child)"
              :style="resolveChildStyle(child)"
              @change="(val: boolean) => handleChildChange(child, val)"
            />

            <!-- group 子字段：slider -->
            <t-slider
              v-else-if="child.type === 'slider'"
              :value="getChildSliderValue(child)"
              :disabled="resolveDisabled(child)"
              :min="child.min ?? 0"
              :max="child.max ?? 100"
              :step="child.step ?? 1"
              :style="resolveChildStyle(child)"
              @change="(val: number | number[]) => handleChildChange(child, val)"
            />

            <!-- group 子字段：cascader -->
            <t-cascader
              v-else-if="child.type === 'cascader'"
              :value="modelValue[child.name]"
              :size="size"
              :placeholder="child.placeholder"
              :clearable="child.clearable !== false"
              :disabled="resolveDisabled(child)"
              :filterable="child.filterable"
              :options="resolveChildTreeData(child)"
              :popup-props="{
                zIndex: 9527,
                overlayInnerStyle: selectOverlayStyle,
              }"
              :style="resolveChildStyle(child)"
              @change="(val: unknown) => handleChildChange(child, val)"
            />

            <!-- group 子字段：tree-select -->
            <t-tree-select
              v-else-if="child.type === 'tree-select'"
              :value="modelValue[child.name]"
              :size="size"
              :placeholder="child.placeholder"
              :clearable="child.clearable !== false"
              :disabled="resolveDisabled(child)"
              :filterable="child.filterable"
              :data="resolveChildTreeData(child)"
              :popup-props="{
                zIndex: 9527,
                overlayInnerStyle: selectOverlayStyle,
              }"
              :style="resolveChildStyle(child)"
              @change="(val: unknown) => handleChildChange(child, val)"
            />

            <!-- group 子字段：number -->
            <t-input-number
              v-else-if="child.type === 'number'"
              :value="getNumberValue(child.name)"
              :size="size"
              :placeholder="child.placeholder"
              :disabled="resolveDisabled(child)"
              :min="child.min"
              :max="child.max"
              :step="child.step ?? 1"
              :decimal-places="child.decimalPlaces"
              :align="child.align"
              :theme="child.theme"
              :allow-input-over-limit="child.allowInputOverLimit"
              :auto-width="child.autoWidth"
              :large-number="child.largeNumber"
              :label="child.numberLabel"
              :tips="child.tips"
              :style="resolveChildStyle(child)"
              @change="(val: number) => handleChildChange(child, val)"
            />
          </template>
        </div>

        <!-- input：单行文本 -->
        <t-input
          v-else-if="field.type === 'input'"
          :value="getStringValue(field.name)"
          :size="size"
          :placeholder="field.placeholder"
          :clearable="field.clearable !== false"
          :disabled="resolveDisabled(field)"
          :readonly="field.readonly"
          :type="resolveInputType(field)"
          :suffix="field.suffix"
          :maxlength="field.maxlength"
          :show-word-limit="field.showWordLimit"
          @change="(val: string) => handleChange(field, val)"
          @blur="(val: string) => handleChange(field, val)"
        />

        <!-- textarea：多行文本 -->
        <t-textarea
          v-else-if="field.type === 'textarea'"
          :value="getStringValue(field.name)"
          :placeholder="field.placeholder"
          :autosize="field.autosize ?? { minRows: 3, maxRows: 8 }"
          :disabled="resolveDisabled(field)"
          :readonly="field.readonly"
          :maxlength="field.maxlength"
          :show-word-limit="field.showWordLimit"
          @change="(val: string) => handleChange(field, val)"
          @blur="(val: string) => handleChange(field, val)"
        />

        <!-- markdown：Markdown 编辑器（源码编辑 / 渲染预览） -->
        <markdown-editor
          v-else-if="field.type === 'markdown'"
          :model-value="getStringValue(field.name)"
          :t="localeStore.t"
          :filename="`${field.name}.md`"
          :editor-height="field.markdownHeight ?? '260px'"
          :readonly="resolveDisabled(field) || field.readonly === true"
          @update:model-value="(val: string) => handleChange(field, val)"
        />

        <!-- select：单选下拉 -->
        <t-select
          v-else-if="field.type === 'select'"
          :value="getStringValue(field.name)"
          :size="size"
          :placeholder="field.placeholder"
          :clearable="field.clearable"
          :disabled="resolveDisabled(field)"
          :filterable="field.filterable"
          :popup-props="{
            zIndex: 9527,
            overlayInnerStyle: selectOverlayStyle,
          }"
          :style="resolveFieldStyle(field)"
          @change="(val: string) => handleChange(field, val)"
        >
          <t-option
            v-for="opt in resolveOptions(field)"
            :key="opt.value"
            :value="opt.value"
            :label="opt.label"
          >
            <span class="auto-form-opt">
              <span>{{ opt.label }}</span>
              <span v-if="opt.sub" class="auto-form-opt__sub">{{ opt.sub }}</span>
            </span>
          </t-option>
        </t-select>

        <!-- multi-select：多选下拉 -->
        <t-select
          v-else-if="field.type === 'multi-select'"
          :value="getArrayValue(field.name)"
          :size="size"
          :placeholder="field.placeholder"
          :clearable="field.clearable !== false"
          :disabled="resolveDisabled(field)"
          :filterable="field.filterable"
          multiple
          :popup-props="{
            zIndex: 9527,
            overlayInnerStyle: selectOverlayStyle,
          }"
          :style="resolveFieldStyle(field)"
          @change="(val: string[]) => handleChange(field, val)"
        >
          <t-option
            v-for="opt in resolveOptions(field)"
            :key="opt.value"
            :value="opt.value"
            :label="opt.label"
          >
            <span class="auto-form-opt">
              <span>{{ opt.label }}</span>
              <span v-if="opt.sub" class="auto-form-opt__sub">{{ opt.sub }}</span>
            </span>
          </t-option>
        </t-select>

        <!-- date-picker：日期选择 -->
        <t-date-picker
          v-else-if="field.type === 'date-picker'"
          :value="getStringValue(field.name)"
          :size="size"
          mode="date"
          :format="field.dateFormat ?? 'YYYY-MM-DD'"
          value-type="format"
          :placeholder="field.placeholder"
          :disabled="resolveDisabled(field)"
          :disabled-date="field.disabledDate"
          :style="resolveFieldStyle(field)"
          :popup-props="{ zIndex: 9527 }"
          @change="(val: string) => handleChange(field, val)"
        />

        <!-- date-range-picker：日期范围选择 -->
        <t-date-range-picker
          v-else-if="field.type === 'date-range-picker'"
          :value="getDateRangeValue(field.name)"
          :size="size"
          mode="date"
          :format="field.dateFormat ?? 'YYYY-MM-DD'"
          value-type="format"
          :placeholder="field.placeholder"
          :disabled="resolveDisabled(field)"
          :disabled-date="field.disabledDate"
          :style="resolveFieldStyle(field)"
          :popup-props="{ zIndex: 9527 }"
          @change="(val: string[]) => handleChange(field, val)"
        />

        <!-- month-day-picker：月日选择（不含年份） -->
        <t-date-picker
          v-else-if="field.type === 'month-day-picker'"
          :value="getStringValue(field.name)"
          :size="size"
          mode="date"
          format="MM-DD"
          value-type="format"
          :placeholder="field.placeholder"
          :year="false"
          :disabled="resolveDisabled(field)"
          :style="resolveFieldStyle(field)"
          :popup-props="{ zIndex: 9527 }"
          @change="(val: string) => handleChange(field, val)"
        />

        <!-- time-picker：时间选择 -->
        <t-time-picker
          v-else-if="field.type === 'time-picker'"
          :value="getStringValue(field.name)"
          :size="size"
          :format="field.timeFormat ?? 'HH:mm'"
          :placeholder="field.placeholder"
          :disabled="resolveDisabled(field)"
          :style="resolveFieldStyle(field)"
          :popup-props="{ zIndex: 9527 }"
          @change="(val: string) => handleChange(field, val)"
        />

        <!-- time-range-picker：时间范围选择 -->
        <t-time-range-picker
          v-else-if="field.type === 'time-range-picker'"
          :value="getDateRangeValue(field.name)"
          :size="size"
          :format="field.timeFormat ?? 'HH:mm'"
          :placeholder="field.placeholder"
          :disabled="resolveDisabled(field)"
          :style="resolveFieldStyle(field)"
          :popup-props="{ zIndex: 9527 }"
          @change="(val: string[]) => handleChange(field, val)"
        />

        <!-- switch：开关 -->
        <t-switch
          v-else-if="field.type === 'switch'"
          :value="modelValue[field.name]"
          :size="size"
          :disabled="resolveDisabled(field)"
          @change="(val: boolean) => handleChange(field, val)"
        />

        <!-- number：数字输入 -->
        <t-input-number
          v-else-if="field.type === 'number'"
          :value="getNumberValue(field.name)"
          :size="size"
          :placeholder="field.placeholder"
          :disabled="resolveDisabled(field)"
          :readonly="field.readonly"
          :min="field.min"
          :max="field.max"
          :step="field.step ?? 1"
          :decimal-places="field.decimalPlaces"
          :align="field.align"
          :theme="field.theme"
          :allow-input-over-limit="field.allowInputOverLimit"
          :auto-width="field.autoWidth"
          :large-number="field.largeNumber"
          :label="field.numberLabel"
          :tips="field.tips"
          :style="resolveFieldStyle(field)"
          @change="(val: number) => handleChange(field, val)"
        />

        <!-- slider：滑块 -->
        <t-slider
          v-else-if="field.type === 'slider'"
          :value="getSliderValue(field)"
          :disabled="resolveDisabled(field)"
          :min="field.min ?? 0"
          :max="field.max ?? 100"
          :step="field.step ?? 1"
          :show-input="field.showInput"
          :range="field.range"
          :style="{ ...(resolveFieldStyle(field) ?? { width: '100%' }), padding: '0 8px' }"
          @change="(val: number | number[]) => handleChange(field, val)"
        />

        <!-- checkbox：多选框组 -->
        <t-checkbox-group
          v-else-if="field.type === 'checkbox'"
          :value="getArrayValue(field.name)"
          :size="size"
          :disabled="resolveDisabled(field)"
          :max="field.checkboxMax"
          :layout="field.layout"
          @change="(val: string[]) => handleChange(field, val)"
        >
          <t-checkbox
            v-for="opt in resolveOptions(field)"
            :key="opt.value"
            :value="opt.value"
            :disabled="opt.disabled"
            :size="size"
          >{{ opt.label }}</t-checkbox>
        </t-checkbox-group>
        <!-- radio：单选框组（按钮组模式，使用 t-radio-button 子组件） -->
        <t-radio-group
          v-else-if="field.type === 'radio' && (field.variant === 'primary-filled' || field.variant === 'default-filled')"
          :value="getStringValue(field.name)"
          :size="size"
          :disabled="resolveDisabled(field)"
          :variant="field.variant"
          :allow-uncheck="field.allowUncheck"
          @change="(val: string) => handleChange(field, val)"
        >
          <t-radio-button
            v-for="opt in resolveOptions(field)"
            :key="opt.value"
            :value="opt.value"
            :disabled="opt.disabled"
          >{{ opt.label }}</t-radio-button>
        </t-radio-group>

        <!-- radio：单选框组（普通模式，使用 t-radio 子组件） -->
        <t-radio-group
          v-else-if="field.type === 'radio'"
          :value="getStringValue(field.name)"
          :size="size"
          :disabled="resolveDisabled(field)"
          :variant="field.variant"
          :allow-uncheck="field.allowUncheck"
          :layout="field.layout"
          @change="(val: string) => handleChange(field, val)"
        >
          <t-radio
            v-for="opt in resolveOptions(field)"
            :key="opt.value"
            :value="opt.value"
            :disabled="opt.disabled"
            :size="size"
          >{{ opt.label }}</t-radio>
        </t-radio-group>
        <!-- cascader：级联选择 -->
        <t-cascader
          v-else-if="field.type === 'cascader'"
          :value="modelValue[field.name]"
          :size="size"
          :placeholder="field.placeholder"
          :clearable="field.clearable !== false"
          :disabled="resolveDisabled(field)"
          :filterable="field.filterable"
          :options="resolveTreeData(field)"
          :popup-props="{
            zIndex: 9527,
            overlayInnerStyle: selectOverlayStyle,
          }"
          :style="resolveFieldStyle(field)"
          @change="(val: unknown) => handleChange(field, val)"
        />

        <!-- tree-select：树形选择 -->
        <t-tree-select
          v-else-if="field.type === 'tree-select'"
          :value="modelValue[field.name]"
          :size="size"
          :placeholder="field.placeholder"
          :clearable="field.clearable !== false"
          :disabled="resolveDisabled(field)"
          :filterable="field.filterable"
          :multiple="field.multiple"
          :data="resolveTreeData(field)"
          :popup-props="{
            zIndex: 9527,
            overlayInnerStyle: selectOverlayStyle,
          }"
          :style="resolveFieldStyle(field)"
          @change="(val: unknown) => handleChange(field, val)"
        />

        <!-- upload：文件/图片上传 -->
        <auto-upload
          v-else-if="field.type === 'upload'"
          :value="getUploadValue(field.name)"
          :accept="field.uploadAccept"
          :multiple="field.uploadMultiple"
          :max="field.uploadMax"
          :size-limit="field.uploadSizeLimit"
          :disabled="resolveDisabled(field)"
          :draggable="field.uploadDraggable"
          :theme="field.uploadTheme"
          :tips="field.uploadTips"
          :placeholder="typeof field.placeholder === 'string' ? field.placeholder : undefined"
          :action="field.uploadAction"
          :headers="field.uploadHeaders"
          :request-method="field.uploadRequestMethod"
          @update:value="(val: AutoFormUploadFile[]) => handleChange(field, val)"
          @change="(val: AutoFormUploadFile[]) => handleChange(field, val)"
        />

        <!-- map-picker：高德地图选点（未配置 JS Key 时组件内部降级为文本输入） -->
        <auto-map-picker
          v-else-if="field.type === 'map-picker'"
          :model-value="getStringValue(field.name)"
          :placeholder="typeof field.placeholder === 'string' ? field.placeholder : undefined"
          :disabled="resolveDisabled(field)"
          :style="resolveFieldStyle(field)"
          @update:model-value="(val: string) => handleChange(field, val)"
        />
      </t-form-item>
    </template>

    <!-- #append 插槽：在所有字段之后追加自定义内容（仍位于 t-form 内部，保持表单布局节奏） -->
    <slot name="append" :form-data="modelValue" />
  </t-form>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import AutoUpload from './auto-upload.vue';
import AutoMapPicker from './auto-map-picker.vue';
import MarkdownEditor from '@/components/common/markdown-editor.vue';
import { useLocaleStore } from '@/stores/locale';
import { resolveI18nString, deepResolveI18n } from '@/utils/field-enhancer';
import type { AutoFormField, AutoFormFieldType, AutoFormGroupChild, AutoFormOption, AutoFormRule, AutoFormTreeNode, AutoFormUploadFile } from '@/types/auto-form';
import { MOBILE_BREAKPOINT } from '@/constants/layout';

// ==============================
// i18n
// ==============================

const localeStore = useLocaleStore();
/** 业务自定义 i18n 文案（TDesign 内置 placeholder 由 ConfigProvider 统一提供） */
const t = computed(() => localeStore.t.autoForm);

const props = withDefaults(defineProps<{


  /** 表单数据（v-model） */
  modelValue: Record<string, unknown>;
  /** 字段配置列表 */
  fields: AutoFormField[];
  /** 是否显示冒号，默认 false */
  colon?: boolean;
  /** 表单内控件尺寸，默认 'medium' */
  size?: 'small' | 'medium' | 'large';
  /** 是否禁用整个表单 */
  disabled?: boolean;
  /** 表单标签宽度，默认内容自适应（label 与控件间距由 CSS gap 统一控制），移动端自动切换为 'auto' */
  labelWidth?: string;
  /** 表单标签对齐方式，默认 'left'（移动端自动切换为 'top'） */
  labelAlign?: 'left' | 'right' | 'top';
  /** 是否显示必填标记，默认 undefined */
  requiredMark?: boolean;
  /** 表单布局，默认 'vertical' */
  layout?: 'vertical' | 'inline';
  /** 校验不通过时自动滚动到第一个错误字段，默认 '' 不滚动 */
  scrollToFirstError?: '' | 'smooth' | 'auto';
  /** 是否阻止表单默认提交行为，默认 true */
  preventSubmitDefault?: boolean;
}>(), {
  colon: false,
  size: 'large',
  disabled: false,
  labelWidth: undefined,
  labelAlign: 'left',
  requiredMark: undefined,
  layout: 'vertical',
  scrollToFirstError: 'smooth',
  preventSubmitDefault: true,


});

const emit = defineEmits<{


  /** 双向绑定：表单数据变化（v-model） */
  (e: 'update:modelValue', value: Record<string, unknown>): void;
}>();

// ==============================
// 状态变量
// ==============================

const formRef = ref<{ validate: () => Promise<boolean | Record<string, unknown>> } | null>(null);

/** 是否为移动端（宽度 ≤ MOBILE_BREAKPOINT），内部自动检测，无需外部传入 */
const isMobile = ref(typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT);

// ==============================
// 移动端检测
// ==============================

const handleResize = (): void => {
  isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT;
};

onMounted(() => {
  window.addEventListener('resize', handleResize);


});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
});

// ==============================
// 计算属性
// ==============================

/** 过滤掉 visible 返回 false 的字段；并对每个字段深度解析 $t:xxx 使 label/placeholder 跟随语言切换 */
const visibleFields = computed(() =>
  props.fields
    .filter((field) => {
      // 未配置 visible 时默认显示
      if (field.visible === undefined) return true;
      // 函数形式：调用函数并根据返回值决定
      if (typeof field.visible === 'function') return field.visible(props.modelValue);
      // 静态布尔值：直接使用
      return field.visible;
    })
    .map((field) => deepResolveI18n(field) as AutoFormField),
);

/** 标签对齐方式：优先使用 props，移动端自动切换为 top */
const labelAlign = computed(() => {
  if (isMobile.value) return 'top';
  return props.labelAlign ?? 'left';
});
/** 标签宽度：统一固定值（不区分中英文），保证各字段控件左边缘对齐；移动端 label 置顶，回退 auto */
const labelWidth = computed(() => (isMobile.value ? 'auto' : props.labelWidth ?? '200px'));

/**  */
const colon = computed(() => props.colon !== false);

const size = computed(() => props.size ?? 'medium');

// ==============================
// 私有方法：取值辅助（替代模板中的 as 类型断言）
// ==============================

/**
 * 从 modelValue 中取字符串值
 * @param name - 字段名
 * @returns 字符串值，非字符串时返回空字符串
 */
const getStringValue = (name: string): string => {
  const val = props.modelValue[name];
  return typeof val === 'string' ? val : '';
};

/**
 * 从 modelValue 中取数字值
 * @param name - 字段名
 * @returns 数字值，非数字时返回 undefined
 */
const getNumberValue = (name: string): number | undefined => {
  const val = props.modelValue[name];
  return typeof val === 'number' ? val : undefined;
};

/**
 * 从 modelValue 中取字符串数组值（用于 multi-select）
 * @param name - 字段名
 * @returns 字符串数组，非数组时返回空数组
 */
const getArrayValue = (name: string): string[] => {
  const val = props.modelValue[name];
  return Array.isArray(val) ? (val as string[]) : [];
};

/**
 * 从 modelValue 中取日期/时间范围值（用于 date-range-picker / time-range-picker）
 * @param name - 字段名
 * @returns 字符串二元组，非数组时返回空数组
 */
const getDateRangeValue = (name: string): string[] => {
  const val = props.modelValue[name];
  return Array.isArray(val) ? (val as string[]) : [];
};

/**
 * 从 modelValue 中取上传文件列表（用于 upload）
 * @param name - 字段名
 * @returns AutoFormUploadFile 数组，非数组时返回空数组
 */
const getUploadValue = (name: string): AutoFormUploadFile[] => {
  const val = props.modelValue[name];
  return Array.isArray(val) ? (val as AutoFormUploadFile[]) : [];
};

/**
 * 获取 slider 的 value，range 模式下返回 number[]，否则返回 number
 * @param field - 字段配置
 * @returns slider value
 */
const getSliderValue = (field: AutoFormField): number | number[] => {
  const val = props.modelValue[field.name];
  if (field.range) {
    return Array.isArray(val) ? (val as number[]) : [field.min ?? 0, field.max ?? 100];
  }
  return typeof val === 'number' ? val : (field.min ?? 0);
};

/**
 * group 子字段版的 getSliderValue【模板适配】
 * @description 将 AutoFormGroupChild 收敛为 AutoFormField 后复用 getSliderValue，
 *              避免在模板中书写 as 断言（遵循“Vue 模板内禁用 as”规约）
 * @param child - group 子字段配置
 * @returns slider value
 */
const getChildSliderValue = (child: AutoFormGroupChild): number | number[] =>
  getSliderValue(child as unknown as AutoFormField);

/**
 * select 下拉宽度跟随触发元素（100%）
 * @param trigger - 触发元素
 * @returns 内联样式对象
 */
const selectOverlayStyle = (trigger: HTMLElement): Record<string, string> => ({
  width: `${trigger.offsetWidth}px`,
});


// ==============================
// 私有方法：解析动态配置
// ==============================

/**
 * 将规则中字符串形式的 pattern 转为 RegExp，并补充默认 trigger
 * @param rules - 原始规则数组
 * @returns 处理后的规则数组
 */
/**
 * 生成数字范围验证函数
 * @param min - 最小值（undefined 表示不限制）
 * @param max - 最大值（undefined 表示不限制）
 * @returns FormRule validator 函数
 */
const validateNumber = (min?: number, max?: number) => (val: unknown) => {
  const num = Number(val);
  if (val === '' || val === null || val === undefined || Number.isNaN(num)) return true;
  return (min === undefined || num >= min) && (max === undefined || num <= max);
};

const normalizeRules = (rules: AutoFormRule[], fieldType?: string): AutoFormRule[] =>
  rules.map?.((rule) => {
    const normalized: AutoFormRule = { ...rule };
    // 字符串 pattern 转为 RegExp
    if (typeof normalized.pattern === 'string') {
      normalized.pattern = new RegExp(normalized.pattern);
    }
    // numberMin / numberMax 转为 validator 函数进行数字范围验证
    if (normalized.numberMin !== undefined || normalized.numberMax !== undefined) {
      normalized.validator = validateNumber(normalized.numberMin, normalized.numberMax);
    }
    // 未指定 trigger 时，根据控件类型决定：
    // - 文本输入类（input / textarea / number）使用 blur（失焦后验证）
    // - 选择/上传/开关等交互类使用 change（值变更时立即验证）
    if (!normalized.trigger) {
      const blurTypes: AutoFormFieldType[] = ['input', 'textarea', 'number'];
      normalized.trigger = blurTypes.includes(fieldType as AutoFormFieldType) ? 'blur' : 'change';
    }
    return normalized;
  });

/**
 * 解析字段是否显示必填红星
 * - props.requiredMark 为 false 时强制不显示
 * - 否则根据 rules 中是否有 required: true 决定
 * @param field - 字段配置
 * @returns 是否显示必填红星
 */
const resolveRequiredMark = (field: AutoFormField): boolean | undefined => {
  // 1. 字段级别明确配置时，优先使用
  if (field.requiredMark !== undefined) return field.requiredMark;
  // 2. 全局明确传 false 时，强制不显示红星
  if (props.requiredMark === false) return false;
  // 3. 读取 rules 中是否有 required: true，有则显示红星
  const rules = typeof field.rules === 'function' ? field.rules(props.modelValue) : (field.rules ?? []);
  return rules.some?.((rule) => rule.required === true);
};

/**
 * 解析字段的验证规则（支持静态数组和动态函数，自动转换字符串 pattern）
 * @param field - 字段配置
 * @returns 验证规则数组
 */
const resolveRules = (field: AutoFormField): AutoFormRule[] => {
  if (!field.rules) return [];
  const raw = typeof field.rules === 'function' ? field.rules(props.modelValue) : field.rules;
  return normalizeRules(raw, field.type);
};

/**
/**
 * 解析字段的下拉选项（支持静态数组和动态函数）
 * @description 对结果调用 deepResolveI18n，使函数返回的 options 中的 $t:xxx 也跟随语言切换
 * @param field - 字段配置或子字段配置
 * @returns 选项数组
 */
const resolveOptions = (field: AutoFormField | AutoFormGroupChild): AutoFormOption[] => {
  if (!field.options) return [];
  const raw = typeof field.options === 'function' ? field.options(props.modelValue) : field.options;
  return deepResolveI18n(raw) as AutoFormOption[];
};

/**
 * 解析级联 / 树形选择的数据源（支持静态数组和动态函数）
 * @param field - 字段配置
 * @returns 树形节点数组
 */
const resolveTreeData = (field: AutoFormField): AutoFormTreeNode[] => {
  if (!field.treeData) return [];
  if (typeof field.treeData === 'function') return field.treeData(props.modelValue);
  return field.treeData;
};

/**
 * group 子字段版的 resolveTreeData【模板适配】
 * @description 将 AutoFormGroupChild 收敛为 AutoFormField 后复用 resolveTreeData，
 *              避免在模板中书写 as 断言（遵循“Vue 模板内禁用 as”规约）
 * @param child - group 子字段配置
 * @returns 树形节点数组
 */
const resolveChildTreeData = (child: AutoFormGroupChild): AutoFormTreeNode[] =>
  resolveTreeData(child as unknown as AutoFormField);

/**
 * 解析 input 字段的 type 属性（支持静态字符串和动态函数）
 * @param field - 字段配置
 * @returns input type 字符串，默认 'text'
 */
const resolveInputType = (field: AutoFormField): string => {
  if (!field.inputType) return 'text';
  if (typeof field.inputType === 'function') return field.inputType(props.modelValue);
  return field.inputType;
};

/**
 * 解析字段的禁用状态（支持静态布尔和动态函数）
 * - forceEnabled: true 时，即使全局 disabled 也不禁用该字段
 * @param field - 字段配置或子字段配置
 * @returns 是否禁用
 */
const resolveDisabled = (field: AutoFormField | AutoFormGroupChild): boolean => {
  if (props.disabled && !field.forceEnabled) return true;
  if (typeof field.disabled === 'function') return field.disabled(props.modelValue);
  return field.disabled ?? false;
};

/**
 * 解析字段的帮助提示文本（支持静态字符串、$t:xxx 国际化引用和动态函数）
 * @description 调用 resolveI18nString 以支持 $t:xxx 运行时解析，
 *              使 help 文案能随 locale store 的语言切换响应式更新。
 *              函数首行显式读取 localeStore.lang，确保 TDesign t-form-item 的
 *              #help slot 渲染 effect 能追踪语言切换依赖（否则当 help 是 handler
 *              函数时，外层 visibleFields computed 不会依赖 locale，slot 内的
 *              函数调用不会重新触发）。
 * @param field - 字段配置
 * @returns 帮助提示文本，无内容时返回空字符串
 */
const resolveHelp = (field: AutoFormField): string => {
  // 显式依赖 lang：让包含此调用的 render effect 必然追踪语言切换
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  localeStore.lang;
  if (!field.help) return '';
  const raw = typeof field.help === 'function' ? field.help(props.modelValue) : field.help;
  const resolved = resolveI18nString(raw);
  return typeof resolved === 'string' ? resolved : '';
};

/**
 * 解析主字段的内联样式
 * - 配置了 width 时使用该值
 * - autoWidth 为 true 时不设置宽度（由内容撑开）
 * - 否则默认宽度 100%
 * @param field - 字段配置
 * @returns 内联样式对象或 undefined
 */
const resolveFieldStyle = (field: AutoFormField): Record<string, string> | undefined => {
  if (field.autoWidth) return undefined;
  if (field.width) return { width: field.width };
  return { width: '100%' };
};

/**
 * 解析 group 子字段的内联样式
 * @param child - 子字段配置
 * @returns 内联样式对象
 */
const resolveChildStyle = (child: AutoFormGroupChild): Record<string, string> => {
  if (!child.width) return { flex: '1', minWidth: '0' };
  // 纯数字视为 flex 比例
  if (/^\d+$/.test(child.width)) return { flex: child.width, minWidth: '0' };
  return { width: child.width, flexShrink: '0' };
};

/**
 * 处理字段值变更
 * @param field - 字段配置
 * @param value - 新值
 */
const handleChange = (field: AutoFormField, value: unknown): void => {
  // disabled 的字段不应该产生值变更（部分 UI 组件在 disabled 状态下仍可能 emit change）
  if (resolveDisabled(field)) return;

  const newData = { ...props.modelValue, [field.name]: value };
  if (typeof field.onChange === 'function') {
    field.onChange(value, newData);
  }
  emit('update:modelValue', newData);
};

/**
 * 处理 group 子字段值变更
 * @param child - 子字段配置
 * @param value - 新值
 */
const handleChildChange = (child: AutoFormGroupChild, value: unknown): void => {
  const newData = { ...props.modelValue, [child.name]: value };
  if (typeof child.onChange === 'function') {
    child.onChange(value, newData);
  }
  emit('update:modelValue', newData);
};

// ==============================
// 暴露方法
// ==============================

/**
 * 触发表单验证
 * @returns true 表示验证通过，否则返回错误信息对象
 */
const validate = async (): Promise<boolean | Record<string, unknown>> => {
  if (!formRef.value) return true;
  return formRef.value.validate();
};

/**
 * 清除表单校验状态
 * @description 用于抽屉/对话框打开后清除 validate-on-rule-change 触发的首次校验
 * @param fields - 可选，指定需要清除的字段名数组；不传则清除全部
 */
const clearValidate = (fields?: string[]): void => {
  (formRef.value as unknown as { clearValidate?: (fields?: string[]) => void })?.clearValidate?.(fields);
};

defineExpose({ validate, clearValidate });
</script>

<style scoped>
/* vertical 布局下，字段默认撑满整行 */
.auto-form--vertical .auto-form-item {
  width: 100% !important;
}

:deep(.auto-form-item .t-form__controls) {
  display: flex;
  flex-direction: column;
}

:deep(.auto-form-item .t-form__controls-content) {
  order: 0;
}

:deep(.auto-form-item .t-form__status) {
  order: 1;
  margin-top: 4px;
}

:deep(.auto-form-item .t-input__help) {
  order: 2;
}

.auto-form--inline {
  row-gap: 28px !important;
}

/* 左侧/右侧 label 布局：label 与控件首行对齐，间距用 gap */
/* 注意：不能用 align-items:center —— 带 #help 说明文字时 controls 变高，label 会被顶到中间而错位 */
.auto-form:not(.auto-form--label-top) :deep(.t-form-item),
.auto-form:not(.auto-form--label-top) :deep(.t-form__item) {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}

/* vertical 布局：label 用统一宽度，保证各字段输入框左边缘对齐 */
.auto-form--vertical:not(.auto-form--label-top) :deep(.t-form__label),
.auto-form--vertical:not(.auto-form--label-top) :deep(.t-form-item__label) {
  flex: 0 0 var(--auto-form-label-width) !important;
  width: var(--auto-form-label-width) !important;
}

/* inline 布局：label 按内容自适应，避免短 label 后空出一大片 */
.auto-form--inline:not(.auto-form--label-top) :deep(.t-form__label),
.auto-form--inline:not(.auto-form--label-top) :deep(.t-form-item__label) {
  flex: 0 0 auto !important;
  width: auto !important;
}

.auto-form:not(.auto-form--label-top) :deep(.t-form__label),
.auto-form:not(.auto-form--label-top) :deep(.t-form-item__label) {
  display: flex;
  align-items: center;
  align-self: flex-start;
  min-width: 0 !important;
  max-width: none !important;
  padding: 0 !important;
  margin: 0 !important;
  height: 40px;
  line-height: 40px !important;
  white-space: nowrap;
}

.auto-form:not(.auto-form--label-top) :deep(.t-form__controls) {
  flex: 1 1 auto;
  min-width: 0;
  margin-left: 0 !important;
}

/* 控件首行高度固定为表单项尺寸，保证 label 与 input/select 视觉居中对齐 */
.auto-form:not(.auto-form--label-top) :deep(.t-form__controls-content) {
  min-height: 40px;
}

.auto-form-group {
  display: flex;
  align-items: center;
  width: 100%;
}

@media (max-width: 768px) {
  :deep(.auto-form-item) {
    padding-bottom: 20px;
  }

  /* 标签 top 对齐时减少底部间距 */
  :deep(.t-form__label) {
    padding-bottom: 6px !important;
    line-height: 40px !important;
  }

  /* group 在移动端允许换行，避免子字段过窄 */
  .auto-form-group {
    flex-wrap: wrap;
  }

  /* group 换行后每个子字段占满整行 */
  .auto-form-group > * {
    min-width: 100% !important;
    flex: none !important;
    width: 100% !important;
  }
}

/* 修复主题样式 !important 覆盖错误状态边框颜色的问题 */
/* TDesign 错误状态：.t-is-error 在 form-item 根元素上，控件在 .t-form__controls-content 内 */

/* input / input-number */
:deep(.t-is-error .t-form__controls-content .t-input),
:deep(.t-is-error .t-form__controls-content .t-input-number .t-input) {
  border-color: var(--accent-red) !important;
  background-color: rgba(var(--accent-red-rgb, 244, 63, 94), 0.06) !important;
}

/* textarea */
:deep(.t-is-error .t-form__controls-content .t-textarea__inner) {
  border-color: var(--accent-red) !important;
  background-color: rgba(var(--accent-red-rgb, 244, 63, 94), 0.06) !important;
}

/* select / multi-select */
:deep(.t-is-error .t-form__controls-content .t-select__wrap .t-input),
:deep(.t-is-error .t-form__controls-content .t-select .t-input) {
  border-color: var(--accent-red) !important;
  background-color: rgba(var(--accent-red-rgb, 244, 63, 94), 0.06) !important;
}

/* date-picker / month-day-picker */
:deep(.t-is-error .t-form__controls-content .t-date-picker .t-input),
:deep(.t-is-error .t-form__controls-content .t-date-picker__input .t-input) {
  border-color: var(--accent-red) !important;
  background-color: rgba(var(--accent-red-rgb, 244, 63, 94), 0.06) !important;
}

/* date-range-picker */
:deep(.t-is-error .t-form__controls-content .t-date-range-picker .t-input),
:deep(.t-is-error .t-form__controls-content .t-date-range-picker__input .t-input) {
  border-color: var(--accent-red) !important;
  background-color: rgba(var(--accent-red-rgb, 244, 63, 94), 0.06) !important;
}

/* time-picker */
:deep(.t-is-error .t-form__controls-content .t-time-picker .t-input) {
  border-color: var(--accent-red) !important;
  background-color: rgba(var(--accent-red-rgb, 244, 63, 94), 0.06) !important;
}

/* time-range-picker */
:deep(.t-is-error .t-form__controls-content .t-time-range-picker .t-input) {
  border-color: var(--accent-red) !important;
  background-color: rgba(var(--accent-red-rgb, 244, 63, 94), 0.06) !important;
}

/* cascader */
:deep(.t-is-error .t-form__controls-content .t-cascader .t-input) {
  border-color: var(--accent-red) !important;
  background-color: rgba(var(--accent-red-rgb, 244, 63, 94), 0.06) !important;
}

/* tree-select */
:deep(.t-is-error .t-form__controls-content .t-tree-select .t-input) {
  border-color: var(--accent-red) !important;
  background-color: rgba(var(--accent-red-rgb, 244, 63, 94), 0.06) !important;
}

/* radio-group */
:deep(.t-is-error .t-form__controls-content .t-radio-group) {
  color: var(--accent-red);
}

/* checkbox-group */
:deep(.t-is-error .t-form__controls-content .t-checkbox-group) {
  color: var(--accent-red);
}

/* textarea 字数统计显示在文本框内部右下角 */
:deep(.t-textarea) {
  position: relative;
}

:deep(.t-textarea .t-textarea__limit) {
  position: absolute;
  right: 8px;
  bottom: 6px;
  font-size: 12px;
  color: var(--text-muted);
  pointer-events: none;
  line-height: 1;
}

:deep(.t-textarea .t-textarea__inner) {
  padding-bottom: 22px;
}

/* label 字体大小，跟随 size 变化 */
:deep(.t-form__label) {
  font-size: 16px;
  line-height: 40px;
}



/* help 提示文字样式 */
:deep(.t-input__help) {
  font-size: 14px;
  margin-top: 12px;
}

/* 错误信息与输入控件之间的间距 */
:deep(.t-input__extra) {
  font-size: 14px;
}

/* radio / checkbox 尺寸：通过 CSS 变量覆盖 TDesign 默认值 */
:deep(.t-radio__input) {
  width: 20px;
  height: 20px;
}

:deep(.t-radio__input::after) {
  width: 20px;
  height: 20px;
  margin-top: -10px;
  margin-left: -10px;
}
:deep(.t-radio__label) {
  font-size: 16px;
}

:deep(.t-checkbox__input) {
  width: 20px;
  height: 20px;
}

:deep(.t-textarea__inner) {
  font-size: 16px;
}

/* 修正放大后对钩位置偏移（原始基于 16x16，按比例 20/16 调整） */
:deep(.t-checkbox.t-is-checked .t-checkbox__input::after) {
  top: 7.5px;
  left: 3.75px;
  width: 6.25px;
  height: 11.25px;
}

:deep(.t-checkbox.t-is-indeterminate .t-checkbox__input::after) {
  top: 6.25px;
}

:deep(.t-checkbox__label) {
  font-size: 16px;
}

/* 下拉选项：主文字 + 弱化说明（说明不参与取值与回显，只在面板里提示） */
.auto-form-opt {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.auto-form-opt__sub {
  font-size: 11px;
  color: var(--text-muted, #9e9e9e);
  white-space: nowrap;
}
</style>
