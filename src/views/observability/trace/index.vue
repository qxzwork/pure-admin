<script setup lang="ts">
import { useTrace } from "./hook";
import { PureTableBar } from "@/components/RePureTableBar";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

defineOptions({ name: "ObservabilityTrace" });

const {
  loading,
  columns,
  dataList,
  pagination,
  statusFilter,
  stats,
  statsLoading,
  detailVisible,
  detailTrace,
  detailSpans,
  detailLoading,
  onSearch,
  loadStats,
  handleDetail,
  handleSizeChange,
  handleCurrentChange,
  fmt,
  fmtTime,
  spanTag
} = useTrace();
</script>

<template>
  <div class="p-4">
    <el-row :gutter="16" class="mb-4">
      <el-col :span="6">
        <el-card v-loading="statsLoading" shadow="hover">
          <div class="text-center">
            <div class="text-3xl text-(--el-color-primary) font-bold">
              {{ stats?.totalCount ?? 0 }}
            </div>
            <div class="text-sm text-gray-500 mt-1">总请求数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card v-loading="statsLoading" shadow="hover">
          <div class="text-center">
            <div class="text-3xl text-(--el-color-success) font-bold">
              {{ stats?.successRate?.toFixed(1) ?? 0 }}%
            </div>
            <div class="text-sm text-gray-500 mt-1">
              成功率
              <span class="text-xs ml-1">
                ({{ stats?.successCount ?? 0 }}/{{ stats?.totalCount ?? 0 }})
              </span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card v-loading="statsLoading" shadow="hover">
          <div class="text-center">
            <div class="text-3xl text-(--el-color-warning) font-bold">
              {{ fmt(stats?.avgDuration) }}
            </div>
            <div class="text-sm text-gray-500 mt-1">平均耗时</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card v-loading="statsLoading" shadow="hover">
          <div class="text-center">
            <div class="text-3xl text-(--el-color-info) font-bold">
              {{ stats?.totalTokens?.toLocaleString() ?? 0 }}
            </div>
            <div class="text-sm text-gray-500 mt-1">总 Token 消耗</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <PureTableBar title="Trace 列表" :columns="columns" @refresh="onSearch">
      <template #buttons>
        <el-select
          v-model="statusFilter"
          placeholder="全部状态"
          clearable
          class="w-32! mr-2"
          @change="onSearch"
        >
          <el-option label="SUCCESS" value="SUCCESS" />
          <el-option label="ERROR" value="ERROR" />
        </el-select>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/refresh-line')"
          @click="loadStats"
        >
          刷新统计
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
            <el-tag
              :type="row.status === 'SUCCESS' ? 'success' : 'danger'"
              size="small"
            >
              {{ row.status }}
            </el-tag>
          </template>
          <template #operation="{ row }">
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

    <el-dialog
      v-model="detailVisible"
      title="Trace 详情"
      width="900px"
      destroy-on-close
    >
      <div v-loading="detailLoading">
        <template v-if="detailTrace">
          <el-descriptions :column="2" border class="mb-4">
            <el-descriptions-item label="Trace ID">{{
              detailTrace.id
            }}</el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag
                :type="detailTrace.status === 'SUCCESS' ? 'success' : 'danger'"
                size="small"
              >
                {{ detailTrace.status }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="模型">{{
              detailTrace.modelName
            }}</el-descriptions-item>
            <el-descriptions-item label="耗时">{{
              fmt(detailTrace.totalDuration)
            }}</el-descriptions-item>
            <el-descriptions-item label="工具调用"
              >{{ detailTrace.toolCallCount ?? 0 }} 次</el-descriptions-item
            >
            <el-descriptions-item label="Token">
              {{ detailTrace.inputTokens ?? 0 }} /
              {{ detailTrace.outputTokens ?? 0 }} (共
              {{ detailTrace.totalTokens ?? 0 }})
            </el-descriptions-item>
            <el-descriptions-item label="用户提问" :span="2">
              <div class="whitespace-pre-wrap break-all">
                {{ detailTrace.userQuery }}
              </div>
            </el-descriptions-item>
            <el-descriptions-item label="Agent 响应" :span="2">
              <div class="whitespace-pre-wrap break-all max-h-40 overflow-auto">
                {{ detailTrace.agentResponse }}
              </div>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="detailTrace.errorMessage"
              label="错误信息"
              :span="2"
            >
              <div
                class="text-(--el-color-danger) whitespace-pre-wrap break-all"
              >
                {{ detailTrace.errorMessage }}
              </div>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{
              fmtTime(detailTrace.createTime)
            }}</el-descriptions-item>
            <el-descriptions-item label="更新时间">{{
              fmtTime(detailTrace.updateTime)
            }}</el-descriptions-item>
          </el-descriptions>

          <h4 class="mb-2">Span 调用链路</h4>
          <el-table :data="detailSpans" border size="small" max-height="400">
            <el-table-column
              prop="spanName"
              label="名称"
              min-width="150"
              show-overflow-tooltip
            />
            <el-table-column prop="spanType" label="类型" width="90">
              <template #default="{ row }">
                <el-tag :type="spanTag(row.spanType)" size="small">
                  {{ row.spanType }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="80">
              <template #default="{ row }">
                <el-tag
                  :type="row.status === 'SUCCESS' ? 'success' : 'danger'"
                  size="small"
                >
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="duration" label="耗时" width="100">
              <template #default="{ row }">{{ fmt(row.duration) }}</template>
            </el-table-column>
            <el-table-column
              prop="toolName"
              label="工具"
              width="120"
              show-overflow-tooltip
            />
            <el-table-column
              prop="thought"
              label="思考/输出"
              min-width="200"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                {{ row.thought || row.toolOutput || "-" }}
              </template>
            </el-table-column>
            <el-table-column
              prop="errorMessage"
              label="错误"
              min-width="150"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span class="text-(--el-color-danger)">{{
                  row.errorMessage || ""
                }}</span>
              </template>
            </el-table-column>
          </el-table>
        </template>
      </div>
      <template #footer>
        <el-button @click="detailVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>
