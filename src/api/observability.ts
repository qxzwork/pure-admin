import { http } from "@/utils/http";

/** Agent Trace 记录 */
export type AgentTrace = {
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

/** Agent Span 记录 */
export type AgentSpan = {
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

/** 统计数据 */
export type TraceStatistics = {
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

/** Trace 分页响应 */
type TracePageResult = {
  content: AgentTrace[];
  total: number;
  pages: number;
  current: number;
  size: number;
};

/** 会话分组响应 */
export type SessionGroupResponse = {
  sessionId: string;
  traceCount: number;
  firstQueryTime: string;
  lastQueryTime: string;
  totalTokens: number;
  successCount: number;
  errorCount: number;
  traces: AgentTrace[];
};

/** 会话分页响应 */
type SessionGroupPageResponse = {
  content: SessionGroupResponse[];
  total: number;
  pages: number;
  current: number;
  size: number;
};

/** 按 sessionId 分页查询会话分组 */
export const getSessions = (params?: {
  page?: number;
  size?: number;
  startTime?: string;
  endTime?: string;
  status?: string;
}) => {
  return http.request<SessionGroupPageResponse>(
    "get",
    "/api/observability/sessions",
    { params }
  );
};

/** 分页查询 Trace 列表 */
export const getTraceList = (params: {
  page?: number;
  size?: number;
  status?: string;
}) => {
  return http.request<TracePageResult>("get", "/api/observability/traces", {
    params
  });
};

/** 获取 Trace 详情（含 Span 列表） */
export const getTraceDetail = (traceId: string) => {
  return http.request<{ trace: AgentTrace; spans: AgentSpan[] }>(
    "get",
    `/api/observability/traces/${traceId}`
  );
};

/** 获取最近 Trace 记录 */
export const getRecentTraces = (limit?: number) => {
  return http.request<AgentTrace[]>("get", "/api/observability/traces/recent", {
    params: { limit: limit ?? 10 }
  });
};

/** 获取统计数据 */
export const getStatistics = () => {
  return http.request<TraceStatistics>("get", "/api/observability/statistics");
};
