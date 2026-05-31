<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import {
  getDictDataList,
  addDictData,
  updateDictData,
  deleteDictData
} from "@/api/dict";
import type { DictData } from "@/api/dict";
import type { FormInstance, FormRules } from "element-plus";

defineOptions({ name: "ManagementDictData" });

const route = useRoute();
const router = useRouter();
const dictCode = route.params.dictCode as string;
const loading = ref(false);
const dataList = ref<DictData[]>([]);

const columns: TableColumnList = [
  { label: "标签", prop: "dictLabel", minWidth: 150 },
  { label: "值", prop: "dictValue", minWidth: 120 },
  { label: "排序", prop: "sortOrder", width: 80 },
  {
    label: "状态",
    prop: "status",
    width: 80,
    slot: "status"
  },
  { label: "备注", prop: "remark", minWidth: 200, showOverflowTooltip: true },
  { label: "操作", fixed: "right", width: 160, slot: "operation" }
];

async function onSearch() {
  loading.value = true;
  try {
    const res = await getDictDataList(dictCode);
    dataList.value = res?.data ?? [];
  } catch {
    dataList.value = [];
  } finally {
    loading.value = false;
  }
}

// 弹窗
const dialogVisible = ref(false);
const dialogTitle = ref("");
const dialogLoading = ref(false);
const formRef = ref<FormInstance>();
const editId = ref<string | null>(null);
const form = reactive({
  dictLabel: "",
  dictValue: "",
  sortOrder: 0,
  status: 1,
  remark: "",
  cssClass: ""
});
const rules: FormRules = {
  dictLabel: [{ required: true, message: "请输入标签", trigger: "blur" }],
  dictValue: [{ required: true, message: "请输入值", trigger: "blur" }]
};

function openAdd() {
  editId.value = null;
  dialogTitle.value = "新增字典数据";
  form.dictLabel = "";
  form.dictValue = "";
  form.sortOrder = 0;
  form.status = 1;
  form.remark = "";
  form.cssClass = "";
  dialogVisible.value = true;
}

function openEdit(row: DictData) {
  editId.value = row.id;
  dialogTitle.value = "编辑字典数据";
  form.dictLabel = row.dictLabel;
  form.dictValue = row.dictValue;
  form.sortOrder = row.sortOrder ?? 0;
  form.status = row.status;
  form.remark = row.remark ?? "";
  form.cssClass = row.cssClass ?? "";
  dialogVisible.value = true;
}

async function handleSubmit() {
  await formRef.value.validate();
  dialogLoading.value = true;
  try {
    const data = { ...form, dictCode };
    const res = editId.value
      ? await updateDictData(editId.value, data)
      : await addDictData(data);
    if (res?.code === 200) {
      message(editId.value ? "编辑成功" : "新增成功", { type: "success" });
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

async function handleDelete(row: DictData) {
  try {
    await ElMessageBox.confirm(`确定删除「${row.dictLabel}」？`, "警告", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    const res = await deleteDictData(row.id);
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

function goBack() {
  router.push("/management/dict");
}

onMounted(() => {
  onSearch();
});
</script>

<template>
  <div class="p-4">
    <div class="flex items-center mb-4">
      <el-button :icon="useRenderIcon('ri/arrow-go-back-line')" @click="goBack">
        返回
      </el-button>
      <span class="ml-2 text-lg font-semibold">字典数据 - {{ dictCode }}</span>
      <el-button
        type="primary"
        class="ml-auto!"
        :icon="useRenderIcon('ri/add-circle-line')"
        @click="openAdd"
      >
        新增数据
      </el-button>
      <el-button :icon="useRenderIcon('ri/refresh-line')" @click="onSearch">
        刷新
      </el-button>
    </div>

    <pure-table
      row-key="id"
      align-whole="center"
      table-layout="auto"
      :loading="loading"
      :data="dataList"
      :columns="columns"
      :header-cell-style="{
        background: 'var(--el-fill-color-light)',
        color: 'var(--el-text-color-primary)'
      }"
    >
      <template #status="{ row }">
        <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
          {{ row.status === 1 ? "启用" : "禁用" }}
        </el-tag>
      </template>
      <template #operation="{ row, size }">
        <el-button
          link
          type="primary"
          :size="size"
          :icon="useRenderIcon('ri/edit-line')"
          @click="openEdit(row)"
        >
          编辑
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

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="标签" prop="dictLabel">
          <el-input v-model="form.dictLabel" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="值" prop="dictValue">
          <el-input v-model="form.dictValue" placeholder="字典值" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sortOrder" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" placeholder="备注信息" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="dialogLoading"
          @click="handleSubmit"
        >
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
