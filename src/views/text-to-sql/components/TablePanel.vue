<script setup lang="ts">
import { ref, computed } from "vue";
import { message } from "@/utils/message";

const props = defineProps({
  data: {
    type: Array as () => Record<string, any>[],
    required: true
  }
});

const currentPage = ref(1);
const pageSize = ref(20);

// 列定义
const columns = computed(() => {
  if (!props.data || props.data.length === 0) return [];
  return Object.keys(props.data[0]).map(key => ({
    label: key,
    prop: key,
    minWidth: 120,
    showOverflowTooltip: true
  }));
});

// 分页数据
const paginatedData = computed(() => {
  if (!props.data) return [];
  const start = (currentPage.value - 1) * pageSize.value;
  return props.data.slice(start, start + pageSize.value);
});

// 总数
const total = computed(() => props.data?.length ?? 0);

// 页码变化
function handleCurrentChange(val: number) {
  currentPage.value = val;
}

// 每页条数变化
function handleSizeChange(val: number) {
  pageSize.value = val;
  currentPage.value = 1;
}

// 导出 CSV
function exportCSV() {
  if (!props.data || props.data.length === 0) {
    message("暂无数据可导出", { type: "warning" });
    return;
  }

  try {
    const headers = Object.keys(props.data[0]);
    const csvHeaders = headers.join(",");

    const csvRows = props.data.map(row =>
      headers
        .map(h => {
          const val = row[h];
          // 处理包含逗号或引号的值
          if (val === null || val === undefined) return "";
          const str = String(val);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    );

    const csv = [csvHeaders, ...csvRows].join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `query_result_${new Date().getTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    message("导出成功", { type: "success" });
  } catch (e: any) {
    message("导出失败: " + e.message, { type: "error" });
  }
}
</script>

<template>
  <div class="table-panel">
    <div class="table-toolbar">
      <span class="text-sm text-gray-500"> 共 {{ total }} 条数据 </span>
      <el-button type="primary" size="small" link @click="exportCSV">
        <el-icon class="mr-1"
          ><IconifyIconOffline icon="ri:download-line"
        /></el-icon>
        导出 CSV
      </el-button>
    </div>

    <el-table :data="paginatedData" border stripe max-height="400" size="small">
      <el-table-column
        v-for="col in columns"
        :key="col.prop"
        :label="col.label"
        :prop="col.prop"
        :min-width="col.minWidth"
        show-overflow-tooltip
      />
    </el-table>

    <div class="table-pagination">
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
  </div>
</template>

<style scoped>
.table-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.table-pagination {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
</style>
