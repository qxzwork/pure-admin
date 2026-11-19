<script setup lang="ts">
import { ref, reactive, nextTick, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import {
  queryTextToSql,
  getTextToSqlTables,
  getSchemaStatus,
  type TextToSqlResponse,
  type QueryHistory,
  type SchemaStatus
} from "@/api/text-to-sql";
import SqlViewer from "./components/SqlViewer.vue";
import ChartPanel from "./components/ChartPanel.vue";
import TablePanel from "./components/TablePanel.vue";
import SchemaPanel from "./components/SchemaPanel.vue";
import { formatTime } from "./utils/schema";

defineOptions({ name: "TextToSql" });

// 状态
const question = ref("");
const loading = ref(false);
const currentResult = ref<TextToSqlResponse | null>(null);
const history = ref<QueryHistory[]>([]);
const tables = ref<string[]>([]);
const schemaStatus = ref<SchemaStatus | null>(null);
const showSchemaPanel = ref(false);
const chatContainerRef = ref<HTMLElement | null>(null);
const activeTab = ref("chart");

// 生成会话 ID
const conversationId = ref(crypto.randomUUID());

function now(): string {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
    }
  });
}

// 发送查询
async function sendQuestion() {
  const text = question.value.trim();
  if (!text || loading.value) return;

  question.value = "";
  loading.value = true;
  currentResult.value = null;

  try {
    const res = await queryTextToSql({
      question: text,
      conversationId: conversationId.value
    });

    if (res?.code === 200 && res.data) {
      currentResult.value = res.data;

      // 添加到历史记录
      history.value.unshift({
        id: crypto.randomUUID(),
        question: text,
        sql: res.data.generatedSql,
        time: now(),
        success: res.data.success
      });

      // 自动切换到合适的 tab
      if (res.data.chartConfig) {
        if (res.data.chartConfig.type === "table") {
          activeTab.value = "table";
        } else {
          activeTab.value = "chart";
        }
      }
    } else {
      message(res?.message ?? "查询失败", { type: "error" });
    }
  } catch (e: any) {
    message(e?.message ?? "查询失败", { type: "error" });
  } finally {
    loading.value = false;
    scrollToBottom();
  }
}

// 处理回车
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendQuestion();
  }
}

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

// 更新向量（Schema 面板内触发，完成后同步刷新侧边栏状态）
async function handleSchemaUpdated() {
  await Promise.all([loadSchemaStatus(), loadTables()]);
}

// 清空历史
function clearHistory() {
  history.value = [];
  currentResult.value = null;
  conversationId.value = crypto.randomUUID();
}

// 点击历史记录
function handleClickHistory(item: QueryHistory) {
  question.value = item.question;
}

// 复制 SQL
function copySQL(sql: string) {
  navigator.clipboard.writeText(sql);
  message("已复制到剪贴板", { type: "success" });
}

onMounted(() => {
  loadTables();
  loadSchemaStatus();
});
</script>

<template>
  <div class="text-to-sql-container">
    <!-- 左侧面板 -->
    <div class="text-to-sql-sidebar">
      <div class="btn-group mb-3">
        <el-button
          type="primary"
          class="w-full"
          :icon="useRenderIcon('ri/chat-new-line')"
          @click="clearHistory"
        >
          新查询
        </el-button>

        <el-button
          class="w-full"
          :icon="useRenderIcon('ri/database-2-line')"
          @click="showSchemaPanel = true"
        >
          Schema 管理
        </el-button>
      </div>

      <!-- Schema 状态 -->
      <div v-if="schemaStatus" class="mb-3 p-2 bg-gray-50 rounded text-xs">
        <div class="flex justify-between mb-1">
          <span>已索引 / 总数：</span>
          <span>
            {{ schemaStatus.indexedCount }} / {{ schemaStatus.tableCount }}
          </span>
        </div>
        <div
          v-if="schemaStatus.failedCount > 0"
          class="flex justify-between mb-1"
        >
          <span>失败：</span>
          <span class="text-red-500">{{ schemaStatus.failedCount }}</span>
        </div>
        <div class="flex justify-between mb-1">
          <span>最后同步：</span>
          <span class="text-gray-500">{{
            formatTime(schemaStatus.lastSyncTime)
          }}</span>
        </div>
        <div class="flex justify-between">
          <span>状态：</span>
          <el-tag v-if="schemaStatus.running" type="primary" size="small">
            同步中
          </el-tag>
          <el-tag
            v-else
            :type="schemaStatus.needsUpdate ? 'warning' : 'success'"
            size="small"
          >
            {{ schemaStatus.needsUpdate ? "需要更新" : "正常" }}
          </el-tag>
        </div>
      </div>

      <!-- 历史记录 -->
      <div class="flex flex-col flex-1 overflow-hidden">
        <div class="text-sm font-bold mb-2">查询历史</div>
        <div class="flex-1 overflow-auto">
          <div
            v-for="item in history"
            :key="item.id"
            class="history-item"
            @click="handleClickHistory(item)"
          >
            <div class="flex items-center gap-1 mb-1">
              <el-icon
                :class="item.success ? 'text-green-500' : 'text-red-500'"
              >
                <component
                  :is="item.success ? 'ri:check-line' : 'ri:close-line'"
                />
              </el-icon>
              <span class="text-xs text-gray-400">{{ item.time }}</span>
            </div>
            <div class="text-sm truncate">{{ item.question }}</div>
          </div>
          <el-empty
            v-if="!history.length"
            description="暂无查询历史"
            :image-size="60"
          />
        </div>
      </div>
    </div>

    <!-- 右侧面板 -->
    <div class="text-to-sql-main">
      <!-- 结果展示区 -->
      <div ref="chatContainerRef" class="text-to-sql-result">
        <!-- 欢迎页 -->
        <div v-if="!currentResult && !loading" class="welcome-page">
          <div class="text-center">
            <div class="text-4xl mb-4">🔍</div>
            <h2 class="text-xl font-bold mb-2">Text-to-SQL 智能查询</h2>
            <p class="text-gray-500 mb-6">
              用自然语言提问，自动生成 SQL 并可视化结果
            </p>
            <div class="example-questions">
              <div class="text-sm font-bold mb-2">示例问题：</div>
              <div class="flex flex-wrap gap-2">
                <el-tag
                  v-for="q in [
                    '查询所有用户的数量',
                    '统计每个城市的订单数量',
                    '最近7天的销售额趋势',
                    '查询销售额最高的10个产品'
                  ]"
                  :key="q"
                  class="cursor-pointer"
                  @click="question = q"
                >
                  {{ q }}
                </el-tag>
              </div>
            </div>
          </div>
        </div>

        <!-- 加载中 -->
        <div v-if="loading" class="loading-state">
          <el-icon class="is-loading text-2xl text-blue-500">
            <IconifyIconOffline icon="ri:loader-4-line" />
          </el-icon>
          <span class="ml-2">正在分析问题并生成 SQL...</span>
        </div>

        <!-- 结果展示 -->
        <div v-if="currentResult && !loading" class="result-container">
          <!-- SQL 展示 -->
          <div class="result-section">
            <div class="section-header">
              <span class="font-bold">生成的 SQL</span>
              <el-button
                link
                type="primary"
                size="small"
                @click="copySQL(currentResult.generatedSql)"
              >
                <el-icon class="mr-1"
                  ><IconifyIconOffline icon="ri:file-copy-line"
                /></el-icon>
                复制
              </el-button>
            </div>
            <SqlViewer :sql="currentResult.generatedSql" />
          </div>

          <!-- 步骤展示 -->
          <div v-if="currentResult.steps?.length" class="result-section">
            <div class="section-header">
              <span class="font-bold">执行步骤</span>
            </div>
            <div class="steps-list">
              <div
                v-for="(step, index) in currentResult.steps"
                :key="index"
                class="step-item"
              >
                <el-icon class="text-blue-500">
                  <IconifyIconOffline icon="ri:arrow-right-s-line" />
                </el-icon>
                <span>{{ step }}</span>
              </div>
            </div>
          </div>

          <!-- 图表/表格切换 -->
          <div class="result-section">
            <el-tabs v-model="activeTab" class="result-tabs">
              <el-tab-pane label="图表" name="chart">
                <ChartPanel
                  v-if="currentResult.chartConfig"
                  :config="currentResult.chartConfig"
                />
                <el-empty v-else description="暂无图表数据" :image-size="80" />
              </el-tab-pane>
              <el-tab-pane label="表格" name="table">
                <TablePanel
                  v-if="currentResult.data?.length"
                  :data="currentResult.data"
                />
                <el-empty v-else description="暂无表格数据" :image-size="80" />
              </el-tab-pane>
            </el-tabs>
          </div>

          <!-- 文字答案 -->
          <div v-if="currentResult.answer" class="result-section">
            <div class="section-header">
              <span class="font-bold">分析结果</span>
            </div>
            <div class="answer-content">
              {{ currentResult.answer }}
            </div>
          </div>

          <!-- 错误信息 -->
          <div
            v-if="!currentResult.success && currentResult.error"
            class="error-section"
          >
            <el-alert
              :title="currentResult.error"
              type="error"
              show-icon
              :closable="false"
            />
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="text-to-sql-input">
        <el-input
          v-model="question"
          type="textarea"
          :rows="1"
          autosize
          placeholder="输入自然语言问题，例如：查询所有用户的数量"
          :disabled="loading"
          @keydown="handleKeydown"
        />
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/send-plane-fill')"
          :loading="loading"
          @click="sendQuestion"
        >
          查询
        </el-button>
      </div>
    </div>

    <!-- Schema 管理弹窗 -->
    <el-dialog
      v-model="showSchemaPanel"
      title="Schema 管理"
      width="800px"
      destroy-on-close
    >
      <SchemaPanel @updated="handleSchemaUpdated" />
    </el-dialog>
  </div>
</template>

<style scoped>
.text-to-sql-container {
  position: fixed;
  inset: 82px 0 0 210px;
  display: flex;
  background: var(--el-bg-color);
}

.text-to-sql-sidebar {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 250px;
  padding: 12px;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color);
}

.btn-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.btn-group :deep(.el-button + .el-button) {
  margin-left: 0;
}

.text-to-sql-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.text-to-sql-result {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

.text-to-sql-input {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: flex-end;
  padding: 12px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color);
}

.history-item {
  padding: 8px;
  margin-bottom: 4px;
  cursor: pointer;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.history-item:hover {
  background: var(--el-fill-color-light);
}

.welcome-page {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.result-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.result-section {
  overflow: hidden;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.steps-list {
  padding: 12px 16px;
}

.step-item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.answer-content {
  padding: 16px;
  line-height: 1.8;
  white-space: pre-wrap;
}

.error-section {
  padding: 16px;
}

:deep(.result-tabs) {
  .el-tabs__header {
    padding: 0 16px;
    margin: 0;
    background: var(--el-fill-color-light);
  }

  .el-tabs__content {
    padding: 16px;
  }
}

.example-questions {
  max-width: 400px;
  margin: 0 auto;
}
</style>
