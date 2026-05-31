<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { http } from "@/utils/http";
import dayjs from "dayjs";

defineOptions({ name: "ManagementLoginLog" });

type LoginLog = {
  id: string;
  username: string;
  ip: string;
  address: string;
  browser: string;
  os: string;
  status: number;
  message: string;
  loginTime: string;
};

const loading = ref(false);
const dataList = ref<LoginLog[]>([]);
const pagination = reactive({ total: 0, pageSize: 20, currentPage: 1 });

const filterForm = reactive({
  username: "",
  status: undefined as number | undefined
});

const columns: TableColumnList = [
  { label: "用户名", prop: "username", width: 120 },
  { label: "IP", prop: "ip", width: 130 },
  { label: "浏览器", prop: "browser", width: 100 },
  { label: "操作系统", prop: "os", width: 120 },
  {
    label: "状态",
    prop: "status",
    width: 80,
    slot: "status"
  },
  {
    label: "失败原因",
    prop: "message",
    minWidth: 150,
    showOverflowTooltip: true
  },
  {
    label: "登录时间",
    prop: "loginTime",
    width: 170,
    sortable: true
  }
];

async function onSearch() {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      page: pagination.currentPage,
      size: pagination.pageSize
    };
    if (filterForm.username) params.username = filterForm.username;
    if (filterForm.status !== undefined) params.status = filterForm.status;
    const res = await http.request<any>("get", "/api/management/login-logs", {
      params
    });
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
  filterForm.username = "";
  filterForm.status = undefined;
  pagination.currentPage = 1;
  onSearch();
}

function fmtTime(val: string) {
  return val ? dayjs(val).format("YYYY-MM-DD HH:mm:ss") : "-";
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
      <el-form-item label="用户名：" prop="username">
        <el-input
          v-model="filterForm.username"
          placeholder="模糊搜索"
          clearable
          class="w-35!"
        />
      </el-form-item>
      <el-form-item label="状态：" prop="status">
        <el-select
          v-model="filterForm.status"
          placeholder="全部"
          clearable
          class="w-25!"
        >
          <el-option label="成功" :value="1" />
          <el-option label="失败" :value="0" />
        </el-select>
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

    <PureTableBar title="登录日志" :columns="columns" @refresh="onSearch">
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
              :type="row.status === 1 ? 'success' : 'danger'"
              size="small"
            >
              {{ row.status === 1 ? "成功" : "失败" }}
            </el-tag>
          </template>
        </pure-table>
      </template>
    </PureTableBar>
  </div>
</template>
