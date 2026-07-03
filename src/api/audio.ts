import { http } from "@/utils/http";

type SimpleResult<T> = {
  code: number;
  message: string;
  data: T;
};

export type AudioGenerateRequest = {
  historyId: number;
  conversationId?: string;
};

export type AudioGenerateResponse = {
  recordId?: number;
  audioUrl?: string;
  durationMs?: number;
  fileSizeBytes?: number;
  sentenceCount?: number;
  /** generating | completed | failed */
  status?: string;
  progressPercent?: number;
  progressDetail?: string;
  errorMessage?: string;
};

export type AudioRecord = {
  id: number;
  historyId: number;
  conversationId?: string;
  audioUrl?: string;
  durationMs?: number;
  fileSizeBytes?: number;
  sentenceCount?: number;
  status: number;
  errorMessage?: string;
  progressPercent?: number;
  progressDetail?: string;
  createTime: string;
  updateTime: string;
};

export type AudioPageResult = {
  records: AudioRecord[];
  total: number;
  current: number;
  size: number;
};

export const generateAudioAsync = (data: AudioGenerateRequest) => {
  return http.request<SimpleResult<AudioGenerateResponse>>(
    "post",
    "/api/audio/generate/async",
    { data }
  );
};

export const getAudioStatus = (recordId: number) => {
  return http.request<SimpleResult<AudioGenerateResponse>>(
    "get",
    `/api/audio/status/${recordId}`
  );
};

export const getAudioList = (params?: { page?: number; size?: number }) => {
  return http.request<SimpleResult<AudioPageResult>>("get", "/api/audio/list", {
    params
  });
};

export const getAudioDetail = (id: number) => {
  return http.request<SimpleResult<AudioRecord>>("get", `/api/audio/${id}`);
};

export const deleteAudio = (id: number) => {
  return http.request<SimpleResult<null>>("delete", `/api/audio/${id}`);
};
