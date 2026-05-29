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
