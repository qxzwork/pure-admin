<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message } from "@/utils/message";
import {
  getTableSchema,
  vectorizeSchema,
  getSchemaStatus,
  type SchemaInfo,
  type SchemaStatus
} from "@/api/text-to-sql";

const props = defineProps({
  tables: {
    type: Array as () => string[],
    required: true
  }
});

const emit = defineEmits(["vectorize"]);

const selectedTable = ref("");
const schema = ref<SchemaInfo | null>(null);
const schemaStatus = ref<SchemaStatus | null>(null);
const loading = ref(false);
const vectorizing = ref(false);

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
      emit("vectorize", selectedTable.value);
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
      emit("vectorize");
    } else {
      message(res?.message ?? "向量化失败", { type: "error" });
    }
  } catch (e: any) {
    message(e?.message ?? "向量化失败", { type: "error" });
  } finally {
    vectorizing.value = false;
  }
}

// 选择表
function handleSelectTable(tableName: string) {
  selectedTable.value = tableName;
  loadSchema(tableName);
}

// 格式化时间
function formatTime(timestamp: number) {
  if (!timestamp) return "未更新";
  return new Date(timestamp).toLocaleString("zh-CN");
}

onMounted(() => {
  loadSchemaStatus();
});
</script>

<template>
  <div class="schema-panel">
    <!-- 状态信息 -->
    <div v-if="schemaStatus" class="status-bar">
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
        size="small"
        :loading="vectorizing"
        @click="handleVectorizeAll"
      >
        <el-icon class="mr-1"
          ><IconifyIconOffline icon="ri:refresh-line"
        /></el-icon>
        更新所有表
      </el-button>
    </div>

    <!-- 表列表和详情 -->
    <div class="schema-content">
      <!-- 左侧表列表 -->
      <div class="table-list">
        <div class="list-header">
          <span class="font-bold">可用表 ({{ tables.length }})</span>
        </div>
        <div class="list-body">
          <div
            v-for="table in tables"
            :key="table"
            :class="['table-item', { active: selectedTable === table }]"
            @click="handleSelectTable(table)"
          >
            <el-icon class="mr-1"
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
      </div>

      <!-- 右侧表详情 -->
      <div class="table-detail">
        <template v-if="schema">
          <div class="detail-header">
            <div>
              <span class="font-bold text-lg">{{ schema.tableName }}</span>
              <span v-if="schema.tableComment" class="ml-2 text-gray-500">
                ({{ schema.tableComment }})
              </span>
            </div>
            <el-button
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

          <el-table
            :data="schema.columns"
            border
            stripe
            size="small"
            max-height="400"
          >
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

.schema-content {
  display: flex;
  gap: 16px;
  min-height: 400px;
}

.table-list {
  flex-shrink: 0;
  width: 200px;
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
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
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

.loading-container {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}
</style>
