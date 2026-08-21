<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { getAudioList, deleteAudio, type AudioRecord } from "@/api/audio";

defineOptions({ name: "AudioList" });

const router = useRouter();
const loading = ref(false);
const list = ref<AudioRecord[]>([]);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);

async function loadList() {
  loading.value = true;
  try {
    const res = await getAudioList({
      page: currentPage.value,
      size: pageSize.value
    });
    if (res?.code === 200) {
      list.value = res.data?.records ?? [];
      total.value = Number(res.data?.total) || 0;
    }
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

async function handleDelete(item: AudioRecord) {
  try {
    await ElMessageBox.confirm("确定删除该音频记录？", "警告", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    const res = await deleteAudio(item.id);
    if (res?.code === 200) {
      message("删除成功", { type: "success" });
      loadList();
    } else {
      message(res?.message ?? "删除失败", { type: "error" });
    }
  } catch {
    // cancelled
  }
}

function handleDetail(item: AudioRecord) {
  router.push(`/audio/detail/${item.id}`);
}

function handlePlay(item: AudioRecord) {
  if (item.audioUrl) {
    window.open(item.audioUrl);
  }
}

function handleDownload(item: AudioRecord) {
  if (item.audioUrl) {
    window.open(item.audioUrl);
  }
}

function handleCurrentChange(val: number) {
  currentPage.value = val;
  loadList();
}

function handleSizeChange(val: number) {
  pageSize.value = val;
  currentPage.value = 1;
  loadList();
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
  loadList();
});
</script>

<template>
  <div class="audio-list-container">
    <div class="list-content">
      <div class="list-header">
        <div class="header-left">
          <div class="header-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <div class="header-info">
            <h1 class="header-title">音频生成记录</h1>
            <p class="header-desc">查看和管理所有生成的有声版音频</p>
          </div>
        </div>
        <div class="header-actions">
          <el-button
            type="primary"
            class="primary-btn"
            :icon="useRenderIcon('ri:add-line')"
            @click="router.push('/audio')"
          >
            生成新音频
          </el-button>
          <el-button
            class="refresh-btn"
            :icon="useRenderIcon('ri:refresh-line')"
            @click="loadList"
          >
            刷新
          </el-button>
        </div>
      </div>

      <!-- 历史列表 -->
      <div v-loading="loading" class="table-wrapper">
        <el-table :data="list" max-height="calc(100vh - 320px)">
          <el-table-column
            prop="historyId"
            label="关联文章ID"
            width="140"
            show-overflow-tooltip
          />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag
                :type="getStatusTag(row.status).type"
                size="small"
                effect="plain"
              >
                {{ getStatusTag(row.status).text }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="时长" width="110" align="center">
            <template #default="{ row }">
              {{ formatDuration(row.durationMs) }}
            </template>
          </el-table-column>
          <el-table-column label="文件大小" width="110" align="center">
            <template #default="{ row }">
              {{ formatFileSize(row.fileSizeBytes) }}
            </template>
          </el-table-column>
          <el-table-column
            prop="sentenceCount"
            label="句子数"
            width="80"
            align="center"
          />
          <el-table-column label="创建时间" width="170" align="center">
            <template #default="{ row }">
              {{ formatDate(row.createTime) }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <el-button
                link
                type="primary"
                size="small"
                @click="handleDetail(row)"
              >
                <el-icon class="mr-1"
                  ><IconifyIconOffline icon="ri:eye-line"
                /></el-icon>
                查看
              </el-button>
              <el-button
                v-if="row.audioUrl"
                link
                type="success"
                size="small"
                @click="handlePlay(row)"
              >
                <el-icon class="mr-1"
                  ><IconifyIconOffline icon="ri:play-line"
                /></el-icon>
                播放
              </el-button>
              <el-button
                v-if="row.audioUrl"
                link
                type="info"
                size="small"
                @click="handleDownload(row)"
              >
                <el-icon class="mr-1"
                  ><IconifyIconOffline icon="ri:download-line"
                /></el-icon>
                下载
              </el-button>
              <el-button
                link
                type="danger"
                size="small"
                @click="handleDelete(row)"
              >
                <el-icon class="mr-1"
                  ><IconifyIconOffline icon="ri:delete-bin-line"
                /></el-icon>
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 分页 -->
      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.audio-list-container {
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

.list-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  padding: 24px;
  overflow-y: auto;
}

.list-header {
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

.header-icon {
  width: 48px;
  height: 48px;
  color: #8b6914;
  filter: drop-shadow(0 2px 4px rgb(139 105 20 / 20%));
}

.header-icon svg {
  width: 100%;
  height: 100%;
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

.header-actions {
  display: flex;
  gap: 12px;
}

.primary-btn {
  background: linear-gradient(135deg, #8b6914 0%, #a67c00 100%) !important;
  border-color: #8b6914 !important;
  box-shadow: 0 4px 12px rgb(139 105 20 / 30%);
  transition: all 0.3s ease;
}

.primary-btn:hover {
  background: linear-gradient(135deg, #a67c00 0%, #c49000 100%) !important;
  box-shadow: 0 6px 16px rgb(139 105 20 / 40%);
  transform: translateY(-1px);
}

.refresh-btn {
  color: #4a3728 !important;
  background: #fffef9 !important;
  border-color: #e8d5c0 !important;
  box-shadow: 0 2px 8px rgb(139 105 20 / 8%);
}

.refresh-btn:hover {
  color: #8b6914 !important;
  border-color: #d4a574 !important;
}

.table-wrapper {
  flex: 1;
  overflow: hidden;
  background: #fffef9;
  border: 1px solid #e8d5c0;
  border-radius: 14px;
  box-shadow: 0 2px 12px rgb(139 105 20 / 6%);
}

:deep(.el-table) {
  --el-table-bg-color: #fffef9;
  --el-table-tr-bg-color: #fffef9;
  --el-table-header-bg-color: rgb(139 105 20 / 4%);
  --el-table-row-hover-bg-color: rgb(139 105 20 / 6%);
  --el-table-border-color: #e8d5c0;
  --el-table-text-color: #4a3728;
  --el-table-header-text-color: #4a3728;
}

:deep(.el-table th.el-table__cell) {
  font-weight: 600;
}

:deep(
  .el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell
) {
  background: rgb(139 105 20 / 2%);
}

:deep(.el-table .el-table__row:hover > td.el-table__cell) {
  background: rgb(139 105 20 / 6%);
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}

:deep(.el-pagination) {
  --el-pagination-bg-color: #fffef9;
  --el-pagination-hover-color: #8b6914;
}

:deep(.el-pagination .is-active) {
  background: #8b6914 !important;
}
</style>
