<script setup lang="ts">
import { ref, reactive, nextTick, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { getToken, formatToken } from "@/utils/auth";
import { message } from "@/utils/message";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import {
  getQueryRewriteEnabled,
  setQueryRewriteEnabled,
  getMultiRoundSearchEnabled,
  setMultiRoundSearchEnabled
} from "@/api/rag";

defineOptions({ name: "RagChat" });

// 配置 marked
marked.use(
  markedHighlight({
    langPrefix: "hljs language-",
    highlight(code: string, lang: string) {
      const language = hljs.getLanguage(lang) ? lang : "plaintext";
      return hljs.highlight(code, { language }).value;
    }
  })
);

marked.setOptions({
  breaks: true,
  gfm: true
});

function renderMarkdown(content: string): string {
  if (!content) return "";
  return marked.parse(content) as string;
}

type RetrievedChunk = {
  score: number;
  content: string;
  source: string;
};

type ThinkingStep = {
  stage: string;
  status: string;
  message?: string;
  original?: string;
  rewritten?: string;
  queryRewritten?: boolean;
  count?: number;
  chunks?: RetrievedChunk[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  steps: ThinkingStep[];
  done: boolean;
  time: string;
};

const inputText = ref("");
const messages = ref<ChatMessage[]>([]);
const sending = ref(false);
const showThinking = ref(true);
const queryRewriteEnabled = ref(false);
const queryRewriteLoading = ref(false);
const multiRoundSearchEnabled = ref(true);
const multiRoundSearchLoading = ref(false);
const chatContainerRef = ref<HTMLElement | null>(null);

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

function sendMessage() {
  const text = inputText.value.trim();
  if (!text || sending.value) return;

  inputText.value = "";
  messages.value.push({
    role: "user",
    content: text,
    steps: [],
    done: true,
    time: now()
  });

  const assistantMsg = reactive<ChatMessage>({
    role: "assistant",
    content: "",
    steps: [],
    done: false,
    time: now()
  });
  messages.value.push(assistantMsg);
  sending.value = true;
  scrollToBottom();

  const body = JSON.stringify({ query: text });

  const token = getToken()?.token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (token) headers["Authorization"] = formatToken(token);

  fetch("/api/rag/chat/stream", {
    method: "POST",
    headers,
    body
  })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventType = "";
      let dataLines: string[] = [];

      function processEvent() {
        if (eventType && dataLines.length) {
          handleSSE(eventType, dataLines.join("\n"), assistantMsg);
          eventType = "";
          dataLines = [];
        }
      }

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            processEvent();
            assistantMsg.done = true;
            sending.value = false;
            scrollToBottom();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop()!;

          for (const line of lines) {
            if (line.startsWith("event:")) {
              processEvent();
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataLines.push(line.slice(5));
            } else if (line.trim() === "") {
              processEvent();
            }
          }
          read();
        });
      }
      read();
    })
    .catch(() => {
      assistantMsg.content = "连接失败，请稍后重试";
      assistantMsg.done = true;
      sending.value = false;
      scrollToBottom();
    });
}

function handleSSE(event: string, data: string, msg: ChatMessage) {
  if (event === "step") {
    const step: ThinkingStep = JSON.parse(data);
    if (step.status === "start") {
      msg.steps.push(step);
    } else if (step.status === "done") {
      const existing = msg.steps.find(
        s => s.stage === step.stage && s.status === "start"
      );
      if (existing) {
        Object.assign(existing, step, { status: "done" });
      } else {
        msg.steps.push(step);
      }
    }
  } else if (event === "token") {
    msg.content += data;
    scrollToBottom();
  } else if (event === "done") {
    msg.done = true;
    sending.value = false;
    scrollToBottom();
  } else if (event === "error") {
    msg.content = msg.content || `错误: ${data}`;
    msg.done = true;
    sending.value = false;
    scrollToBottom();
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function clearChat() {
  messages.value = [];
}

async function fetchQueryRewriteStatus() {
  try {
    const res = await getQueryRewriteEnabled();
    if (res?.code === 200) {
      queryRewriteEnabled.value = res.data ?? false;
    }
  } catch {
    // ignore
  }
}

async function handleQueryRewriteChange(val: boolean) {
  queryRewriteLoading.value = true;
  try {
    const res = await setQueryRewriteEnabled(val);
    if (res?.code === 200) {
      message(val ? "查询改写已开启" : "查询改写已关闭", { type: "success" });
    } else {
      queryRewriteEnabled.value = !val;
      message(res?.message ?? "设置失败", { type: "error" });
    }
  } catch (e: any) {
    queryRewriteEnabled.value = !val;
    message(e?.message ?? "设置失败", { type: "error" });
  } finally {
    queryRewriteLoading.value = false;
  }
}

async function fetchMultiRoundSearchStatus() {
  try {
    const res = await getMultiRoundSearchEnabled();
    if (res?.code === 200) {
      multiRoundSearchEnabled.value = res.data ?? true;
    }
  } catch {
    // ignore
  }
}

async function handleMultiRoundSearchChange(val: boolean) {
  multiRoundSearchLoading.value = true;
  try {
    const res = await setMultiRoundSearchEnabled(val);
    if (res?.code === 200) {
      message(val ? "多轮检索已开启" : "多轮检索已关闭", { type: "success" });
    } else {
      multiRoundSearchEnabled.value = !val;
      message(res?.message ?? "设置失败", { type: "error" });
    }
  } catch (e: any) {
    multiRoundSearchEnabled.value = !val;
    message(e?.message ?? "设置失败", { type: "error" });
  } finally {
    multiRoundSearchLoading.value = false;
  }
}

function getStepIcon(stage: string, status: string) {
  if (status === "start") return "ri:loader-4-line";
  if (stage === "rewrite") return "ri:edit-line";
  if (stage === "retrieve") return "ri:search-line";
  if (stage === "answer") return "ri:chat-check-line";
  return "ri:check-line";
}

function getStepColor(status: string) {
  if (status === "start") return "text-gray-400";
  return "text-(--el-color-success)";
}

function getStepLabel(stage: string) {
  const labels: Record<string, string> = {
    rewrite: "问题理解",
    retrieve: "知识检索",
    answer: "生成回答"
  };
  return labels[stage] || stage;
}

function getStepStatus(step: ThinkingStep): "pending" | "active" | "done" {
  if (step.status === "done") return "done";
  if (step.status === "start") return "active";
  return "pending";
}

function getChunksPreview(chunks: RetrievedChunk[], limit = 3) {
  return chunks.slice(0, limit);
}

function hasMoreChunks(chunks: RetrievedChunk[], limit = 3) {
  return chunks.length > limit;
}

onMounted(() => {
  scrollToBottom();
  fetchQueryRewriteStatus();
  fetchMultiRoundSearchStatus();
});
</script>

<template>
  <div class="rag-chat-container">
    <!-- 左侧 -->
    <div class="rag-chat-sidebar">
      <el-button
        type="primary"
        class="w-full mb-3"
        :icon="useRenderIcon('ri/chat-new-line')"
        @click="clearChat"
      >
        新对话
      </el-button>
      <div class="flex items-center mb-3">
        <el-switch v-model="showThinking" class="mr-2" />
        <span class="text-sm">显示执行流程</span>
      </div>
      <div class="flex items-center mb-3">
        <el-switch
          v-model="queryRewriteEnabled"
          class="mr-2"
          :loading="queryRewriteLoading"
          @change="handleQueryRewriteChange"
        />
        <span class="text-sm">查询改写</span>
      </div>
      <div class="flex items-center mb-3">
        <el-switch
          v-model="multiRoundSearchEnabled"
          class="mr-2"
          :loading="multiRoundSearchLoading"
          @change="handleMultiRoundSearchChange"
        />
        <span class="text-sm">多轮检索</span>
      </div>
      <div class="text-xs text-gray-400 mt-auto">
        RAG 智能问答，流式输出，实时展示执行流程。
      </div>
    </div>

    <!-- 右侧：对话区 -->
    <div class="rag-chat-main">
      <div ref="chatContainerRef" class="rag-chat-messages">
        <template v-if="messages.length">
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            :class="[
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            ]"
          >
            <div
              :class="[
                'max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm',
                msg.role === 'user'
                  ? 'bg-(--el-color-primary) text-white rounded-br-sm'
                  : 'bg-(--el-fill-color-light) text-(--el-text-color-primary) rounded-bl-sm'
              ]"
            >
              <!-- 执行流程 -->
              <template v-if="showThinking && msg.steps.length">
                <div class="thinking-process">
                  <div class="thinking-header">
                    <iconify-icon-offline
                      icon="ri:flow-chart"
                      class="size-4 text-gray-500"
                    />
                    <span>执行流程</span>
                    <el-tag size="small" type="info" class="ml-auto">
                      {{ msg.steps.filter(s => s.status === "done").length }}/{{
                        msg.steps.length
                      }}
                    </el-tag>
                  </div>
                  <div class="thinking-timeline">
                    <div
                      v-for="(step, si) in msg.steps"
                      :key="si"
                      :class="[
                        'timeline-item',
                        `timeline-${getStepStatus(step)}`
                      ]"
                    >
                      <div class="timeline-node">
                        <div class="timeline-dot">
                          <iconify-icon-offline
                            v-if="getStepStatus(step) === 'active'"
                            icon="ri:loader-4-line"
                            class="size-3 animate-spin"
                          />
                          <iconify-icon-offline
                            v-else-if="getStepStatus(step) === 'done'"
                            icon="ri:check-line"
                            class="size-3"
                          />
                          <div v-else class="size-2 rounded-full bg-gray-300" />
                        </div>
                        <div
                          v-if="si < msg.steps.length - 1"
                          class="timeline-line"
                        />
                      </div>
                      <div class="timeline-content">
                        <div class="timeline-header">
                          <span class="timeline-title">
                            {{ getStepLabel(step.stage) }}
                          </span>
                          <el-tag
                            v-if="
                              step.stage === 'rewrite' && step.status === 'done'
                            "
                            :type="step.queryRewritten ? 'warning' : 'info'"
                            size="small"
                            class="ml-2"
                          >
                            {{ step.queryRewritten ? "已重写" : "原始问题" }}
                          </el-tag>
                          <el-tag
                            v-if="
                              step.stage === 'retrieve' &&
                              step.status === 'done'
                            "
                            type="info"
                            size="small"
                            class="ml-2"
                          >
                            {{ step.count }} 条结果
                          </el-tag>
                        </div>

                        <!-- 问题改写详情 -->
                        <div
                          v-if="
                            step.stage === 'rewrite' &&
                            step.status === 'done' &&
                            step.queryRewritten
                          "
                          class="timeline-detail"
                        >
                          <div class="rewrite-box">
                            <div class="rewrite-original">
                              <span class="rewrite-label">原始</span>
                              <span>{{ step.original }}</span>
                            </div>
                            <div class="rewrite-arrow">
                              <iconify-icon-offline
                                icon="ri:arrow-down-line"
                                class="size-4 text-orange-400"
                              />
                            </div>
                            <div class="rewrite-rewritten">
                              <span class="rewrite-label">改写</span>
                              <span>{{ step.rewritten }}</span>
                            </div>
                          </div>
                        </div>

                        <!-- 检索结果预览 -->
                        <div
                          v-if="
                            step.stage === 'retrieve' &&
                            step.status === 'done' &&
                            step.chunks?.length
                          "
                          class="timeline-detail"
                        >
                          <div class="chunks-list">
                            <div
                              v-for="(chunk, ci) in getChunksPreview(
                                step.chunks
                              )"
                              :key="ci"
                              class="chunk-item"
                            >
                              <div class="chunk-score">
                                {{ (chunk.score * 100).toFixed(0) }}%
                              </div>
                              <div class="chunk-info">
                                <div class="chunk-source">
                                  {{ chunk.source }}
                                </div>
                                <div class="chunk-content">
                                  {{ chunk.content }}
                                </div>
                              </div>
                            </div>
                            <div
                              v-if="hasMoreChunks(step.chunks)"
                              class="chunks-more"
                            >
                              还有 {{ step.chunks.length - 3 }} 条相关结果...
                            </div>
                          </div>
                        </div>

                        <!-- 加载中状态 -->
                        <div
                          v-if="getStepStatus(step) === 'active'"
                          class="timeline-loading"
                        >
                          {{ step.message || "处理中..." }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>

              <!-- 消息内容 -->
              <div class="min-h-5">
                <template
                  v-if="msg.role === 'assistant' && !msg.content && !msg.done"
                >
                  <span class="text-gray-400 animate-pulse">思考中...</span>
                </template>
                <template v-else-if="msg.role === 'assistant'">
                  <div
                    class="markdown-body"
                    v-html="renderMarkdown(msg.content)"
                  />
                </template>
                <template v-else>
                  <div class="whitespace-pre-wrap break-all">
                    {{ msg.content }}
                  </div>
                </template>
              </div>

              <!-- 时间 -->
              <div
                class="text-[10px] mt-1 text-right"
                :class="msg.role === 'user' ? 'text-white/60' : 'text-gray-400'"
              >
                {{ msg.time }}
              </div>
            </div>
          </div>
        </template>
        <div v-else class="h-full flex-c text-gray-400 text-sm">
          输入问题开始对话，我会基于知识库内容为你解答
        </div>
      </div>

      <!-- 输入区 -->
      <div class="rag-chat-input">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="1"
          autosize
          placeholder="输入问题，Enter 发送，Shift+Enter 换行"
          class="flex-1"
          :disabled="sending"
          @keydown="handleKeydown"
        />
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/send-plane-fill')"
          :loading="sending"
          @click="sendMessage"
        >
          发送
        </el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 布局样式 */
.rag-chat-container {
  position: fixed;
  inset: 82px 0 0 210px;
  display: flex;
  background: var(--el-bg-color);
}

.rag-chat-sidebar {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 200px;
  padding: 12px;
  background: var(--el-bg-color);
  border-right: 1px solid var(--el-border-color);
}

.rag-chat-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.rag-chat-messages {
  flex: 1;
  padding: 16px;
  overflow: auto;
}

.rag-chat-messages > :not(:first-child) {
  margin-top: 16px;
}

.rag-chat-input {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
  align-items: flex-end;
  padding: 12px;
  background: var(--el-bg-color);
  border-top: 1px solid var(--el-border-color);
}

/* 执行流程时间线样式 */
.thinking-process {
  margin-bottom: 12px;
  overflow: hidden;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.thinking-header {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-regular);
  background: var(--el-fill-color-light);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.thinking-timeline {
  padding: 12px 12px 4px;
}

.timeline-item {
  display: flex;
  gap: 12px;
  min-height: 40px;
}

.timeline-node {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  width: 20px;
}

.timeline-dot {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  transition: all 0.3s;
}

.timeline-line {
  flex: 1;
  width: 2px;
  min-height: 16px;
  margin: 4px 0;
  background: var(--el-border-color);
  transition: all 0.3s;
}

.timeline-content {
  flex: 1;
  min-width: 0;
  padding-bottom: 12px;
}

.timeline-header {
  display: flex;
  gap: 4px;
  align-items: center;
  margin-bottom: 4px;
}

.timeline-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.timeline-detail {
  margin-top: 8px;
}

.timeline-loading {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* 状态样式 */
.timeline-pending .timeline-dot {
  background: var(--el-fill-color);
  border: 2px solid var(--el-border-color);
}

.timeline-pending .timeline-title {
  color: var(--el-text-color-secondary);
}

.timeline-active .timeline-dot {
  color: white;
  background: var(--el-color-primary);
  border: 2px solid var(--el-color-primary);
}

.timeline-active .timeline-line {
  background: linear-gradient(
    to bottom,
    var(--el-color-primary),
    var(--el-border-color)
  );
}

.timeline-done .timeline-dot {
  color: white;
  background: var(--el-color-success);
  border: 2px solid var(--el-color-success);
}

.timeline-done .timeline-line {
  background: var(--el-color-success);
}

/* 问题改写样式 */
.rewrite-box {
  padding: 8px;
  font-size: 12px;
  background: var(--el-fill-color);
  border-radius: 6px;
}

.rewrite-original,
.rewrite-rewritten {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.rewrite-label {
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 11px;
  font-weight: 500;
  border-radius: 4px;
}

.rewrite-original .rewrite-label {
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-dark);
}

.rewrite-original span:last-child {
  color: var(--el-text-color-secondary);
}

.rewrite-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 0;
}

.rewrite-rewritten .rewrite-label {
  color: var(--el-color-warning);
  background: var(--el-color-warning-light-9);
}

.rewrite-rewritten span:last-child {
  font-weight: 500;
  color: var(--el-color-warning);
}

/* 检索结果样式 */
.chunks-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chunk-item {
  display: flex;
  gap: 8px;
  padding: 8px;
  font-size: 12px;
  background: var(--el-fill-color);
  border-radius: 6px;
}

.chunk-score {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 24px;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 4px;
}

.chunk-info {
  flex: 1;
  min-width: 0;
}

.chunk-source {
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.chunk-content {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  line-height: 1.5;
  color: var(--el-text-color-regular);
  -webkit-box-orient: vertical;
}

.chunks-more {
  padding: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

@keyframes pulse {
  50% {
    opacity: 0.5;
  }
}

.markdown-body {
  :deep(pre) {
    padding: 12px;
    margin: 8px 0;
    overflow-x: auto;
    background: #f6f8fa;
    border-radius: 6px;
  }

  :deep(code) {
    font-family: "Fira Code", Consolas, Monaco, monospace;
    font-size: 13px;
  }

  :deep(:not(pre) > code) {
    padding: 2px 6px;
    background: rgb(175 184 193 / 20%);
    border-radius: 4px;
  }

  :deep(p) {
    margin: 0 0 8px;
    line-height: 1.6;

    &:last-child {
      margin-bottom: 0;
    }
  }

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4),
  :deep(h5),
  :deep(h6) {
    margin: 12px 0 8px;
    font-weight: 600;
    line-height: 1.4;

    &:first-child {
      margin-top: 0;
    }
  }

  :deep(h1) {
    font-size: 1.5em;
  }

  :deep(h2) {
    font-size: 1.3em;
  }

  :deep(h3) {
    font-size: 1.1em;
  }

  :deep(ul),
  :deep(ol) {
    padding-left: 20px;
    margin: 4px 0;
  }

  :deep(li) {
    margin: 2px 0;
    line-height: 1.6;
  }

  :deep(table) {
    width: 100%;
    margin: 8px 0;
    border-collapse: collapse;

    th,
    td {
      padding: 6px 12px;
      text-align: left;
      border: 1px solid var(--el-border-color);
    }

    th {
      font-weight: 600;
      background: var(--el-fill-color-light);
    }

    tr:hover {
      background: var(--el-fill-color-lighter);
    }
  }

  :deep(blockquote) {
    padding-left: 12px;
    margin: 8px 0;
    color: var(--el-text-color-secondary);
    border-left: 4px solid var(--el-color-primary);
  }

  :deep(hr) {
    margin: 12px 0;
    border: none;
    border-top: 1px solid var(--el-border-color);
  }

  :deep(img) {
    max-width: 100%;
    border-radius: 4px;
  }

  :deep(a) {
    color: var(--el-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
