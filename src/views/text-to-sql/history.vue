<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import {
  getTextToSqlHistory,
  deleteTextToSqlHistory,
  queryTextToSql,
  type TextToSqlResponse
} from "@/api/text-to-sql";
import SqlViewer from "./components/SqlViewer.vue";
import ChartPanel from "./components/ChartPanel.vue";
import TablePanel from "./components/TablePanel.vue";

defineOptions({ name: "TextToSqlHistory" });

// 历史记录类型
type HistoryItem = {
  id: string;
  question: string;
  generatedSql: string;
  answer: string;
  success: boolean;
  executionTime: number;
  createTime: string;
};

// 状态
const historyList = ref<HistoryItem[]>([]);
const loading = ref(false);
const total = ref(0);
const currentPage = ref(1);
const pageSize = ref(20);

// 详情弹窗
const detailVisible = ref(false);
const detailItem = ref<HistoryItem | null>(null);
const detailResult = ref<TextToSqlResponse | null>(null);
const activeTab = ref("sql");

// 加载历史记录
async function loadHistory() {
  loading.value = true;
  try {
    const res = await getTextToSqlHistory({
      page: currentPage.value,
      size: pageSize.value
    });
    if (res?.code === 200) {
      historyList.value = res.data?.records ?? [];
      total.value = Number(res.data?.total) || 0;
    }
  } catch {
    // ignore
  } finally {
    loading.value = false;
  }
}

// 删除历史记录
async function handleDelete(item: HistoryItem) {
  try {
    await ElMessageBox.confirm(`确定删除该查询记录？`, "警告", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });

    const res = await deleteTextToSqlHistory(item.id);
    if (res?.code === 200) {
      message("删除成功", { type: "success" });
      loadHistory();
    } else {
      message(res?.message ?? "删除失败", { type: "error" });
    }
  } catch {
    // cancelled
  }
}

// 查看详情
function handleViewDetail(item: HistoryItem) {
  detailItem.value = item;
  detailResult.value = {
    question: item.question,
    generatedSql: item.generatedSql,
    data: [],
    chartConfig: null,
    answer: item.answer,
    steps: [],
    success: item.success
  };
  detailVisible.value = true;
  activeTab.value = "sql";
}

// 重新查询
async function handleRequery(item: HistoryItem) {
  loading.value = true;
  try {
    const res = await queryTextToSql({ question: item.question });
    if (res?.code === 200 && res.data) {
      message("查询完成", { type: "success" });
      handleViewDetail({
        ...item,
        generatedSql: res.data.generatedSql,
        answer: res.data.answer,
        success: res.data.success
      });
      loadHistory();
    } else {
      message(res?.message ?? "查询失败", { type: "error" });
    }
  } catch (e: any) {
    message(e?.message ?? "查询失败", { type: "error" });
  } finally {
    loading.value = false;
  }
}

// 页码变化
function handleCurrentChange(val: number) {
  currentPage.value = val;
  loadHistory();
}

// 每页条数变化
function handleSizeChange(val: number) {
  pageSize.value = val;
  currentPage.value = 1;
  loadHistory();
}

// 格式化时间
function formatTime(time: string) {
  if (!time) return "-";
  return new Date(time).toLocaleString("zh-CN");
}

// 格式化耗时
function formatDuration(ms: number) {
  if (!ms) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function copySql(sql: string) {
  navigator.clipboard.writeText(sql);
  message("已复制", { type: "success" });
}

onMounted(() => {
  loadHistory();
});
</script>

<template>
  <div class="history-container p-4">
    <el-card shadow="never">
      <template #header>
        <div class="flex-bc">
          <span class="font-bold text-lg">查询历史</span>
          <el-button
            :icon="useRenderIcon('ri:refresh-line')"
            @click="loadHistory"
          >
            刷新
          </el-button>
        </div>
      </template>

      <!-- 历史列表 -->
      <el-table
        v-loading="loading"
        :data="historyList"
        border
        stripe
        max-height="calc(100vh - 300px)"
      >
        <el-table-column
          prop="question"
          label="问题"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column
          prop="generatedSql"
          label="SQL"
          min-width="200"
          show-overflow-tooltip
        />
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'" size="small">
              {{ row.success ? "成功" : "失败" }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="耗时" width="80" align="center">
          <template #default="{ row }">
            {{ formatDuration(row.executionTime) }}
          </template>
        </el-table-column>
        <el-table-column label="时间" width="160" align="center">
          <template #default="{ row }">
            {{ formatTime(row.createTime) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              size="small"
              @click="handleViewDetail(row)"
            >
              <el-icon class="mr-1"
                ><IconifyIconOffline icon="ri:eye-line"
              /></el-icon>
              查看
            </el-button>
            <el-button
              link
              type="success"
              size="small"
              @click="handleRequery(row)"
            >
              <el-icon class="mr-1"
                ><IconifyIconOffline icon="ri:restart-line"
              /></el-icon>
              重查
            </el-button>
            <el-button
              link
              type="danger"
              size="small"
              @click="handleDelete(row)"
            >
              <el-icon class="mr-1"
                ><IconifyIconOffline icon="ri:delete-bin-line"
              /></el-icon>
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="flex justify-end mt-4">
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
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailVisible"
      title="查询详情"
      width="900px"
      destroy-on-close
    >
      <template v-if="detailItem">
        <!-- 问题 -->
        <div class="detail-section">
          <div class="section-label">问题</div>
          <div class="section-content">{{ detailItem.question }}</div>
        </div>

        <!-- SQL -->
        <div class="detail-section">
          <div class="section-label">
            生成的 SQL
            <el-button
              link
              type="primary"
              size="small"
              class="ml-2"
              @click="copySql(detailItem.generatedSql)"
            >
              复制
            </el-button>
          </div>
          <SqlViewer :sql="detailItem.generatedSql" />
        </div>

        <!-- 图表/表格 -->
        <el-tabs v-model="activeTab" class="detail-tabs">
          <el-tab-pane label="图表" name="chart">
            <ChartPanel
              v-if="detailResult?.chartConfig"
              :config="detailResult.chartConfig"
            />
            <el-empty v-else description="暂无图表数据" :image-size="60" />
          </el-tab-pane>
          <el-tab-pane label="表格" name="table">
            <TablePanel
              v-if="detailResult?.data?.length"
              :data="detailResult.data"
            />
            <el-empty v-else description="暂无表格数据" :image-size="60" />
          </el-tab-pane>
        </el-tabs>

        <!-- 答案 -->
        <div v-if="detailItem.answer" class="detail-section">
          <div class="section-label">分析结果</div>
          <div class="section-content answer">{{ detailItem.answer }}</div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.detail-section {
  margin-bottom: 16px;
}

.section-label {
  margin-bottom: 8px;
  font-weight: bold;
  color: var(--el-text-color-primary);
}

.section-content {
  padding: 12px;
  line-height: 1.6;
  background: var(--el-fill-color-lighter);
  border-radius: 6px;
}

.section-content.answer {
  white-space: pre-wrap;
}

.detail-tabs {
  margin-bottom: 16px;
}
</style>
