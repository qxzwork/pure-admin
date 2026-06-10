import dayjs from "dayjs";
import { ref, onMounted } from "vue";
import {
  getSessions,
  getTraceDetail,
  getStatistics,
  type AgentTrace,
  type AgentSpan,
  type TraceStatistics,
  type SessionGroupResponse
} from "@/api/observability";

export function useTrace() {
  // ========== 列表状态 ==========
  const loading = ref(false);
  const sessionList = ref<SessionGroupResponse[]>([]);
  const pagination = ref({ total: 0, pageSize: 20, currentPage: 1 });
  const statusFilter = ref("");

  // ========== 统计状态 ==========
  const stats = ref<TraceStatistics | null>(null);
  const statsLoading = ref(false);

  // ========== 详情状态 ==========
  const detailVisible = ref(false);
  const detailTrace = ref<AgentTrace | null>(null);
  const detailSpans = ref<AgentSpan[]>([]);
  const detailLoading = ref(false);

  // ========== 数据加载 ==========
  async function onSearch() {
    loading.value = true;
    try {
      const res = await getSessions({
        page: pagination.value.currentPage,
        size: pagination.value.pageSize,
        status: statusFilter.value || undefined
      });
      sessionList.value = res?.content ?? [];
      pagination.value.total = Number(res?.total ?? 0);
      pagination.value.pageSize = Number(res?.size ?? 20);
      pagination.value.currentPage = Number(res?.current ?? 1);
    } catch {
      sessionList.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function loadStats() {
    statsLoading.value = true;
    try {
      const res = await getStatistics();
      stats.value = res ?? null;
    } catch {
      stats.value = null;
    } finally {
      statsLoading.value = false;
    }
  }

  // ========== Trace 详情 ==========
  async function handleTraceDetail(row: AgentTrace) {
    detailTrace.value = row;
    detailSpans.value = [];
    detailLoading.value = true;
    detailVisible.value = true;
    try {
      const res = await getTraceDetail(row.id);
      detailSpans.value = res?.spans ?? [];
    } catch {
      detailSpans.value = [];
    } finally {
      detailLoading.value = false;
    }
  }

  // ========== 分页 ==========
  function handleSizeChange(val: number) {
    pagination.value.pageSize = val;
    pagination.value.currentPage = 1;
    onSearch();
  }

  function handleCurrentChange(val: number) {
    pagination.value.currentPage = val;
    onSearch();
  }

  // ========== 格式化工具函数 ==========
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
    if (t === "THOUGHT") return "info" as const;
    return "info" as const;
  }

  function truncateText(text: string, maxLen = 100) {
    if (!text) return "-";
    return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
  }

  // ========== 生命周期 ==========
  onMounted(() => {
    onSearch();
    loadStats();
  });

  return {
    // 列表
    loading,
    sessionList,
    pagination,
    statusFilter,
    // 统计
    stats,
    statsLoading,
    // 详情
    detailVisible,
    detailTrace,
    detailSpans,
    detailLoading,
    // 方法
    onSearch,
    loadStats,
    handleTraceDetail,
    handleSizeChange,
    handleCurrentChange,
    // 格式化
    fmt,
    fmtTime,
    spanTag,
    truncateText
  };
}
