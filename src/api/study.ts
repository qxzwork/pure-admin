import { http } from "@/utils/http";

export interface StudyItem {
  id: number;
  name: string;
  age?: number;
  desc?: string;
}

export interface StudyListParams {
  page?: number;
  pageSize?: number;
  [key: string]: any;
}

export interface StudyApiResult {
  code: number;
  message: string;
  success: boolean;
  timestamp: string;
  data: {
    records: StudyItem[];
    total?: number;
    pages?: number;
    size?: number;
    current?: number;
  };
}

export const getStudyList = (params?: StudyListParams) => {
  return http.request<StudyApiResult>("get", "/api/management/study/list", {
    params
  });
};
