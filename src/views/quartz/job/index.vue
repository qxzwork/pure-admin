<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import {
  getJobList,
  createJob,
  updateJob,
  deleteJob,
  pauseJob,
  resumeJob,
  triggerJob,
  getExecutors
} from "@/api/quartz";
import type { QuartzJob } from "@/api/quartz";
import type { FormInstance, FormRules } from "element-plus";

defineOptions({ name: "QuartzJob" });

const loading = ref(false);
const dataList = ref<QuartzJob[]>([]);
const executorList = ref<Array<{ name: string; description: string }>>([]);

const columns: TableColumnList = [
  { label: "任务名称", prop: "jobName", minWidth: 150 },
  { label: "Cron 表达式", prop: "cronExpression", width: 150 },
  { label: "执行器", prop: "executorBean", width: 150 },
  {
    label: "描述",
    prop: "description",
    minWidth: 200,
    showOverflowTooltip: true
  },
  { label: "状态", prop: "status", width: 80, slot: "status" },
  { label: "操作", fixed: "right", width: 300, slot: "operation" }
];

async function onSearch() {
  loading.value = true;
  try {
    const res = await getJobList();
    dataList.value = res?.data ?? [];
  } catch {
    dataList.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadExecutors() {
  try {
    const res = await getExecutors();
    executorList.value = res?.data ?? [];
  } catch {
    executorList.value = [];
  }
}

// 弹窗
const dialogVisible = ref(false);
const dialogTitle = ref("");
const dialogLoading = ref(false);
const formRef = ref<FormInstance>();
const editId = ref<string | null>(null);
const form = reactive({
  jobName: "",
  cronExpression: "",
  executorBean: "",
  jobParams: "",
  description: "",
  status: 1
});
const rules: FormRules = {
  jobName: [{ required: true, message: "请输入任务名称", trigger: "blur" }],
  cronExpression: [
    { required: true, message: "请输入 Cron 表达式", trigger: "blur" }
  ],
  executorBean: [{ required: true, message: "请选择执行器", trigger: "change" }]
};

function openAdd() {
  editId.value = null;
  dialogTitle.value = "创建任务";
  Object.assign(form, {
    jobName: "",
    cronExpression: "",
    executorBean: "",
    jobParams: "",
    description: "",
    status: 1
  });
  dialogVisible.value = true;
}

function openEdit(row: QuartzJob) {
  editId.value = row.id;
  dialogTitle.value = "编辑任务";
  Object.assign(form, {
    jobName: row.jobName,
    cronExpression: row.cronExpression,
    executorBean: row.executorBean,
    jobParams: row.jobParams ?? "",
    description: row.description ?? "",
    status: row.status
  });
  dialogVisible.value = true;
}

async function handleSubmit() {
  await formRef.value.validate();
  dialogLoading.value = true;
  try {
    const data = { ...form };
    const res = editId.value
      ? await updateJob(editId.value, data)
      : await createJob(data);
    if (res?.code === 200) {
      message(editId.value ? "编辑成功" : "创建成功", { type: "success" });
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

async function handleDelete(row: QuartzJob) {
  try {
    await ElMessageBox.confirm(`确定删除任务「${row.jobName}」？`, "警告", {
      type: "warning"
    });
    const res = await deleteJob(row.id);
    if (res?.code === 200) {
      message("删除成功", { type: "success" });
      onSearch();
    }
  } catch {}
}

async function handlePause(row: QuartzJob) {
  const res = await pauseJob(row.id);
  if (res?.code === 200) {
    message("已暂停", { type: "success" });
    onSearch();
  }
}

async function handleResume(row: QuartzJob) {
  const res = await resumeJob(row.id);
  if (res?.code === 200) {
    message("已恢复", { type: "success" });
    onSearch();
  }
}

async function handleTrigger(row: QuartzJob) {
  try {
    await ElMessageBox.confirm(`确定立即执行任务「${row.jobName}」？`, "提示", {
      type: "info"
    });
    const res = await triggerJob(row.id);
    if (res?.code === 200) {
      message("已触发", { type: "success" });
    }
  } catch {}
}

onMounted(() => {
  onSearch();
  loadExecutors();
});
</script>

<template>
  <div class="p-4">
    <PureTableBar title="定时任务" :columns="columns" @refresh="onSearch">
      <template #buttons>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/add-circle-line')"
          @click="openAdd"
          >创建任务</el-button
        >
      </template>
      <template v-slot="{ size, dynamicColumns }">
        <pure-table
          row-key="id"
          align-whole="center"
          table-layout="auto"
          :loading="loading"
          :size="size"
          :data="dataList"
          :columns="dynamicColumns"
          :header-cell-style="{
            background: 'var(--el-fill-color-light)',
            color: 'var(--el-text-color-primary)'
          }"
        >
          <template #status="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? "运行中" : "已暂停" }}
            </el-tag>
          </template>
          <template #operation="{ row, size }">
            <el-button
              v-if="row.status === 1"
              link
              type="warning"
              :size="size"
              :icon="useRenderIcon('ri/pause-circle-line')"
              @click="handlePause(row)"
              >暂停</el-button
            >
            <el-button
              v-else
              link
              type="success"
              :size="size"
              :icon="useRenderIcon('ri/play-circle-line')"
              @click="handleResume(row)"
              >恢复</el-button
            >
            <el-button
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon('ri/flashlight-line')"
              @click="handleTrigger(row)"
              >执行</el-button
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
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="任务名称" prop="jobName">
          <el-input
            v-model="form.jobName"
            :disabled="!!editId"
            placeholder="唯一标识"
          />
        </el-form-item>
        <el-form-item label="Cron 表达式" prop="cronExpression">
          <el-input
            v-model="form.cronExpression"
            placeholder="如: 0 0 8 * * ?"
          />
        </el-form-item>
        <el-form-item label="执行器" prop="executorBean">
          <el-select v-model="form.executorBean" placeholder="选择执行器">
            <el-option
              v-for="e in executorList"
              :key="e.name"
              :label="`${e.name} - ${e.description}`"
              :value="e.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="任务参数">
          <el-input
            v-model="form.jobParams"
            type="textarea"
            :rows="3"
            placeholder="JSON 格式参数（可选）"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="form.description" placeholder="任务描述" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">暂停</el-radio>
          </el-radio-group>
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
