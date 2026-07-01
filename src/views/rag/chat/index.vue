<script setup lang="ts">
import { ref, reactive, nextTick, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { getToken, formatToken } from "@/utils/auth";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { Delete, Picture, Close, Loading } from "@element-plus/icons-vue";
import { marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import {
  getQueryRewriteEnabled,
  setQueryRewriteEnabled,
  getMultiRoundSearchEnabled,
  setMultiRoundSearchEnabled,
  getRagSources,
  getRagConversations,
  getRagConversationMessages,
  deleteRagConversation
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
  images?: { id: string; url: string }[];
};

const inputText = ref("");
const messages = ref<ChatMessage[]>([]);
const sending = ref(false);
const showThinking = ref(true);
const queryRewriteEnabled = ref(false);
const queryRewriteLoading = ref(false);
const multiRoundSearchEnabled = ref(true);
const multiRoundSearchLoading = ref(false);
const sourceFilter = ref("");
const sourceOptions = ref<string[]>([]);
const conversationId = ref("");
const conversationList = ref<{ id: string; title: string }[]>([]);
const chatContainerRef = ref<HTMLElement | null>(null);
const uploadedImages = ref<{ id: string; url: string }[]>([]);
const uploading = ref(false);
const imageInputRef = ref<HTMLInputElement | null>(null);

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

// ==================== 图片上传 ====================

function triggerImagePicker() {
  imageInputRef.value?.click();
}

async function handleImageSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  uploading.value = true;
  for (const file of Array.from(files)) {
    try {
      const imageId = await uploadFile(file);
      const url = URL.createObjectURL(file);
      uploadedImages.value.push({ id: imageId, url });
    } catch (e: any) {
      message(e.message || "图片上传失败", { type: "error" });
    }
  }
  uploading.value = false;
  target.value = "";
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const token = getToken()?.token;
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = formatToken(token);

  const resp = await fetch("/api/image/upload", {
    method: "POST",
    headers,
    body: formData
  });
  const result = await resp.json();
  if (result.code !== 200) throw new Error(result.message || "上传失败");
  return result.data.imageId;
}

function removeImage(index: number) {
  const img = uploadedImages.value[index];
  if (img) URL.revokeObjectURL(img.url);
  uploadedImages.value.splice(index, 1);
}

function sendMessage() {
  const text = inputText.value.trim();
  const currentImages = uploadedImages.value.map(img => ({
    id: img.id,
    url: img.url
  }));
  const currentImageIds = uploadedImages.value.map(img => img.id);
  if ((!text && currentImageIds.length === 0) || sending.value) return;

  const imageAppendix =
    currentImageIds.length > 0
      ? "\n\n" +
        currentImageIds.map((id, i) => `图片${i + 1},ID:${id}`).join("\n")
      : "";
  const finalText = text + imageAppendix;

  inputText.value = "";
  messages.value.push({
    role: "user",
    content: finalText,
    steps: [],
    done: true,
    time: now(),
    images: currentImages.length > 0 ? currentImages : undefined
  });
  uploadedImages.value = [];

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

  const body = JSON.stringify({
    query: finalText,
    conversationId: conversationId.value || undefined,
    sourceFilter: sourceFilter.value || undefined
  });

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
  conversationId.value = crypto.randomUUID();
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

async function fetchSources() {
  try {
    const res = await getRagSources();
    if (res?.code === 200) {
      sourceOptions.value = res.data ?? [];
    }
  } catch {
    // ignore
  }
}

async function fetchConversations() {
  try {
    const res = await getRagConversations();
    if (res?.code === 200) {
      conversationList.value = (res.data ?? []).filter(
        (c: { id: string }) => c.id
      );
    }
  } catch {
    // ignore
  }
}

async function loadConversation(id: string) {
  if (!id) {
    messages.value = [];
    return;
  }
  conversationId.value = id;
  try {
    const res = await getRagConversationMessages(id);
    if (res?.code === 200) {
      messages.value = (res.data ?? []).map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        steps: [],
        done: true,
        time: ""
      }));
      scrollToBottom();
    }
  } catch {
    // ignore
  }
}

async function handleDeleteConversation(id: string) {
  if (!id) return;
  try {
    await ElMessageBox.confirm("确定删除该对话记录？", "警告", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning"
    });
    const res = await deleteRagConversation(id);
    if (res?.code === 200) {
      message("删除成功", { type: "success" });
      if (conversationId.value === id) {
        conversationId.value = "";
        messages.value = [];
      }
      fetchConversations();
    } else {
      message(res?.message ?? "删除失败", { type: "error" });
    }
  } catch {
    // cancelled
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
  fetchSources();
  fetchConversations();
});
</script>

<template>
  <div class="rag-chat-container">
    <!-- 左侧 -->
    <div class="rag-chat-sidebar">
      <button class="new-chat-btn" @click="clearChat">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span>新对话</span>
      </button>

      <div class="sidebar-conversations">
        <div class="conversations-label">历史对话</div>
        <div class="conversations-list">
          <div
            v-for="item in conversationList"
            :key="item.id"
            class="conversation-item"
            :class="{ active: conversationId === item.id }"
            @click="loadConversation(item.id)"
          >
            <svg
              class="conv-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
              />
            </svg>
            <span class="conv-title">{{ item.title }}</span>
            <button
              class="conv-delete"
              title="删除对话"
              @click.stop="handleDeleteConversation(item.id)"
            >
              <Delete />
            </button>
          </div>
          <div v-if="conversationList.length === 0" class="conversations-empty">
            暂无历史对话
          </div>
        </div>
      </div>

      <div class="sidebar-settings">
        <div class="settings-label">设置</div>
        <div class="setting-item">
          <el-switch v-model="showThinking" size="small" />
          <span class="setting-text">显示执行流程</span>
        </div>
        <div class="setting-item">
          <el-switch
            v-model="queryRewriteEnabled"
            size="small"
            :loading="queryRewriteLoading"
            @change="handleQueryRewriteChange"
          />
          <span class="setting-text">查询改写</span>
        </div>
        <div class="setting-item">
          <el-switch
            v-model="multiRoundSearchEnabled"
            size="small"
            :loading="multiRoundSearchLoading"
            @change="handleMultiRoundSearchChange"
          />
          <span class="setting-text">多轮检索</span>
        </div>
      </div>

      <div class="sidebar-footer">
        <div class="footer-text">RAG 智能问答</div>
        <div class="footer-sub">流式输出，实时展示执行流程</div>
      </div>
    </div>

    <!-- 右侧：对话区 -->
    <div class="rag-chat-main">
      <div ref="chatContainerRef" class="rag-chat-messages">
        <template v-if="messages.length">
          <div class="messages-container">
            <div
              v-for="(msg, idx) in messages"
              :key="idx"
              class="message-wrapper"
              :class="[`message-${msg.role}`]"
            >
              <!-- 用户消息 -->
              <div
                v-if="msg.role === 'user'"
                class="message-content-wrapper user-message-wrapper"
              >
                <div class="user-avatar">
                  <span>U</span>
                </div>
                <div class="user-message-content">
                  <div class="message-text whitespace-pre-wrap break-all">
                    {{ msg.content }}
                  </div>
                  <div v-if="msg.images?.length" class="user-message-images">
                    <div
                      v-for="(img, iIdx) in msg.images"
                      :key="iIdx"
                      class="user-message-image"
                    >
                      <img :src="img.url" alt="图片" />
                    </div>
                  </div>
                  <div class="message-time">
                    {{ msg.time }}
                  </div>
                </div>
              </div>

              <!-- AI 消息 -->
              <div v-else class="message-content-wrapper ai-message-wrapper">
                <div class="ai-avatar">
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
                  </svg>
                </div>
                <div class="ai-message-content">
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
                          {{
                            msg.steps.filter(s => s.status === "done").length
                          }}/{{ msg.steps.length }}
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
                              <div
                                v-else
                                class="size-2 rounded-full bg-gray-300"
                              />
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
                                  step.stage === 'rewrite' &&
                                  step.status === 'done'
                                "
                                :type="step.queryRewritten ? 'warning' : 'info'"
                                size="small"
                                class="ml-2"
                              >
                                {{
                                  step.queryRewritten ? "已重写" : "原始问题"
                                }}
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
                                  还有
                                  {{ step.chunks.length - 3 }} 条相关结果...
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
                  <div class="message-body">
                    <template v-if="!msg.content && !msg.done">
                      <div class="typing-indicator">
                        <span />
                        <span />
                        <span />
                      </div>
                    </template>
                    <template v-else>
                      <div
                        class="markdown-body"
                        v-html="renderMarkdown(msg.content)"
                      />
                    </template>
                  </div>

                  <div class="message-time">
                    {{ msg.time }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <!-- 空状态 -->
        <div v-else class="empty-state">
          <div class="empty-icon">
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
          <h2 class="empty-title">RAG 智能问答</h2>
          <p class="empty-desc">
            基于知识库内容为你解答问题，支持流式输出和实时展示执行流程
          </p>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="rag-input-area">
        <div class="rag-chat-input">
          <div class="input-toolbar">
            <button
              class="image-upload-btn"
              :disabled="sending || uploading"
              :title="uploading ? '上传中...' : '上传图片'"
              @click="triggerImagePicker"
            >
              <el-icon v-if="uploading"><Loading /></el-icon>
              <el-icon v-else><Picture /></el-icon>
            </button>
            <div v-if="uploadedImages.length" class="image-preview-strip">
              <div
                v-for="(img, idx) in uploadedImages"
                :key="idx"
                class="image-preview-item"
              >
                <img :src="img.url" alt="预览" />
                <button class="image-remove-btn" @click="removeImage(idx)">
                  <Close />
                </button>
              </div>
            </div>
          </div>
          <div class="input-row">
            <el-input
              v-model="inputText"
              type="textarea"
              :rows="1"
              autosize
              :placeholder="
                uploadedImages.length > 0
                  ? '输入文字描述图片（可选）'
                  : '输入问题，Enter 发送，Shift+Enter 换行'
              "
              class="rag-textarea"
              :disabled="sending"
              @keydown="handleKeydown"
            />
            <el-button
              type="primary"
              :icon="useRenderIcon('ri/send-plane-fill')"
              :loading="sending"
              :disabled="!inputText.trim() && uploadedImages.length === 0"
              @click="sendMessage"
            >
              发送
            </el-button>
          </div>
        </div>
        <input
          ref="imageInputRef"
          type="file"
          accept="image/*"
          multiple
          style="display: none"
          @change="handleImageSelect"
        />
        <div class="input-hint">
          <span v-if="uploadedImages.length > 0"
            >{{ uploadedImages.length }} 张图片待发送 · Enter 发送 · Shift+Enter
            换行</span
          >
          <span v-else>Enter 发送 · Shift+Enter 换行</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ==================== 布局样式 ==================== */
.rag-chat-container {
  position: fixed;
  inset: 82px 0 0 210px;
  display: flex;
  overflow: hidden;
  background: var(--el-bg-color);
}

.rag-chat-sidebar {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  width: 220px;
  background: var(--el-bg-color-page);
  border-right: 1px solid var(--el-border-color-lighter);
}

/* ==================== 侧边栏组件 ==================== */
.new-chat-btn {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  margin: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  color: white;
  cursor: pointer;
  background: var(--el-color-primary);
  border: none;
  border-radius: 10px;
  transition: all 0.2s;
}

.new-chat-btn:hover {
  background: var(--el-color-primary-light-3);
  transform: translateY(-1px);
}

.new-chat-btn svg {
  width: 18px;
  height: 18px;
}

.sidebar-conversations {
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
}

.conversations-label,
.settings-label {
  padding: 12px 16px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.conversations-list {
  flex: 1;
  padding: 0 8px;
  overflow-y: auto;
}

.conversation-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 2px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}

.conversation-item:hover {
  background: var(--el-fill-color);
}

.conversation-item.active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.conv-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  color: var(--el-text-color-secondary);
}

.conversation-item.active .conv-icon {
  color: var(--el-color-primary);
}

.conv-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  white-space: nowrap;
}

.conv-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.2s;
}

.conversation-item:hover .conv-delete {
  opacity: 1;
}

.conv-delete:hover {
  color: var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}

.conversations-empty {
  padding: 24px 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.sidebar-settings {
  padding: 0 16px 16px;
}

.setting-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 8px 0;
}

.setting-text {
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.footer-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.footer-sub {
  margin-top: 4px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  opacity: 0.7;
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
  padding: 24px 20px;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.rag-chat-messages > :not(:first-child) {
  margin-top: 0;
}

.rag-chat-input {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 768px;
  padding: 8px 12px;
  margin: 0 auto;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color);
  border-radius: 16px;
  transition: all 0.2s;
}

.rag-chat-input:focus-within {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-9);
}

.input-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}

.image-upload-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 8px;
  transition: all 0.2s;
}

.image-upload-btn:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color);
}

.image-upload-btn:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.image-preview-strip {
  display: flex;
  flex: 1;
  gap: 8px;
  overflow-x: auto;
  scroll-behavior: smooth;
}

.image-preview-item {
  position: relative;
  flex-shrink: 0;
  width: 80px;
  height: 80px;
  overflow: hidden;
  border: 2px solid var(--el-border-color);
  border-radius: 10px;
  transition: all 0.2s;
}

.image-preview-item:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 4px 12px rgb(0 0 0 / 12%);
  transform: translateY(-1px);
}

.image-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.2s;
}

.image-preview-item:hover img {
  transform: scale(1.05);
}

.image-remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  color: white;
  cursor: pointer;
  background: rgb(0 0 0 / 55%);
  border: none;
  border-radius: 50%;
  opacity: 0;
  backdrop-filter: blur(4px);
  transition: all 0.2s;
}

.image-preview-item:hover .image-remove-btn {
  opacity: 1;
}

.image-remove-btn:hover {
  background: var(--el-color-danger);
  transform: scale(1.1);
}

.image-remove-btn svg {
  width: 14px;
  height: 14px;
}

.input-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-row .rag-textarea {
  flex: 1;
}

/* 输入区域容器 */
.rag-input-area {
  padding: 16px 20px 20px;
  background: var(--el-bg-color);
}

.input-hint {
  max-width: 768px;
  margin: 8px auto 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

/* ==================== 消息气泡样式 ==================== */
.messages-container {
  max-width: 768px;
  margin: 0 auto;
}

.message-wrapper {
  margin-bottom: 24px;
  animation: message-in 0.3s ease;
}

@keyframes message-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-content-wrapper {
  display: flex;
  gap: 16px;
}

.user-message-wrapper {
  flex-direction: row-reverse;
}

.user-avatar,
.ai-avatar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
}

.user-avatar {
  color: white;
  background: var(--el-color-primary);
}

.ai-avatar {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-8);
}

.ai-avatar svg {
  width: 18px;
  height: 18px;
}

.user-message-content,
.ai-message-content {
  flex: 1;
  min-width: 0;
}

.user-message-content {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.message-text {
  max-width: 80%;
  padding: 10px 16px;
  font-size: 14px;
  line-height: 1.6;
  color: white;
  background: var(--el-color-primary);
  border-radius: 12px 12px 2px;
}

.ai-message-content {
  padding: 16px;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px 12px 12px 2px;
}

.message-body {
  min-height: 24px;
}

.message-time {
  margin-top: 8px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.user-message-content .message-time {
  margin-right: 4px;
}

.user-message-images {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 8px;
}

.user-message-image {
  width: 100px;
  height: 100px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  transition: transform 0.2s;
}

.user-message-image:hover {
  transform: scale(1.05);
}

.user-message-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* ==================== 打字指示器 ==================== */
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: var(--el-color-primary);
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
    opacity: 0.4;
    transform: translateY(0);
  }

  30% {
    opacity: 1;
    transform: translateY(-8px);
  }
}

/* ==================== 空状态 ==================== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 20px;
  color: var(--el-color-primary);
  opacity: 0.6;
}

.empty-icon svg {
  width: 100%;
  height: 100%;
}

.empty-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.empty-desc {
  margin: 0;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  text-align: center;
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
