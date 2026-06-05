<script setup lang="ts">
import dayjs from "dayjs";
import type { ProcessInfo } from "@/api/monitor";

defineOptions({ name: "ProcessTable" });

defineProps({
  data: {
    type: Array as () => ProcessInfo["topProcesses"],
    default: () => []
  }
});

function formatTime(ts: number) {
  return ts > 0 ? dayjs(ts).format("MM-DD HH:mm") : "-";
}
</script>

<template>
  <el-table :data="data" stripe size="small">
    <el-table-column prop="pid" label="PID" width="80" />
    <el-table-column
      prop="name"
      label="进程名称"
      min-width="150"
      show-overflow-tooltip
    />
    <el-table-column prop="cpu" label="CPU" width="90">
      <template #default="{ row }">
        <el-tag
          :type="parseFloat(row.cpu) > 50 ? 'danger' : 'success'"
          size="small"
          effect="plain"
        >
          {{ row.cpu }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="memory" label="内存" width="90">
      <template #default="{ row }">
        <el-tag
          :type="parseFloat(row.memory) > 50 ? 'warning' : 'info'"
          size="small"
          effect="plain"
        >
          {{ row.memory }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column
      prop="user"
      label="用户"
      width="120"
      show-overflow-tooltip
    />
    <el-table-column label="启动时间" width="120">
      <template #default="{ row }">
        {{ formatTime(row.startTime) }}
      </template>
    </el-table-column>
  </el-table>
</template>
