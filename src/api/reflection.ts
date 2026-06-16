import { http } from "@/utils/http";

type SimpleResult<T> = {
  code: number;
  message: string;
  data: T;
};

export type IterationDetail = {
  round: number;
  score: number;
  feedback: string;
};

export type WritingRequest = {
  topic: string;
  requirements?: string;
  maxIterations?: number;
  scoreThreshold?: number;
  conversationId?: string;
  contentType?: "article" | "novel";
  stylePreset?: "popular_story" | "suspense" | "custom";
  targetWordCount?: number;
  customStyle?: string;
};

export type WritingResponse = {
  conversationId?: string;
  topic?: string;
  outline?: string;
  finalArticle?: string;
  score?: number;
  feedback?: string;
  iterations?: number;
  /** 0=执行中, 1=达标, 2=超限兜底 */
  status?: number;
  iterationDetails?: IterationDetail[];
  finished?: boolean;
  currentNode?: string;
  errorMessage?: string;
  durationMs?: number;
  contentType?: string;
  stylePreset?: string;
  writingStyle?: string;
  totalSections?: number;
  currentSection?: number;
  antiAiScore?: number;
  consistencyScore?: number;
};

export type ReflectionHistory = {
  id: number;
  topic: string;
  requirements?: string;
  outline?: string;
  finalArticle?: string;
  score?: number;
  feedback?: string;
  iterations?: number;
  maxIterations?: number;
  /** 0-进行中, 1-成功, 2-达到最大迭代仍不达标 */
  status?: number;
  conversationId?: string;
  durationMs?: number;
  contentType?: string;
  stylePreset?: string;
  targetWordCount?: number;
  totalSections?: number;
  antiAiScore?: number;
  consistencyScore?: number;
  writingStyle?: string;
  createTime?: string;
  updateTime?: string;
};

export const writeReflection = (data: WritingRequest) => {
  return http.request<SimpleResult<WritingResponse>>(
    "post",
    "/api/reflection/write",
    { data }
  );
};

export const getReflectionGraph = () => {
  return http.request<SimpleResult<string>>("get", "/api/reflection/graph");
};

export const getReflectionHistory = (conversationId: string) => {
  return http.request<SimpleResult<ReflectionHistory[]>>(
    "get",
    `/api/reflection/history/${conversationId}`
  );
};

export const getAllReflectionHistory = () => {
  return http.request<SimpleResult<ReflectionHistory[]>>(
    "get",
    "/api/reflection/history"
  );
};
