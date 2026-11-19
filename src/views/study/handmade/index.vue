<script setup lang="ts">
import { ref } from "vue";
import { useColumns } from "./columns";

const tableRef = ref();

const {
  loading,
  columns,
  dataList,
  pagination,
  loadingConfig,
  adaptiveConfig,
  onSizeChange,
  onCurrentChange
} = useColumns();
</script>

<template>
  <pure-table
    ref="tableRef"
    border
    adaptive
    :adaptiveConfig="adaptiveConfig"
    row-key="id"
    alignWhole="center"
    showOverflowTooltip
    :loading="loading"
    :loading-config="loadingConfig"
    :data="
      dataList.slice(
        (pagination.currentPage - 1) * pagination.pageSize,
        pagination.currentPage * pagination.pageSize
      )
    "
    :columns="columns"
    :pagination="pagination"
    @page-size-change="onSizeChange"
    @page-current-change="onCurrentChange"
  >
    <template #operation="{ size }">
      <el-button link type="primary" :size="size">查看</el-button>
    </template>
  </pure-table>
</template>
