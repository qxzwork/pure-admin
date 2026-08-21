<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { getAudioDetail, type AudioRecord } from "@/api/audio";

defineOptions({ name: "AudioDetail" });

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const record = ref<AudioRecord | null>(null);

async function loadDetail() {
  const id = Number(route.params.id);
  if (!id) return;
  loading.value = true;
  try {
    const res = await getAudioDetail(id);
    if (res?.code === 200) {
      record.value = res.data;
    }
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
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
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleString("zh-CN");
}

function getStatusTag(status: number): {
  text: string;
  type: "" | "success" | "danger" | "warning";
} {
  switch (status) {
    case 0:
      return { text: "生成中", type: "warning" };
    case 1:
      return { text: "成功", type: "success" };
    case 2:
      return { text: "失败", type: "danger" };
    default:
      return { text: "未知", type: "" };
  }
}

onMounted(() => {
  loadDetail();
});
</script>

<template>
  <div v-loading="loading" class="audio-detail-container">
    <div class="detail-content">
      <div class="detail-header">
        <div class="header-left">
          <el-button
            class="back-btn"
            :icon="useRenderIcon('ri:arrow-left-line')"
            @click="router.push('/audio/list')"
          >
            返回列表
          </el-button>
          <div class="header-info">
            <h1 class="header-title">音频详情</h1>
            <p class="header-desc">查看音频生成记录的详细信息</p>
          </div>
        </div>
        <el-tag
          v-if="record"
          :type="getStatusTag(record.status).type"
          size="large"
          effect="plain"
        >
          {{ getStatusTag(record.status).text }}
        </el-tag>
      </div>

      <template v-if="record">
        <!-- 播放器 -->
        <div v-if="record.audioUrl" class="player-section">
          <div class="section-card">
            <div class="section-header">
              <div class="section-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </div>
              <div class="section-title">音频播放</div>
              <el-button
                link
                type="primary"
                size="small"
                class="download-link"
                @click="window.open(record.audioUrl)"
              >
                下载
              </el-button>
            </div>
            <audio controls :src="record.audioUrl" class="audio-element">
              您的浏览器不支持音频播放
            </audio>
          </div>
        </div>

        <!-- 基本信息 -->
        <div class="info-section">
          <div class="section-card">
            <div class="section-header">
              <div class="section-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
              <div class="section-title">基本信息</div>
            </div>
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">记录 ID</span>
                <span class="info-value">{{ record.id }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">关联文章 ID</span>
                <span class="info-value">{{ record.historyId }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">音频时长</span>
                <span class="info-value">{{
                  formatDuration(record.durationMs)
                }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">文件大小</span>
                <span class="info-value">{{
                  formatFileSize(record.fileSizeBytes)
                }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">句子数量</span>
                <span class="info-value">{{
                  record.sentenceCount ?? "--"
                }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">生成进度</span>
                <span class="info-value"
                  >{{ record.progressPercent ?? 0 }}%</span
                >
              </div>
              <div class="info-item">
                <span class="info-label">创建时间</span>
                <span class="info-value">{{
                  formatDate(record.createTime)
                }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">更新时间</span>
                <span class="info-value">{{
                  formatDate(record.updateTime)
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 进度详情 -->
        <div v-if="record.progressDetail" class="progress-section">
          <div class="section-card">
            <div class="section-header">
              <div class="section-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <div class="section-title">进度详情</div>
            </div>
            <div class="progress-detail">{{ record.progressDetail }}</div>
          </div>
        </div>

        <!-- 进度条（生成中） -->
        <div v-if="record.status === 0" class="progress-bar-section">
          <div class="section-card">
            <div class="section-header">
              <div class="section-icon spinning">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              </div>
              <div class="section-title">生成进度</div>
            </div>
            <el-progress
              :percentage="record.progressPercent || 0"
              :stroke-width="12"
              striped
              :striped-flow="true"
              class="progress-bar"
            />
            <p class="progress-text">
              {{ record.progressDetail || "处理中..." }}
            </p>
          </div>
        </div>

        <!-- 错误信息 -->
        <div
          v-if="record.status === 2 && record.errorMessage"
          class="error-section"
        >
          <div class="section-card">
            <div class="section-header">
              <div class="section-icon error-icon">
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
              <div class="section-title">错误信息</div>
            </div>
            <el-alert
              :title="record.errorMessage"
              type="error"
              show-icon
              :closable="false"
            />
          </div>
        </div>
      </template>

      <div v-if="!loading && !record" class="empty-state">
        <el-empty description="记录不存在" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.audio-detail-container {
  position: fixed;
  inset: 82px 0 0 210px;
  display: flex;
  overflow: hidden;
  background: #fdf8f3;
  background-image:
    radial-gradient(
      circle at 20% 50%,
      rgb(212 165 116 / 5%) 0%,
      transparent 50%
    ),
    radial-gradient(
      circle at 80% 20%,
      rgb(139 105 20 / 3%) 0%,
      transparent 50%
    );
}

.detail-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  padding: 24px;
  overflow-y: auto;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.header-left {
  display: flex;
  gap: 16px;
  align-items: center;
}

.back-btn {
  color: #4a3728 !important;
  background: #fffef9 !important;
  border-color: #e8d5c0 !important;
  box-shadow: 0 2px 8px rgb(139 105 20 / 8%);
}

.back-btn:hover {
  color: #8b6914 !important;
  border-color: #d4a574 !important;
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-title {
  margin: 0;
  font-family: "Noto Serif SC", "Source Han Serif SC", serif;
  font-size: 22px;
  font-weight: 700;
  color: #4a3728;
  letter-spacing: 1px;
}

.header-desc {
  margin: 0;
  font-size: 14px;
  color: #8b7355;
}

.section-card {
  padding: 24px;
  margin-bottom: 20px;
  background: #fffef9;
  border: 1px solid #e8d5c0;
  border-radius: 14px;
  box-shadow: 0 2px 12px rgb(139 105 20 / 6%);
}

.section-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 20px;
}

.section-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  color: #8b6914;
}

.section-icon svg {
  width: 100%;
  height: 100%;
}

.section-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: #4a3728;
}

.download-link {
  color: #8b6914 !important;
}

.download-link:hover {
  color: #a67c00 !important;
}

/* 播放器 */
.audio-element {
  width: 100%;
  border-radius: 8px;
}

/* 信息网格 */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (width <= 768px) {
  .info-grid {
    grid-template-columns: 1fr;
  }
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px;
  background: rgb(139 105 20 / 3%);
  border: 1px dashed #e8d5c0;
  border-radius: 10px;
}

.info-label {
  font-size: 12px;
  color: #8b7355;
}

.info-value {
  font-size: 15px;
  font-weight: 600;
  color: #4a3728;
}

/* 进度详情 */
.progress-detail {
  padding: 14px;
  font-size: 14px;
  line-height: 1.6;
  color: #4a3728;
  background: rgb(139 105 20 / 3%);
  border: 1px dashed #e8d5c0;
  border-radius: 10px;
}

/* 进度条 */
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

.progress-bar {
  width: 100%;
}

:deep(.progress-bar .el-progress-bar__outer) {
  background: rgb(139 105 20 / 10%);
  border-radius: 8px;
}

:deep(.progress-bar .el-progress-bar__inner) {
  background: linear-gradient(90deg, #8b6914 0%, #d4a574 100%);
  border-radius: 8px;
}

.progress-text {
  margin-top: 12px;
  font-size: 13px;
  color: #8b7355;
  text-align: center;
}

/* 错误 */
.error-icon {
  color: #c75450;
}

.empty-state {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
}
</style>
