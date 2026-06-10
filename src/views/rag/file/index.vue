<script setup lang="ts">
import {
  ref,
  reactive,
  onMounted,
  onBeforeUnmount,
  computed,
  watch
} from "vue";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import type { UploadRequestOptions } from "element-plus";
import dayjs from "dayjs";
import {
  RAG_DOC_STATUS,
  getRagFileList,
  getRagFileDetail,
  getRagFileText,
  uploadRagFile,
  deleteRagFile,
  type RagDocStatusCode,
  type RagFileItem,
  type RagFileDetail,
  type RagTextSlice
} from "@/api/rag";

defineOptions({ name: "KnowledgeFile" });

// ========== 列表查询 ==========
const loading = ref(false);
const dataList = ref<RagFileItem[]>([]);
const pagination = reactive({ total: 0, pageSize: 20, currentPage: 1 });
const searchForm = reactive({
  fileName: "",
  status: "" as string | RagDocStatusCode
});

const statusOptions = [
  { label: "全部", value: "" },
  { label: "解析中", value: RAG_DOC_STATUS.PROCESSING },
  { label: "成功", value: RAG_DOC_STATUS.SUCCESS },
  { label: "失败", value: RAG_DOC_STATUS.FAILED }
];

const columns: TableColumnList = [
  { label: "ID", prop: "id", width: 80 },
  {
    label: "文件名",
    prop: "fileName",
    minWidth: 200,
    showOverflowTooltip: true
  },
  { label: "类型", prop: "fileType", width: 90 },
  {
    label: "大小",
    prop: "fileSize",
    width: 110,
    formatter: ({ fileSize }: { fileSize: number }) => fmtSize(fileSize)
  },
  {
    label: "状态",
    prop: "status",
    width: 110,
    slot: "status"
  },
  { label: "切片数", prop: "chunkCount", width: 90 },
  { label: "上传人", prop: "uploaderName", width: 120 },
  {
    label: "上传时间",
    prop: "createTime",
    width: 170,
    formatter: ({ createTime }: { createTime: string }) => fmtTime(createTime)
  },
  { label: "操作", fixed: "right", width: 200, slot: "operation" }
];

function fmtSize(bytes: number) {
  if (!bytes && bytes !== 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function fmtTime(val: string) {
  return val ? dayjs(val).format("YYYY-MM-DD HH:mm:ss") : "-";
}

function statusTagType(status: number) {
  switch (status) {
    case RAG_DOC_STATUS.PROCESSING:
      return "warning";
    case RAG_DOC_STATUS.SUCCESS:
      return "success";
    case RAG_DOC_STATUS.FAILED:
      return "danger";
    default:
      return "info";
  }
}

async function onSearch() {
  loading.value = true;
  try {
    const res = await getRagFileList({
      page: pagination.currentPage,
      size: pagination.pageSize,
      fileName: searchForm.fileName || undefined,
      status: (searchForm.status || undefined) as RagDocStatusCode | undefined
    });
    if (res?.code === 200) {
      dataList.value = res.data?.records ?? [];
      pagination.total = Number(res.data?.total ?? 0);
      pagination.currentPage = Number(res.data?.current ?? 1);
      pagination.pageSize = Number(res.data?.size ?? 20);
    } else {
      message(res?.message ?? "查询失败", { type: "error" });
      dataList.value = [];
    }
  } catch {
    dataList.value = [];
  } finally {
    loading.value = false;
  }
}

function handleSizeChange(val: number) {
  pagination.pageSize = val;
  pagination.currentPage = 1;
  onSearch();
}

function handleCurrentChange(val: number) {
  pagination.currentPage = val;
  onSearch();
}

function resetSearch() {
  searchForm.fileName = "";
  searchForm.status = "";
  pagination.currentPage = 1;
  onSearch();
}

// ========== 状态轮询 ==========
const hasProcessing = computed(() =>
  dataList.value.some(i => i.status === RAG_DOC_STATUS.PROCESSING)
);

let pollTimer: ReturnType<typeof setInterval> | null = null;
function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    onSearch();
  }, 3000);
}
function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ========== 上传 ==========
const uploadRef = ref();

async function customUpload(options: UploadRequestOptions) {
  const { file, onSuccess, onError } = options;
  try {
    const res = await uploadRagFile(file as File);
    if (res?.code === 200) {
      message(
        res.data?.message ??
          `上传成功，documentId=${res.data?.documentId}，处理中…`,
        { type: "success" }
      );
      onSuccess(res);
      onSearch();
    } else {
      message(res?.message ?? "上传失败", { type: "error" });
      onError({
        status: res?.code ?? 0,
        method: "post",
        url: "/api/rag/files/upload",
        name: (file as File)?.name ?? "",
        message: res?.message ?? "upload failed"
      });
    }
  } catch (e: any) {
    message(e?.message ?? "上传失败", { type: "error" });
    onError({
      status: 0,
      method: "post",
      url: "/api/rag/files/upload",
      name: (file as File)?.name ?? "",
      message: e?.message ?? "upload failed"
    });
  }
}

function onBeforeUpload(file: { size: number; name: string }) {
  const max = 50 * 1024 * 1024;
  if ((file.size ?? 0) > max) {
    message("文件大小不能超过 50MB", { type: "warning" });
    return false;
  }
  return true;
}

// ========== 详情 ==========
const detailVisible = ref(false);
const detailInfo = ref<RagFileDetail | null>(null);
const textSlice = ref<RagTextSlice | null>(null);
const textLoading = ref(false);
const textOffset = ref(0);
const TEXT_PAGE_SIZE = 2000;

async function openDetail(row: RagFileItem) {
  detailInfo.value = null;
  textSlice.value = null;
  textOffset.value = 0;
  detailVisible.value = true;
  try {
    const res = await getRagFileDetail(row.id);
    if (res?.code === 200) {
      detailInfo.value = res.data;
    } else {
      message(res?.message ?? "获取详情失败", { type: "error" });
    }
  } catch (e: any) {
    message(e?.message ?? "获取详情失败", { type: "error" });
  }
  await loadNextTextSlice(row.id, true);
}

async function loadNextTextSlice(id: number, reset = false) {
  if (reset) {
    textOffset.value = 0;
    textSlice.value = null;
  }
  if (textSlice.value && !textSlice.value.truncated && !reset) return;
  textLoading.value = true;
  try {
    const res = await getRagFileText(id, {
      offset: textOffset.value,
      limit: TEXT_PAGE_SIZE
    });
    if (res?.code === 200) {
      const slice = res.data;
      textSlice.value = {
        ...slice,
        content: (textSlice.value?.content ?? "") + (slice.content ?? "")
      };
      textOffset.value += slice.returnedLength;
    } else {
      message(res?.message ?? "获取文本失败", { type: "error" });
    }
  } catch (e: any) {
    message(e?.message ?? "获取文本失败", { type: "error" });
  } finally {
    textLoading.value = false;
  }
}

function closeDetail() {
  detailVisible.value = false;
  detailInfo.value = null;
  textSlice.value = null;
}

// ========== 删除 ==========
async function handleDelete(row: RagFileItem) {
  try {
    await ElMessageBox.confirm(
      `确定删除文件 “${row.fileName}” 吗？将级联清理 Milvus、七牛云和数据库记录。`,
      "警告",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await deleteRagFile(row.id);
    if (res?.code === 200) {
      message("删除成功", { type: "success" });
      onSearch();
    } else {
      message(res?.message ?? "删除失败", { type: "error" });
    }
  } catch {
    // cancelled
  }
}

function onDownload(row: RagFileItem) {
  // 后端 /file 端点会 302 跳转到七牛云公网 URL
  window.open(`/api/rag/files/${row.id}/file`, "_blank");
}

// ========== 生命周期 ==========
onMounted(() => {
  onSearch();
});

onBeforeUnmount(() => {
  stopPolling();
});

// 响应式：根据列表中是否有处理中的文档，控制轮询
watch(hasProcessing, v => {
  if (v) startPolling();
  else stopPolling();
});
</script>

<template>
  <div class="p-4">
    <el-form
      :inline="true"
      :model="searchForm"
      class="search-form bg-bg_color w-full pl-8 pt-3 overflow-auto"
    >
      <el-form-item label="文件名：">
        <el-input
          v-model="searchForm.fileName"
          placeholder="请输入文件名"
          clearable
          class="w-50!"
          @keyup.enter="onSearch"
        />
      </el-form-item>
      <el-form-item label="状态：">
        <el-select
          v-model="searchForm.status"
          placeholder="全部"
          clearable
          class="w-32!"
          @change="onSearch"
        >
          <el-option
            v-for="opt in statusOptions"
            :key="String(opt.value ?? 'all')"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/search-line')"
          :loading="loading"
          @click="onSearch"
        >
          搜索
        </el-button>
        <el-button
          :icon="useRenderIcon('ri/refresh-line')"
          @click="resetSearch"
        >
          重置
        </el-button>
      </el-form-item>
    </el-form>

    <PureTableBar title="知识文件" :columns="columns" @refresh="onSearch">
      <template #buttons>
        <el-upload
          ref="uploadRef"
          :show-file-list="false"
          :http-request="customUpload"
          :before-upload="onBeforeUpload"
          accept=".pdf,.doc,.docx,.md,.txt,.markdown"
        >
          <el-button type="primary" :icon="useRenderIcon('ri/upload-2-line')">
            上传文档
          </el-button>
        </el-upload>
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          row-key="id"
          adaptive
          :adaptiveConfig="{ offsetBottom: 108 }"
          align-whole="center"
          table-layout="auto"
          :loading="loading"
          :size="size"
          :data="dataList"
          :columns="dynamicColumns"
          :pagination="{ ...pagination, size }"
          :header-cell-style="{
            background: 'var(--el-fill-color-light)',
            color: 'var(--el-text-color-primary)'
          }"
          @page-size-change="handleSizeChange"
          @page-current-change="handleCurrentChange"
        >
          <template #status="{ row }">
            <el-tag
              :type="statusTagType(row.status) as any"
              :effect="
                row.status === RAG_DOC_STATUS.PROCESSING ? 'dark' : 'light'
              "
            >
              {{ row.statusName }}
            </el-tag>
          </template>
          <template #operation="{ row, size }">
            <el-button
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon('ri/search-line')"
              @click="openDetail(row)"
            >
              详情
            </el-button>
            <el-button
              v-if="row.status === RAG_DOC_STATUS.SUCCESS"
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon('ri/download-line')"
              @click="onDownload(row)"
            >
              下载
            </el-button>
            <el-popconfirm
              :title="`确定删除 “${row.fileName}” 吗？`"
              @confirm="handleDelete(row)"
            >
              <template #reference>
                <el-button
                  link
                  type="danger"
                  :size="size"
                  :icon="useRenderIcon('ri/delete-bin-line')"
                >
                  删除
                </el-button>
              </template>
            </el-popconfirm>
          </template>
        </pure-table>
      </template>
    </PureTableBar>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      :title="detailInfo?.fileName ?? '文档详情'"
      width="820px"
      destroy-on-close
      @close="closeDetail"
    >
      <div v-loading="!detailInfo">
        <el-descriptions
          v-if="detailInfo"
          :column="2"
          border
          size="small"
          class="mb-4"
        >
          <el-descriptions-item label="ID">
            {{ detailInfo.id }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(detailInfo.status) as any">
              {{ detailInfo.statusName }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="文件名">
            {{ detailInfo.fileName }}
          </el-descriptions-item>
          <el-descriptions-item label="类型">
            {{ detailInfo.fileType || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="大小">
            {{ fmtSize(detailInfo.fileSize) }}
          </el-descriptions-item>
          <el-descriptions-item label="切片数">
            {{ detailInfo.chunkCount ?? 0 }}
          </el-descriptions-item>
          <el-descriptions-item label="文本长度">
            {{ detailInfo.extractedTextLength ?? 0 }} 字符
          </el-descriptions-item>
          <el-descriptions-item label="上传人">
            {{ detailInfo.uploaderName || "-" }}
          </el-descriptions-item>
          <el-descriptions-item label="上传时间">
            {{ fmtTime(detailInfo.createTime) }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ fmtTime(detailInfo.updateTime) }}
          </el-descriptions-item>
          <el-descriptions-item
            v-if="detailInfo.errorMessage"
            label="错误信息"
            :span="2"
          >
            <span class="text-red-500">{{ detailInfo.errorMessage }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="text-sm font-semibold mb-2">解析后的纯文本</div>
        <div
          v-loading="textLoading"
          class="whitespace-pre-wrap break-all border border-gray-200 rounded p-3 max-h-96 overflow-auto bg-gray-50 text-sm"
        >
          {{
            textSlice?.content ||
            (detailInfo?.statusName === "PROCESSING" ? "解析中…" : "暂无内容")
          }}
        </div>
        <div v-if="textSlice?.truncated" class="text-right mt-2">
          <el-button
            link
            type="primary"
            :loading="textLoading"
            @click="detailInfo && loadNextTextSlice(detailInfo.id)"
          >
            加载更多
          </el-button>
        </div>
      </div>
      <template #footer>
        <el-button @click="closeDetail">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.search-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }
}
</style>
