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
  columnComment: string;
  isPrimaryKey: boolean;
  isNullable: boolean;
};

/** Schema 信息 */
export type SchemaInfo = {
  tableName: string;
  tableComment: string;
  columns: ColumnInfo[];
};

/** Schema 状态 */
export type SchemaStatus = {
  lastVectorizeTime: number;
  cachedTableCount: number;
  needsUpdate: boolean;
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

/** 更新 Schema 向量 */
export const vectorizeSchema = (tableName?: string) => {
  return http.request<SimpleResult<null>>(
    "post",
    "/api/text-to-sql/schema/vectorize",
    { params: tableName ? { tableName } : {} }
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
