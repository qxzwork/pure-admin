<script setup lang="ts">
import type { NetworkInfo } from "@/api/monitor";

defineOptions({ name: "NetworkTable" });

defineProps({
  data: {
    type: Array as () => NetworkInfo["interfaces"],
    default: () => []
  }
});
</script>

<template>
  <el-table :data="data" stripe size="small">
    <el-table-column
      prop="displayName"
      label="网卡名称"
      min-width="150"
      show-overflow-tooltip
    />
    <el-table-column
      prop="ipv4"
      label="IPv4 地址"
      min-width="140"
      show-overflow-tooltip
    />
    <el-table-column prop="mac" label="MAC 地址" width="160" />
    <el-table-column prop="bytesRecv" label="接收流量" width="110" />
    <el-table-column prop="bytesSent" label="发送流量" width="110" />
    <el-table-column prop="speed" label="速度" width="120" />
  </el-table>
</template>
