<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { http } from "@/utils/http";
import type { FormInstance, FormRules } from "element-plus";

defineOptions({ name: "ManagementConfig" });

type SysConfig = {
  id: string;
  configName: string;
  configKey: string;
  configValue: string;
  configType: string;
  remark: string;
};

const loading = ref(false);
const dataList = ref<SysConfig[]>([]);
const pagination = reactive({ total: 0, pageSize: 20, currentPage: 1 });
const filterName = ref("");

const columns: TableColumnList = [
  { label: "配置名称", prop: "configName", minWidth: 150 },
  { label: "配置键", prop: "configKey", minWidth: 200 },
  { label: "配置值", prop: "configValue", minWidth: 150 },
  { label: "类型", prop: "configType", width: 80 },
  { label: "备注", prop: "remark", minWidth: 200, showOverflowTooltip: true },
  { label: "操作", fixed: "right", width: 150, slot: "operation" }
];

async function onSearch() {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      page: pagination.currentPage,
      size: pagination.pageSize
    };
    if (filterName.value) params.configName = filterName.value;
    const res = await http.request<any>("get", "/api/management/configs", {
      params
    });
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

const dialogVisible = ref(false);
const dialogTitle = ref("");
const dialogLoading = ref(false);
const formRef = ref<FormInstance>();
const editId = ref<string | null>(null);
const form = reactive({
  configName: "",
  configKey: "",
  configValue: "",
  configType: "text",
  remark: ""
});
const rules: FormRules = {
  configName: [{ required: true, message: "请输入配置名称", trigger: "blur" }],
  configKey: [{ required: true, message: "请输入配置键", trigger: "blur" }],
  configValue: [{ required: true, message: "请输入配置值", trigger: "blur" }]
};

function openAdd() {
  editId.value = null;
  dialogTitle.value = "新增配置";
  Object.assign(form, {
    configName: "",
    configKey: "",
    configValue: "",
    configType: "text",
    remark: ""
  });
  dialogVisible.value = true;
}

function openEdit(row: SysConfig) {
  editId.value = row.id;
  dialogTitle.value = "编辑配置";
  Object.assign(form, {
    configName: row.configName,
    configKey: row.configKey,
    configValue: row.configValue,
    configType: row.configType ?? "text",
    remark: row.remark ?? ""
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
          `/api/management/configs/${editId.value}`,
          { data: form }
        )
      : await http.request<any>("post", "/api/management/configs", {
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

async function handleDelete(row: SysConfig) {
  try {
    await ElMessageBox.confirm(`确定删除配置「${row.configName}」？`, "警告", {
      type: "warning"
    });
    const res = await http.request<any>(
      "delete",
      `/api/management/configs/${row.id}`
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
    <el-form :inline="true" class="search-form bg-bg_color w-full pl-8 pt-3">
      <el-form-item label="配置名称：">
        <el-input
          v-model="filterName"
          placeholder="模糊搜索"
          clearable
          class="w-40!"
          @change="onSearch"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/search-line')"
          @click="onSearch"
          >搜索</el-button
        >
      </el-form-item>
    </el-form>
    <PureTableBar title="系统配置" :columns="columns" @refresh="onSearch">
      <template #buttons>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/add-circle-line')"
          @click="openAdd"
          >新增配置</el-button
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
          <template #operation="{ row, size }">
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
      width="500px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="配置名称" prop="configName"
          ><el-input v-model="form.configName"
        /></el-form-item>
        <el-form-item label="配置键" prop="configKey"
          ><el-input v-model="form.configKey" :disabled="!!editId"
        /></el-form-item>
        <el-form-item label="配置值" prop="configValue"
          ><el-input v-model="form.configValue"
        /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="form.configType">
            <el-option label="文本" value="text" /><el-option
              label="数字"
              value="number"
            /><el-option label="开关" value="bool" />
          </el-select>
        </el-form-item>
        <el-form-item label="备注"
          ><el-input v-model="form.remark" type="textarea" :rows="2"
        /></el-form-item>
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
