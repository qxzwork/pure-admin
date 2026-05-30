import { http } from "@/utils/http";

export type ApiRequestLog = {
  id: string;
  description: string;
  requestMethod: string;
  requestUri: string;
  queryParams: string;
  requestBody: string;
  clientIp: string;
  userId: string;
  username: string;
  userAgent: string;
  responseStatus: number;
  responseBody: string;
  durationMs: number;
  errorMessage: string;
  createTime: string;
};

type ApiLogPageResult = {
  data: {
    records: ApiRequestLog[];
    total: number;
    size: number;
    current: number;
  };
};

export const getApiLogList = (params: {
  page?: number;
  size?: number;
  uri?: string;
  username?: string;
  status?: number;
  startTime?: string;
  endTime?: string;
}) => {
  return http.request<ApiLogPageResult>("get", "/api/management/api-logs", {
    params
  });
};

export const getApiLogDetail = (id: string) => {
  return http.request<{ data: ApiRequestLog }>(
    "get",
    `/api/management/api-logs/${id}`
  );
};
