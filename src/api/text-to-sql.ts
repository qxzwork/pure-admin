import { http } from "@/utils/http";

type SimpleResult<T> = {
  code: number;
  message: string;
  data: T;
};

/** 请求类型 */
export type TextToSqlRequest = {
  question: string;
  conversationId?: string;
  allowedTables?: string[];
  context?: Record<string, any>;
};

/** 图表系列数据 */
export type ChartSeries = {
  name: string;
  type: string;
  data: any[];
};

/** 图表配置 */
export type ChartConfig = {
  type: "bar" | "line" | "pie" | "table" | "card";
  title: string;
  xAxis?: string[];
  yAxis?: string;
  legend?: string[];
  series?: ChartSeries[];
  tableData?: Record<string, any>[];
  tableColumns?: string[];
};

/** Text-to-SQL 响应 */
export type TextToSqlResponse = {
  question: string;
  generatedSql: string;
  data: Record<string, any>[];
  chartConfig: ChartConfig;
  answer: string;
  steps: string[];
  success: boolean;
  error?: string;
};

/** 列信息 */
export type ColumnInfo = {
  columnName: string;
  columnType: string;
  columnComment: string | null;
  isPrimaryKey: boolean;
  isNullable: boolean;
};

/** Schema 信息 */
export type SchemaInfo = {
  tableName: string;
  tableComment: string | null;
  columns: ColumnInfo[];
};

/** 同步任务 */
export type SyncTaskView = {
  taskId: string;
  /** "ALL" 表示全库；否则为单个表名 */
  scope: string;
  total: number;
  /** 已完成数量（含"未变化跳过"） */
  done: number;
  failed: number;
  running: boolean;
  /** epoch ms */
  startedAt: number;
  /** epoch ms；运行中为 0 */
  finishedAt: number;
  message: string;
};

/** 逐表状态 */
export type SchemaTableItem = {
  tableName: string;
  tableComment: string | null;
  columnCount: number;
  /** 0=待处理 1=已完成 2=失败 */
  vectorStatus: 0 | 1 | 2;
  /** ISO-8601 */
  vectorTime: string | null;
  errorMessage: string | null;
  /** 结构哈希与已索引版本一致 */
  upToDate: boolean;
};

/** Schema 汇总状态 */
export type SchemaStatus = {
  /** 允许访问的表总数 */
  tableCount: number;
  /** 已索引且结构未变化 */
  indexedCount: number;
  /** 未索引 / 结构已变化 */
  pendingCount: number;
  /** 上次同步失败 */
  failedCount: number;
  /** ISO-8601 */
  lastSyncTime: string | null;
  needsUpdate: boolean;
  /** 元数据快照中的表数（≠ 已索引数） */
  cachedTableCount: number;
  running: boolean;
  currentTask?: SyncTaskView;
};

/** 查询历史 */
export type QueryHistory = {
  id: string;
  question: string;
  sql: string;
  time: string;
  success: boolean;
};

// ========== 查询接口 ==========

/** 自然语言查询 */
export const queryTextToSql = (data: TextToSqlRequest) => {
  return http.request<SimpleResult<TextToSqlResponse>>(
    "post",
    "/api/text-to-sql/query",
    { data, timeout: 300000 }
  );
};

// ========== 表管理接口 ==========

/** 获取可用表列表 */
export const getTextToSqlTables = () => {
  return http.request<SimpleResult<string[]>>("get", "/api/text-to-sql/tables");
};

/** 获取表结构 */
export const getTableSchema = (tableName: string) => {
  return http.request<SimpleResult<SchemaInfo>>(
    "get",
    `/api/text-to-sql/tables/${tableName}/schema`
  );
};

// ========== Schema 管理接口 ==========

/** 启动 Schema 同步（不传 tableName 即全库），异步返回任务 */
export const startSchemaSync = (tableName?: string) => {
  return http.request<SimpleResult<SyncTaskView>>(
    "post",
    "/api/text-to-sql/schema/sync",
    { params: tableName ? { tableName } : {} }
  );
};

/** 查询当前同步任务进度；从未执行过时 data 可能是空对象 */
export const getSchemaSyncStatus = () => {
  return http.request<SimpleResult<SyncTaskView | null>>(
    "get",
    "/api/text-to-sql/schema/sync/status"
  );
};

/** 获取表列表 + 逐表向量状态 */
export const getSchemaTables = () => {
  return http.request<SimpleResult<SchemaTableItem[]>>(
    "get",
    "/api/text-to-sql/schema"
  );
};

/** 删除单表向量与记录 */
export const deleteTableVectors = (tableName: string) => {
  return http.request<SimpleResult<null>>(
    "delete",
    `/api/text-to-sql/schema/${encodeURIComponent(tableName)}`
  );
};

/** 获取 Schema 向量化状态 */
export const getSchemaStatus = () => {
  return http.request<SimpleResult<SchemaStatus>>(
    "get",
    "/api/text-to-sql/schema/status"
  );
};

/** 获取所有表的 Schema */
export const getAllSchemas = () => {
  return http.request<SimpleResult<SchemaInfo[]>>(
    "get",
    "/api/text-to-sql/schema/all"
  );
};

// ========== 历史记录接口 ==========

/** 历史记录项 */
export type HistoryItem = {
  id: string;
  question: string;
  generatedSql: string;
  answer: string;
  success: boolean;
  executionTime: number;
  createTime: string;
};

/** 历史记录分页结果 */
export type HistoryPageResult = {
  records: HistoryItem[];
  total: number;
  current: number;
  size: number;
};

/** 获取查询历史列表 */
export const getTextToSqlHistory = (params?: {
  page?: number;
  size?: number;
}) => {
  return http.request<SimpleResult<HistoryPageResult>>(
    "get",
    "/api/text-to-sql/history",
    { params }
  );
};

/** 删除查询历史 */
export const deleteTextToSqlHistory = (id: string) => {
  return http.request<SimpleResult<null>>(
    "delete",
    `/api/text-to-sql/history/${id}`
  );
};
