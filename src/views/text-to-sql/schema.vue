<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import {
  getTextToSqlTables,
  getTableSchema,
  vectorizeSchema,
  getSchemaStatus,
  type SchemaInfo,
  type SchemaStatus
} from "@/api/text-to-sql";

defineOptions({ name: "TextToSqlSchema" });

const tables = ref<string[]>([]);
const selectedTable = ref("");
const schema = ref<SchemaInfo | null>(null);
const schemaStatus = ref<SchemaStatus | null>(null);
const loading = ref(false);
const vectorizing = ref(false);

// 加载表列表
async function loadTables() {
  try {
    const res = await getTextToSqlTables();
    if (res?.code === 200) {
      tables.value = res.data ?? [];
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
      message(res?.message ?? "获取表结构失败", { type: "error" });
    }
  } catch (e: any) {
    message(e?.message ?? "获取表结构失败", { type: "error" });
  } finally {
    loading.value = false;
  }
}

// 加载 Schema 状态
async function loadSchemaStatus() {
  try {
    const res = await getSchemaStatus();
    if (res?.code === 200) {
      schemaStatus.value = res.data;
    }
  } catch {
    // ignore
  }
}

// 选择表
function handleSelectTable(tableName: string) {
  selectedTable.value = tableName;
  loadSchema(tableName);
}

// 向量化单个表
async function handleVectorizeTable() {
  if (!selectedTable.value) {
    message("请先选择表", { type: "warning" });
    return;
  }

  vectorizing.value = true;
  try {
    const res = await vectorizeSchema(selectedTable.value);
    if (res?.code === 200) {
      message(`表 ${selectedTable.value} 向量化完成`, { type: "success" });
      loadSchemaStatus();
    } else {
      message(res?.message ?? "向量化失败", { type: "error" });
    }
  } catch (e: any) {
    message(e?.message ?? "向量化失败", { type: "error" });
  } finally {
    vectorizing.value = false;
  }
}

// 向量化所有表
async function handleVectorizeAll() {
  vectorizing.value = true;
  try {
    const res = await vectorizeSchema();
    if (res?.code === 200) {
      message("所有表向量化完成", { type: "success" });
      loadSchemaStatus();
    } else {
      message(res?.message ?? "向量化失败", { type: "error" });
    }
  } catch (e: any) {
    message(e?.message ?? "向量化失败", { type: "error" });
  } finally {
    vectorizing.value = false;
  }
}

// 格式化时间
function formatTime(timestamp: number) {
  if (!timestamp) return "未更新";
  return new Date(timestamp).toLocaleString("zh-CN");
}

onMounted(() => {
  loadTables();
  loadSchemaStatus();
});
</script>

<template>
  <div class="schema-container p-4">
    <!-- 状态栏 -->
    <div v-if="schemaStatus" class="status-bar mb-4">
      <div class="status-item">
        <span class="label">已索引表数：</span>
        <span class="value">{{ schemaStatus.cachedTableCount }}</span>
      </div>
      <div class="status-item">
        <span class="label">最后更新：</span>
        <span class="value">{{
          formatTime(schemaStatus.lastVectorizeTime)
        }}</span>
      </div>
      <div class="status-item">
        <span class="label">状态：</span>
        <el-tag
          :type="schemaStatus.needsUpdate ? 'warning' : 'success'"
          size="small"
        >
          {{ schemaStatus.needsUpdate ? "需要更新" : "正常" }}
        </el-tag>
      </div>
      <el-button
        type="primary"
        :loading="vectorizing"
        @click="handleVectorizeAll"
      >
        <el-icon class="mr-1"
          ><IconifyIconOffline icon="ri:refresh-line"
        /></el-icon>
        更新所有表
      </el-button>
    </div>

    <!-- 主内容区 -->
    <div class="schema-content">
      <!-- 左侧表列表 -->
      <el-card class="table-list-card" shadow="never">
        <template #header>
          <div class="flex-bc">
            <span class="font-bold">可用表 ({{ tables.length }})</span>
          </div>
        </template>
        <div class="table-list">
          <div
            v-for="table in tables"
            :key="table"
            :class="['table-item', { active: selectedTable === table }]"
            @click="handleSelectTable(table)"
          >
            <el-icon class="mr-2"
              ><IconifyIconOffline icon="ri:table-line"
            /></el-icon>
            <span>{{ table }}</span>
          </div>
          <el-empty
            v-if="!tables.length"
            description="暂无表"
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
            <el-button
              v-if="schema"
              type="primary"
              size="small"
              :loading="vectorizing"
              @click="handleVectorizeTable"
            >
              <el-icon class="mr-1"
                ><IconifyIconOffline icon="ri:refresh-line"
              /></el-icon>
              更新向量
            </el-button>
          </div>
        </template>

        <template v-if="schema">
          <div v-if="schema.tableComment" class="mb-4 text-gray-500">
            表注释：{{ schema.tableComment }}
          </div>
          <el-table :data="schema.columns" border stripe size="small">
            <el-table-column prop="columnName" label="列名" min-width="120" />
            <el-table-column prop="columnType" label="类型" min-width="100" />
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
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
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

.schema-content {
  display: flex;
  gap: 16px;
  min-height: calc(100vh - 300px);
}

.table-list-card {
  flex-shrink: 0;
  width: 250px;
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
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}
</style>
