import { http } from "@/utils/http";

export type KnowledgeChunk = {
  id: string;
  content: string;
  source: string;
  createTime?: string;
};

type DocumentPageResult = {
  data: {
    content: KnowledgeChunk[];
    total: number;
    current: number;
    size: number;
  };
};

type SimpleResult<T> = {
  code: number;
  message: string;
  data: T;
};

export const getDocumentList = (params: {
  page?: number;
  size?: number;
  source?: string;
}) => {
  return http.request<DocumentPageResult>("get", "/api/rag/documents", {
    params
  });
};

export const getDocumentDetail = (id: string) => {
  return http.request<SimpleResult<KnowledgeChunk>>(
    "get",
    `/api/rag/documents/${id}`
  );
};

export const deleteDocument = (id: string) => {
  return http.request<SimpleResult<null>>("delete", `/api/rag/documents/${id}`);
};

export const ingestDocument = (data: { content: string; source?: string }) => {
  return http.request<SimpleResult<null>>("post", "/api/rag/ingest", { data });
};

// ========== RagFileController 对接 ==========

/** 后端 RagDocumentStatus 枚举（与 aistudy RagDocumentStatus 一致） */
export const RAG_DOC_STATUS = {
  PROCESSING: 0,
  SUCCESS: 1,
  FAILED: 2
} as const;

export type RagDocStatusCode =
  (typeof RAG_DOC_STATUS)[keyof typeof RAG_DOC_STATUS];

/** 文档列表项 */
export type RagFileItem = {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: RagDocStatusCode;
  statusName: string;
  extractedTextLength: number;
  chunkCount: number;
  uploaderName: string;
  errorMessage: string | null;
  createTime: string;
  updateTime: string;
};

/** 文档详情 */
export type RagFileDetail = RagFileItem & {
  qiniuKey: string;
  qiniuUrl: string;
  uploaderId: number;
};

/** 上传响应 */
export type RagFileUpload = {
  documentId: number;
  fileName: string;
  status: RagDocStatusCode;
  message: string;
};

/** 文本分片 */
export type RagTextSlice = {
  totalLength: number;
  offset: number;
  returnedLength: number;
  content: string;
  truncated: boolean;
};

/** 后端统一分页响应 */
type PageResponse<T> = {
  code: number;
  message: string;
  data: {
    records: T[];
    total: number;
    current: number;
    size: number;
    pages: number;
  };
};

/** 上传文档（multipart/form-data，key=file） */
export const uploadRagFile = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return http.request<SimpleResult<RagFileUpload>>(
    "post",
    "/api/rag/files/upload",
    { data: form },
    {
      headers: { "Content-Type": "multipart/form-data" }
    }
  );
};

/** 分页查询文档 */
export const getRagFileList = (params: {
  page?: number;
  size?: number;
  fileName?: string;
  status?: RagDocStatusCode;
}) => {
  return http.request<PageResponse<RagFileItem>>("get", "/api/rag/files", {
    params,
    timeout: 30000 // 30秒
  });
};

/** 文档详情 */
export const getRagFileDetail = (id: number) => {
  return http.request<SimpleResult<RagFileDetail>>(
    "get",
    `/api/rag/files/${id}`
  );
};

/** 纯文本分片 */
export const getRagFileText = (
  id: number,
  params: { offset?: number; limit?: number } = {}
) => {
  return http.request<SimpleResult<RagTextSlice>>(
    "get",
    `/api/rag/files/${id}/text`,
    { params }
  );
};

/** 删除文档（级联 Milvus + 七牛云 + DB） */
export const deleteRagFile = (id: number) => {
  return http.request<SimpleResult<null>>("delete", `/api/rag/files/${id}`);
};

// ========== RAG 配置 ==========

/** 获取查询改写开关状态 */
export const getQueryRewriteEnabled = () => {
  return http.request<SimpleResult<boolean>>(
    "get",
    "/api/rag/config/query-rewrite"
  );
};

/** 设置查询改写开关 */
export const setQueryRewriteEnabled = (enabled: boolean) => {
  return http.request<SimpleResult<null>>(
    "post",
    "/api/rag/config/query-rewrite",
    { params: { enabled } }
  );
};

/** 获取多轮检索开关状态 */
export const getMultiRoundSearchEnabled = () => {
  return http.request<SimpleResult<boolean>>(
    "get",
    "/api/rag/config/multi-round-search"
  );
};

/** 设置多轮检索开关 */
export const setMultiRoundSearchEnabled = (enabled: boolean) => {
  return http.request<SimpleResult<null>>(
    "post",
    "/api/rag/config/multi-round-search",
    { params: { enabled } }
  );
};

// ========== 来源列表 ==========

/** 获取所有来源列表 */
export const getRagSources = () => {
  return http.request<SimpleResult<string[]>>("get", "/api/rag/sources");
};

// ========== 对话管理 ==========

/** 获取对话列表 */
export const getRagConversations = () => {
  return http.request<SimpleResult<{ id: string; title: string }[]>>(
    "get",
    "/api/rag/conversations"
  );
};

/** 获取对话历史消息 */
export const getRagConversationMessages = (conversationId: string) => {
  return http.request<SimpleResult<{ role: string; content: string }[]>>(
    "get",
    `/api/rag/conversations/${conversationId}/messages`
  );
};

/** 删除对话 */
export const deleteRagConversation = (conversationId: string) => {
  return http.request<SimpleResult<null>>(
    "delete",
    `/api/rag/conversations/${conversationId}`
  );
};
