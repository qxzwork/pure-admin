<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import {
  deleteTableVectors,
  getSchemaStatus,
  getSchemaTables,
  getTableSchema,
  type SchemaInfo,
  type SchemaStatus,
  type SchemaTableItem
} from "@/api/text-to-sql";
import { useSchemaSync } from "../composables/useSchemaSync";
import {
  formatTime,
  getSyncPercent,
  getSyncProgressText,
  getTableTag,
  getVectorStatusMeta,
  handleApiError
} from "../utils/schema";

const emit = defineEmits(["updated"]);

const schemaTables = ref<SchemaTableItem[]>([]);
const selectedTable = ref("");
const schema = ref<SchemaInfo | null>(null);
const status = ref<SchemaStatus | null>(null);
const loading = ref(false);
const deleting = ref(false);

const {
  task,
  running,
  start,
  refresh: refreshSync
} = useSchemaSync(() => {
  refreshAll();
  emit("updated");
});

const percent = computed(() => getSyncPercent(task.value));
const progressText = computed(() => getSyncProgressText(task.value));

async function loadTables() {
  try {
    const res = await getSchemaTables();
    if (res?.code === 200) {
      schemaTables.value = [...(res.data ?? [])].sort((a, b) =>
        a.tableName.localeCompare(b.tableName)
      );
    }
  } catch {
    // ignore
  }
}

async function loadStatus() {
  try {
    const res = await getSchemaStatus();
    if (res?.code === 200) {
      status.value = res.data;
    }
  } catch {
    // ignore
  }
}

async function loadSchema(tableName: string) {
  if (!tableName) {
    schema.value = null;
    return;
  }

  loading.value = true;
  try {
    const res = await getTableSchema(tableName);
    if (res?.code === 200) {
      schema.value = res.data;
    } else {
      schema.value = null;
      const action = handleApiError(res, "获取表结构失败");
      if (action === "remove") {
        selectedTable.value = "";
      }
      if (action === "remove" || action === "refresh") {
        loadTables();
      }
    }
  } catch (e: any) {
    schema.value = null;
    message(e?.message ?? "获取表结构失败", { type: "error" });
  } finally {
    loading.value = false;
  }
}

async function refreshAll() {
  await Promise.all([loadStatus(), loadTables()]);
  if (selectedTable.value) {
    await loadSchema(selectedTable.value);
  }
}

function handleSelectTable(item: SchemaTableItem) {
  selectedTable.value = item.tableName;
  loadSchema(item.tableName);
}

async function handleSyncAll() {
  const ok = await start();
  if (ok) {
    message("已启动全库同步", { type: "success" });
    emit("updated");
  }
}

async function handleSyncTable() {
  if (!selectedTable.value) {
    message("请先选择表", { type: "warning" });
    return;
  }
  const ok = await start(selectedTable.value);
  if (ok) {
    message(`已启动表 ${selectedTable.value} 的同步`, { type: "success" });
    emit("updated");
  }
}

async function handleDeleteVectors() {
  if (!selectedTable.value) {
    message("请先选择表", { type: "warning" });
    return;
  }

  const tableName = selectedTable.value;
  try {
    await ElMessageBox.confirm(
      `确定删除表 ${tableName} 的向量与记录吗？删除后需重新同步才能用于问答检索。`,
      "删除向量",
      { type: "warning", confirmButtonText: "删除", cancelButtonText: "取消" }
    );
  } catch {
    return;
  }

  deleting.value = true;
  try {
    const res = await deleteTableVectors(tableName);
    if (res?.code === 200) {
      message(`已删除表 ${tableName} 的向量`, { type: "success" });
      schema.value = null;
      selectedTable.value = "";
      await refreshAll();
      emit("updated");
    } else {
      handleApiError(res, "删除向量失败");
    }
  } catch (e: any) {
    message(e?.message ?? "删除向量失败", { type: "error" });
  } finally {
    deleting.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadStatus(), loadTables()]);
  refreshSync();
});
</script>

<template>
  <div class="schema-panel">
    <!-- 状态信息 -->
    <div class="status-bar">
      <div class="status-item">
        <span class="label">已索引 / 总数</span>
        <span class="value">
          {{ status?.indexedCount ?? 0 }} / {{ status?.tableCount ?? 0 }}
        </span>
      </div>
      <div class="status-item">
        <span class="label">待处理</span>
        <span class="value">{{ status?.pendingCount ?? 0 }}</span>
      </div>
      <div class="status-item">
        <span class="label">失败</span>
        <span class="value text-red-500">{{ status?.failedCount ?? 0 }}</span>
      </div>
      <div class="status-item">
        <span class="label">最后同步</span>
        <span class="value">{{ formatTime(status?.lastSyncTime) }}</span>
      </div>
      <div class="status-item">
        <el-tag v-if="running" type="primary" size="small">同步中</el-tag>
        <el-tag
          v-else
          :type="status?.needsUpdate ? 'warning' : 'success'"
          size="small"
        >
          {{ status?.needsUpdate ? "需要更新" : "正常" }}
        </el-tag>
      </div>
      <el-button
        type="primary"
        size="small"
        class="ml-auto"
        :loading="running"
        :disabled="running"
        @click="handleSyncAll"
      >
        <el-icon class="mr-1"
          ><IconifyIconOffline icon="ri:refresh-line"
        /></el-icon>
        更新所有表
      </el-button>
    </div>

    <!-- 同步进度 -->
    <div v-if="running" class="progress-bar">
      <el-progress
        :percentage="percent"
        :status="task && task.failed > 0 ? 'warning' : undefined"
        :stroke-width="10"
      />
      <span class="progress-text">
        {{ task?.scope === "ALL" ? "全库同步" : `同步 ${task?.scope ?? ""}` }}
        ：{{ progressText }}
        <template v-if="task && task.failed > 0">
          ，失败 {{ task.failed }}
        </template>
      </span>
    </div>

    <!-- 表列表和详情 -->
    <div class="schema-content">
      <!-- 左侧表列表 -->
      <div class="table-list">
        <div class="list-header">
          <span class="font-bold">可用表 ({{ schemaTables.length }})</span>
        </div>
        <div class="list-body">
          <div
            v-for="item in schemaTables"
            :key="item.tableName"
            :class="[
              'table-item',
              { active: selectedTable === item.tableName }
            ]"
            @click="handleSelectTable(item)"
          >
            <span class="status-dot" :class="`dot-${item.vectorStatus}`" />
            <div class="table-info">
              <div class="table-name">{{ item.tableName }}</div>
              <div class="table-meta">{{ item.columnCount }} 列</div>
            </div>
            <el-tooltip
              :content="
                item.errorMessage || getVectorStatusMeta(item.vectorStatus).text
              "
              :disabled="!item.errorMessage"
              placement="top"
            >
              <el-tag :type="getTableTag(item).type" size="small">
                {{ getTableTag(item).text }}
              </el-tag>
            </el-tooltip>
          </div>
          <el-empty
            v-if="!schemaTables.length"
            description="暂无表"
            :image-size="60"
          />
        </div>
      </div>

      <!-- 右侧表详情 -->
      <div class="table-detail">
        <template v-if="schema">
          <div class="detail-header">
            <div class="detail-title">
              <span class="font-bold text-lg">{{ schema.tableName }}</span>
              <span v-if="schema.tableComment" class="ml-2 text-gray-500">
                ({{ schema.tableComment }})
              </span>
            </div>
            <div class="flex gap-2">
              <el-button
                type="primary"
                size="small"
                :loading="running"
                :disabled="running"
                @click="handleSyncTable"
              >
                <el-icon class="mr-1"
                  ><IconifyIconOffline icon="ri:refresh-line"
                /></el-icon>
                更新此表
              </el-button>
              <el-button
                type="danger"
                size="small"
                plain
                :loading="deleting"
                :disabled="running || deleting"
                @click="handleDeleteVectors"
              >
                删除向量
              </el-button>
            </div>
          </div>

          <el-table
            :data="schema.columns"
            border
            stripe
            size="small"
            max-height="400"
          >
            <el-table-column prop="columnName" label="列名" min-width="120" />
            <el-table-column prop="columnType" label="类型" min-width="140" />
            <el-table-column
              prop="columnComment"
              label="注释"
              min-width="150"
            />
            <el-table-column label="主键" width="60" align="center">
              <template #default="{ row }">
                <el-icon v-if="row.isPrimaryKey" class="text-yellow-500">
                  <IconifyIconOffline icon="ri:key-line" />
                </el-icon>
              </template>
            </el-table-column>
            <el-table-column label="可空" width="60" align="center">
              <template #default="{ row }">
                <el-icon v-if="row.isNullable" class="text-green-500">
                  <IconifyIconOffline icon="ri:check-line" />
                </el-icon>
                <el-icon v-else class="text-red-500">
                  <IconifyIconOffline icon="ri:close-line" />
                </el-icon>
              </template>
            </el-table-column>
          </el-table>
        </template>

        <el-empty
          v-else-if="!loading"
          description="请选择表查看详情"
          :image-size="80"
        />

        <div v-else class="loading-container">
          <el-icon class="is-loading"
            ><IconifyIconOffline icon="ri:loader-4-line"
          /></el-icon>
          <span class="ml-2">加载中...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.schema-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
  padding: 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.status-item {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 13px;
}

.status-item .label {
  color: var(--el-text-color-secondary);
}

.status-item .value {
  font-weight: 600;
}

.progress-bar {
  padding: 10px 12px;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.progress-text {
  display: inline-block;
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.schema-content {
  display: flex;
  gap: 16px;
  min-height: 400px;
}

.table-list {
  flex-shrink: 0;
  width: 240px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
}

.list-header {
  padding: 10px 12px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color);
}

.list-body {
  max-height: 400px;
  overflow-y: auto;
}

.table-item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.table-item:hover {
  background: var(--el-fill-color-light);
}

.table-item.active {
  background: var(--el-color-primary-light-9);
}

.table-info {
  flex: 1;
  min-width: 0;
}

.table-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
  white-space: nowrap;
}

.table-meta {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.status-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-0 {
  background: var(--el-color-info);
}

.dot-1 {
  background: var(--el-color-success);
}

.dot-2 {
  background: var(--el-color-danger);
}

.table-detail {
  flex: 1;
  min-width: 0;
}

.detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.detail-title {
  min-width: 0;
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}
</style>
