<template>
  <div class="est-form">
    <n-form label-placement="left" label-width="auto" size="small">
      <n-grid :cols="2" :x-gap="16" :y-gap="2">
        <n-gi>
          <n-form-item label="编码生产率">
            <n-input-number v-model:value="model.codingProductivity" :min="1" :max="100000" :step="10" style="width: 100%">
              <template #suffix>代码行/人日</template>
            </n-input-number>
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item label="人月折算人日">
            <n-input-number v-model:value="model.personDaysPerMonth" :min="1" :max="31" :step="0.25" style="width: 100%">
              <template #suffix>人日/人月</template>
            </n-input-number>
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item label="人力成本单价">
            <n-input-number v-model:value="model.laborCostPerMonth" :min="0" :max="10000000" :step="1000" style="width: 100%">
              <template #suffix>元/人月</template>
            </n-input-number>
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item label="团队人数">
            <n-input-number v-model:value="model.teamSize" :min="1" :max="10000" :step="1" style="width: 100%">
              <template #suffix>人</template>
            </n-input-number>
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item label="每日工时">
            <n-input-number v-model:value="model.workHoursPerDay" :min="1" :max="24" :step="0.5" style="width: 100%">
              <template #suffix>小时/人日</template>
            </n-input-number>
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item label="测试用例密度">
            <n-input-number v-model:value="model.testCaseDensity" :min="0" :max="10000" :step="1" style="width: 100%">
              <template #suffix>个/千行</template>
            </n-input-number>
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item label="缺陷密度">
            <n-input-number v-model:value="model.defectDensity" :min="0" :max="10000" :step="0.5" style="width: 100%">
              <template #suffix>个/千行</template>
            </n-input-number>
          </n-form-item>
        </n-gi>
        <n-gi>
          <n-form-item label="设计编码占比">
            <n-input-number v-model:value="model.designCodingRatio" :min="0.01" :max="1" :step="0.05" style="width: 100%">
              <template #suffix>比例</template>
            </n-input-number>
          </n-form-item>
        </n-gi>
      </n-grid>
    </n-form>
    <div class="est-form-actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup>
import { NForm, NFormItem, NGrid, NGi, NInputNumber } from 'naive-ui';

const model = defineModel({
  type: Object,
  required: true
});
</script>

<style scoped>
.est-form-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
</style>
