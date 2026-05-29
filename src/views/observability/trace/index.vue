<script setup lang="ts">
import { ref, onMounted } from "vue";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import dayjs from "dayjs";
import { http } from "@/utils/http";

defineOptions({ name: "ObservabilityTrace" });

type AgentTrace = {
  id: string;
  sessionId: string;
  userQuery: string;
  agentResponse: string;
  status: string;
  totalDuration: number;
  toolCallCount: number;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  errorMessage: string;
  createTime: string;
  updateTime: string;
};

type AgentSpan = {
  id: string;
  traceId: string;
  spanName: string;
  spanType: string;
  parentSpanId: string;
  toolName: string;
  toolInput: string;
  toolOutput: string;
  thought: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: string;
  errorMessage: string;
  metadata: string;
  orderIndex: number;
  createTime: string;
};

type TraceStatistics = {
  totalCount: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgDuration: number;
  avgToolCalls: number;
  totalTokens: number;
  avgInputTokens: number;
  avgOutputTokens: number;
};

const loading = ref(false);
const dataList = ref<AgentTrace[]>([]);
const pagination = ref({ total: 0, pageSize: 20, currentPage: 1 });
const statusFilter = ref("");

const stats = ref<TraceStatistics | null>(null);
const statsLoading = ref(false);

const detailVisible = ref(false);
const detailTrace = ref<AgentTrace | null>(null);
const detailSpans = ref<AgentSpan[]>([]);
const detailLoading = ref(false);

const columns: TableColumnList = [
  { label: "Trace ID", prop: "id", minWidth: 120, showOverflowTooltip: true },
  {
    label: "用户提问",
    prop: "userQuery",
    minWidth: 200,
    showOverflowTooltip: true
  },
  { label: "模型", prop: "modelName", width: 100 },
  { label: "状态", prop: "status", width: 80, slot: "status" },
  { label: "耗时(ms)", prop: "totalDuration", width: 100, sortable: true },
  { label: "工具调用", prop: "toolCallCount", width: 90 },
  { label: "Token", prop: "totalTokens", width: 90 },
  { label: "创建时间", prop: "createTime", width: 170, sortable: true },
  { label: "操作", fixed: "right", width: 80, slot: "operation" }
];

async function onSearch() {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      page: pagination.value.currentPage,
      size: pagination.value.pageSize
    };
    if (statusFilter.value) params.status = statusFilter.value;
    const res = await http.request<{
      data: {
        content: AgentTrace[];
        total: number;
        size: number;
        current: number;
      };
    }>("get", "/api/observability/traces", { params });
    const d = res?.data;
    dataList.value = d?.content ?? [];
    pagination.value.total = Number(d?.total ?? 0);
    pagination.value.pageSize = Number(d?.size ?? 20);
    pagination.value.currentPage = Number(d?.current ?? 1);
  } catch {
    dataList.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadStats() {
  statsLoading.value = true;
  try {
    const res = await http.request<TraceStatistics>(
      "get",
      "/api/observability/statistics"
    );
    stats.value = res ?? null;
  } catch {
    stats.value = null;
  } finally {
    statsLoading.value = false;
  }
}

async function handleDetail(row: AgentTrace) {
  detailTrace.value = row;
  detailSpans.value = [];
  detailLoading.value = true;
  detailVisible.value = true;
  try {
    const res = await http.request<{ trace: AgentTrace; spans: AgentSpan[] }>(
      "get",
      `/api/observability/traces/${row.id}`
    );
    detailSpans.value = res?.spans ?? [];
  } catch {
    detailSpans.value = [];
  } finally {
    detailLoading.value = false;
  }
}

function handleSizeChange(val: number) {
  pagination.value.pageSize = val;
  pagination.value.currentPage = 1;
  onSearch();
}

function handleCurrentChange(val: number) {
  pagination.value.currentPage = val;
  onSearch();
}

function fmt(ms: number) {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function fmtTime(val: string) {
  return val ? dayjs(val).format("YYYY-MM-DD HH:mm:ss") : "-";
}

function spanTag(t: string) {
  if (t === "LLM") return "primary" as const;
  if (t === "TOOL") return "warning" as const;
  return "info" as const;
}

onMounted(() => {
  onSearch();
  loadStats();
});
</script>

<template>
  <div class="p-4">
    <el-row :gutter="16" class="mb-4">
      <el-col :span="6">
        <el-card v-loading="statsLoading" shadow="hover">
          <div class="text-center">
            <div class="text-3xl text-(--el-color-primary) font-bold">
              {{ stats?.totalCount ?? 0 }}
            </div>
            <div class="text-sm text-gray-500 mt-1">总请求数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card v-loading="statsLoading" shadow="hover">
          <div class="text-center">
            <div class="text-3xl text-(--el-color-success) font-bold">
              {{ stats?.successRate?.toFixed(1) ?? 0 }}%
            </div>
            <div class="text-sm text-gray-500 mt-1">
              成功率
              <span class="text-xs ml-1">
                ({{ stats?.successCount ?? 0 }}/{{ stats?.totalCount ?? 0 }})
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card v-loading="statsLoading" shadow="hover">
          <div class="text-center">
            <div class="text-3xl text-(--el-color-warning) font-bold">
              {{ fmt(stats?.avgDuration) }}
            </div>
            <div class="text-sm text-gray-500 mt-1">平均耗时</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card v-loading="statsLoading" shadow="hover">
          <div class="text-center">
            <div class="text-3xl text-(--el-color-info) font-bold">
              {{ stats?.totalTokens?.toLocaleString() ?? 0 }}
            </div>
            <div class="text-sm text-gray-500 mt-1">总 Token 消耗</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <PureTableBar title="Trace 列表" :columns="columns" @refresh="onSearch">
      <template #buttons>
        <el-select
          v-model="statusFilter"
          placeholder="全部状态"
          clearable
          class="w-32! mr-2"
          @change="onSearch"
        >
          <el-option label="SUCCESS" value="SUCCESS" />
          <el-option label="ERROR" value="ERROR" />
        </el-select>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/refresh-line')"
          @click="loadStats"
        >
          刷新统计
        </el-button>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          row-key="id"
          adaptive
          :adaptiveConfig="{ offsetBottom: 108 }"
          align-whole="center"
          table-layout="auto"
          :loading="loading"
          :size="size"
          :data="dataList"
          :columns="dynamicColumns"
          :pagination="{ ...pagination, size }"
          :header-cell-style="{
            background: 'var(--el-fill-color-light)',
            color: 'var(--el-text-color-primary)'
          }"
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        >
          <template #status="{ row }">
            <el-tag
              :type="row.status === 'SUCCESS' ? 'success' : 'danger'"
              size="small"
            >
              {{ row.status }}
            </el-tag>
          </template>
          <template #operation="{ row }">
            <el-button
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon('ri/search-line')"
              @click="handleDetail(row)"
            >
              详情
            </el-button>
          </template>
        </pure-table>
      </template>
    </PureTableBar>

    <!-- Trace 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="Trace 详情"
      width="900px"
      destroy-on-close
    >
      <div v-loading="detailLoading">
        <template v-if="detailTrace">
          <el-descriptions :column="2" border class="mb-4">
            <el-descriptions-item label="Trace ID">{{
              detailTrace.id
            }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag
                :type="detailTrace.status === 'SUCCESS' ? 'success' : 'danger'"
                size="small"
              >
                {{ detailTrace.status }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="模型">{{
              detailTrace.modelName
            }}</el-descriptions-item>
            <el-descriptions-item label="耗时">{{
              fmt(detailTrace.totalDuration)
            }}</el-descriptions-item>
            <el-descriptions-item label="工具调用"
              >{{ detailTrace.toolCallCount ?? 0 }} 次</el-descriptions-item
            >
            <el-descriptions-item label="Token">
              {{ detailTrace.inputTokens ?? 0 }} /
              {{ detailTrace.outputTokens ?? 0 }} (共
              {{ detailTrace.totalTokens ?? 0 }})
            </el-descriptions-item>
            <el-descriptions-item label="用户提问" :span="2">
              <div class="whitespace-pre-wrap break-all">
                {{ detailTrace.userQuery }}
              </div>
            </el-descriptions-item>
            <el-descriptions-item label="Agent 响应" :span="2">
              <div class="whitespace-pre-wrap break-all max-h-40 overflow-auto">
                {{ detailTrace.agentResponse }}
              </div>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="detailTrace.errorMessage"
              label="错误信息"
              :span="2"
            >
              <div
                class="text-(--el-color-danger) whitespace-pre-wrap break-all"
              >
                {{ detailTrace.errorMessage }}
              </div>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{
              fmtTime(detailTrace.createTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{
              fmtTime(detailTrace.updateTime)
            }}</el-descriptions-item>
          </el-descriptions>

          <h4 class="mb-2">Span 调用链路</h4>
          <el-table :data="detailSpans" border size="small" max-height="400">
            <el-table-column
              prop="spanName"
              label="名称"
              min-width="150"
              show-overflow-tooltip
            />
            <el-table-column prop="spanType" label="类型" width="90">
              <template #default="{ row }">
                <el-tag :type="spanTag(row.spanType)" size="small">
                  {{ row.spanType }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag
                  :type="row.status === 'SUCCESS' ? 'success' : 'danger'"
                  size="small"
                >
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="duration" label="耗时" width="100">
              <template #default="{ row }">{{ fmt(row.duration) }}</template>
            </el-table-column>
            <el-table-column
              prop="toolName"
              label="工具"
              width="120"
              show-overflow-tooltip
            />
            <el-table-column
              prop="thought"
              label="思考/输出"
              min-width="200"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                {{ row.thought || row.toolOutput || "-" }}
              </template>
            </el-table-column>
            <el-table-column
              prop="errorMessage"
              label="错误"
              min-width="150"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span class="text-(--el-color-danger)">{{
                  row.errorMessage || ""
                }}</span>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>
