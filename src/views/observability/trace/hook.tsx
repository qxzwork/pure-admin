import dayjs from "dayjs";
import { http } from "@/utils/http";
import { ref, onMounted } from "vue";

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

export function useTrace() {
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
        content: AgentTrace[];
        total: number;
        size: number;
        current: number;
      }>("get", "/api/observability/traces", { params });
      dataList.value = res?.content ?? [];
      pagination.value.total = Number(res?.total ?? 0);
      pagination.value.pageSize = Number(res?.size ?? 20);
      pagination.value.currentPage = Number(res?.current ?? 1);
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

  return {
    loading,
    columns,
    dataList,
    pagination,
    statusFilter,
    stats,
    statsLoading,
    detailVisible,
    detailTrace,
    detailSpans,
    detailLoading,
    onSearch,
    loadStats,
    handleDetail,
    handleSizeChange,
    handleCurrentChange,
    fmt,
    fmtTime,
    spanTag
  };
}
