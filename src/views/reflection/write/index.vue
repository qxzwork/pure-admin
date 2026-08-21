<script setup lang="ts">
import { ref, reactive, nextTick, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { getToken, formatToken } from "@/utils/auth";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { Delete } from "@element-plus/icons-vue";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import type {
  WritingRequest,
  WritingResponse,
  ReflectionHistory,
  SectionProgress
} from "@/api/reflection";
import {
  getAllReflectionHistory,
  deleteReflectionHistory
} from "@/api/reflection";

defineOptions({ name: "ReflectionWrite" });

marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code: string, lang: string) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    }
  })
);

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(content: string): string {
  if (!content) return "";
  return marked.parse(content) as string;
}

function now(): string {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatDuration(ms?: number): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m${s % 60}s`;
}

function statusLabel(status?: number): string {
  if (status === 1) return "达标";
  if (status === 2) return "超限兜底";
  if (status === 0) return "执行中";
  return "";
}

function statusType(
  status?: number
): "primary" | "success" | "warning" | "info" {
  if (status === 1) return "success";
  if (status === 2) return "warning";
  return "info";
}

// ==================== 状态 ====================

const topic = ref("");
const requirements = ref("");
const maxIterations = ref<number | undefined>(undefined);
const scoreThreshold = ref<number | undefined>(undefined);
const contentType = ref<"article" | "novel">("article");
const stylePreset = ref<"popular_story" | "suspense" | "custom">(
  "popular_story"
);
const targetWordCount = ref<number | undefined>(undefined);
const customStyle = ref("");
const sending = ref(false);
const showTimeline = ref(true);
const resultContainerRef = ref<HTMLElement | null>(null);

const result = reactive<WritingResponse>({
  conversationId: undefined,
  topic: undefined,
  outline: undefined,
  finalArticle: undefined,
  score: undefined,
  feedback: undefined,
  iterations: undefined,
  status: undefined,
  iterationDetails: [],
  finished: false,
  currentNode: undefined,
  errorMessage: undefined,
  durationMs: undefined,
  contentType: undefined,
  stylePreset: undefined,
  writingStyle: undefined,
  totalSections: undefined,
  currentSection: undefined,
  antiAiScore: undefined,
  consistencyScore: undefined,
  progressPercent: undefined,
  stageLabel: undefined,
  stageDetail: undefined,
  estimatedRemainingMs: undefined,
  completedSections: undefined,
  sectionProgressList: undefined
});

const historyList = ref<
  {
    id: number;
    conversationId: string;
    topic: string;
    score?: number;
    status?: number;
    contentType?: string;
  }[]
>([]);

// ==================== 工具函数 ====================

function scrollToResult() {
  nextTick(() => {
    if (resultContainerRef.value) {
      resultContainerRef.value.scrollTop =
        resultContainerRef.value.scrollHeight;
    }
  });
}

function resetResult() {
  result.conversationId = undefined;
  result.topic = undefined;
  result.outline = undefined;
  result.finalArticle = undefined;
  result.score = undefined;
  result.feedback = undefined;
  result.iterations = undefined;
  result.status = undefined;
  result.iterationDetails = [];
  result.finished = false;
  result.currentNode = undefined;
  result.errorMessage = undefined;
  result.durationMs = undefined;
  result.contentType = undefined;
  result.stylePreset = undefined;
  result.writingStyle = undefined;
  result.totalSections = undefined;
  result.currentSection = undefined;
  result.antiAiScore = undefined;
  result.consistencyScore = undefined;
  result.progressPercent = undefined;
  result.stageLabel = undefined;
  result.stageDetail = undefined;
  result.estimatedRemainingMs = undefined;
  result.completedSections = undefined;
  result.sectionProgressList = undefined;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  const token = getToken()?.token;
  if (token) headers["Authorization"] = formatToken(token);
  return headers;
}

// ==================== 核心：流式写作 ====================

function startWriting() {
  const t = topic.value.trim();
  if (!t || sending.value) return;

  resetResult();
  sending.value = true;
  result.topic = t;
  result.status = 0;

  const body: WritingRequest = { topic: t };
  if (requirements.value.trim()) body.requirements = requirements.value.trim();
  if (maxIterations.value) body.maxIterations = maxIterations.value;
  if (scoreThreshold.value) body.scoreThreshold = scoreThreshold.value;
  body.contentType = contentType.value;
  body.stylePreset = stylePreset.value;
  if (targetWordCount.value) body.targetWordCount = targetWordCount.value;
  if (customStyle.value.trim()) body.customStyle = customStyle.value.trim();

  console.log("[SSE] 发送请求:", body.topic);
  fetch("/api/reflection/write/stream", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  })
    .then(response => {
      console.log(
        "[SSE] 收到响应: status=" +
          response.status +
          ", body=" +
          !!response.body +
          ", type=" +
          response.headers.get("content-type")
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) {
        console.error("[SSE] response.body 为空，无法读取流");
        result.errorMessage = "响应流不可用，请使用同步模式";
        result.finished = true;
        sending.value = false;
        return;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let chunkCount = 0;

      function read() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              console.log("[SSE] 流结束, chunkCount=" + chunkCount);
              result.finished = true;
              sending.value = false;
              loadHistory();
              scrollToResult();
              return;
            }

            chunkCount++;
            const raw = decoder.decode(value, { stream: true });
            console.log(
              "[SSE] chunk #" +
                chunkCount +
                ", 长度=" +
                raw.length +
                ", 内容=" +
                raw.substring(0, 200)
            );
            buffer += raw;
            const lines = buffer.split("\n");
            buffer = lines.pop()!;

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data:")) continue;
              const dataStr = trimmed.slice(5).trim();
              if (!dataStr) continue;

              try {
                const data: WritingResponse = JSON.parse(dataStr);
                console.log(
                  "[SSE] 解析成功:",
                  data.currentNode,
                  data.progressPercent + "%",
                  data.stageLabel
                );
                applyUpdate(data);
              } catch (e) {
                console.error(
                  "[SSE] JSON解析失败:",
                  e,
                  "raw:",
                  dataStr.substring(0, 200)
                );
              }
            }
            read();
          })
          .catch(readErr => {
            console.error("[SSE] reader.read() 异常:", readErr);
          });
      }
      read();
    })
    .catch(error => {
      console.error("[SSE] fetch 请求失败:", error);
      result.errorMessage = "连接失败，请稍后重试";
      result.finished = true;
      sending.value = false;
      scrollToResult();
    });
}

function applyUpdate(data: WritingResponse) {
  if (data.conversationId) result.conversationId = data.conversationId;
  if (data.topic) result.topic = data.topic;
  if (data.currentNode) result.currentNode = data.currentNode;
  if (data.outline) result.outline = data.outline;
  if (data.finalArticle) result.finalArticle = data.finalArticle;
  if (data.score !== undefined && data.score !== null)
    result.score = data.score;
  if (data.feedback) result.feedback = data.feedback;
  if (data.iterations !== undefined && data.iterations !== null)
    result.iterations = data.iterations;
  if (data.status !== undefined && data.status !== null)
    result.status = data.status;
  if (data.iterationDetails?.length)
    result.iterationDetails = data.iterationDetails;
  if (data.durationMs !== undefined && data.durationMs !== null)
    result.durationMs = data.durationMs;
  if (data.errorMessage) result.errorMessage = data.errorMessage;
  if (data.finished) result.finished = data.finished;
  if (data.contentType) result.contentType = data.contentType;
  if (data.stylePreset) result.stylePreset = data.stylePreset;
  if (data.writingStyle) result.writingStyle = data.writingStyle;
  if (data.totalSections !== undefined && data.totalSections !== null)
    result.totalSections = data.totalSections;
  if (data.currentSection !== undefined && data.currentSection !== null)
    result.currentSection = data.currentSection;
  if (data.antiAiScore !== undefined && data.antiAiScore !== null)
    result.antiAiScore = data.antiAiScore;
  if (data.consistencyScore !== undefined && data.consistencyScore !== null)
    result.consistencyScore = data.consistencyScore;
  // 进度字段 - 直接赋值，不做严格判断
  if (data.progressPercent !== undefined)
    result.progressPercent = data.progressPercent;
  if (data.stageLabel !== undefined) result.stageLabel = data.stageLabel;
  if (data.stageDetail !== undefined) result.stageDetail = data.stageDetail;
  if (data.estimatedRemainingMs !== undefined)
    result.estimatedRemainingMs = data.estimatedRemainingMs;
  if (data.completedSections !== undefined)
    result.completedSections = data.completedSections;
  if (data.sectionProgressList)
    result.sectionProgressList = data.sectionProgressList;
  scrollToResult();
}

// ==================== 同步写作（备用） ====================

function startWritingSync() {
  const t = topic.value.trim();
  if (!t || sending.value) return;

  resetResult();
  sending.value = true;
  result.topic = t;
  result.status = 0;

  const body: WritingRequest = { topic: t };
  if (requirements.value.trim()) body.requirements = requirements.value.trim();
  if (maxIterations.value) body.maxIterations = maxIterations.value;
  if (scoreThreshold.value) body.scoreThreshold = scoreThreshold.value;

  fetch("/api/reflection/write", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  })
    .then(async response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const res = await response.json();
      if (res.code === 200 && res.data) {
        Object.assign(result, res.data, { finished: true });
      } else {
        result.errorMessage = res.message || "写作失败";
      }
    })
    .catch(() => {
      result.errorMessage = "请求失败，请稍后重试";
    })
    .finally(() => {
      result.finished = true;
      sending.value = false;
      loadHistory();
      scrollToResult();
    });
}

// ==================== 历史记录 ====================

async function loadAllHistory() {
  try {
    const res = await getAllReflectionHistory();
    if (res.code === 200 && res.data?.length) {
      historyList.value = res.data.map(item => ({
        id: item.id,
        conversationId: item.conversationId,
        topic: item.topic,
        score: item.score,
        status: item.status,
        contentType: item.contentType
      }));
    }
  } catch {
    // ignore
  }
}

async function loadHistory() {
  if (!result.conversationId) return;
  try {
    const resp = await fetch(
      `/api/reflection/history/${result.conversationId}`,
      { headers: getAuthHeaders() }
    );
    const res = await resp.json();
    if (res.code === 200 && res.data?.length) {
      const item = res.data[0];
      const exists = historyList.value.find(
        h => h.conversationId === item.conversationId
      );
      if (!exists) {
        historyList.value.unshift({
          id: item.id,
          conversationId: item.conversationId,
          topic: item.topic,
          score: item.score,
          status: item.status,
          contentType: item.contentType
        });
      }
    }
  } catch {
    // ignore
  }
}

async function loadHistoryDetail(conversationId: string) {
  try {
    const resp = await fetch(`/api/reflection/history/${conversationId}`, {
      headers: getAuthHeaders()
    });
    const res = await resp.json();
    if (res.code === 200 && res.data?.length) {
      const item = res.data[0];
      resetResult();
      result.conversationId = item.conversationId;
      result.topic = item.topic;
      result.outline = item.outline;
      result.finalArticle = item.finalArticle;
      result.score = item.score;
      result.feedback = item.feedback;
      result.iterations = item.iterations;
      result.status = item.status;
      result.durationMs = item.durationMs;
      result.contentType = item.contentType;
      result.stylePreset = item.stylePreset;
      result.writingStyle = item.writingStyle;
      result.totalSections = item.totalSections;
      result.antiAiScore = item.antiAiScore;
      result.consistencyScore = item.consistencyScore;
      result.finished = true;
    }
  } catch {
    // ignore
  }
}

async function handleDeleteHistory(id: number) {
  try {
    await ElMessageBox.confirm("确定删除该写作记录？", "警告", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });

    await deleteReflectionHistory(id);

    historyList.value = historyList.value.filter(h => h.id !== id);
    message("删除成功", { type: "success" });
  } catch {
    // cancelled or failed
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && e.ctrlKey) {
    e.preventDefault();
    startWriting();
  }
}

const examplePrompts = [
  {
    icon: "ri/article-line",
    text: "写一篇关于人工智能在教育领域应用前景的文章"
  },
  {
    icon: "ri-lightbulb-line",
    text: "分析远程办公对现代企业文化的影响"
  },
  {
    icon: "ri-book-open-line",
    text: "探讨可持续发展与绿色经济的关系"
  },
  {
    icon: "ri-quill-pen-line",
    text: "撰写一篇关于数字化转型的行业洞察"
  }
];

function fillTopic(text: string) {
  topic.value = text;
}

function handleNewWrite() {
  resetResult();
  topic.value = "";
  requirements.value = "";
  maxIterations.value = undefined;
  scoreThreshold.value = undefined;
  contentType.value = "article";
  stylePreset.value = "popular_story";
  targetWordCount.value = undefined;
  customStyle.value = "";
}

onMounted(() => {
  loadAllHistory();
});
</script>

<template>
  <div class="reflection-container">
    <!-- 左侧边栏 -->
    <div class="reflection-sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M12 2a7 7 0 0 1 7 7v1a7 7 0 0 1-7 7 7 7 0 0 1-7-7v-1a7 7 0 0 1 7-7z"
            />
            <path d="M12 17v4" />
            <path d="M8 21h8" />
            <circle cx="9" cy="9" r="1" fill="currentColor" />
            <circle cx="15" cy="9" r="1" fill="currentColor" />
            <path d="M9.5 13a3.5 3.5 0 0 0 5 0" />
          </svg>
        </div>
        <span class="brand-text">反思写作</span>
      </div>

      <button class="new-write-btn" @click="handleNewWrite">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>新写作</span>
      </button>

      <div class="sidebar-history">
        <div class="history-label">历史记录</div>
        <div class="history-list">
          <div
            v-for="item in historyList"
            :key="item.conversationId"
            class="history-item"
            :class="{ active: result.conversationId === item.conversationId }"
            @click="loadHistoryDetail(item.conversationId)"
          >
            <svg
              class="hist-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
              />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <div class="hist-info">
              <span class="hist-title">{{ item.topic }}</span>
            </div>
            <el-tag
              v-if="item.contentType === 'novel'"
              size="small"
              type="primary"
              class="hist-type"
            >
              小说
            </el-tag>
            <el-tag
              v-if="item.score !== undefined"
              size="small"
              :type="statusType(item.status)"
              class="hist-score"
            >
              {{ item.score }}
            </el-tag>
            <button
              class="hist-delete"
              title="删除"
              @click.stop="handleDeleteHistory(item.id)"
            >
              <Delete />
            </button>
          </div>
          <div v-if="historyList.length === 0" class="history-empty">
            暂无历史记录
          </div>
        </div>
      </div>

      <div class="sidebar-settings">
        <div class="setting-item">
          <el-switch v-model="showTimeline" size="small" />
          <span class="setting-text">显示迭代过程</span>
        </div>
      </div>
    </div>

    <!-- 右侧主区域 -->
    <div class="reflection-main">
      <!-- 欢迎态：输入居中 + 示例 -->
      <div v-if="!result.topic && !sending" class="welcome-view">
        <div class="welcome-content">
          <div class="welcome-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                d="M12 2a7 7 0 0 1 7 7v1a7 7 0 0 1-7 7 7 7 0 0 1-7-7v-1a7 7 0 0 1 7-7z"
              />
              <path d="M12 17v4" />
              <path d="M8 21h8" />
              <circle cx="9" cy="9" r="1" fill="currentColor" />
              <circle cx="15" cy="9" r="1" fill="currentColor" />
              <path d="M9.5 13a3.5 3.5 0 0 0 5 0" />
            </svg>
          </div>
          <h1 class="welcome-title">反思循环写作</h1>
          <p class="welcome-desc">
            输入主题，AI 通过多轮迭代反思自动优化文章质量
          </p>

          <div class="welcome-input-area">
            <div class="welcome-input-box">
              <el-input
                v-model="topic"
                type="textarea"
                :rows="3"
                placeholder="请输入写作主题，例如：写一篇关于人工智能在教育领域应用的文章"
                class="topic-input"
                :disabled="sending"
                @keydown="handleKeydown"
              />
              <div class="welcome-input-footer">
                <el-popover
                  placement="top-start"
                  :width="400"
                  trigger="click"
                  popper-class="warm-popover"
                >
                  <template #reference>
                    <el-button
                      text
                      size="small"
                      :icon="useRenderIcon('ri/settings-3-line')"
                    >
                      高级选项
                    </el-button>
                  </template>
                  <div class="popover-fields">
                    <div class="field-item">
                      <label class="field-label">内容类型</label>
                      <el-radio-group v-model="contentType">
                        <el-radio value="article">文章</el-radio>
                        <el-radio value="novel">小说</el-radio>
                      </el-radio-group>
                    </div>
                    <div class="field-item">
                      <label class="field-label">风格预设</label>
                      <el-select v-model="stylePreset" style="width: 100%">
                        <el-option label="热门故事" value="popular_story" />
                        <el-option label="悬疑" value="suspense" />
                        <el-option label="自定义" value="custom" />
                      </el-select>
                    </div>
                    <div v-if="stylePreset === 'custom'" class="field-item">
                      <label class="field-label">自定义风格描述</label>
                      <el-input
                        v-model="customStyle"
                        type="textarea"
                        :rows="2"
                        placeholder="描述你想要的写作风格..."
                      />
                    </div>
                    <div class="field-item">
                      <label class="field-label">目标字数</label>
                      <el-input-number
                        v-model="targetWordCount"
                        :min="1000"
                        :max="100000"
                        :step="1000"
                        placeholder="默认 10000"
                        controls-position="right"
                        style="width: 100%"
                      />
                    </div>
                    <div class="field-item">
                      <label class="field-label">写作要求 / 风格</label>
                      <el-input
                        v-model="requirements"
                        type="textarea"
                        :rows="2"
                        placeholder="例如：学术论文风格，需要引用参考文献"
                      />
                    </div>
                    <div class="field-row">
                      <div class="field-item">
                        <label class="field-label">最大迭代次数</label>
                        <el-input-number
                          v-model="maxIterations"
                          :min="1"
                          :max="10"
                          placeholder="默认"
                          controls-position="right"
                        />
                      </div>
                      <div class="field-item">
                        <label class="field-label">达标分数阈值</label>
                        <el-input-number
                          v-model="scoreThreshold"
                          :min="60"
                          :max="100"
                          :step="5"
                          placeholder="默认"
                          controls-position="right"
                        />
                      </div>
                    </div>
                  </div>
                </el-popover>
                <div class="welcome-actions">
                  <span class="input-hint">Ctrl + Enter</span>
                  <el-button
                    type="primary"
                    class="write-btn"
                    :icon="useRenderIcon('ri/send-plane-fill')"
                    :disabled="!topic.trim()"
                    @click="startWriting"
                  >
                    开始写作
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <div class="example-section">
            <p class="example-label">试试这些主题</p>
            <div class="example-grid">
              <button
                v-for="(ex, i) in examplePrompts"
                :key="i"
                class="example-card"
                @click="fillTopic(ex.text)"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                <span>{{ ex.text }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 结果态：顶部紧凑输入 + 下方滚动结果 -->
      <template v-else>
        <div class="compact-input-bar">
          <el-input
            v-model="topic"
            placeholder="输入新主题..."
            :disabled="sending"
            clearable
            @keydown="handleKeydown"
          >
            <template #prefix>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                style="width: 16px; height: 16px"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </template>
            <template #append>
              <el-button
                type="primary"
                :icon="useRenderIcon('ri/send-plane-fill')"
                :loading="sending"
                :disabled="!topic.trim()"
                @click="startWriting"
              />
            </template>
          </el-input>
        </div>

        <div ref="resultContainerRef" class="results-scroll">
          <div class="results-inner">
            <!-- 完整进度面板 -->
            <div
              v-if="
                sending ||
                (result.progressPercent !== undefined && !result.finished)
              "
              class="progress-panel"
            >
              <!-- 进度条 -->
              <el-progress
                :percentage="result.progressPercent || 0"
                :status="result.finished ? 'success' : undefined"
                :stroke-width="12"
                striped
                :striped-flow="sending"
              />

              <!-- 阶段信息 -->
              <div class="stage-info">
                <span class="stage-label">{{
                  result.stageLabel || "准备中..."
                }}</span>
                <span v-if="result.stageDetail" class="stage-detail">{{
                  result.stageDetail
                }}</span>
              </div>

              <!-- 统计信息 -->
              <div class="progress-stats">
                <div
                  v-if="result.completedSections !== undefined"
                  class="stat-item"
                >
                  <span class="stat-icon">📖</span>
                  <span
                    >已完成 {{ result.completedSections }}/{{
                      result.totalSections || "?"
                    }}
                    章</span
                  >
                </div>
                <div v-if="result.estimatedRemainingMs" class="stat-item">
                  <span class="stat-icon">⏱️</span>
                  <span
                    >预计剩余
                    {{ formatDuration(result.estimatedRemainingMs) }}</span
                  >
                </div>
                <div v-if="result.iterations" class="stat-item">
                  <span class="stat-icon">🔄</span>
                  <span>当前迭代第 {{ result.iterations }} 次</span>
                </div>
              </div>

              <!-- 章节进度列表 -->
              <div
                v-if="result.sectionProgressList?.length"
                class="section-progress-list"
              >
                <div
                  v-for="section in result.sectionProgressList"
                  :key="section.index"
                  class="section-item"
                  :class="section.status"
                >
                  <span class="section-index">{{ section.index + 1 }}</span>
                  <span class="section-title">{{
                    section.title || `第${section.index + 1}章`
                  }}</span>
                  <span v-if="section.score" class="section-score"
                    >{{ section.score }}分</span
                  >
                  <span class="section-status-icon">
                    {{
                      section.status === "completed"
                        ? "✓"
                        : section.status === "writing"
                          ? "✎"
                          : section.status === "evaluating"
                            ? "◎"
                            : "○"
                    }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 执行中指示（简化版，无进度时显示） -->
            <div
              v-if="sending && !result.progressPercent && result.currentNode"
              class="executing-bar"
            >
              <div class="executing-dot" />
              <span>{{ result.currentNode }}</span>
            </div>

            <!-- 加载中（无进度时显示） -->
            <div
              v-if="
                sending &&
                !result.progressPercent &&
                !result.iterationDetails?.length
              "
              class="loading-section"
            >
              <div class="typing-indicator"><span /><span /><span /></div>
              <p class="loading-text">正在执行反思循环...</p>
            </div>

            <!-- 状态摘要 -->
            <el-card
              v-if="
                result.status !== undefined ||
                result.score !== undefined ||
                result.durationMs
              "
              shadow="never"
              class="summary-card"
            >
              <div class="summary-row">
                <div class="summary-left">
                  <el-tag
                    v-if="result.status !== undefined"
                    :type="statusType(result.status)"
                    effect="dark"
                    size="large"
                    round
                  >
                    {{ statusLabel(result.status) }}
                  </el-tag>
                  <span v-if="result.iterations" class="summary-meta">
                    {{ result.iterations }} 轮迭代
                  </span>
                  <el-divider
                    v-if="result.iterations && result.durationMs"
                    direction="vertical"
                  />
                  <span v-if="result.durationMs" class="summary-meta">
                    耗时 {{ formatDuration(result.durationMs) }}
                  </span>
                </div>
                <div v-if="result.score !== undefined" class="summary-score">
                  <span class="score-value">{{ result.score }}</span>
                  <span class="score-unit">分</span>
                </div>
              </div>
              <div
                v-if="
                  result.antiAiScore !== undefined ||
                  result.consistencyScore !== undefined ||
                  (result.totalSections && result.currentSection)
                "
                class="summary-metrics"
              >
                <el-tag
                  v-if="result.antiAiScore !== undefined"
                  :type="
                    result.antiAiScore < 30
                      ? 'success'
                      : result.antiAiScore < 70
                        ? 'warning'
                        : 'danger'
                  "
                  size="small"
                >
                  AIGC检测: {{ result.antiAiScore }}
                </el-tag>
                <el-tag
                  v-if="result.consistencyScore !== undefined"
                  :type="
                    result.consistencyScore > 80
                      ? 'success'
                      : result.consistencyScore > 60
                        ? 'warning'
                        : 'danger'
                  "
                  size="small"
                >
                  一致性: {{ result.consistencyScore }}
                </el-tag>
                <el-tag
                  v-if="result.totalSections && result.currentSection"
                  type="info"
                  size="small"
                >
                  章节: {{ result.currentSection }}/{{ result.totalSections }}
                </el-tag>
              </div>
            </el-card>

            <!-- 错误 -->
            <el-alert
              v-if="result.errorMessage"
              :title="result.errorMessage"
              type="error"
              show-icon
              :closable="false"
              style="margin-bottom: 16px"
            />

            <!-- 迭代时间线 -->
            <el-card
              v-if="showTimeline && result.iterationDetails?.length"
              shadow="never"
              class="section-card"
            >
              <template #header>
                <div class="card-header">
                  <span>迭代过程</span>
                  <el-tag size="small" type="info"
                    >{{ result.iterationDetails.length }} 轮</el-tag
                  >
                </div>
              </template>
              <el-timeline>
                <el-timeline-item
                  v-for="item in result.iterationDetails"
                  :key="item.round"
                  :type="item.score >= 90 ? 'success' : 'warning'"
                  :hollow="true"
                  :size="'large'"
                  :timestamp="`第 ${item.round} 轮 — ${item.score} 分`"
                  placement="top"
                >
                  <p v-if="item.feedback" class="timeline-feedback">
                    {{ item.feedback }}
                  </p>
                </el-timeline-item>
              </el-timeline>
            </el-card>

            <!-- 大纲 -->
            <el-card v-if="result.outline" shadow="never" class="section-card">
              <template #header>
                <div class="card-header">
                  <span>大纲</span>
                </div>
              </template>
              <div
                class="markdown-body"
                v-html="renderMarkdown(result.outline)"
              />
            </el-card>

            <!-- 最终文章 -->
            <el-card
              v-if="result.finalArticle"
              shadow="never"
              class="section-card article-card"
            >
              <template #header>
                <div class="card-header">
                  <span>最终文章</span>
                </div>
              </template>
              <article
                class="markdown-body article-content"
                v-html="renderMarkdown(result.finalArticle)"
              />
            </el-card>

            <!-- 评估反馈 -->
            <el-card
              v-if="result.feedback && result.finished"
              shadow="never"
              class="section-card"
            >
              <template #header>
                <div class="card-header">
                  <span>评估反馈</span>
                </div>
              </template>
              <div
                class="markdown-body"
                v-html="renderMarkdown(result.feedback)"
              />
            </el-card>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ========== 布局 ========== */
.reflection-container {
  position: fixed;
  inset: 82px 0 0 210px;
  display: flex;
  overflow: hidden;
  background: #fdf8f3;
  background-image:
    radial-gradient(
      circle at 20% 50%,
      rgb(212 165 116 / 5%) 0%,
      transparent 50%
    ),
    radial-gradient(
      circle at 80% 20%,
      rgb(139 105 20 / 3%) 0%,
      transparent 50%
    );
}

.reflection-sidebar {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 260px;
  background: linear-gradient(180deg, #f5ede4 0%, #ede3d5 100%);
  border-right: 1px solid #e8d5c0;
  box-shadow: 2px 0 12px rgb(139 105 20 / 10%);
}

.reflection-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

/* ========== 侧边栏 ========== */
.sidebar-brand {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 20px 20px 8px;
}

.brand-icon {
  width: 32px;
  height: 32px;
  color: #8b6914;
  filter: drop-shadow(0 2px 4px rgb(139 105 20 / 20%));
}

.brand-icon svg {
  width: 100%;
  height: 100%;
}

.brand-text {
  font-size: 18px;
  font-weight: 700;
  color: #4a3728;
  letter-spacing: 0.5px;
}

.new-write-btn {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  width: calc(100% - 32px);
  padding: 12px 0;
  margin: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  cursor: pointer;
  background: linear-gradient(135deg, #8b6914 0%, #a67c00 100%);
  border: none;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgb(139 105 20 / 30%);
  transition: all 0.3s ease;
}

.new-write-btn:hover {
  background: linear-gradient(135deg, #a67c00 0%, #8b6914 100%);
  box-shadow: 0 6px 16px rgb(139 105 20 / 40%);
  transform: translateY(-2px);
}

.new-write-btn svg {
  width: 18px;
  height: 18px;
}

.sidebar-history {
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.history-label {
  padding: 16px 20px 8px;
  font-size: 12px;
  font-weight: 700;
  color: #8b7355;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.history-list {
  flex: 1;
  padding: 0 12px;
  overflow-y: auto;
}

.history-list::-webkit-scrollbar {
  width: 4px;
}

.history-list::-webkit-scrollbar-track {
  background: transparent;
}

.history-list::-webkit-scrollbar-thumb {
  background: #e8d5c0;
  border-radius: 2px;
}

.history-item {
  position: relative;
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 4px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.history-item::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 3px;
  height: 0;
  content: "";
  background: #8b6914;
  border-radius: 2px;
  transform: translateY(-50%);
  transition: height 0.2s ease;
}

.history-item:hover {
  background: rgb(139 105 20 / 8%);
}

.history-item:hover::before {
  height: 60%;
}

.history-item.active {
  background: rgb(139 105 20 / 12%);
}

.history-item.active::before {
  height: 80%;
  background: #8b6914;
}

.hist-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: #8b7355;
}

.history-item.active .hist-icon {
  color: #8b6914;
}

.hist-info {
  flex: 1;
  min-width: 0;
}

.hist-title {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  color: #4a3728;
  white-space: nowrap;
}

.history-item.active .hist-title {
  font-weight: 600;
  color: #8b6914;
}

.hist-type {
  flex-shrink: 0;
  color: #8b6914;
  background: rgb(139 105 20 / 10%);
  border-color: transparent;
}

.hist-score {
  flex-shrink: 0;
}

.hist-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: #8b7355;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 6px;
  opacity: 0;
  transition: all 0.15s;
}

.history-item:hover .hist-delete {
  opacity: 1;
}

.hist-delete:hover {
  color: #c75450;
  background: rgb(199 84 80 / 10%);
}

.history-empty {
  padding: 24px 12px;
  font-size: 13px;
  font-style: italic;
  color: #8b7355;
  text-align: center;
}

.sidebar-settings {
  padding: 12px 20px 16px;
  border-top: 1px solid #e8d5c0;
}

.setting-item {
  display: flex;
  gap: 10px;
  align-items: center;
}

.setting-text {
  font-size: 13px;
  color: #8b7355;
}

/* ========== 欢迎态 ========== */
.welcome-view {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
  overflow-y: auto;
  background: radial-gradient(
    ellipse at center,
    rgb(212 165 116 / 10%) 0%,
    transparent 70%
  );
}

.welcome-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 680px;
}

.welcome-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 20px;
  color: #8b6914;
  opacity: 0.7;
  filter: drop-shadow(0 4px 8px rgb(139 105 20 / 20%));
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }

  50% {
    transform: translateY(-8px);
  }
}

.welcome-icon svg {
  width: 100%;
  height: 100%;
}

.welcome-title {
  margin: 0 0 8px;
  font-family: "Noto Serif SC", "Source Han Serif SC", serif;
  font-size: 28px;
  font-weight: 700;
  color: #4a3728;
  letter-spacing: 2px;
}

.welcome-desc {
  margin: 0 0 36px;
  font-size: 15px;
  line-height: 1.6;
  color: #8b7355;
}

.welcome-input-area {
  width: 100%;
  margin-bottom: 44px;
}

.welcome-input-box {
  padding: 18px 20px;
  background: #fffef9;
  border: 2px solid #e8d5c0;
  border-radius: 16px;
  box-shadow:
    0 4px 20px rgb(139 105 20 / 8%),
    inset 0 1px 0 rgb(255 255 255 / 80%);
  transition: all 0.3s ease;
}

.welcome-input-box:focus-within {
  border-color: #8b6914;
  box-shadow:
    0 4px 24px rgb(139 105 20 / 15%),
    0 0 0 4px rgb(139 105 20 / 10%);
}

:deep(.welcome-input-box .el-textarea__inner) {
  padding: 0;
  font-size: 15px;
  line-height: 1.6;
  color: #4a3728;
  resize: none;
  background: transparent;
  border: none;
  box-shadow: none;
}

:deep(.welcome-input-box .el-textarea__inner::placeholder) {
  color: #8b7355;
  opacity: 0.6;
}

.welcome-input-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
}

.welcome-actions {
  display: flex;
  gap: 14px;
  align-items: center;
}

.input-hint {
  font-size: 12px;
  color: #8b7355;
  opacity: 0.6;
}

.write-btn {
  background: linear-gradient(135deg, #8b6914 0%, #a67c00 100%) !important;
  border-color: #8b6914 !important;
  box-shadow: 0 4px 12px rgb(139 105 20 / 30%);
  transition: all 0.3s ease;
}

.write-btn:hover {
  background: linear-gradient(135deg, #a67c00 0%, #c49000 100%) !important;
  box-shadow: 0 6px 16px rgb(139 105 20 / 40%);
  transform: translateY(-1px);
}

.write-btn:active {
  transform: translateY(0);
}

.popover-fields {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: #4a3728;
}

.field-row {
  display: flex;
  gap: 14px;
}

.field-row .field-item {
  flex: 1;
}

/* ========== 示例卡片 ========== */
.example-section {
  width: 100%;
}

.example-label {
  margin: 0 0 14px;
  font-size: 13px;
  font-style: italic;
  color: #8b7355;
  text-align: center;
}

.example-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.example-card {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  font-size: 13px;
  line-height: 1.5;
  color: #4a3728;
  text-align: left;
  cursor: pointer;
  background: #fffef9;
  border: 1px solid #e8d5c0;
  border-radius: 12px;
  box-shadow:
    0 2px 8px rgb(139 105 20 / 6%),
    inset 0 1px 0 rgb(255 255 255 / 60%);
  transform: rotate(-0.5deg);
  transition: all 0.2s ease;
}

.example-card:nth-child(2) {
  transform: rotate(0.3deg);
}

.example-card:nth-child(3) {
  transform: rotate(0.5deg);
}

.example-card:nth-child(4) {
  transform: rotate(-0.3deg);
}

.example-card:hover {
  color: #8b6914;
  background: rgb(139 105 20 / 5%);
  border-color: #d4a574;
  box-shadow: 0 4px 12px rgb(139 105 20 / 12%);
  transform: rotate(0deg) translateY(-2px);
}

.example-card svg {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  opacity: 0.7;
}

/* ========== 结果态：紧凑输入栏 ========== */
.compact-input-bar {
  flex-shrink: 0;
  padding: 14px 24px;
  background: #f5ede4;
  border-bottom: 1px solid #e8d5c0;
  box-shadow: 0 2px 8px rgb(139 105 20 / 5%);
}

:deep(.compact-input-bar .el-input__wrapper) {
  background: #fffef9;
  border-color: #e8d5c0;
  box-shadow: 0 2px 8px rgb(139 105 20 / 8%);
}

:deep(.compact-input-bar .el-input-group__append) {
  color: white;
  background: linear-gradient(135deg, #8b6914 0%, #a67c00 100%);
  border-color: #8b6914;
  box-shadow: none;
}

:deep(.compact-input-bar .el-input-group__append .el-button) {
  color: white;
  border: none;
}

/* ========== 结果态：滚动区 ========== */
.results-scroll {
  flex: 1;
  overflow-y: auto;
  scroll-behavior: smooth;
  background: #fdf8f3;
}

.results-inner {
  max-width: 840px;
  padding: 24px;
  margin: 0 auto;
  animation: fade-in 0.4s ease;
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ========== 进度面板 ========== */
.progress-panel {
  padding: 24px;
  margin-bottom: 20px;
  background: #fffef9;
  border: 1px solid #e8d5c0;
  border-radius: 16px;
  box-shadow:
    0 4px 20px rgb(139 105 20 / 8%),
    inset 0 1px 0 rgb(255 255 255 / 80%);
}

:deep(.progress-panel .el-progress-bar__outer) {
  background: rgb(139 105 20 / 10%);
  border-radius: 8px;
}

:deep(.progress-panel .el-progress-bar__inner) {
  background: linear-gradient(90deg, #8b6914 0%, #d4a574 100%);
  border-radius: 8px;
}

.stage-info {
  margin-top: 18px;
  text-align: center;
}

.stage-label {
  font-family: "Noto Serif SC", "Source Han Serif SC", serif;
  font-size: 20px;
  font-weight: 700;
  color: #4a3728;
}

.stage-detail {
  display: block;
  margin-top: 8px;
  font-size: 14px;
  color: #8b7355;
}

.progress-stats {
  display: flex;
  gap: 28px;
  justify-content: center;
  margin-top: 16px;
}

.stat-item {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
  color: #8b7355;
}

.stat-icon {
  font-size: 18px;
}

.section-progress-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 18px;
  margin-top: 18px;
  border-top: 1px dashed #e8d5c0;
}

.section-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 16px;
  font-size: 13px;
  background: #fffef9;
  border: 1px solid #e8d5c0;
  border-radius: 24px;
  transition: all 0.3s ease;
}

.section-item.completed {
  color: #5b8c3e;
  background: rgb(91 140 62 / 8%);
  border-color: rgb(91 140 62 / 30%);
}

.section-item.writing {
  color: #8b6914;
  background: rgb(139 105 20 / 8%);
  border-color: rgb(139 105 20 / 30%);
  animation: section-pulse 2s ease-in-out infinite;
}

.section-item.evaluating {
  color: #b8860b;
  background: rgb(184 134 11 / 8%);
  border-color: rgb(184 134 11 / 30%);
}

.section-item.pending {
  color: #8b7355;
  opacity: 0.6;
}

.section-index {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 12px;
  font-weight: 700;
  background: rgb(139 105 20 / 10%);
  border-radius: 50%;
}

.section-item.completed .section-index {
  color: white;
  background: #5b8c3e;
}

.section-item.writing .section-index {
  color: white;
  background: #8b6914;
}

.section-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.section-score {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.8;
}

.section-status-icon {
  font-size: 16px;
}

@keyframes section-pulse {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgb(139 105 20 / 20%);
  }

  50% {
    box-shadow: 0 0 0 8px rgb(139 105 20 / 0%);
  }
}

/* ========== 执行中指示（简化版） ========== */
.executing-bar {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: 14px;
  color: #8b6914;
  background: rgb(139 105 20 / 6%);
  border: 1px dashed rgb(139 105 20 / 30%);
  border-radius: 10px;
}

.executing-dot {
  width: 8px;
  height: 8px;
  background: #8b6914;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

/* ========== 加载指示器 ========== */
.loading-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 56px 0;
}

.typing-indicator {
  display: flex;
  gap: 8px;
}

.typing-indicator span {
  width: 10px;
  height: 10px;
  background: #8b6914;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  60%,
  100% {
    opacity: 0.3;
    transform: translateY(0) scale(1);
  }

  30% {
    opacity: 1;
    transform: translateY(-8px) scale(1.1);
  }
}

.loading-text {
  margin-top: 16px;
  font-size: 14px;
  font-style: italic;
  color: #8b7355;
}

/* ========== 结果卡片通用 ========== */
.summary-card,
.section-card {
  margin-bottom: 20px;
  background: #fffef9;
  border: 1px solid #e8d5c0;
  border-radius: 14px;
  box-shadow: 0 2px 12px rgb(139 105 20 / 6%);
}

:deep(.summary-card .el-card__body) {
  padding: 20px 24px;
}

:deep(.section-card .el-card__header) {
  padding: 14px 24px;
  background: linear-gradient(
    180deg,
    rgb(139 105 20 / 3%) 0%,
    transparent 100%
  );
  border-bottom: 1px solid #e8d5c0;
}

:deep(.section-card .el-card__body) {
  padding: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  font-weight: 600;
  color: #4a3728;
}

/* ========== 状态摘要 ========== */
.summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.summary-left {
  display: flex;
  gap: 14px;
  align-items: center;
}

.summary-meta {
  font-size: 14px;
  color: #8b7355;
}

.summary-score {
  display: flex;
  gap: 4px;
  align-items: baseline;
}

.score-value {
  font-family: Georgia, serif;
  font-size: 40px;
  font-weight: 800;
  line-height: 1;
  color: #8b6914;
}

.score-unit {
  font-size: 16px;
  color: #8b7355;
}

.summary-metrics {
  display: flex;
  gap: 10px;
  padding-top: 14px;
  margin-top: 14px;
  border-top: 1px dashed #e8d5c0;
}

/* ========== 文章卡片 ========== */
.article-card {
  border-left: 4px solid #8b6914;
}

.article-content {
  font-family: "Noto Serif SC", "Source Han Serif SC", Georgia, serif;
  font-size: 16px;
  line-height: 1.9;
  color: #4a3728;
}

/* ========== 时间线反馈 ========== */
.timeline-feedback {
  padding: 10px 14px;
  margin-top: 6px;
  font-size: 14px;
  line-height: 1.7;
  color: #4a3728;
  background: rgb(139 105 20 / 4%);
  border-left: 3px solid #d4a574;
  border-radius: 0 8px 8px 0;
}

/* ========== Markdown ========== */
.markdown-body {
  font-size: 15px;
  line-height: 1.8;
  color: #4a3728;
  overflow-wrap: break-word;
}

:deep(.markdown-body p) {
  margin: 0 0 14px;
}

:deep(.markdown-body p:last-child) {
  margin-bottom: 0;
}

:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3),
:deep(.markdown-body h4) {
  margin: 20px 0 10px;
  font-family: "Noto Serif SC", "Source Han Serif SC", serif;
  font-weight: 700;
  line-height: 1.4;
  color: #4a3728;
}

:deep(.markdown-body h1:first-child),
:deep(.markdown-body h2:first-child),
:deep(.markdown-body h3:first-child),
:deep(.markdown-body h4:first-child) {
  margin-top: 0;
}

:deep(.markdown-body h1) {
  font-size: 1.6em;
}

:deep(.markdown-body h2) {
  font-size: 1.4em;
}

:deep(.markdown-body h3) {
  font-size: 1.2em;
}

:deep(.markdown-body ul),
:deep(.markdown-body ol) {
  padding-left: 28px;
  margin: 10px 0;
}

:deep(.markdown-body li) {
  margin: 6px 0;
  line-height: 1.7;
}

:deep(.markdown-body code) {
  padding: 3px 8px;
  font-family: "Fira Code", Consolas, Monaco, monospace;
  font-size: 13px;
  color: #8b6914;
  background: rgb(139 105 20 / 6%);
  border-radius: 4px;
}

:deep(.markdown-body pre) {
  padding: 18px;
  margin: 14px 0;
  overflow-x: auto;
  background: #2d2a26;
  border-radius: 10px;
}

:deep(.markdown-body pre code) {
  padding: 0;
  color: #e8d5c0;
  background: none;
}

:deep(.markdown-body table) {
  width: 100%;
  margin: 14px 0;
  border-collapse: collapse;
}

:deep(.markdown-body th),
:deep(.markdown-body td) {
  padding: 10px 14px;
  text-align: left;
  border: 1px solid #e8d5c0;
}

:deep(.markdown-body th) {
  font-weight: 600;
  background: rgb(139 105 20 / 5%);
}

:deep(.markdown-body tr:hover) {
  background: rgb(139 105 20 / 2%);
}

:deep(.markdown-body blockquote) {
  padding: 10px 18px;
  margin: 14px 0;
  color: #8b7355;
  background: rgb(139 105 20 / 4%);
  border-left: 4px solid #d4a574;
  border-radius: 0 8px 8px 0;
}

:deep(.markdown-body hr) {
  margin: 20px 0;
  border: none;
  border-top: 1px dashed #e8d5c0;
}

:deep(.markdown-body a) {
  color: #8b6914;
  text-decoration: none;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s;
}

:deep(.markdown-body a:hover) {
  border-bottom-color: #8b6914;
}

:deep(.markdown-body strong) {
  font-weight: 700;
  color: #4a3728;
}

:deep(.markdown-body img) {
  max-width: 100%;
  border-radius: 10px;
  box-shadow: 0 4px 12px rgb(139 105 20 / 10%);
}

/* ========== 响应式 ========== */
@media (width <= 768px) {
  .reflection-container {
    inset: 0;
  }

  .reflection-sidebar {
    display: none;
  }

  .example-grid {
    grid-template-columns: 1fr;
  }

  .results-inner {
    padding: 16px;
  }
}
</style>

<style>
.warm-popover {
  background: #fffef9 !important;
  border: 1px solid #e8d5c0 !important;
  border-radius: 12px !important;
  box-shadow: 0 4px 20px rgb(139 105 20 / 12%) !important;
}

.warm-popover .el-popper__arrow::before {
  background: #fffef9 !important;
  border-color: #e8d5c0 !important;
}

.warm-popover .el-radio__label {
  color: #4a3728;
}

.warm-popover .el-select {
  --el-select-border-color-hover: #8b6914;
}
</style>
