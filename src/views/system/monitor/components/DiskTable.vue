<script setup lang="ts">
import type { DiskInfo } from "@/api/monitor";

defineOptions({ name: "DiskTable" });

defineProps({
  data: {
    type: Array as () => DiskInfo["partitions"],
    default: () => []
  }
});

function getUsageColor(usage: string) {
  const percent = parseFloat(usage);
  if (percent >= 90) return "#F56C6C";
  if (percent >= 70) return "#E6A23C";
  return "#67C23A";
}
</script>

<template>
  <el-table :data="data" stripe size="small">
    <el-table-column
      prop="name"
      label="名称"
      min-width="100"
      show-overflow-tooltip
    />
    <el-table-column
      prop="mount"
      label="挂载点"
      min-width="150"
      show-overflow-tooltip
    />
    <el-table-column prop="type" label="类型" width="100" />
    <el-table-column prop="total" label="总容量" width="110" />
    <el-table-column prop="free" label="可用空间" width="110" />
    <el-table-column label="使用率" width="200">
      <template #default="{ row }">
        <el-progress
          :percentage="parseFloat(row.usage)"
          :color="getUsageColor(row.usage)"
          :stroke-width="14"
          :text-inside="true"
        />
      </template>
    </el-table-column>
  </el-table>
</template>
