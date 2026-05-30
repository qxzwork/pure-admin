<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { getApiLogList, getApiLogDetail } from "@/api/api-log";
import type { ApiRequestLog } from "@/api/api-log";
import dayjs from "dayjs";

defineOptions({ name: "ManagementApiLog" });

const loading = ref(false);
const dataList = ref<ApiRequestLog[]>([]);
const pagination = reactive({ total: 0, pageSize: 20, currentPage: 1 });

const filterForm = reactive({
  uri: "",
  username: "",
  status: undefined as number | undefined
});

const columns: TableColumnList = [
  { label: "操作", prop: "description", width: 140, showOverflowTooltip: true },
  {
    label: "方法",
    prop: "requestMethod",
    width: 80,
    slot: "method"
  },
  {
    label: "请求路径",
    prop: "requestUri",
    minWidth: 200,
    showOverflowTooltip: true
  },
  { label: "IP", prop: "clientIp", width: 130 },
  { label: "用户", prop: "username", width: 100 },
  {
    label: "状态",
    prop: "responseStatus",
    width: 80,
    slot: "status"
  },
  {
    label: "耗时",
    prop: "durationMs",
    width: 90,
    sortable: true,
    slot: "duration"
  },
  {
    label: "时间",
    prop: "createTime",
    width: 170,
    sortable: true
  },
  { label: "操作", fixed: "right", width: 80, slot: "operation" }
];

async function onSearch() {
  loading.value = true;
  try {
    const params: Record<string, any> = {
      page: pagination.currentPage,
      size: pagination.pageSize
    };
    if (filterForm.uri) params.uri = filterForm.uri;
    if (filterForm.username) params.username = filterForm.username;
    if (filterForm.status !== undefined) params.status = filterForm.status;
    const res = await getApiLogList(params);
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
  filterForm.uri = "";
  filterForm.username = "";
  filterForm.status = undefined;
  pagination.currentPage = 1;
  onSearch();
}

function methodTag(method: string) {
  const map: Record<string, string> = {
    GET: "success",
    POST: "primary",
    PUT: "warning",
    DELETE: "danger"
  };
  return (map[method] ?? "info") as any;
}

function statusTag(status: number) {
  if (status >= 200 && status < 300) return "success";
  if (status >= 400 && status < 500) return "warning";
  if (status >= 500) return "danger";
  return "info";
}

function fmtTime(val: string) {
  return val ? dayjs(val).format("YYYY-MM-DD HH:mm:ss") : "-";
}

// 详情弹窗
const detailVisible = ref(false);
const detailLoading = ref(false);
const detailData = ref<ApiRequestLog | null>(null);

async function handleDetail(row: ApiRequestLog) {
  detailVisible.value = true;
  detailLoading.value = true;
  detailData.value = row;
  try {
    const res = await getApiLogDetail(row.id);
    if (res?.data) detailData.value = res.data;
  } catch {
    // use row data as fallback
  } finally {
    detailLoading.value = false;
  }
}

function fmtJson(str: string) {
  if (!str) return "-";
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
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
      <el-form-item label="请求路径：" prop="uri">
        <el-input
          v-model="filterForm.uri"
          placeholder="模糊搜索"
          clearable
          class="w-45!"
        />
      </el-form-item>
      <el-form-item label="用户名：" prop="username">
        <el-input
          v-model="filterForm.username"
          placeholder="精确匹配"
          clearable
          class="w-35!"
        />
      </el-form-item>
      <el-form-item label="状态码：" prop="status">
        <el-select
          v-model="filterForm.status"
          placeholder="全部"
          clearable
          class="w-25!"
        >
          <el-option label="2xx" :value="200" />
          <el-option label="4xx" :value="400" />
          <el-option label="5xx" :value="500" />
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

    <PureTableBar title="请求日志" :columns="columns" @refresh="onSearch">
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
          <template #method="{ row }">
            <el-tag :type="methodTag(row.requestMethod)" size="small">
              {{ row.requestMethod }}
            </el-tag>
          </template>
          <template #status="{ row }">
            <el-tag
              v-if="row.responseStatus"
              :type="statusTag(row.responseStatus)"
              size="small"
            >
              {{ row.responseStatus }}
            </el-tag>
            <span v-else class="text-gray-400">-</span>
          </template>
          <template #duration="{ row }">
            <span
              :class="
                row.durationMs > 3000
                  ? 'text-(--el-color-danger)'
                  : row.durationMs > 1000
                    ? 'text-(--el-color-warning)'
                    : ''
              "
            >
              {{ row.durationMs != null ? `${row.durationMs}ms` : "-" }}
            </span>
          </template>
          <template #operation="{ row, size }">
            <el-button
              link
              type="primary"
              :size="size"
              :icon="useRenderIcon('ri/search-line')"
              @click="handleDetail(row)"
            >
              详情
            </el-button>
          </template>
        </pure-table>
      </template>
    </PureTableBar>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="请求日志详情"
      width="800px"
      destroy-on-close
    >
      <div v-loading="detailLoading">
        <template v-if="detailData">
          <el-descriptions :column="2" border class="mb-4">
            <el-descriptions-item label="操作描述">
              {{ detailData.description || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="请求方法">
              <el-tag :type="methodTag(detailData.requestMethod)" size="small">
                {{ detailData.requestMethod }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="请求路径" :span="2">
              {{ detailData.requestUri }}
            </el-descriptions-item>
            <el-descriptions-item label="查询参数" :span="2">
              {{ detailData.queryParams || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="客户端IP">
              {{ detailData.clientIp || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="用户">
              {{ detailData.username || "-" }}
            </el-descriptions-item>
            <el-descriptions-item label="状态码">
              <el-tag
                v-if="detailData.responseStatus"
                :type="statusTag(detailData.responseStatus)"
                size="small"
              >
                {{ detailData.responseStatus }}
              </el-tag>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="耗时">
              {{
                detailData.durationMs != null
                  ? `${detailData.durationMs}ms`
                  : "-"
              }}
            </el-descriptions-item>
            <el-descriptions-item label="时间" :span="2">
              {{ fmtTime(detailData.createTime) }}
            </el-descriptions-item>
            <el-descriptions-item label="浏览器UA" :span="2">
              <div class="text-xs break-all">
                {{ detailData.userAgent || "-" }}
              </div>
            </el-descriptions-item>
          </el-descriptions>

          <h4 class="mb-2 text-sm font-semibold">请求体</h4>
          <pre
            class="bg-(--el-fill-color-lighter) rounded p-3 text-xs overflow-auto max-h-50 mb-4"
            >{{ fmtJson(detailData.requestBody) }}</pre
          >

          <h4 class="mb-2 text-sm font-semibold">响应体</h4>
          <pre
            class="bg-(--el-fill-color-lighter) rounded p-3 text-xs overflow-auto max-h-60 mb-4"
            >{{ fmtJson(detailData.responseBody) }}</pre
          >

          <template v-if="detailData.errorMessage">
            <h4 class="mb-2 text-sm font-semibold text-(--el-color-danger)">
              异常信息
            </h4>
            <pre
              class="bg-(--el-color-danger-light-9) rounded p-3 text-xs overflow-auto max-h-40 text-(--el-color-danger)"
              >{{ detailData.errorMessage }}</pre
            >
          </template>
        </template>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>
