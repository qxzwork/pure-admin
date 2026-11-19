import { computed, onUnmounted, ref } from "vue";
import { message } from "@/utils/message";
import {
  getSchemaSyncStatus,
  startSchemaSync,
  type SyncTaskView
} from "@/api/text-to-sql";
import { handleApiError } from "../utils/schema";

/** 轮询间隔（文档建议 1.5s ~ 2s） */
const POLL_INTERVAL = 1500;

/**
 * Schema 同步任务：启动 → 轮询进度 → 结束回调。
 * 多个视图共用，避免重复实现轮询与清理逻辑。
 */
export function useSchemaSync(onFinished?: () => void) {
  const task = ref<SyncTaskView | null>(null);
  /** 启动请求进行中 */
  const starting = ref(false);

  let timer: ReturnType<typeof setTimeout> | null = null;
  /** 正在跟踪的任务 ID，为空表示未轮询 */
  let trackingTaskId = "";

  const running = computed(
    () => starting.value || task.value?.running === true
  );

  function clearTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function stopPolling() {
    clearTimer();
    trackingTaskId = "";
  }

  function finish() {
    stopPolling();
    starting.value = false;
    onFinished?.();
  }

  async function poll() {
    clearTimer();
    if (!trackingTaskId) return;

    // 页面隐藏时暂停网络请求，只保留定时器
    if (typeof document !== "undefined" && document.hidden) {
      timer = setTimeout(poll, POLL_INTERVAL);
      return;
    }

    try {
      const res = await getSchemaSyncStatus();
      // 组件已卸载 / 轮询已停止
      if (!trackingTaskId) return;

      if (res?.code !== 200) {
        handleApiError(res, "获取同步进度失败");
        finish();
        return;
      }

      // data 可能是空对象或 null（从未执行 / 服务重启）
      const data = res.data as SyncTaskView | null | undefined;
      if (!data || !data.taskId) {
        task.value = null;
        finish();
        return;
      }

      task.value = data;

      // 任务已被新任务替换
      if (data.taskId !== trackingTaskId) {
        finish();
        return;
      }

      if (!data.running) {
        finish();
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL);
    } catch (e: any) {
      message(e?.message ?? "获取同步进度失败", { type: "error" });
      finish();
    }
  }

  /** 启动同步；不传 tableName 表示全库 */
  async function start(tableName?: string): Promise<boolean> {
    if (running.value) {
      message("已有同步任务进行中，请稍候", { type: "warning" });
      return false;
    }

    starting.value = true;
    try {
      const res = await startSchemaSync(tableName);
      if (res?.code !== 200 || !res.data) {
        handleApiError(res, "启动同步失败");
        starting.value = false;
        return false;
      }

      task.value = res.data;

      // 后端可能直接返回已结束的任务
      if (!res.data.running) {
        starting.value = false;
        onFinished?.();
        return true;
      }

      trackingTaskId = res.data.taskId;
      starting.value = false;
      timer = setTimeout(poll, POLL_INTERVAL);
      return true;
    } catch (e: any) {
      message(e?.message ?? "启动同步失败", { type: "error" });
      starting.value = false;
      return false;
    }
  }

  /** 同步状态（例如弹窗打开时接上已在运行的任务） */
  async function refresh() {
    if (trackingTaskId) return;
    try {
      const res = await getSchemaSyncStatus();
      if (res?.code !== 200) return;

      const data = res.data as SyncTaskView | null | undefined;
      if (!data || !data.taskId) {
        if (!starting.value) task.value = null;
        return;
      }

      task.value = data;
      if (data.running) {
        trackingTaskId = data.taskId;
        timer = setTimeout(poll, POLL_INTERVAL);
      }
    } catch {
      // 忽略：状态接口失败不影响页面主流程
    }
  }

  onUnmounted(() => {
    stopPolling();
  });

  return { task, running, start, refresh, stopPolling };
}
