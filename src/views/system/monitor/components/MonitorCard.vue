<script setup lang="ts">
defineOptions({ name: "MonitorCard" });

defineProps({
  title: { type: String, required: true },
  icon: { type: String, default: "" },
  loading: { type: Boolean, default: false }
});
</script>

<template>
  <el-card
    shadow="never"
    class="monitor-card h-full"
    :body-style="{ padding: '16px' }"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <span v-if="icon" class="text-lg">
          <iconify-icon-offline :icon="icon" />
        </span>
        <span class="font-semibold text-sm">{{ title }}</span>
      </div>
    </template>
    <div v-loading="loading">
      <slot />
    </div>
  </el-card>
</template>

<style lang="scss" scoped>
.monitor-card {
  :deep(.el-card__header) {
    padding: 12px 16px;
    border-bottom: 1px solid var(--el-border-color-lighter);
  }
}
</style>
