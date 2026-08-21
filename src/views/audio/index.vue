<script setup lang="ts">
import {
  ref,
  reactive,
  computed,
  onBeforeUnmount,
  onMounted,
  nextTick
} from "vue";
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
const currentStep = ref<"select" | "generating" | "completed" | "error">(
  "select"
);
const isTransitioning = ref(false);
const currentPage = ref(1);
const pageSize = ref(10);
let pollTimer: ReturnType<typeof setInterval> | null = null;

const filteredHistoryList = computed(() => {
  if (!searchQuery.value) return historyList.value;
  const query = searchQuery.value.toLowerCase();
  return historyList.value.filter(item =>
    item.topic.toLowerCase().includes(query)
  );
});

const paginatedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredHistoryList.value.slice(start, end);
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
        currentStep.value = "completed";
        message("音频生成完成", { type: "success" });
      } else if (res.data.status === "failed") {
        stopPolling();
        generating.value = false;
        currentStep.value = "error";
        message(res.data.errorMessage || "生成失败", { type: "error" });
      }
    }
  } catch {
    // ignore
  }
}

function tableRowClassName({ row }: { row: ReflectionHistory }) {
  if (selectedHistoryId.value === row.id) {
    return "current-row";
  }
  return "";
}

function handleRowClick(row: ReflectionHistory) {
  selectedHistoryId.value = row.id;
}

async function handleGenerate() {
  if (!selectedHistoryId.value || generating.value) return;

  resetResult();
  generating.value = true;
  currentStep.value = "generating";
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
        currentStep.value = "completed";
        message("音频生成完成", { type: "success" });
        return;
      }

      if (res.data.status === "failed") {
        generating.value = false;
        currentStep.value = "error";
        message(res.data.errorMessage || "生成失败", { type: "error" });
        return;
      }

      if (res.data.recordId) {
        pollTimer = setInterval(() => pollStatus(res.data.recordId!), 60000);
      }
    } else {
      generating.value = false;
      currentStep.value = "error";
      result.status = "failed";
      result.errorMessage = res.message || "提交失败";
      message(res.message || "提交失败", { type: "error" });
    }
  } catch {
    generating.value = false;
    currentStep.value = "error";
    result.status = "failed";
    result.errorMessage = "请求失败，请稍后重试";
    message("请求失败，请稍后重试", { type: "error" });
  }
}

function handleBack() {
  isTransitioning.value = true;
  setTimeout(() => {
    resetResult();
    generating.value = false;
    currentStep.value = "select";
    isTransitioning.value = false;
  }, 500);
}

function handleRetry() {
  isTransitioning.value = true;
  setTimeout(() => {
    resetResult();
    generating.value = false;
    currentStep.value = "select";
    isTransitioning.value = false;
  }, 500);
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
  <div
    class="studio-container"
    :class="{ 'is-transitioning': isTransitioning }"
  >
    <!-- 粒子背景 -->
    <div class="particles-bg">
      <div v-for="i in 50" :key="i" class="particle" :style="{ '--i': i }" />
    </div>

    <!-- 光晕效果 -->
    <div class="glow-orb glow-orb-1" />
    <div class="glow-orb glow-orb-2" />
    <div class="glow-orb glow-orb-3" />

    <!-- 主内容区 -->
    <div class="studio-main">
      <!-- 选择态 -->
      <transition name="fade-up" mode="out-in">
        <div v-if="currentStep === 'select'" key="select" class="select-view">
          <div class="select-header">
            <h2 class="select-title">选择文章</h2>
            <div class="search-wrapper">
              <input
                v-model="searchQuery"
                type="text"
                class="search-input"
                placeholder="搜索文章..."
              />
              <svg
                class="search-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                width="18"
                height="18"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          <div class="table-container">
            <el-table
              :data="paginatedList"
              style="width: 100%"
              :row-class-name="tableRowClassName"
              highlight-current-row
              @row-click="handleRowClick"
            >
              <el-table-column
                prop="topic"
                label="标题"
                min-width="200"
                show-overflow-tooltip
              >
                <template #default="{ row }">
                  <span class="topic-text">{{ row.topic }}</span>
                </template>
              </el-table-column>
              <el-table-column label="类型" width="80" align="center">
                <template #default="{ row }">
                  <span
                    :class="[
                      'type-tag',
                      row.contentType === 'novel'
                        ? 'type-novel'
                        : 'type-article'
                    ]"
                  >
                    {{ row.contentType === "novel" ? "小说" : "文章" }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100" align="center">
                <template #default="{ row }">
                  <span class="status-badge">
                    <span
                      :class="[
                        'status-dot',
                        `status-${getStatusType(row.status) || 'default'}`
                      ]"
                    />
                    <span class="status-text">{{
                      getStatusText(row.status) || "未知"
                    }}</span>
                  </span>
                </template>
              </el-table-column>
              <el-table-column label="分数" width="80" align="center">
                <template #default="{ row }">
                  <span class="score-text">{{ row.score || "--" }}</span>
                </template>
              </el-table-column>
              <el-table-column label="时间" width="110" align="center">
                <template #default="{ row }">
                  <span class="date-text">{{
                    formatDate(row.createTime)
                  }}</span>
                </template>
              </el-table-column>
              <el-table-column
                label="操作"
                width="80"
                align="center"
                fixed="right"
              >
                <template #default="{ row }">
                  <button
                    class="play-btn"
                    @click.stop="
                      selectedHistoryId = row.id;
                      handleGenerate();
                    "
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      width="16"
                      height="16"
                    >
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </button>
                </template>
              </el-table-column>
            </el-table>

            <!-- 分页 -->
            <div class="pagination-wrapper">
              <span class="pagination-info"
                >共 {{ filteredHistoryList.length }} 篇</span
              >
              <el-pagination
                v-model:current-page="currentPage"
                v-model:page-size="pageSize"
                :page-sizes="[10, 20, 50]"
                :total="filteredHistoryList.length"
                layout="sizes, prev, pager, next"
                small
              />
            </div>
          </div>

          <div class="select-footer">
            <button
              class="generate-btn"
              :disabled="!selectedHistoryId"
              @click="handleGenerate"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                width="20"
                height="20"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>生成音频</span>
              <span class="btn-glow" />
            </button>
          </div>
        </div>
      </transition>

      <!-- 生成态 -->
      <transition name="fade-up" mode="out-in">
        <div
          v-if="currentStep === 'generating'"
          key="generating"
          class="generating-view"
        >
          <div class="generating-content">
            <div class="progress-ring-container">
              <svg class="progress-ring" viewBox="0 0 200 200">
                <defs>
                  <linearGradient
                    id="progressGradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stop-color="#3b82f6" />
                    <stop offset="100%" stop-color="#8b5cf6" />
                  </linearGradient>
                </defs>
                <circle
                  class="progress-ring-bg"
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="rgba(255,255,255,0.1)"
                  stroke-width="8"
                />
                <circle
                  class="progress-ring-fill"
                  cx="100"
                  cy="100"
                  r="90"
                  fill="none"
                  stroke="url(#progressGradient)"
                  stroke-width="8"
                  stroke-linecap="round"
                  :stroke-dasharray="565.48"
                  :stroke-dashoffset="
                    565.48 * (1 - (result.progressPercent || 0) / 100)
                  "
                />
              </svg>
              <div class="progress-percent">
                {{ result.progressPercent || 0 }}%
              </div>
            </div>

            <!-- 声波动画 -->
            <div class="sound-wave">
              <div
                v-for="i in 20"
                :key="i"
                class="wave-bar"
                :style="{ '--i': i }"
              />
            </div>

            <div class="generating-info">
              <h2 class="generating-title">正在生成音频</h2>
              <p class="generating-detail">
                {{ result.progressDetail || "处理中..." }}
              </p>
            </div>

            <div class="generating-article">
              <span class="article-label">正在处理：</span>
              <span class="article-title">{{ getSelectedTopic() }}</span>
            </div>
          </div>
        </div>
      </transition>

      <!-- 完成态 -->
      <transition name="fade-up" mode="out-in">
        <div
          v-if="currentStep === 'completed'"
          key="completed"
          class="completed-view"
        >
          <div class="completed-content">
            <div class="player-card">
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
                  <h3 class="player-title">生成完成</h3>
                  <p class="player-subtitle">{{ getSelectedTopic() }}</p>
                </div>
                <button class="back-to-select" @click="handleBack">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="18"
                    height="18"
                  >
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  返回
                </button>
              </div>

              <!-- 波形可视化 -->
              <div class="waveform-container">
                <canvas ref="waveformCanvas" class="waveform-canvas" />
              </div>

              <audio controls :src="result.audioUrl" class="audio-player">
                您的浏览器不支持音频播放
              </audio>

              <div class="player-meta">
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

              <div class="player-actions">
                <button
                  class="download-btn"
                  @click="window.open(result.audioUrl)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    width="20"
                    height="20"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>下载音频</span>
                  <span class="btn-glow" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- 错误态 -->
      <transition name="fade-up" mode="out-in">
        <div v-if="currentStep === 'error'" key="error" class="error-view">
          <div class="error-content">
            <div class="error-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <h2 class="error-title">生成失败</h2>
            <p class="error-message">
              {{ result.errorMessage || "发生未知错误" }}
            </p>
            <div class="error-actions">
              <button class="retry-btn" @click="handleRetry">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  width="20"
                  height="20"
                >
                  <polyline points="23 4 23 10 17 10" />
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                </svg>
                <span>重新选择</span>
                <span class="btn-glow" />
              </button>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<style scoped>
/* ========== 容器 ========== */
.studio-container {
  position: fixed;
  inset: 82px 0 0 210px;
  display: flex;
  overflow: hidden;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0a1a2e 100%);
}

.studio-container.is-transitioning {
  pointer-events: none;
}

/* ========== 粒子背景 ========== */
.particles-bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.particle {
  position: absolute;
  top: calc(var(--i) * 1.5%);
  left: calc(var(--i) * 2%);
  width: 4px;
  height: 4px;
  background: rgb(59 130 246 / 60%);
  border-radius: 50%;
  animation: particle-float 15s infinite linear;
  animation-delay: calc(var(--i) * -0.3s);
}

@keyframes particle-float {
  0%,
  100% {
    opacity: 0;
    transform: translate(0, 0) scale(1);
  }

  10% {
    opacity: 1;
  }

  90% {
    opacity: 1;
  }

  50% {
    transform: translate(
        calc(cos(var(--i)) * 100px),
        calc(sin(var(--i)) * 100px)
      )
      scale(1.5);
  }
}

/* ========== 光晕效果 ========== */
.glow-orb {
  position: absolute;
  pointer-events: none;
  border-radius: 50%;
  opacity: 0.3;
  filter: blur(80px);
  animation: glow-pulse 8s ease-in-out infinite;
}

.glow-orb-1 {
  top: -100px;
  left: -100px;
  width: 400px;
  height: 400px;
  background: #3b82f6;
  animation-delay: 0s;
}

.glow-orb-2 {
  right: -50px;
  bottom: -50px;
  width: 300px;
  height: 300px;
  background: #8b5cf6;
  animation-delay: -3s;
}

.glow-orb-3 {
  top: 50%;
  left: 50%;
  width: 200px;
  height: 200px;
  background: #6366f1;
  transform: translate(-50%, -50%);
  animation-delay: -5s;
}

@keyframes glow-pulse {
  0%,
  100% {
    opacity: 0.2;
    transform: scale(1);
  }

  50% {
    opacity: 0.4;
    transform: scale(1.1);
  }
}

/* ========== 主内容区 ========== */
.studio-main {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

/* ========== 过渡动画 ========== */
.fade-up-enter-active,
.fade-up-leave-active {
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-up-enter-from {
  opacity: 0;
  transform: translateY(30px);
}

.fade-up-leave-to {
  opacity: 0;
  transform: translateY(-30px);
}

/* ========== 按钮光晕 ========== */
.btn-glow {
  position: absolute;
  inset: -2px;
  z-index: -1;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6, #6366f1);
  border-radius: inherit;
  opacity: 0;
  filter: blur(12px);
  transition: opacity 0.3s ease;
}

.generate-btn:hover .btn-glow,
.download-btn:hover .btn-glow,
.retry-btn:hover .btn-glow {
  opacity: 0.6;
}

/* ========== 选择态 ========== */
.select-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 32px 40px;
}

.select-header {
  display: flex;
  gap: 24px;
  align-items: center;
  margin-bottom: 40px;
}

.select-title {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  color: white;
}

.search-wrapper {
  position: relative;
  margin-left: auto;
}

.search-input {
  width: 280px;
  padding: 14px 20px 14px 48px;
  font-size: 15px;
  color: white;
  outline: none;
  background: rgb(255 255 255 / 5%);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 12px;
  backdrop-filter: blur(20px);
  transition: all 0.3s ease;
}

.search-input::placeholder {
  color: rgb(255 255 255 / 40%);
}

.search-input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 24px rgb(59 130 246 / 20%);
}

.search-icon {
  position: absolute;
  top: 50%;
  left: 16px;
  color: rgb(255 255 255 / 40%);
  transform: translateY(-50%);
}

/* ========== 表格容器 ========== */
.table-container {
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  background: rgb(255 255 255 / 3%);
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 16px;
  backdrop-filter: blur(20px);
}

/* ========== Element Plus 表格自定义 ========== */
:deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: rgb(255 255 255 / 5%);
  --el-table-row-hover-bg-color: rgb(59 130 246 / 10%);
  --el-table-border-color: rgb(255 255 255 / 6%);
  --el-table-text-color: rgb(255 255 255 / 80%);
  --el-table-header-text-color: rgb(255 255 255 / 60%);
  --el-table-current-row-bg-color: rgb(59 130 246 / 15%);

  background: transparent;
}

:deep(.el-table__header th) {
  font-size: 13px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

:deep(.el-table__row) {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

:deep(.el-table__row.current-row) {
  background-color: rgb(59 130 246 / 15%) !important;
}

:deep(.el-table__row:hover > td.el-table__cell) {
  background-color: rgb(59 130 246 / 10%);
}

:deep(.el-table__empty-block) {
  background: transparent;
}

/* ========== 表格内容样式 ========== */
.topic-text {
  font-size: 14px;
  font-weight: 500;
  color: rgb(255 255 255 / 90%);
}

.type-tag {
  display: inline-block;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 12px;
}

.type-article {
  color: #3b82f6;
  background: rgb(59 130 246 / 15%);
}

.type-novel {
  color: #8b5cf6;
  background: rgb(139 92 246 / 15%);
}

.status-badge {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.status-success {
  background: #10b981;
  box-shadow: 0 0 8px rgb(16 185 129 / 50%);
}

.status-dot.status-warning {
  background: #f59e0b;
  box-shadow: 0 0 8px rgb(245 158 11 / 50%);
}

.status-dot.status-info {
  background: #3b82f6;
  box-shadow: 0 0 8px rgb(59 130 246 / 50%);
}

.status-dot.status-default {
  background: rgb(255 255 255 / 30%);
}

.status-text {
  font-size: 13px;
  color: rgb(255 255 255 / 60%);
}

.score-text {
  font-size: 14px;
  font-weight: 600;
  color: #8b5cf6;
}

.date-text {
  font-size: 13px;
  color: rgb(255 255 255 / 50%);
}

.play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: 0 auto;
  color: rgb(255 255 255 / 60%);
  cursor: pointer;
  background: rgb(255 255 255 / 5%);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.play-btn:hover {
  color: #3b82f6;
  background: rgb(59 130 246 / 15%);
  border-color: rgb(59 130 246 / 30%);
}

/* ========== 分页 ========== */
.pagination-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-top: 1px solid rgb(255 255 255 / 6%);
}

.pagination-info {
  font-size: 13px;
  color: rgb(255 255 255 / 40%);
}

:deep(.el-pagination) {
  --el-pagination-bg-color: transparent;
  --el-pagination-text-color: rgb(255 255 255 / 60%);
  --el-pagination-button-bg-color: rgb(255 255 255 / 5%);
  --el-pagination-hover-color: #3b82f6;
}

:deep(.el-pagination .is-active) {
  color: #3b82f6 !important;
  background: rgb(59 130 246 / 20%) !important;
}

:deep(.el-pagination .el-select .el-input) {
  --el-select-border-color-hover: #3b82f6;
}

/* ========== 底部操作栏 ========== */
.select-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 40px;
}

.generate-btn {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px 40px;
  overflow: hidden;
  font-size: 16px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: none;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgb(59 130 246 / 40%);
  transition: all 0.3s ease;
}

.generate-btn:hover:not(:disabled) {
  box-shadow: 0 12px 40px rgb(59 130 246 / 50%);
  transform: translateY(-2px);
}

.generate-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* ========== 生成态 ========== */
.generating-view {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.generating-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.progress-ring-container {
  position: relative;
  width: 200px;
  height: 200px;
  margin-bottom: 40px;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.progress-ring-fill {
  filter: drop-shadow(0 0 12px rgb(59 130 246 / 50%));
  transition: stroke-dashoffset 0.5s ease;
}

.progress-percent {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 700;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* ========== 声波动画 ========== */
.sound-wave {
  display: flex;
  gap: 4px;
  align-items: center;
  height: 60px;
  margin-bottom: 40px;
}

.wave-bar {
  width: 4px;
  height: 20px;
  background: linear-gradient(180deg, #3b82f6, #8b5cf6);
  border-radius: 2px;
  animation: wave-animation 1.2s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.05s);
}

@keyframes wave-animation {
  0%,
  100% {
    height: 20px;
  }

  50% {
    height: calc(20px + sin(var(--i)) * 30px);
  }
}

.generating-info {
  margin-bottom: 32px;
}

.generating-title {
  margin: 0 0 12px;
  font-size: 32px;
  font-weight: 600;
  color: white;
}

.generating-detail {
  margin: 0;
  font-size: 16px;
  color: rgb(255 255 255 / 60%);
}

.generating-article {
  padding: 16px 24px;
  background: rgb(255 255 255 / 5%);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 12px;
  backdrop-filter: blur(20px);
}

.article-label {
  font-size: 14px;
  color: rgb(255 255 255 / 50%);
}

.article-title {
  font-size: 16px;
  font-weight: 600;
  color: white;
}

/* ========== 完成态 ========== */
.completed-view {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.completed-content {
  width: 100%;
  max-width: 700px;
}

.player-card {
  padding: 32px;
  background: rgb(255 255 255 / 5%);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 24px;
  box-shadow: 0 24px 80px rgb(0 0 0 / 30%);
  backdrop-filter: blur(20px);
}

.player-header {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 24px;
}

.player-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border-radius: 16px;
  box-shadow: 0 8px 24px rgb(59 130 246 / 40%);
}

.player-icon svg {
  width: 24px;
  height: 24px;
  color: white;
}

.player-info {
  flex: 1;
}

.player-title {
  margin: 0 0 4px;
  font-size: 20px;
  font-weight: 600;
  color: white;
}

.player-subtitle {
  margin: 0;
  font-size: 14px;
  color: rgb(255 255 255 / 60%);
}

.back-to-select {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 20px;
  font-size: 14px;
  color: rgb(255 255 255 / 70%);
  cursor: pointer;
  background: rgb(255 255 255 / 5%);
  border: 1px solid rgb(255 255 255 / 10%);
  border-radius: 10px;
  transition: all 0.3s ease;
}

.back-to-select:hover {
  color: white;
  background: rgb(255 255 255 / 10%);
}

/* ========== 波形可视化 ========== */
.waveform-container {
  height: 80px;
  margin-bottom: 24px;
  overflow: hidden;
  background: rgb(0 0 0 / 20%);
  border-radius: 12px;
}

.waveform-canvas {
  width: 100%;
  height: 100%;
}

.audio-player {
  width: 100%;
  margin-bottom: 24px;
  border-radius: 12px;
}

.player-meta {
  display: flex;
  gap: 32px;
  padding-top: 20px;
  margin-bottom: 24px;
  border-top: 1px solid rgb(255 255 255 / 10%);
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 12px;
  color: rgb(255 255 255 / 40%);
}

.meta-value {
  font-size: 16px;
  font-weight: 600;
  color: white;
}

.player-actions {
  display: flex;
  justify-content: center;
}

.download-btn {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px 48px;
  overflow: hidden;
  font-size: 16px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: none;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgb(59 130 246 / 40%);
  transition: all 0.3s ease;
}

.download-btn:hover {
  box-shadow: 0 12px 40px rgb(59 130 246 / 50%);
  transform: translateY(-2px);
}

/* ========== 错误态 ========== */
.error-view {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.error-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.error-icon {
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
  color: #ef4444;
  filter: drop-shadow(0 0 20px rgb(239 68 68 / 50%));
  animation: error-shake 0.6s ease-in-out;
}

@keyframes error-shake {
  0%,
  100% {
    transform: translateX(0);
  }

  20%,
  60% {
    transform: translateX(-10px);
  }

  40%,
  80% {
    transform: translateX(10px);
  }
}

.error-icon svg {
  width: 100%;
  height: 100%;
}

.error-title {
  margin: 0 0 12px;
  font-size: 32px;
  font-weight: 600;
  color: white;
}

.error-message {
  margin: 0 0 32px;
  font-size: 16px;
  color: rgb(255 255 255 / 60%);
}

.error-actions {
  display: flex;
  gap: 16px;
}

.retry-btn {
  position: relative;
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px 40px;
  overflow: hidden;
  font-size: 16px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  border: none;
  border-radius: 14px;
  box-shadow: 0 8px 32px rgb(59 130 246 / 40%);
  transition: all 0.3s ease;
}

.retry-btn:hover {
  box-shadow: 0 12px 40px rgb(59 130 246 / 50%);
  transform: translateY(-2px);
}

/* ========== 响应式 ========== */
@media (width <= 768px) {
  .studio-container {
    inset: 0;
  }

  .card-title {
    font-size: 18px;
  }
}
</style>
