<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { http } from "@/utils/http";

defineOptions({ name: "ManagementMonitor" });

const loading = ref(false);
const data = ref<Record<string, any>>({});

async function loadData() {
  loading.value = true;
  try {
    const res = await http.request<any>("get", "/api/management/monitor");
    if (res?.code === 200) data.value = res.data ?? {};
  } catch {
    data.value = {};
  } finally {
    loading.value = false;
  }
}

function memPercent(jvm: any) {
  return jvm?.heapPercent ?? 0;
}

function memColor(percent: number) {
  if (percent > 85) return "#F56C6C";
  if (percent > 70) return "#E6A23C";
  return "#409EFF";
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div v-loading="loading" class="p-4">
    <div class="flex-bc mb-4">
      <span class="text-lg font-semibold">系统监控</span>
      <el-button :icon="useRenderIcon('ri/refresh-line')" @click="loadData"
        >刷新</el-button
      >
    </div>

    <el-row :gutter="16" class="mb-4">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="text-center">
            <div class="text-3xl text-(--el-color-primary) font-bold">
              {{ data.jvm?.heapUsed ?? "-" }}
            </div>
            <div class="text-sm text-gray-500 mt-1">JVM 已用内存</div>
            <div class="text-xs text-gray-400">
              最大: {{ data.jvm?.heapMax ?? "-" }}
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="text-center">
            <div class="text-3xl text-(--el-color-success) font-bold">
              {{ data.jvm?.threads ?? "-" }}
            </div>
            <div class="text-sm text-gray-500 mt-1">活跃线程数</div>
            <div class="text-xs text-gray-400">
              运行时间: {{ data.jvm?.uptime ?? "-" }}
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="text-center">
            <div class="text-3xl text-(--el-color-warning) font-bold">
              {{ data.database?.activeConnections ?? "-" }} /
              {{ data.database?.maxPoolSize ?? "-" }}
            </div>
            <div class="text-sm text-gray-500 mt-1">数据库连接 (活跃/最大)</div>
            <div class="text-xs text-gray-400">
              空闲: {{ data.database?.idleConnections ?? "-" }}
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="text-center">
            <div class="text-3xl text-(--el-color-info) font-bold">
              {{ data.redis?.dbSize ?? "-" }}
            </div>
            <div class="text-sm text-gray-500 mt-1">Redis Key 数量</div>
            <div class="text-xs text-gray-400">
              内存: {{ data.redis?.usedMemory ?? "-" }}
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="mb-4">
      <el-col :span="12">
        <el-card>
          <template #header
            ><span class="font-semibold">JVM 内存</span></template
          >
          <el-progress
            :percentage="memPercent(data.jvm)"
            :color="memColor(memPercent(data.jvm))"
            :stroke-width="20"
            :text-inside="true"
          />
          <div class="mt-3 text-sm text-gray-500">
            已用 {{ data.jvm?.heapUsed ?? "-" }} / 最大
            {{ data.jvm?.heapMax ?? "-" }}
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header
            ><span class="font-semibold">数据库连接池</span></template
          >
          <el-progress
            :percentage="
              data.database
                ? Math.round(
                    (data.database.activeConnections /
                      data.database.maxPoolSize) *
                      100
                  )
                : 0
            "
            :stroke-width="20"
            :text-inside="true"
          />
          <div class="mt-3 text-sm text-gray-500">
            活跃 {{ data.database?.activeConnections ?? "-" }} / 最大
            {{ data.database?.maxPoolSize ?? "-" }} / 空闲
            {{ data.database?.idleConnections ?? "-" }}
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card>
          <template #header
            ><span class="font-semibold">服务器信息</span></template
          >
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="操作系统">{{
              data.server?.os ?? "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="Java 版本">{{
              data.server?.javaVersion ?? "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="CPU 核数">{{
              data.server?.processors ?? "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="总内存">{{
              data.server?.totalMemory ?? "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="可用内存">{{
              data.server?.freeMemory ?? "-"
            }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header
            ><span class="font-semibold">Redis 信息</span></template
          >
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="版本">{{
              data.redis?.redisVersion ?? "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="内存占用">{{
              data.redis?.usedMemory ?? "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="连接数">{{
              data.redis?.connectedClients ?? "-"
            }}</el-descriptions-item>
            <el-descriptions-item label="运行天数"
              >{{ data.redis?.uptimeInDays ?? "-" }} 天</el-descriptions-item
            >
            <el-descriptions-item label="Key 数量">{{
              data.redis?.dbSize ?? "-"
            }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
