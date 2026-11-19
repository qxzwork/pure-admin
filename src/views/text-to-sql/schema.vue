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
import { useSchemaSync } from "./composables/useSchemaSync";
import {
  formatTime,
  getSyncPercent,
  getSyncProgressText,
  getTableTag,
  getVectorStatusMeta,
  handleApiError
} from "./utils/schema";

defineOptions({ name: "TextToSqlSchema" });

const schemaTables = ref<SchemaTableItem[]>([]);
const selectedTable = ref("");
const schema = ref<SchemaInfo | null>(null);
const status = ref<SchemaStatus | null>(null);
const keyword = ref("");
const loading = ref(false);
const refreshing = ref(false);
const deleting = ref(false);

const {
  task,
  running,
  start,
  refresh: refreshSync
} = useSchemaSync(() => {
  refreshAll();
});

const filteredTables = computed(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return schemaTables.value;
  return schemaTables.value.filter(
    item =>
      item.tableName.toLowerCase().includes(kw) ||
      (item.tableComment ?? "").toLowerCase().includes(kw)
  );
});

const percent = computed(() => getSyncPercent(task.value));
const progressText = computed(() => getSyncProgressText(task.value));

// 加载逐表状态
async function loadTables() {
  try {
    const res = await getSchemaTables();
    if (res?.code === 200) {
      // 接口未约定排序，前端按表名稳定排序
      schemaTables.value = [...(res.data ?? [])].sort((a, b) =>
        a.tableName.localeCompare(b.tableName)
      );
    } else if (res?.code === 404) {
      // Text-to-SQL 功能关闭
      schemaTables.value = [];
    }
  } catch {
    // ignore
  }
}

// 加载汇总状态
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

// 加载表结构
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
        loadTables();
      } else if (action === "refresh") {
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

// 整体刷新
async function refreshAll() {
  refreshing.value = true;
  try {
    await Promise.all([loadStatus(), loadTables()]);
    if (selectedTable.value) {
      await loadSchema(selectedTable.value);
    }
  } finally {
    refreshing.value = false;
  }
}

// 选择表
function handleSelectTable(item: SchemaTableItem) {
  selectedTable.value = item.tableName;
  loadSchema(item.tableName);
}

// 同步所有表
async function handleSyncAll() {
  const ok = await start();
  if (ok) message("已启动全库同步", { type: "success" });
}

// 同步当前表
async function handleSyncTable() {
  if (!selectedTable.value) {
    message("请先选择表", { type: "warning" });
    return;
  }
  const ok = await start(selectedTable.value);
  if (ok)
    message(`已启动表 ${selectedTable.value} 的同步`, { type: "success" });
}

// 删除当前表向量
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
  // 接上可能已在运行的同步任务
  refreshSync();
});
</script>

<template>
  <div class="schema-container p-4">
    <!-- 状态栏 -->
    <el-card class="mb-4" shadow="never">
      <div class="status-bar">
        <div class="status-item">
          <span class="label">表总数</span>
          <span class="value">{{ status?.tableCount ?? 0 }}</span>
        </div>
        <div class="status-item">
          <span class="label">已索引</span>
          <span class="value text-green-600">{{
            status?.indexedCount ?? 0
          }}</span>
        </div>
        <div class="status-item">
          <span class="label">待处理</span>
          <span class="value text-gray-500">{{
            status?.pendingCount ?? 0
          }}</span>
        </div>
        <div class="status-item">
          <span class="label">失败</span>
          <span class="value text-red-500">{{ status?.failedCount ?? 0 }}</span>
        </div>
        <div class="status-item">
          <span class="label">最后同步</span>
          <span class="value text-gray-500">{{
            formatTime(status?.lastSyncTime)
          }}</span>
        </div>
        <div class="status-item">
          <el-tag v-if="running" type="primary" size="small" class="ml-1">
            同步中
          </el-tag>
          <el-tag
            v-else
            :type="status?.needsUpdate ? 'warning' : 'success'"
            size="small"
          >
            {{ status?.needsUpdate ? "需要更新" : "正常" }}
          </el-tag>
        </div>
        <div class="ml-auto flex gap-2">
          <el-button :loading="refreshing" @click="refreshAll">
            刷新
          </el-button>
          <el-button
            type="primary"
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
      </div>

      <!-- 同步进度 -->
      <div v-if="running" class="progress-bar">
        <el-progress
          :percentage="percent"
          :status="task && task.failed > 0 ? 'warning' : undefined"
          :stroke-width="12"
        />
        <span class="progress-text">
          {{ task?.scope === "ALL" ? "全库同步" : `同步 ${task?.scope ?? ""}` }}
          ：{{ progressText }}
          <template v-if="task && task.failed > 0">
            ，失败 {{ task.failed }}
          </template>
        </span>
      </div>
    </el-card>

    <!-- 主内容区 -->
    <div class="schema-content">
      <!-- 左侧表列表 -->
      <el-card class="table-list-card" shadow="never">
        <template #header>
          <div class="flex-bc mb-2">
            <span class="font-bold">可用表 ({{ schemaTables.length }})</span>
          </div>
          <el-input
            v-model="keyword"
            placeholder="搜索表名 / 注释"
            size="small"
            clearable
          />
        </template>
        <div class="table-list">
          <div
            v-for="item in filteredTables"
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
              <div class="table-meta">
                {{ item.tableComment || "无注释" }} · {{ item.columnCount }} 列
              </div>
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
            v-if="!filteredTables.length"
            :description="keyword ? '没有匹配的表' : '暂无表'"
            :image-size="60"
          />
        </div>
      </el-card>

      <!-- 右侧表详情 -->
      <el-card class="table-detail-card" shadow="never">
        <template #header>
          <div class="flex-bc">
            <span class="font-bold">
              {{ schema ? `${schema.tableName} 表结构` : "表结构详情" }}
            </span>
            <div v-if="schema" class="flex gap-2">
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
                <el-icon class="mr-1"
                  ><IconifyIconOffline icon="ri:delete-bin-line"
                /></el-icon>
                删除向量
              </el-button>
            </div>
          </div>
        </template>

        <template v-if="schema">
          <div v-if="schema.tableComment" class="mb-4 text-gray-500">
            表注释：{{ schema.tableComment }}
          </div>
          <el-table :data="schema.columns" border stripe size="small">
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

        <div v-else-if="loading" class="loading-container">
          <el-icon class="is-loading"
            ><IconifyIconOffline icon="ri:loader-4-line"
          /></el-icon>
          <span class="ml-2">加载中...</span>
        </div>

        <el-empty v-else description="请选择表查看详情" :image-size="80" />
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  align-items: center;
}

.status-item {
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 14px;
}

.status-item .label {
  color: var(--el-text-color-secondary);
}

.status-item .value {
  font-weight: 600;
}

.progress-bar {
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.progress-text {
  display: inline-block;
  margin-top: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.schema-content {
  display: flex;
  gap: 16px;
  min-height: calc(100vh - 300px);
}

.table-list-card {
  flex-shrink: 0;
  width: 300px;
}

.table-detail-card {
  flex: 1;
  min-width: 0;
}

.table-list {
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}

.table-item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 6px;
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
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
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

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}
</style>
