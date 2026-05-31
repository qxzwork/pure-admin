import { http } from "@/utils/http";

export type DictType = {
  id: string;
  dictName: string;
  dictCode: string;
  description: string;
  status: number;
  createTime: string;
};

export type DictData = {
  id: string;
  dictCode: string;
  dictLabel: string;
  dictValue: string;
  sortOrder: number;
  status: number;
  remark: string;
  cssClass: string;
};

export const getDictTypeList = (params: {
  page?: number;
  size?: number;
  dictName?: string;
  dictCode?: string;
}) => {
  return http.request<any>("get", "/api/management/dicts", { params });
};

export const addDictType = (data: Partial<DictType>) => {
  return http.request<any>("post", "/api/management/dicts", { data });
};

export const updateDictType = (id: string, data: Partial<DictType>) => {
  return http.request<any>("put", `/api/management/dicts/${id}`, { data });
};

export const deleteDictType = (id: string) => {
  return http.request<any>("delete", `/api/management/dicts/${id}`);
};

export const getDictDataList = (dictCode: string) => {
  return http.request<any>("get", `/api/management/dicts/${dictCode}/data`);
};

export const addDictData = (data: Partial<DictData>) => {
  return http.request<any>("post", "/api/management/dict-data", { data });
};

export const updateDictData = (id: string, data: Partial<DictData>) => {
  return http.request<any>("put", `/api/management/dict-data/${id}`, { data });
};

export const deleteDictData = (id: string) => {
  return http.request<any>("delete", `/api/management/dict-data/${id}`);
};
