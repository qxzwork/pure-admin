<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { http } from "@/utils/http";
import dayjs from "dayjs";
import type { FormInstance, FormRules } from "element-plus";

defineOptions({ name: "ManagementNotification" });

type Notification = {
  id: string;
  title: string;
  content: string;
  type: number;
  status: number;
  publisherId: string;
  createTime: string;
};

const loading = ref(false);
const dataList = ref<Notification[]>([]);
const pagination = reactive({ total: 0, pageSize: 20, currentPage: 1 });

const columns: TableColumnList = [
  { label: "标题", prop: "title", minWidth: 200, showOverflowTooltip: true },
  { label: "类型", prop: "type", width: 80, slot: "type" },
  { label: "状态", prop: "status", width: 80, slot: "status" },
  { label: "创建时间", prop: "createTime", width: 170 },
  { label: "操作", fixed: "right", width: 250, slot: "operation" }
];

const typeMap: Record<number, string> = { 1: "通知", 2: "公告", 3: "消息" };
const statusMap: Record<number, { label: string; type: string }> = {
  0: { label: "草稿", type: "info" },
  1: { label: "已发布", type: "success" },
  2: { label: "已撤回", type: "warning" }
};

async function onSearch() {
  loading.value = true;
  try {
    const res = await http.request<any>(
      "get",
      "/api/management/notifications",
      {
        params: { page: pagination.currentPage, size: pagination.pageSize }
      }
    );
    const d = res?.data;
    dataList.value = d?.records ?? [];
    pagination.total = Number(d?.total ?? 0);
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

const dialogVisible = ref(false);
const dialogTitle = ref("");
const dialogLoading = ref(false);
const formRef = ref<FormInstance>();
const editId = ref<string | null>(null);
const form = reactive({ title: "", content: "", type: 1 });
const rules: FormRules = {
  title: [{ required: true, message: "请输入标题", trigger: "blur" }],
  content: [{ required: true, message: "请输入内容", trigger: "blur" }]
};

function openAdd() {
  editId.value = null;
  dialogTitle.value = "创建通知";
  Object.assign(form, { title: "", content: "", type: 1 });
  dialogVisible.value = true;
}

function openEdit(row: Notification) {
  editId.value = row.id;
  dialogTitle.value = "编辑通知";
  Object.assign(form, {
    title: row.title,
    content: row.content,
    type: row.type
  });
  dialogVisible.value = true;
}

async function handleSubmit() {
  await formRef.value.validate();
  dialogLoading.value = true;
  try {
    const res = editId.value
      ? await http.request<any>(
          "put",
          `/api/management/notifications/${editId.value}`,
          { data: form }
        )
      : await http.request<any>("post", "/api/management/notifications", {
          data: form
        });
    if (res?.code === 200) {
      message("操作成功", { type: "success" });
      dialogVisible.value = false;
      onSearch();
    } else {
      message(res?.message ?? "操作失败", { type: "error" });
    }
  } catch {
    message("操作失败", { type: "error" });
  } finally {
    dialogLoading.value = false;
  }
}

async function handlePublish(row: Notification) {
  const res = await http.request<any>(
    "put",
    `/api/management/notifications/${row.id}/publish`
  );
  if (res?.code === 200) {
    message("发布成功", { type: "success" });
    onSearch();
  }
}

async function handleRevoke(row: Notification) {
  const res = await http.request<any>(
    "put",
    `/api/management/notifications/${row.id}/revoke`
  );
  if (res?.code === 200) {
    message("撤回成功", { type: "success" });
    onSearch();
  }
}

async function handleDelete(row: Notification) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.title}」？`, "警告", {
      type: "warning"
    });
    const res = await http.request<any>(
      "delete",
      `/api/management/notifications/${row.id}`
    );
    if (res?.code === 200) {
      message("删除成功", { type: "success" });
      onSearch();
    }
  } catch {}
}

onMounted(() => {
  onSearch();
});
</script>

<template>
  <div class="p-4">
    <PureTableBar title="通知管理" :columns="columns" @refresh="onSearch">
      <template #buttons>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/add-circle-line')"
          @click="openAdd"
          >创建通知</el-button
        >
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
          <template #type="{ row }">
            <el-tag size="small">{{ typeMap[row.type] ?? "未知" }}</el-tag>
          </template>
          <template #status="{ row }">
            <el-tag
              :type="(statusMap[row.status]?.type as any) ?? 'info'"
              size="small"
            >
              {{ statusMap[row.status]?.label ?? "未知" }}
            </el-tag>
          </template>
          <template #operation="{ row, size }">
            <el-button
              v-if="row.status === 0"
              link
              type="success"
              :size="size"
              :icon="useRenderIcon('ri/send-plane-fill')"
              @click="handlePublish(row)"
              >发布</el-button
            >
            <el-button
              v-if="row.status === 1"
              link
              type="warning"
              :size="size"
              :icon="useRenderIcon('ri-arrow-go-back-line')"
              @click="handleRevoke(row)"
              >撤回</el-button
            >
            <el-button
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon('ri/edit-line')"
              @click="openEdit(row)"
              >编辑</el-button
            >
            <el-button
              link
              type="danger"
              :size="size"
              :icon="useRenderIcon('ri/delete-bin-line')"
              @click="handleDelete(row)"
              >删除</el-button
            >
          </template>
        </pure-table>
      </template>
    </PureTableBar>
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="600px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="60px">
        <el-form-item label="标题" prop="title"
          ><el-input v-model="form.title" placeholder="通知标题"
        /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.type">
            <el-option label="通知" :value="1" /><el-option
              label="公告"
              :value="2"
            /><el-option label="消息" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容" prop="content">
          <el-input
            v-model="form.content"
            type="textarea"
            :rows="6"
            placeholder="通知内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="dialogLoading" @click="handleSubmit"
          >确定</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>
