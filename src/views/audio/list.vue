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
  <div class="audio-list-container p-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex-bc">
          <span class="font-bold text-lg">音频生成记录</span>
          <div class="flex items-center gap-2">
            <el-button
              type="primary"
              :icon="useRenderIcon('ri:add-line')"
              @click="router.push('/audio')"
            >
              生成新音频
            </el-button>
            <el-button
              :icon="useRenderIcon('ri:refresh-line')"
              @click="loadList"
            >
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <!-- 历史列表 -->
      <el-table
        v-loading="loading"
        :data="list"
        border
        stripe
        max-height="calc(100vh - 300px)"
      >
        <el-table-column
          prop="historyId"
          label="关联文章ID"
          width="140"
          show-overflow-tooltip
        />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusTag(row.status).type" size="small">
              {{ getStatusTag(row.status).text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="时长" width="100" align="center">
          <template #default="{ row }">
            {{ formatDuration(row.durationMs) }}
          </template>
        </el-table-column>
        <el-table-column label="文件大小" width="100" align="center">
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
        <el-table-column label="创建时间" width="160" align="center">
          <template #default="{ row }">
            {{ formatDate(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
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

      <!-- 分页 -->
      <div class="flex justify-end mt-4">
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
    </el-card>
  </div>
</template>

<style scoped>
.audio-list-container {
  /* 使用与 Text-to-SQL 一致的样式 */
}
</style>
