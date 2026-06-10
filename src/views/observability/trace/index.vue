<script setup lang="ts">
import { useTrace } from "./hook";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

defineOptions({ name: "ObservabilityTrace" });

const {
  loading,
  columns,
  sessionList,
  pagination,
  statusFilter,
  expandedRows,
  stats,
  statsLoading,
  detailVisible,
  detailTrace,
  detailSpans,
  detailLoading,
  onSearch,
  loadStats,
  toggleExpand,
  handleTraceDetail,
  handleSizeChange,
  handleCurrentChange,
  fmt,
  fmtTime,
  spanTag,
  truncateText
} = useTrace();
</script>

<template>
  <div class="p-4">
    <!-- 统计卡片 -->
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

    <!-- 会话分组列表 -->
    <el-card shadow="never" class="mt-4">
      <div class="flex-bc mb-4">
        <h3 class="text-lg font-semibold">会话列表</h3>
        <div class="flex items-center">
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
        </div>
      </div>
      <pure-table
        row-key="sessionId"
        :expand-row-keys="expandedRows"
        adaptive
        :adaptiveConfig="{ offsetBottom: 108 }"
        align-whole="center"
        table-layout="auto"
        :loading="loading"
        :data="sessionList"
        :columns="columns"
        :pagination="pagination"
        :header-cell-style="{
          background: 'var(--el-fill-color-light)',
          color: 'var(--el-text-color-primary)'
        }"
        @page-size-change="handleSizeChange"
        @page-current-change="handleCurrentChange"
      >
        <!-- 展开列 -->
        <template #expand="{ row }">
          <div class="p-3 bg-gray-50 dark:bg-gray-800">
            <h4 class="mb-2 text-sm font-semibold">
              会话 {{ row.sessionId }} 的 Trace 记录
            </h4>
            <el-table :data="row.traces" border size="small" max-height="400">
              <el-table-column
                prop="id"
                label="Trace ID"
                min-width="150"
                show-overflow-tooltip
              />
              <el-table-column
                prop="userQuery"
                label="用户提问"
                min-width="200"
                show-overflow-tooltip
              />
              <el-table-column prop="modelName" label="模型" width="100" />
              <el-table-column prop="status" label="状态" width="80">
                <template #default="{ row: trace }">
                  <el-tag
                    :type="trace.status === 'SUCCESS' ? 'success' : 'danger'"
                    size="small"
                  >
                    {{ trace.status }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="totalDuration" label="耗时" width="100">
                <template #default="{ row: trace }">
                  {{ fmt(trace.totalDuration) }}
                </template>
              </el-table-column>
              <el-table-column
                prop="toolCallCount"
                label="工具调用"
                width="90"
              />
              <el-table-column prop="totalTokens" label="Token" width="90" />
              <el-table-column prop="createTime" label="创建时间" width="170">
                <template #default="{ row: trace }">
                  {{ fmtTime(trace.createTime) }}
                </template>
              </el-table-column>
              <el-table-column label="操作" width="80" fixed="right">
                <template #default="{ row: trace }">
                  <el-button
                    link
                    type="primary"
                    size="small"
                    :icon="useRenderIcon('ri/search-line')"
                    @click="handleTraceDetail(trace)"
                  >
                    详情
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>

        <!-- 会话级别：成功/失败 -->
        <template #successCount="{ row }">
          <span class="text-(--el-color-success)">{{ row.successCount }}</span>
          <span class="mx-1">/</span>
          <span class="text-(--el-color-danger)">{{ row.errorCount }}</span>
        </template>

        <!-- 会话级别：时间格式化 -->
        <template #firstQueryTime="{ row }">
          {{ fmtTime(row.firstQueryTime) }}
        </template>
        <template #lastQueryTime="{ row }">
          {{ fmtTime(row.lastQueryTime) }}
        </template>

        <!-- 会话级别：操作列（展开 Trace 列表） -->
        <template #operation="{ row }">
          <el-button
            link
            type="primary"
            :icon="
              useRenderIcon(
                expandedRows.includes(row.sessionId)
                  ? 'ri/arrow-up-s-line'
                  : 'ri/arrow-down-s-line'
              )
            "
            @click="toggleExpand(row)"
          >
            {{ row.traceCount }} 条 Trace
          </el-button>
        </template>
      </pure-table>
    </el-card>

    <!-- Trace 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="Trace 详情"
      width="95%"
      destroy-on-close
    >
      <div v-loading="detailLoading">
        <template v-if="detailTrace">
          <!-- Trace 基本信息 -->
          <el-descriptions :column="2" border class="mb-4">
            <el-descriptions-item label="Trace ID">
              {{ detailTrace.id }}
            </el-descriptions-item>
            <el-descriptions-item label="会话 ID">
              {{ detailTrace.sessionId }}
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag
                :type="detailTrace.status === 'SUCCESS' ? 'success' : 'danger'"
                size="small"
              >
                {{ detailTrace.status }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="模型">
              {{ detailTrace.modelName }}
            </el-descriptions-item>
            <el-descriptions-item label="耗时">
              {{ fmt(detailTrace.totalDuration) }}
            </el-descriptions-item>
            <el-descriptions-item label="工具调用">
              {{ detailTrace.toolCallCount ?? 0 }} 次
            </el-descriptions-item>
            <el-descriptions-item label="Token 统计">
              输入 {{ detailTrace.inputTokens ?? 0 }} / 输出
              {{ detailTrace.outputTokens ?? 0 }} (共
              {{ detailTrace.totalTokens ?? 0 }})
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">
              {{ fmtTime(detailTrace.createTime) }}
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
          </el-descriptions>

          <!-- Span 调用链路 -->
          <h4 class="mb-2 font-semibold">Span 调用链路</h4>
          <el-table :data="detailSpans" border size="small" max-height="500">
            <el-table-column
              prop="spanName"
              label="名称"
              min-width="120"
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
            <el-table-column prop="duration" label="耗时" width="90">
              <template #default="{ row }">{{ fmt(row.duration) }}</template>
            </el-table-column>
            <el-table-column
              prop="toolName"
              label="工具名称"
              width="120"
              show-overflow-tooltip
            />
            <el-table-column
              prop="toolInput"
              label="工具输入"
              min-width="200"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <el-tooltip
                  v-if="row.toolInput"
                  :content="row.toolInput"
                  placement="top"
                  :show-after="300"
                >
                  <span>{{ truncateText(row.toolInput, 80) }}</span>
                </el-tooltip>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="toolOutput"
              label="工具输出"
              min-width="200"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <el-tooltip
                  v-if="row.toolOutput"
                  :content="row.toolOutput"
                  placement="top"
                  :show-after="300"
                >
                  <span>{{ truncateText(row.toolOutput, 80) }}</span>
                </el-tooltip>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="thought"
              label="思考过程"
              min-width="200"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <el-tooltip
                  v-if="row.thought"
                  :content="row.thought"
                  placement="top"
                  :show-after="300"
                >
                  <span>{{ truncateText(row.thought, 80) }}</span>
                </el-tooltip>
                <span v-else>-</span>
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
