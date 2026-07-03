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
  <div class="audio-detail-container p-4">
    <el-card v-loading="loading" shadow="never">
      <template #header>
        <div class="flex-bc">
          <div class="flex items-center">
            <el-button
              :icon="useRenderIcon('ri:arrow-left-line')"
              link
              type="primary"
              @click="router.push('/audio/list')"
            >
              返回列表
            </el-button>
          </div>
          <el-tag
            v-if="record"
            :type="getStatusTag(record.status).type"
            size="large"
          >
            {{ getStatusTag(record.status).text }}
          </el-tag>
        </div>
      </template>

      <template v-if="record">
        <!-- 播放器 -->
        <div v-if="record.audioUrl" class="detail-section">
          <div class="section-label">
            音频播放
            <el-button
              link
              type="primary"
              size="small"
              class="ml-2"
              @click="window.open(record.audioUrl)"
            >
              下载
            </el-button>
          </div>
          <div class="section-content">
            <audio controls :src="record.audioUrl" style="width: 100%">
              您的浏览器不支持音频播放
            </audio>
          </div>
        </div>

        <!-- 基本信息 -->
        <div class="detail-section">
          <div class="section-label">基本信息</div>
          <div class="section-content">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="记录 ID">
                {{ record.id }}
              </el-descriptions-item>
              <el-descriptions-item label="关联文章 ID">
                {{ record.historyId }}
              </el-descriptions-item>
              <el-descriptions-item label="音频时长">
                {{ formatDuration(record.durationMs) }}
              </el-descriptions-item>
              <el-descriptions-item label="文件大小">
                {{ formatFileSize(record.fileSizeBytes) }}
              </el-descriptions-item>
              <el-descriptions-item label="句子数量">
                {{ record.sentenceCount ?? "--" }}
              </el-descriptions-item>
              <el-descriptions-item label="生成进度">
                {{ record.progressPercent ?? 0 }}%
              </el-descriptions-item>
              <el-descriptions-item label="创建时间">
                {{ formatDate(record.createTime) }}
              </el-descriptions-item>
              <el-descriptions-item label="更新时间">
                {{ formatDate(record.updateTime) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
        </div>

        <!-- 进度详情 -->
        <div v-if="record.progressDetail" class="detail-section">
          <div class="section-label">进度详情</div>
          <div class="section-content">{{ record.progressDetail }}</div>
        </div>

        <!-- 进度条（生成中） -->
        <div v-if="record.status === 0" class="detail-section">
          <div class="section-label">生成进度</div>
          <div class="section-content">
            <el-progress
              :percentage="record.progressPercent || 0"
              :stroke-width="12"
              striped
              :striped-flow="true"
            />
            <p class="progress-text">
              {{ record.progressDetail || "处理中..." }}
            </p>
          </div>
        </div>

        <!-- 错误信息 -->
        <div
          v-if="record.status === 2 && record.errorMessage"
          class="detail-section"
        >
          <div class="section-label">错误信息</div>
          <div class="section-content">
            <el-alert
              :title="record.errorMessage"
              type="error"
              show-icon
              :closable="false"
            />
          </div>
        </div>
      </template>

      <el-empty v-if="!loading && !record" description="记录不存在" />
    </el-card>
  </div>
</template>

<style scoped>
.detail-section {
  margin-bottom: 16px;
}

.section-label {
  margin-bottom: 8px;
  font-weight: bold;
  color: var(--el-text-color-primary);
}

.section-content {
  padding: 12px;
  line-height: 1.6;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.progress-text {
  margin-top: 8px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}
</style>
