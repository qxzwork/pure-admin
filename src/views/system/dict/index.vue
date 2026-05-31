<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import {
  getDictTypeList,
  addDictType,
  updateDictType,
  deleteDictType
} from "@/api/dict";
import type { DictType } from "@/api/dict";
import { useRouter } from "vue-router";
import dayjs from "dayjs";
import type { FormInstance, FormRules } from "element-plus";

defineOptions({ name: "ManagementDict" });

const router = useRouter();
const loading = ref(false);
const dataList = ref<DictType[]>([]);
const pagination = reactive({ total: 0, pageSize: 20, currentPage: 1 });

const filterForm = reactive({ dictName: "", dictCode: "" });

const columns: TableColumnList = [
  { label: "字典名称", prop: "dictName", minWidth: 150 },
  { label: "字典编码", prop: "dictCode", minWidth: 150 },
  {
    label: "描述",
    prop: "description",
    minWidth: 200,
    showOverflowTooltip: true
  },
  {
    label: "状态",
    prop: "status",
    width: 80,
    slot: "status"
  },
  { label: "创建时间", prop: "createTime", width: 170 },
  { label: "操作", fixed: "right", width: 200, slot: "operation" }
];

async function onSearch() {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      page: pagination.currentPage,
      size: pagination.pageSize
    };
    if (filterForm.dictName) params.dictName = filterForm.dictName;
    if (filterForm.dictCode) params.dictCode = filterForm.dictCode;
    const res = await getDictTypeList(params);
    const d = res?.data;
    dataList.value = d?.records ?? [];
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

function resetSearch() {
  filterForm.dictName = "";
  filterForm.dictCode = "";
  pagination.currentPage = 1;
  onSearch();
}

function fmtTime(val: string) {
  return val ? dayjs(val).format("YYYY-MM-DD HH:mm:ss") : "-";
}

// 弹窗
const dialogVisible = ref(false);
const dialogTitle = ref("");
const dialogLoading = ref(false);
const formRef = ref<FormInstance>();
const editId = ref<string | null>(null);
const form = reactive({
  dictName: "",
  dictCode: "",
  description: "",
  status: 1
});
const rules: FormRules = {
  dictName: [{ required: true, message: "请输入字典名称", trigger: "blur" }],
  dictCode: [{ required: true, message: "请输入字典编码", trigger: "blur" }]
};

function openAdd() {
  editId.value = null;
  dialogTitle.value = "新增字典";
  form.dictName = "";
  form.dictCode = "";
  form.description = "";
  form.status = 1;
  dialogVisible.value = true;
}

function openEdit(row: DictType) {
  editId.value = row.id;
  dialogTitle.value = "编辑字典";
  form.dictName = row.dictName;
  form.dictCode = row.dictCode;
  form.description = row.description ?? "";
  form.status = row.status;
  dialogVisible.value = true;
}

async function handleSubmit() {
  await formRef.value.validate();
  dialogLoading.value = true;
  try {
    const data = { ...form };
    const res = editId.value
      ? await updateDictType(editId.value, data)
      : await addDictType(data);
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

async function handleDelete(row: DictType) {
  try {
    await ElMessageBox.confirm(
      `确定删除字典「${row.dictName}」？删除后关联的字典数据也会一并删除。`,
      "警告",
      {
        confirmButtonText: "确定",
        cancelButtonText: "取消",
        type: "warning"
      }
    );
    const res = await deleteDictType(row.id);
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

function goDictData(row: DictType) {
  router.push(`/management/dict/data/${row.dictCode}`);
}

onMounted(() => {
  onSearch();
});
</script>

<template>
  <div class="p-4">
    <el-form
      :inline="true"
      :model="filterForm"
      class="search-form bg-bg_color w-full pl-8 pt-3 overflow-auto"
    >
      <el-form-item label="字典名称：" prop="dictName">
        <el-input
          v-model="filterForm.dictName"
          placeholder="模糊搜索"
          clearable
          class="w-35!"
        />
      </el-form-item>
      <el-form-item label="字典编码：" prop="dictCode">
        <el-input
          v-model="filterForm.dictCode"
          placeholder="模糊搜索"
          clearable
          class="w-35!"
        />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/search-line')"
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

    <PureTableBar title="字典管理" :columns="columns" @refresh="onSearch">
      <template #buttons>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/add-circle-line')"
          @click="openAdd"
        >
          新增字典
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
              :icon="useRenderIcon('ri:list-check')"
              @click="goDictData(row)"
            >
              数据
            </el-button>
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
      </template>
    </PureTableBar>

    <!-- 新增/编辑弹窗 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="字典名称" prop="dictName">
          <el-input v-model="form.dictName" placeholder="请输入字典名称" />
        </el-form-item>
        <el-form-item label="字典编码" prop="dictCode">
          <el-input
            v-model="form.dictCode"
            placeholder="请输入字典编码"
            :disabled="!!editId"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
            placeholder="请输入描述"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio :value="1">启用</el-radio>
            <el-radio :value="0">禁用</el-radio>
          </el-radio-group>
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
