<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { getAllReflectionHistory } from "@/api/reflection";
import type { ReflectionHistory } from "@/api/reflection";
import { generateAudioAsync, getAudioStatus } from "@/api/audio";
import type { AudioGenerateResponse } from "@/api/audio";

const router = useRouter();

defineOptions({ name: "AudioGenerate" });

const historyList = ref<ReflectionHistory[]>([]);
const selectedHistoryId = ref<number | undefined>(undefined);
const generating = ref(false);
const searchQuery = ref("");
let pollTimer: ReturnType<typeof setInterval> | null = null;

const filteredHistoryList = computed(() => {
  if (!searchQuery.value) return historyList.value;
  const query = searchQuery.value.toLowerCase();
  return historyList.value.filter(item =>
    item.topic.toLowerCase().includes(query)
  );
});

const result = reactive<AudioGenerateResponse>({
  recordId: undefined,
  audioUrl: undefined,
  durationMs: undefined,
  fileSizeBytes: undefined,
  sentenceCount: undefined,
  status: undefined,
  progressPercent: undefined,
  progressDetail: undefined,
  errorMessage: undefined
});

function resetResult() {
  result.recordId = undefined;
  result.audioUrl = undefined;
  result.durationMs = undefined;
  result.fileSizeBytes = undefined;
  result.sentenceCount = undefined;
  result.status = undefined;
  result.progressPercent = undefined;
  result.progressDetail = undefined;
  result.errorMessage = undefined;
}

function formatDuration(ms?: number): string {
  if (!ms) return "--";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}分${sec}秒` : `${sec}秒`;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

function getStatusText(status?: number): string {
  switch (status) {
    case 0:
      return "进行中";
    case 1:
      return "达标";
    case 2:
      return "超限兜底";
    default:
      return "";
  }
}

function getStatusType(status?: number): "" | "success" | "warning" | "info" {
  switch (status) {
    case 1:
      return "success";
    case 2:
      return "warning";
    case 0:
      return "info";
    default:
      return "";
  }
}

async function loadHistoryList() {
  try {
    const res = await getAllReflectionHistory();
    if (res.code === 200 && res.data?.length) {
      historyList.value = res.data;
    }
  } catch {
    // ignore
  }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollStatus(recordId: number) {
  try {
    const res = await getAudioStatus(recordId);
    if (res.code === 200 && res.data) {
      Object.assign(result, res.data);

      if (res.data.status === "completed") {
        stopPolling();
        generating.value = false;
        message("音频生成完成", { type: "success" });
      } else if (res.data.status === "failed") {
        stopPolling();
        generating.value = false;
        message(res.data.errorMessage || "生成失败", { type: "error" });
      }
    }
  } catch {
    // ignore
  }
}

async function handleGenerate() {
  if (!selectedHistoryId.value || generating.value) return;

  resetResult();
  generating.value = true;
  result.status = "generating";
  result.progressPercent = 0;
  result.progressDetail = "正在提交任务...";

  try {
    const res = await generateAudioAsync({
      historyId: selectedHistoryId.value
    });

    if (res.code === 200 && res.data) {
      Object.assign(result, res.data);

      if (res.data.status === "completed") {
        generating.value = false;
        message("音频生成完成", { type: "success" });
        return;
      }

      if (res.data.status === "failed") {
        generating.value = false;
        message(res.data.errorMessage || "生成失败", { type: "error" });
        return;
      }

      if (res.data.recordId) {
        pollTimer = setInterval(() => pollStatus(res.data.recordId!), 60000);
      }
    } else {
      generating.value = false;
      result.status = "failed";
      result.errorMessage = res.message || "提交失败";
      message(res.message || "提交失败", { type: "error" });
    }
  } catch {
    generating.value = false;
    result.status = "failed";
    result.errorMessage = "请求失败，请稍后重试";
    message("请求失败，请稍后重试", { type: "error" });
  }
}

function getSelectedTopic(): string {
  if (!selectedHistoryId.value) return "";
  const item = historyList.value.find(h => h.id === selectedHistoryId.value);
  return item?.topic || "";
}

onMounted(() => {
  loadHistoryList();
});

onBeforeUnmount(() => {
  stopPolling();
});
</script>

<template>
  <div class="audio-container">
    <div class="audio-main">
      <!-- 欢迎态 -->
      <div v-if="!generating && !result.status" class="welcome-view">
        <div class="welcome-content">
          <div class="welcome-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <h1 class="welcome-title">有声版生成</h1>
          <p class="welcome-desc">
            选择一篇反思写作作品，AI 将为其生成有声版音频
          </p>
          <el-button
            text
            :icon="useRenderIcon('ri-history-line')"
            style="margin-bottom: 24px"
            @click="router.push('/audio/list')"
          >
            查看生成记录
          </el-button>

          <div class="welcome-form">
            <!-- 搜索框 -->
            <div class="search-box">
              <el-input
                v-model="searchQuery"
                placeholder="搜索文章标题..."
                size="large"
                clearable
                :prefix-icon="useRenderIcon('ri/search-line')"
              />
            </div>

            <!-- 卡片网格 -->
            <div class="card-grid">
              <div
                v-for="item in filteredHistoryList"
                :key="item.id"
                class="history-card"
                :class="{ 'card-selected': selectedHistoryId === item.id }"
                @click="selectedHistoryId = item.id"
              >
                <div class="card-title" :title="item.topic">
                  {{ item.topic }}
                </div>
                <div class="card-tags">
                  <el-tag
                    size="small"
                    :type="item.contentType === 'novel' ? '' : 'info'"
                  >
                    {{ item.contentType === "novel" ? "小说" : "文章" }}
                  </el-tag>
                  <el-tag
                    v-if="item.status !== undefined"
                    size="small"
                    :type="getStatusType(item.status)"
                  >
                    {{ getStatusText(item.status) }}
                  </el-tag>
                  <span v-if="item.score" class="card-score"
                    >{{ item.score }}分</span
                  >
                </div>
                <div class="card-meta">
                  <span v-if="item.createTime">{{
                    formatDate(item.createTime)
                  }}</span>
                  <span v-if="item.totalSections"
                    >{{ item.totalSections }}章</span
                  >
                </div>
              </div>
            </div>

            <!-- 空状态 -->
            <div
              v-if="filteredHistoryList.length === 0 && historyList.length > 0"
              class="empty-search"
            >
              <el-empty description="未找到匹配的文章" :image-size="80" />
            </div>

            <!-- 生成按钮 -->
            <el-button
              type="primary"
              size="large"
              :icon="useRenderIcon('ri/play-circle-line')"
              :disabled="!selectedHistoryId"
              :loading="generating"
              style="width: 100%; margin-top: 16px"
              @click="handleGenerate"
            >
              生成有声版
            </el-button>
          </div>

          <div v-if="historyList.length === 0" class="empty-hint">
            <el-alert
              title="暂无可用于生成音频的写作作品"
              description="请先完成至少一篇反思写作（状态为达标或超限兜底），然后再来生成有声版。"
              type="info"
              show-icon
              :closable="false"
            />
          </div>
        </div>
      </div>

      <!-- 生成中 / 结果态 -->
      <div v-else class="result-view">
        <div class="result-content">
          <!-- 顶部信息 -->
          <div class="result-header">
            <h2 class="result-title">{{ getSelectedTopic() }}</h2>
            <el-button
              text
              :icon="useRenderIcon('ri/arrow-go-back-line')"
              @click="
                resetResult();
                generating = false;
              "
            >
              返回
            </el-button>
          </div>

          <!-- 进度区域 -->
          <div
            v-if="generating || result.status === 'generating'"
            class="progress-section"
          >
            <div class="progress-card">
              <div class="progress-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="spinning"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
              <div class="progress-info">
                <div class="progress-title">正在生成有声版</div>
                <div class="progress-detail">
                  {{ result.progressDetail || "处理中..." }}
                </div>
              </div>
              <el-progress
                :percentage="result.progressPercent || 0"
                :stroke-width="10"
                striped
                :striped-flow="true"
                style="width: 100%; margin-top: 20px"
              />
            </div>
          </div>

          <!-- 完成区域 -->
          <div
            v-if="result.status === 'completed' && result.audioUrl"
            class="completed-section"
          >
            <div class="audio-player-card">
              <div class="player-header">
                <div class="player-icon">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                </div>
                <div class="player-info">
                  <div class="player-title">有声版音频</div>
                  <div class="player-subtitle">生成完成</div>
                </div>
              </div>

              <audio
                controls
                :src="result.audioUrl"
                style="width: 100%; margin-top: 16px"
              >
                您的浏览器不支持音频播放
              </audio>

              <div class="audio-meta">
                <div class="meta-item">
                  <span class="meta-label">时长</span>
                  <span class="meta-value">{{
                    formatDuration(result.durationMs)
                  }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">文件大小</span>
                  <span class="meta-value">{{
                    formatFileSize(result.fileSizeBytes)
                  }}</span>
                </div>
                <div class="meta-item">
                  <span class="meta-label">句子数量</span>
                  <span class="meta-value">{{
                    result.sentenceCount ?? "--"
                  }}</span>
                </div>
              </div>

              <el-button
                type="primary"
                :icon="useRenderIcon('ri/download-line')"
                style="width: 100%; margin-top: 16px"
                @click="window.open(result.audioUrl)"
              >
                下载音频
              </el-button>
            </div>
          </div>

          <!-- 错误区域 -->
          <div v-if="result.status === 'failed'" class="error-section">
            <el-alert
              :title="result.errorMessage || '生成失败'"
              type="error"
              show-icon
              :closable="false"
            />
            <el-button
              type="primary"
              style="margin-top: 16px"
              @click="
                resetResult();
                generating = false;
              "
            >
              重新选择
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.audio-container {
  position: fixed;
  inset: 82px 0 0 210px;
  display: flex;
  overflow: hidden;
  background: var(--el-bg-color);
}

.audio-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* ========== 欢迎态 ========== */
.welcome-view {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  overflow-y: auto;
}

.welcome-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 520px;
}

.welcome-icon {
  width: 56px;
  height: 56px;
  margin-bottom: 20px;
  color: var(--el-color-primary);
  opacity: 0.7;
}

.welcome-icon svg {
  width: 100%;
  height: 100%;
}

.welcome-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.welcome-desc {
  margin: 0 0 36px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.welcome-form {
  width: 100%;
  max-width: 900px;
}

/* 搜索框 */
.search-box {
  margin-bottom: 20px;
}

/* 卡片网格 */
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  max-height: 400px;
  padding: 4px;
  margin-bottom: 16px;
  overflow-y: auto;
}

@media (width <= 1200px) {
  .card-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (width <= 768px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}

/* 文章卡片 */
.history-card {
  padding: 16px;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 2px solid var(--el-border-color-lighter);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 4%);
  transition: all 0.2s ease;
}

.history-card:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 4px 12px rgb(0 0 0 / 8%);
}

.card-selected {
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary) !important;
}

/* 卡片标题 */
.card-title {
  display: -webkit-box;
  margin-bottom: 10px;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-text-color-primary);
  -webkit-box-orient: vertical;
}

/* 卡片标签 */
.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-bottom: 8px;
}

.card-score {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-color-primary);
}

/* 卡片元信息 */
.card-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

/* 空搜索 */
.empty-search {
  margin-bottom: 16px;
}

.empty-hint {
  width: 100%;
  margin-top: 24px;
}

/* ========== 结果态 ========== */
.result-view {
  display: flex;
  flex: 1;
  justify-content: center;
  padding: 32px 24px;
  overflow-y: auto;
  background: var(--el-fill-color-lighter);
}

.result-content {
  width: 100%;
  max-width: 600px;
}

.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.result-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* ========== 进度 ========== */
.progress-section {
  margin-bottom: 24px;
}

.progress-card {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  padding: 28px 24px;
  background: linear-gradient(
    135deg,
    var(--el-color-primary-light-9) 0%,
    var(--el-bg-color) 100%
  );
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 14px;
}

.progress-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  color: var(--el-color-primary);
}

.progress-icon svg {
  width: 100%;
  height: 100%;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.progress-info {
  flex: 1;
  margin-left: 16px;
}

.progress-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.progress-detail {
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

/* ========== 完成 ========== */
.completed-section {
  animation: fade-in 0.3s ease;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.audio-player-card {
  padding: 24px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 14px;
  box-shadow: 0 2px 12px rgb(0 0 0 / 4%);
}

.player-header {
  display: flex;
  gap: 16px;
  align-items: center;
}

.player-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  color: white;
  background: var(--el-color-primary);
  border-radius: 12px;
}

.player-icon svg {
  width: 22px;
  height: 22px;
}

.player-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.player-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: var(--el-color-success);
}

.audio-meta {
  display: flex;
  gap: 24px;
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.meta-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* ========== 错误 ========== */
.error-section {
  animation: fade-in 0.3s ease;
}
</style>
