<script setup lang="ts">
import { ref, onMounted, reactive } from "vue";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { http } from "@/utils/http";
import dayjs from "dayjs";

defineOptions({ name: "RagDocument" });

type KnowledgeChunk = {
  id: string;
  content: string;
  source: string;
};

const loading = ref(false);
const dataList = ref<KnowledgeChunk[]>([]);
const pagination = reactive({ total: 0, pageSize: 20, currentPage: 1 });
const sourceFilter = ref("");

const columns: TableColumnList = [
  { label: "ID", prop: "id", width: 100, showOverflowTooltip: true },
  {
    label: "内容",
    prop: "content",
    minWidth: 300,
    showOverflowTooltip: true
  },
  { label: "来源", prop: "source", width: 150, showOverflowTooltip: true },
  { label: "操作", fixed: "right", width: 160, slot: "operation" }
];

async function onSearch() {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      page: pagination.currentPage,
      size: pagination.pageSize
    };
    if (sourceFilter.value) params.source = sourceFilter.value;
    const res = await http.request<any>("get", "/api/rag/documents", {
      params
    });
    const d = res?.data;
    dataList.value = d?.content ?? [];
    pagination.total = Number(d?.total ?? 0);
    pagination.pageSize = Number(d?.size ?? 20);
    pagination.currentPage = Number(d?.current ?? 1);
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

function fmtTime(val: string) {
  return val ? dayjs(val).format("YYYY-MM-DD HH:mm:ss") : "-";
}

function fmtContent(text: string) {
  if (!text) return "-";
  return text.length > 200 ? text.slice(0, 200) + "..." : text;
}

async function handleDelete(row: KnowledgeChunk) {
  try {
    await ElMessageBox.confirm(
      `确定删除 ID 为 ${row.id} 的文档片段？`,
      "警告",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await http.request<any>(
      "delete",
      `/api/rag/documents/${row.id}`
    );
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

const detailVisible = ref(false);
const detailContent = ref("");

function handleView(row: KnowledgeChunk) {
  detailContent.value = row.content || "-";
  detailVisible.value = true;
}

// --- Ingest dialog ---
const ingestVisible = ref(false);
const ingestForm = reactive({ content: "", source: "" });
const ingestLoading = ref(false);

function openIngest() {
  ingestForm.content = "";
  ingestForm.source = "";
  ingestVisible.value = true;
}

async function handleIngest() {
  if (!ingestForm.content.trim()) {
    message("请输入文档内容", { type: "warning" });
    return;
  }
  ingestLoading.value = true;
  try {
    const res = await http.request<any>("post", "/api/rag/ingest", {
      data: {
        content: ingestForm.content,
        source: ingestForm.source || undefined
      }
    });
    if (res?.code === 200) {
      message("入库成功", { type: "success" });
      ingestVisible.value = false;
      onSearch();
    } else {
      message(res?.message ?? "入库失败", { type: "error" });
    }
  } catch {
    message("入库失败", { type: "error" });
  } finally {
    ingestLoading.value = false;
  }
}

onMounted(() => {
  onSearch();
});
</script>

<template>
  <div class="p-4">
    <PureTableBar title="文档列表" :columns="columns" @refresh="onSearch">
      <template #buttons>
        <el-input
          v-model="sourceFilter"
          placeholder="按来源筛选"
          clearable
          class="w-45! mr-2"
          @change="onSearch"
        />
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/add-circle-line')"
          @click="openIngest"
        >
          新增文档
        </el-button>
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
          <template #content="{ row }">
            <span class="text-left inline-block max-w-150 truncate">{{
              fmtContent(row.content)
            }}</span>
          </template>
          <template #operation="{ row, size }">
            <el-button
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon('ri/search-line')"
              @click="handleView(row)"
            >
              查看
            </el-button>
            <el-button
              link
              type="danger"
              :size="size"
              :icon="useRenderIcon('ri/delete-bin-line')"
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </pure-table>
      </template>
    </PureTableBar>

    <!-- 内容查看弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="文档内容"
      width="700px"
      destroy-on-close
    >
      <div class="whitespace-pre-wrap break-all max-h-96 overflow-auto">
        {{ detailContent }}
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 新增文档弹窗 -->
    <el-dialog
      v-model="ingestVisible"
      title="新增文档"
      width="600px"
      destroy-on-close
    >
      <el-form label-width="80px">
        <el-form-item label="来源">
          <el-input
            v-model="ingestForm.source"
            placeholder="可选，文档来源名称"
          />
        </el-form-item>
        <el-form-item label="内容" required>
          <el-input
            v-model="ingestForm.content"
            type="textarea"
            :rows="10"
            placeholder="请输入文档内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="ingestVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="ingestLoading"
          @click="handleIngest"
        >
          提交
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
