import { http } from "@/utils/http";

export type QuartzJob = {
  id: string;
  jobName: string;
  cronExpression: string;
  executorBean: string;
  jobParams: string;
  status: number;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export const getJobList = () => {
  return http.request<any>("get", "/api/quartz/jobs");
};

export const createJob = (data: Partial<QuartzJob>) => {
  return http.request<any>("post", "/api/quartz/jobs", { data });
};

export const updateJob = (id: string, data: Partial<QuartzJob>) => {
  return http.request<any>("put", `/api/quartz/jobs/${id}`, { data });
};

export const deleteJob = (id: string) => {
  return http.request<any>("delete", `/api/quartz/jobs/${id}`);
};

export const pauseJob = (id: string) => {
  return http.request<any>("post", `/api/quartz/jobs/${id}/pause`);
};

export const resumeJob = (id: string) => {
  return http.request<any>("post", `/api/quartz/jobs/${id}/resume`);
};

export const triggerJob = (id: string) => {
  return http.request<any>("post", `/api/quartz/jobs/${id}/trigger`);
};

export const getExecutors = () => {
  return http.request<any>("get", "/api/quartz/jobs/executors");
};
