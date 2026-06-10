<script setup lang="ts">
import { useTrace } from "./hook";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";

defineOptions({ name: "ObservabilityTrace" });

const {
  loading,
  sessionList,
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
    <el-row :gutter="16" class="mb-6">
      <el-col :span="6">
        <el-card
          v-loading="statsLoading"
          shadow="hover"
          class="stat-card stat-card-primary"
        >
          <div class="text-center">
            <div class="stat-icon">
              <el-icon size="24"><DataAnalysis /></el-icon>
            </div>
            <div class="stat-value">{{ stats?.totalCount ?? 0 }}</div>
            <div class="stat-label">总请求数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card
          v-loading="statsLoading"
          shadow="hover"
          class="stat-card stat-card-success"
        >
          <div class="text-center">
            <div class="stat-icon">
              <el-icon size="24"><CircleCheck /></el-icon>
            </div>
            <div class="stat-value">
              {{ stats?.successRate?.toFixed(1) ?? 0 }}%
            </div>
            <div class="stat-label">
              成功率
              <span class="stat-sub"
                >({{ stats?.successCount ?? 0 }}/{{
                  stats?.totalCount ?? 0
                }})</span
              >
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card
          v-loading="statsLoading"
          shadow="hover"
          class="stat-card stat-card-warning"
        >
          <div class="text-center">
            <div class="stat-icon">
              <el-icon size="24"><Timer /></el-icon>
            </div>
            <div class="stat-value">{{ fmt(stats?.avgDuration) }}</div>
            <div class="stat-label">平均耗时</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card
          v-loading="statsLoading"
          shadow="hover"
          class="stat-card stat-card-info"
        >
          <div class="text-center">
            <div class="stat-icon">
              <el-icon size="24"><Coin /></el-icon>
            </div>
            <div class="stat-value">
              {{ stats?.totalTokens?.toLocaleString() ?? 0 }}
            </div>
            <div class="stat-label">总 Token 消耗</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 筛选和刷新 -->
    <div class="flex-bc mb-4">
      <h3 class="text-lg font-semibold text-gray-800 dark:text-gray-200">
        会话记录
      </h3>
      <div class="flex items-center">
        <el-select
          v-model="statusFilter"
          placeholder="全部状态"
          clearable
          class="w-32! mr-3"
          @change="onSearch"
        >
          <el-option label="全部" value="" />
          <el-option label="成功" value="SUCCESS" />
          <el-option label="失败" value="ERROR" />
        </el-select>
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/refresh-line')"
          :loading="loading"
          @click="onSearch"
        >
          刷新
        </el-button>
      </div>
    </div>

    <!-- 会话列表 -->
    <div v-loading="loading" class="session-list">
      <el-empty
        v-if="!sessionList.length && !loading"
        description="暂无会话记录"
      />

      <el-card
        v-for="(session, index) in sessionList"
        :key="session.sessionId"
        class="session-card"
        shadow="hover"
        :style="{ animationDelay: `${index * 0.1}s` }"
      >
        <!-- 会话头部 -->
        <template #header>
          <div class="session-header">
            <div class="flex items-center">
              <el-icon class="mr-2 text-primary" size="18"
                ><ChatDotRound
              /></el-icon>
              <span class="font-semibold text-gray-800 dark:text-gray-200"
                >会话</span
              >
              <el-tag class="ml-2" size="small" type="info">{{
                session.sessionId
              }}</el-tag>
            </div>
            <div class="text-sm text-gray-500">
              {{ fmtTime(session.lastQueryTime) }}
            </div>
          </div>
          <div class="session-stats">
            <el-tag size="small" type="primary" effect="plain">
              <el-icon class="mr-1"><Document /></el-icon>
              {{ session.traceCount }} 次请求
            </el-tag>
            <el-tag size="small" type="success" effect="plain">
              <el-icon class="mr-1"><CircleCheck /></el-icon>
              {{ session.successCount }} 成功
            </el-tag>
            <el-tag size="small" type="danger" effect="plain">
              <el-icon class="mr-1"><CircleClose /></el-icon>
              {{ session.errorCount }} 失败
            </el-tag>
            <el-tag size="small" type="warning" effect="plain">
              <el-icon class="mr-1"><Coin /></el-icon>
              Token: {{ session.totalTokens.toLocaleString() }}
            </el-tag>
          </div>
        </template>

        <!-- 时间线 -->
        <el-timeline class="trace-timeline">
          <el-timeline-item
            v-for="trace in session.traces"
            :key="trace.id"
            :timestamp="fmtTime(trace.createTime)"
            :color="trace.status === 'SUCCESS' ? '#67C23A' : '#F56C6C'"
            placement="top"
          >
            <el-card
              shadow="never"
              class="trace-card"
              @click="handleTraceDetail(trace)"
            >
              <div class="trace-content">
                <!-- 用户提问 -->
                <div class="trace-question">
                  <el-icon class="mr-2 text-primary"><ChatLineRound /></el-icon>
                  <span class="font-medium">{{ trace.userQuery }}</span>
                </div>

                <!-- 详细信息 -->
                <div class="trace-meta">
                  <div class="meta-item">
                    <el-icon><Cpu /></el-icon>
                    <span>{{ trace.modelName }}</span>
                  </div>
                  <el-divider direction="vertical" />
                  <div class="meta-item">
                    <el-icon><Timer /></el-icon>
                    <span>{{ fmt(trace.totalDuration) }}</span>
                  </div>
                  <el-divider direction="vertical" />
                  <div class="meta-item">
                    <el-icon><Coin /></el-icon>
                    <span>Token: {{ trace.totalTokens }}</span>
                  </div>
                  <el-divider direction="vertical" />
                  <div class="meta-item">
                    <el-icon><Tools /></el-icon>
                    <span>工具调用: {{ trace.toolCallCount ?? 0 }}</span>
                  </div>
                </div>

                <!-- 状态标签 -->
                <div class="trace-status">
                  <el-tag
                    :type="trace.status === 'SUCCESS' ? 'success' : 'danger'"
                    size="small"
                    effect="dark"
                  >
                    {{ trace.status }}
                  </el-tag>
                  <el-button
                    type="primary"
                    link
                    size="small"
                    class="ml-auto"
                    @click.stop="handleTraceDetail(trace)"
                  >
                    查看详情
                    <el-icon class="ml-1"><ArrowRight /></el-icon>
                  </el-button>
                </div>

                <!-- 错误信息 -->
                <div v-if="trace.errorMessage" class="trace-error">
                  <el-icon><Warning /></el-icon>
                  <span>{{ trace.errorMessage }}</span>
                </div>
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
      </el-card>

      <!-- 分页 -->
      <div v-if="pagination.total > 0" class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.currentPage"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="handleCurrentChange"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <!-- Trace 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="Trace 详情"
      width="90%"
      destroy-on-close
      class="detail-dialog"
    >
      <div v-loading="detailLoading">
        <template v-if="detailTrace">
          <!-- Trace 基本信息 -->
          <el-descriptions :column="2" border class="mb-6">
            <el-descriptions-item label="Trace ID">
              <el-tag type="info">{{ detailTrace.id }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="会话 ID">
              <el-tag type="info">{{ detailTrace.sessionId }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag
                :type="detailTrace.status === 'SUCCESS' ? 'success' : 'danger'"
                effect="dark"
              >
                {{ detailTrace.status }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="模型">
              <el-tag type="primary">{{ detailTrace.modelName }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="耗时">
              <span class="font-semibold">{{
                fmt(detailTrace.totalDuration)
              }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="工具调用">
              <span class="font-semibold"
                >{{ detailTrace.toolCallCount ?? 0 }} 次</span
              >
            </el-descriptions-item>
            <el-descriptions-item label="Token 统计">
              <div class="flex items-center gap-2">
                <el-tag size="small" type="info"
                  >输入: {{ detailTrace.inputTokens ?? 0 }}</el-tag
                >
                <el-tag size="small" type="success"
                  >输出: {{ detailTrace.outputTokens ?? 0 }}</el-tag
                >
                <el-tag size="small" type="warning"
                  >总计: {{ detailTrace.totalTokens ?? 0 }}</el-tag
                >
              </div>
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">
              {{ fmtTime(detailTrace.createTime) }}
            </el-descriptions-item>
            <el-descriptions-item label="用户提问" :span="2">
              <div
                class="whitespace-pre-wrap break-all p-2 bg-gray-50 dark:bg-gray-800 rounded"
              >
                {{ detailTrace.userQuery }}
              </div>
            </el-descriptions-item>
            <el-descriptions-item label="Agent 响应" :span="2">
              <div
                class="whitespace-pre-wrap break-all max-h-40 overflow-auto p-2 bg-gray-50 dark:bg-gray-800 rounded"
              >
                {{ detailTrace.agentResponse }}
              </div>
            </el-descriptions-item>
            <el-descriptions-item
              v-if="detailTrace.errorMessage"
              label="错误信息"
              :span="2"
            >
              <div
                class="text-red-500 whitespace-pre-wrap break-all p-2 bg-red-50 dark:bg-red-900/20 rounded"
              >
                {{ detailTrace.errorMessage }}
              </div>
            </el-descriptions-item>
          </el-descriptions>

          <!-- Span 调用链路 -->
          <h4 class="mb-4 font-semibold text-gray-800 dark:text-gray-200">
            <el-icon class="mr-2"><Connection /></el-icon>
            Span 调用链路
          </h4>
          <el-table
            :data="detailSpans"
            border
            size="small"
            max-height="500"
            class="span-table"
          >
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
                  <span class="cursor-help">{{
                    truncateText(row.toolInput, 80)
                  }}</span>
                </el-tooltip>
                <span v-else class="text-gray-400">-</span>
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
                  <span class="cursor-help">{{
                    truncateText(row.toolOutput, 80)
                  }}</span>
                </el-tooltip>
                <span v-else class="text-gray-400">-</span>
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
                  <span class="cursor-help">{{
                    truncateText(row.thought, 80)
                  }}</span>
                </el-tooltip>
                <span v-else class="text-gray-400">-</span>
              </template>
            </el-table-column>
            <el-table-column
              prop="errorMessage"
              label="错误"
              min-width="150"
              show-overflow-tooltip
            >
              <template #default="{ row }">
                <span v-if="row.errorMessage" class="text-red-500">
                  {{ row.errorMessage }}
                </span>
                <span v-else class="text-gray-400">-</span>
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

<style scoped>
/* 统计卡片样式 */
.stat-card {
  overflow: hidden;
  border: none;
  border-radius: 12px;
  transition: all 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
}

.stat-card-primary {
  color: white;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.stat-card-success {
  color: white;
  background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%);
}

.stat-card-warning {
  color: white;
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.stat-card-info {
  color: white;
  background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
}

.stat-icon {
  margin-bottom: 8px;
  opacity: 0.8;
}

.stat-value {
  margin-bottom: 4px;
  font-size: 2em;
  font-weight: bold;
}

.stat-label {
  font-size: 0.9em;
  opacity: 0.9;
}

.stat-sub {
  font-size: 0.8em;
  opacity: 0.7;
}

/* 会话列表样式 */
.session-list {
  min-height: 200px;
}

.session-card {
  margin-bottom: 16px;
  border-radius: 12px;
  opacity: 0;
  transition: all 0.3s ease;
  animation: fade-in-up 0.5s ease forwards;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.session-card:hover {
  box-shadow: 0 8px 24px rgb(0 0 0 / 10%);
  transform: translateY(-2px);
}

.session-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.session-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* 时间线样式 */
.trace-timeline {
  padding-left: 8px;
}

:deep(.el-timeline-item__timestamp) {
  font-size: 12px;
  color: #909399;
}

:deep(.el-timeline-item__node) {
  left: 1px;
  width: 12px;
  height: 12px;
}

:deep(.el-timeline-item__tail) {
  left: 5px;
}

/* Trace 卡片样式 */
.trace-card {
  margin-top: 8px;
  cursor: pointer;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.trace-card:hover {
  background-color: #f5f7fa;
  border-color: #c0c4cc;
  transform: translateX(4px);
}

.trace-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.trace-question {
  display: flex;
  align-items: center;
  font-size: 1.05em;
  color: #303133;
}

.trace-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 0.9em;
  color: #909399;
}

.meta-item {
  display: flex;
  gap: 4px;
  align-items: center;
}

.trace-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.trace-error {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  font-size: 0.9em;
  color: #f56c6c;
  background-color: #fef0f0;
  border-radius: 4px;
}

/* 分页样式 */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  padding: 16px 0;
  margin-top: 24px;
}

/* 详情弹窗样式 */
.detail-dialog {
  border-radius: 12px;
}

.span-table {
  overflow: hidden;
  border-radius: 8px;
}

/* 深色模式适配 */
:deep(.dark) {
  .trace-question {
    color: #e5eaf3;
  }

  .trace-meta {
    color: #a3a6ad;
  }

  .trace-card {
    border-color: #4c4d4f;
  }

  .trace-card:hover {
    background-color: #2d2d2d;
    border-color: #6c6e72;
  }

  .trace-error {
    background-color: rgb(245 108 108 / 10%);
  }
}
</style>
