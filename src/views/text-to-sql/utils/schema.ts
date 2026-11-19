import dayjs from "dayjs";
import { message } from "@/utils/message";
import type { SchemaTableItem, SyncTaskView } from "@/api/text-to-sql";

/** 业务响应结构（仅取需要的字段） */
export type ApiLikeResult = {
  code?: number;
  message?: string;
};

/** 后端时间字段统一格式化（ISO-8601 字符串 / epoch ms / 空值） */
export function formatTime(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "未更新";
  const result = dayjs(value);
  return result.isValid() ? result.format("YYYY-MM-DD HH:mm:ss") : "未更新";
}

/** 逐表向量状态展示映射 */
export const VECTOR_STATUS_MAP = {
  0: { text: "待处理", type: "info" as const },
  1: { text: "已完成", type: "success" as const },
  2: { text: "失败", type: "danger" as const }
};

export function getVectorStatusMeta(status: number) {
  return (
    VECTOR_STATUS_MAP[status as keyof typeof VECTOR_STATUS_MAP] ??
    VECTOR_STATUS_MAP[0]
  );
}

/** 列表项标签：失败 > 待处理 > 待更新 > 已完成 */
export function getTableTag(item: SchemaTableItem): {
  text: string;
  type: "success" | "warning" | "danger" | "info";
} {
  if (item.vectorStatus === 2) return { text: "失败", type: "danger" };
  if (item.vectorStatus === 0) return { text: "待处理", type: "info" };
  if (!item.upToDate) return { text: "待更新", type: "warning" };
  return { text: "已完成", type: "success" };
}

/** 同步进度百分比（done 与 failed 均视为已处理） */
export function getSyncPercent(task?: SyncTaskView | null): number {
  if (!task || !task.total || task.total <= 0) return 0;
  const processed = (task.done || 0) + (task.failed || 0);
  return Math.min(100, Math.round((processed / task.total) * 100));
}

/** 同步进度文案 */
export function getSyncProgressText(task?: SyncTaskView | null): string {
  if (!task || !task.total) return "";
  return `${task.done || 0} / ${task.total}`;
}

export type ApiErrorAction = "none" | "refresh" | "remove";

/**
 * 统一处理业务错误码：
 * - 403：表被 deny，提示并建议刷新列表
 * - 404：表不存在，建议从列表移除
 * - 400 / 500：直接展示服务端 message
 */
export function handleApiError(
  res: ApiLikeResult | null | undefined,
  fallback = "操作失败"
): ApiErrorAction {
  const code = res?.code;
  if (code === 403) {
    message("该表不允许访问", { type: "warning" });
    return "refresh";
  }
  if (code === 404) {
    message("表不存在", { type: "warning" });
    return "remove";
  }
  message(res?.message || fallback, { type: "error" });
  return "none";
}
