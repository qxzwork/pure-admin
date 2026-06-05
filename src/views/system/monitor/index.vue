<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from "vue";
import { message } from "@/utils/message";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import {
  getMonitorData,
  clearMonitorCache,
  type MonitorData
} from "@/api/monitor";
import MonitorCard from "./components/MonitorCard.vue";
import DiskTable from "./components/DiskTable.vue";
import NetworkTable from "./components/NetworkTable.vue";
import ProcessTable from "./components/ProcessTable.vue";

defineOptions({ name: "SystemMonitor" });

const loading = ref(false);
const monitorData = ref<MonitorData | null>(null);
const refreshInterval = ref(120000);
let timer: ReturnType<typeof setInterval> | null = null;

const intervalOptions = [
  { label: "关闭", value: 0 },
  { label: "30秒", value: 30000 },
  { label: "1分钟", value: 60000 },
  { label: "2分钟", value: 120000 },
  { label: "5分钟", value: 300000 }
];

async function fetchData() {
  loading.value = true;
  try {
    const res = await getMonitorData();
    if (res?.code === 200) {
      monitorData.value = res.data;
    } else {
      message(res?.message ?? "获取监控数据失败", { type: "error" });
    }
  } catch (e: any) {
    message(e?.message ?? "获取监控数据失败", { type: "error" });
  } finally {
    loading.value = false;
  }
}

function startTimer() {
  stopTimer();
  if (refreshInterval.value > 0) {
    timer = setInterval(fetchData, refreshInterval.value);
  }
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function handleIntervalChange(val: number) {
  refreshInterval.value = val;
  startTimer();
}

async function handleClearCache() {
  try {
    const res = await clearMonitorCache();
    if (res?.code === 200) {
      message("缓存已清除", { type: "success" });
      fetchData();
    } else {
      message(res?.message ?? "清除缓存失败", { type: "error" });
    }
  } catch (e: any) {
    message(e?.message ?? "清除缓存失败", { type: "error" });
  }
}

function getLoadColor(load: string) {
  const percent = parseFloat(load);
  if (percent >= 80) return "#F56C6C";
  if (percent >= 60) return "#E6A23C";
  return "#67C23A";
}

function getUsagePercent(usage: string) {
  return parseFloat(usage) || 0;
}

onMounted(() => {
  fetchData();
  startTimer();
});

onBeforeUnmount(() => {
  stopTimer();
});
</script>

<template>
  <div class="p-4 monitor-page">
    <!-- 顶部操作栏 -->
    <div class="flex-bc mb-4">
      <h2 class="text-lg font-bold m-0">系统监控</h2>
      <div class="flex items-center gap-3">
        <span class="text-sm text-gray-500">刷新间隔</span>
        <el-select
          :model-value="refreshInterval"
          style="width: 100px"
          @change="handleIntervalChange"
        >
          <el-option
            v-for="opt in intervalOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-button
          :icon="useRenderIcon('ri/refresh-line')"
          :loading="loading"
          @click="fetchData"
        >
          刷新
        </el-button>
        <el-button
          :icon="useRenderIcon('ri/delete-bin-line')"
          @click="handleClearCache"
        >
          清除缓存
        </el-button>
      </div>
    </div>

    <!-- 统计卡片行 -->
    <el-row :gutter="16" class="mb-4">
      <el-col :xs="24" :sm="12" :lg="6" class="mb-3">
        <div class="stat-card stat-card--blue">
          <div class="stat-card__icon">
            <iconify-icon-offline icon="ri/time-line" />
          </div>
          <div class="stat-card__content">
            <div class="stat-card__label">运行时间</div>
            <div class="stat-card__value">
              {{ monitorData?.system?.uptime ?? "-" }}
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6" class="mb-3">
        <div
          class="stat-card"
          :class="
            getUsagePercent(monitorData?.cpu?.systemLoad ?? '0%') >= 80
              ? 'stat-card--red'
              : getUsagePercent(monitorData?.cpu?.systemLoad ?? '0%') >= 60
                ? 'stat-card--orange'
                : 'stat-card--green'
          "
        >
          <div class="stat-card__icon">
            <iconify-icon-offline icon="ri/cpu-line" />
          </div>
          <div class="stat-card__content">
            <div class="stat-card__label">CPU 负载</div>
            <div class="stat-card__value">
              {{ monitorData?.cpu?.systemLoad ?? "-" }}
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6" class="mb-3">
        <div
          class="stat-card"
          :class="
            getUsagePercent(monitorData?.memory?.physical?.usage ?? '0%') >= 80
              ? 'stat-card--red'
              : getUsagePercent(monitorData?.memory?.physical?.usage ?? '0%') >=
                  60
                ? 'stat-card--orange'
                : 'stat-card--purple'
          "
        >
          <div class="stat-card__icon">
            <iconify-icon-offline icon="ri/ram-line" />
          </div>
          <div class="stat-card__content">
            <div class="stat-card__label">内存使用</div>
            <div class="stat-card__value">
              {{ monitorData?.memory?.physical?.usage ?? "-" }}
            </div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6" class="mb-3">
        <div class="stat-card stat-card--cyan">
          <div class="stat-card__icon">
            <iconify-icon-offline icon="ri/git-branch-line" />
          </div>
          <div class="stat-card__content">
            <div class="stat-card__label">进程 / 线程</div>
            <div class="stat-card__value">
              {{ monitorData?.process?.processCount ?? "-" }} /
              {{ monitorData?.process?.threadCount ?? "-" }}
            </div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- CPU + 内存 -->
    <el-row :gutter="16" class="mb-4">
      <el-col :xs="24" :lg="12" class="mb-3">
        <MonitorCard title="CPU 信息" icon="ri/cpu-line" :loading="loading">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="名称" :span="2">
              {{ monitorData?.cpu?.name ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="厂商">
              {{ monitorData?.cpu?.vendor ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="物理核心">
              {{ monitorData?.cpu?.physicalCores ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="逻辑核心">
              {{ monitorData?.cpu?.logicalCores ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="最大频率">
              {{ monitorData?.cpu?.maxFreq ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="当前频率">
              {{ monitorData?.cpu?.currentFreq ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="系统负载">
              <el-tag
                :color="getLoadColor(monitorData?.cpu?.systemLoad ?? '0%')"
                style="color: #fff"
                size="small"
              >
                {{ monitorData?.cpu?.systemLoad ?? "-" }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="平均负载">
              {{ monitorData?.cpu?.loadAverage ?? "-" }}
            </el-descriptions-item>
          </el-descriptions>
        </MonitorCard>
      </el-col>
      <el-col :xs="24" :lg="12" class="mb-3">
        <MonitorCard title="内存信息" icon="ri/ram-line" :loading="loading">
          <div class="mb-3">
            <div class="flex justify-between text-sm mb-1">
              <span>物理内存</span>
              <span class="text-gray-500">
                {{ monitorData?.memory?.physical?.used ?? "-" }} /
                {{ monitorData?.memory?.physical?.total ?? "-" }}
              </span>
            </div>
            <el-progress
              :percentage="
                getUsagePercent(monitorData?.memory?.physical?.usage ?? '0%')
              "
              :color="
                getLoadColor(monitorData?.memory?.physical?.usage ?? '0%')
              "
              :stroke-width="20"
              :text-inside="true"
            />
          </div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="总内存">
              {{ monitorData?.memory?.physical?.total ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="可用内存">
              {{ monitorData?.memory?.physical?.available ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="已用内存">
              {{ monitorData?.memory?.physical?.used ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="使用率">
              {{ monitorData?.memory?.physical?.usage ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="monitorData?.memory?.virtual"
              label="Swap 总量"
            >
              {{ monitorData.memory.virtual.swapTotal }}
            </el-descriptions-item>
            <el-descriptions-item
              v-if="monitorData?.memory?.virtual"
              label="Swap 已用"
            >
              {{ monitorData.memory.virtual.swapUsed }}
            </el-descriptions-item>
          </el-descriptions>
        </MonitorCard>
      </el-col>
    </el-row>

    <!-- JVM + 数据库 -->
    <el-row :gutter="16" class="mb-4">
      <el-col :xs="24" :lg="12" class="mb-3">
        <MonitorCard
          title="JVM 信息"
          icon="ri/code-box-line"
          :loading="loading"
        >
          <div class="mb-3">
            <div class="flex justify-between text-sm mb-1">
              <span>堆内存</span>
              <span class="text-gray-500">
                {{ monitorData?.jvm?.heapUsed ?? "-" }} /
                {{ monitorData?.jvm?.heapMax ?? "-" }}
              </span>
            </div>
            <el-progress
              :percentage="monitorData?.jvm?.heapPercent ?? 0"
              :color="getLoadColor(`${monitorData?.jvm?.heapPercent ?? 0}%`)"
              :stroke-width="20"
              :text-inside="true"
            />
          </div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="堆内存已用">
              {{ monitorData?.jvm?.heapUsed ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="堆内存最大">
              {{ monitorData?.jvm?.heapMax ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="线程数">
              {{ monitorData?.jvm?.threads ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="运行时间">
              {{ monitorData?.jvm?.uptime ?? "-" }}
            </el-descriptions-item>
          </el-descriptions>
        </MonitorCard>
      </el-col>
      <el-col :xs="24" :lg="12" class="mb-3">
        <MonitorCard
          title="数据库连接池"
          icon="ri/database-2-line"
          :loading="loading"
        >
          <div class="mb-3">
            <div class="flex justify-between text-sm mb-1">
              <span>连接使用</span>
              <span class="text-gray-500">
                {{ monitorData?.database?.activeConnections ?? 0 }} 活跃 /
                {{ monitorData?.database?.totalConnections ?? 0 }} 总计
              </span>
            </div>
            <el-progress
              :percentage="
                monitorData?.database?.maxPoolSize
                  ? Math.round(
                      ((monitorData.database.activeConnections || 0) /
                        monitorData.database.maxPoolSize) *
                        100
                    )
                  : 0
              "
              :color="
                getLoadColor(
                  `${
                    monitorData?.database?.maxPoolSize
                      ? Math.round(
                          ((monitorData.database.activeConnections || 0) /
                            monitorData.database.maxPoolSize) *
                            100
                        )
                      : 0
                  }%`
                )
              "
              :stroke-width="20"
              :text-inside="true"
            />
          </div>
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="活跃连接">
              {{ monitorData?.database?.activeConnections ?? 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="空闲连接">
              {{ monitorData?.database?.idleConnections ?? 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="总连接数">
              {{ monitorData?.database?.totalConnections ?? 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="最大池大小">
              {{ monitorData?.database?.maxPoolSize ?? 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="最小空闲" :span="2">
              {{ monitorData?.database?.minIdle ?? 0 }}
            </el-descriptions-item>
          </el-descriptions>
        </MonitorCard>
      </el-col>
    </el-row>

    <!-- Redis + 系统 -->
    <el-row :gutter="16" class="mb-4">
      <el-col :xs="24" :lg="12" class="mb-3">
        <MonitorCard
          title="Redis 信息"
          icon="ri-database-line"
          :loading="loading"
        >
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="版本">
              {{ monitorData?.redis?.redisVersion ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="内存使用">
              {{ monitorData?.redis?.usedMemory ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="客户端数">
              {{ monitorData?.redis?.connectedClients ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="运行天数">
              {{ monitorData?.redis?.uptimeInDays ?? "-" }} 天
            </el-descriptions-item>
            <el-descriptions-item label="Key 数量" :span="2">
              {{ monitorData?.redis?.dbSize ?? "-" }}
            </el-descriptions-item>
          </el-descriptions>
        </MonitorCard>
      </el-col>
      <el-col :xs="24" :lg="12" class="mb-3">
        <MonitorCard title="系统信息" icon="ri-windows-line" :loading="loading">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="操作系统" :span="2">
              {{ monitorData?.system?.os ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="系统架构">
              {{ monitorData?.system?.arch ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="系统版本">
              {{ monitorData?.system?.version ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="主板厂商">
              {{ monitorData?.system?.baseboard?.manufacturer ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="主板型号">
              {{ monitorData?.system?.baseboard?.model ?? "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="运行时间" :span="2">
              {{ monitorData?.system?.uptime ?? "-" }}
            </el-descriptions-item>
          </el-descriptions>
        </MonitorCard>
      </el-col>
    </el-row>

    <!-- 磁盘分区 -->
    <el-row :gutter="16" class="mb-4">
      <el-col :span="24">
        <MonitorCard
          title="磁盘分区"
          icon="ri-hard-drive-2-line"
          :loading="loading"
        >
          <DiskTable :data="monitorData?.disk?.partitions ?? []" />
        </MonitorCard>
      </el-col>
    </el-row>

    <!-- 网卡信息 -->
    <el-row :gutter="16" class="mb-4">
      <el-col :span="24">
        <MonitorCard title="网卡信息" icon="ri-wifi-line" :loading="loading">
          <div class="mb-2 text-sm text-gray-500">
            主机名：{{ monitorData?.network?.hostName ?? "-" }} | DNS：{{
              monitorData?.network?.dns ?? "-"
            }}
          </div>
          <NetworkTable :data="monitorData?.network?.interfaces ?? []" />
        </MonitorCard>
      </el-col>
    </el-row>

    <!-- Top 进程 -->
    <el-row :gutter="16">
      <el-col :span="24">
        <MonitorCard
          :title="`Top 进程 (按 CPU 排序)`"
          icon="ri-list-ordered"
          :loading="loading"
        >
          <ProcessTable :data="monitorData?.process?.topProcesses ?? []" />
        </MonitorCard>
      </el-col>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
.monitor-page {
  .stat-card {
    display: flex;
    gap: 16px;
    align-items: center;
    padding: 20px;
    color: #fff;
    border-radius: 8px;
    transition: transform 0.2s;

    &:hover {
      transform: translateY(-2px);
    }

    &--blue {
      background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
    }

    &--green {
      background: linear-gradient(135deg, #67c23a 0%, #95d475 100%);
    }

    &--orange {
      background: linear-gradient(135deg, #e6a23c 0%, #eebe77 100%);
    }

    &--red {
      background: linear-gradient(135deg, #f56c6c 0%, #f89898 100%);
    }

    &--purple {
      background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%);
    }

    &--cyan {
      background: linear-gradient(135deg, #06b6d4 0%, #67e8f9 100%);
    }

    &__icon {
      font-size: 36px;
      opacity: 0.8;
    }

    &__content {
      flex: 1;
    }

    &__label {
      margin-bottom: 4px;
      font-size: 13px;
      opacity: 0.9;
    }

    &__value {
      font-size: 22px;
      font-weight: 700;
    }
  }
}
</style>
