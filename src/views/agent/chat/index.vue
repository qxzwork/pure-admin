<script setup lang="ts">
import { ref, reactive, nextTick, onMounted, computed } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { getToken, formatToken } from "@/utils/auth";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import {
  Delete,
  Promotion,
  Check,
  Close,
  Loading,
  Picture
} from "@element-plus/icons-vue";
import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true
});

function renderMarkdown(text: string): string {
  if (!text) return "";
  return marked.parse(text) as string;
}

defineOptions({ name: "AgentChat" });

// ==================== 类型定义 ====================

type ApprovalTool = {
  toolCallId: string;
  toolName: string;
  description: string;
  arguments: string;
};

type ChatMessage = {
  role: "user" | "assistant" | "approval";
  content: string;
  reasoning: string;
  done: boolean;
  time: string;
  threadId?: string;
  tools?: ApprovalTool[];
  approvalStatus?: "pending" | "approved" | "rejected";
  imageIds?: string[];
  images?: { id: string; url: string }[];
};

// ==================== 状态 ====================

const inputText = ref("");
const messages = ref<ChatMessage[]>([]);
const sending = ref(false);
const showThinking = ref(true);
const chatContainerRef = ref<HTMLElement | null>(null);
const conversationId = ref<string>("");
const conversationList = ref<{ id: string; title: string }[]>([]);
const sidebarCollapsed = ref(false);
const textareaRef = ref<HTMLElement | null>(null);
const uploadedImages = ref<{ id: string; url: string }[]>([]);
const uploading = ref(false);
const imageInputRef = ref<HTMLInputElement | null>(null);

// ==================== 计算属性 ====================

const currentConversationTitle = computed(() => {
  if (!conversationId.value) return "新对话";
  const conv = conversationList.value.find(c => c.id === conversationId.value);
  return conv?.title || "新对话";
});

// ==================== 工具函数 ====================

function now(): string {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatRelativeTime(timeStr: string): string {
  if (!timeStr) return "";
  return timeStr;
}

function scrollToBottom() {
  nextTick(() => {
    if (chatContainerRef.value) {
      chatContainerRef.value.scrollTop = chatContainerRef.value.scrollHeight;
    }
  });
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  const token = getToken()?.token;
  if (token) headers["Authorization"] = formatToken(token);
  return headers;
}

async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const resp = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${text}`);
  }
  return resp.json();
}

function getUserInitial(): string {
  return "U";
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

// ==================== 对话历史 ====================

async function fetchConversations() {
  try {
    const resp = await fetch("/api/agent/chat/conversations", {
      headers: getAuthHeaders()
    });
    const res = await resp.json();
    if (res.code === 200) {
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
    const resp = await fetch(`/api/agent/chat/conversations/${id}/messages`, {
      headers: getAuthHeaders()
    });
    const res = await resp.json();
    if (res.code === 200) {
      messages.value = (res.data ?? []).map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        reasoning: "",
        done: true,
        time: msg.time || ""
      }));
      scrollToBottom();
    }
  } catch {
    // ignore
  }
}

async function saveMessage(role: string, content: string, time: string) {
  try {
    await fetch("/api/agent/chat/history", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        conversationId: conversationId.value,
        role,
        content,
        time
      })
    });
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
    const resp = await fetch(`/api/agent/chat/conversations/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders()
    });
    const res = await resp.json();
    if (res.code === 200) {
      message("删除成功", { type: "success" });
      if (conversationId.value === id) {
        conversationId.value = crypto.randomUUID();
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

// ==================== SSE 对话 ====================

function sendMessage() {
  const text = inputText.value.trim();
  if (!text || sending.value) return;

  inputText.value = "";
  const userTime = now();
  const currentImages = uploadedImages.value.map(img => ({
    id: img.id,
    url: img.url
  }));
  const currentImageIds = uploadedImages.value.map(img => img.id);
  messages.value.push({
    role: "user",
    content: text,
    reasoning: "",
    done: true,
    time: userTime,
    imageIds: currentImageIds.length > 0 ? currentImageIds : undefined,
    images: currentImages.length > 0 ? currentImages : undefined
  });
  uploadedImages.value = [];
  saveMessage("user", text, userTime);

  const assistantMsg = reactive<ChatMessage>({
    role: "assistant",
    content: "",
    reasoning: "",
    done: false,
    time: now()
  });
  messages.value.push(assistantMsg);
  sending.value = true;
  scrollToBottom();

  if (!conversationId.value) {
    conversationId.value = crypto.randomUUID();
  }
  const body: Record<string, any> = {
    message: text,
    conversationId: conversationId.value
  };
  if (currentImageIds.length > 0) body.imageIds = currentImageIds;

  fetch("/api/agent/chat/hitl", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  })
    .then(response => {
      if (!response.ok) {
        response.text().then(t => console.error("[Agent] Error body:", t));
        throw new Error(`HTTP ${response.status}`);
      }
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      function read() {
        reader.read().then(({ done, value }) => {
          if (done) {
            if (!assistantMsg.content && !assistantMsg.reasoning) {
              const idx = messages.value.indexOf(assistantMsg);
              if (idx !== -1) messages.value.splice(idx, 1);
            } else {
              assistantMsg.done = true;
              saveMessage("assistant", assistantMsg.content, assistantMsg.time);
              fetchConversations();
            }
            sending.value = false;
            scrollToBottom();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop()!;

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const dataStr = trimmed.slice(5).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const json = JSON.parse(dataStr);

              if (json.type === "INTERRUPTION") {
                const idx = messages.value.indexOf(assistantMsg);
                if (idx !== -1) messages.value.splice(idx, 1);

                messages.value.push({
                  role: "approval",
                  content: json.message || "以下操作需要您的确认",
                  reasoning: "",
                  done: true,
                  time: now(),
                  threadId: json.threadId,
                  tools: json.tools || [],
                  approvalStatus: "pending"
                });
                sending.value = false;
                scrollToBottom();
                return;
              }

              if (json.content) {
                assistantMsg.content += json.content;
                scrollToBottom();
              }
              if (json.reasoningContent) {
                assistantMsg.reasoning += json.reasoningContent;
                scrollToBottom();
              }
              if (json.conversationId && !conversationId.value) {
                conversationId.value = json.conversationId;
              }
              if (json.finished) {
                assistantMsg.done = true;
                sending.value = false;
                saveMessage(
                  "assistant",
                  assistantMsg.content,
                  assistantMsg.time
                );
                fetchConversations();
                scrollToBottom();
                return;
              }
            } catch {
              // ignore parse errors
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
      saveMessage("assistant", assistantMsg.content, assistantMsg.time);
      sending.value = false;
      scrollToBottom();
    });
}

// ==================== 审批操作 ====================

function findPendingApproval(): ChatMessage | undefined {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const msg = messages.value[i];
    if (msg.role === "approval" && msg.approvalStatus === "pending") {
      return msg;
    }
  }
  return undefined;
}

function handleApprovalResponse(threadId: string, resp: any) {
  if (resp.code !== 200) {
    message(resp.message || "审批失败", { type: "error" });
    return;
  }

  const data = resp.data;

  if (data.content && data.content.includes("需要审批")) {
    fetchPendingApproval(threadId);
    return;
  }

  if (data.content) {
    const t = now();
    messages.value.push({
      role: "assistant",
      content: data.content,
      reasoning: "",
      done: true,
      time: t
    });
    saveMessage("assistant", data.content, t);
    fetchConversations();
  }
  scrollToBottom();
}

async function fetchPendingApproval(threadId: string) {
  try {
    const resp = await fetch("/api/agent/pending-approvals", {
      headers: getAuthHeaders()
    });
    const result = await resp.json();
    if (result.code === 200 && result.data) {
      const pending = result.data.find((p: any) => p.threadId === threadId);
      if (pending) {
        messages.value.push({
          role: "approval",
          content: pending.message || "又有新的操作需要您的确认",
          reasoning: "",
          done: true,
          time: now(),
          threadId: pending.threadId,
          tools: pending.tools || [],
          approvalStatus: "pending"
        });
        scrollToBottom();
      }
    }
  } catch (e) {
    console.error("[HITL] 获取待审批信息失败:", e);
  }
}

async function approveAll(msg: ChatMessage) {
  if (!msg.threadId) return;
  msg.approvalStatus = "approved";
  sending.value = true;
  scrollToBottom();

  try {
    const resp = await postJSON<any>("/api/agent/approval", {
      threadId: msg.threadId,
      decision: "APPROVE"
    });
    handleApprovalResponse(msg.threadId, resp);
  } catch (e) {
    message("审批请求失败", { type: "error" });
    msg.approvalStatus = "pending";
  } finally {
    sending.value = false;
    scrollToBottom();
  }
}

async function rejectAll(msg: ChatMessage) {
  if (!msg.threadId) return;
  msg.approvalStatus = "rejected";
  sending.value = true;
  scrollToBottom();

  try {
    const resp = await postJSON<any>("/api/agent/approval", {
      threadId: msg.threadId,
      decision: "REJECT",
      reason: "用户拒绝执行此操作"
    });
    handleApprovalResponse(msg.threadId, resp);
  } catch (e) {
    message("审批请求失败", { type: "error" });
    msg.approvalStatus = "pending";
  } finally {
    sending.value = false;
    scrollToBottom();
  }
}

// ==================== 其他交互 ====================

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

function clearChat() {
  messages.value = [];
  conversationId.value = "";
}

function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value;
}

function insertExample(text: string) {
  inputText.value = text;
  textareaRef.value?.focus();
}

onMounted(async () => {
  await fetchConversations();
  if (conversationList.value.length > 0) {
    await loadConversation(conversationList.value[0].id);
  }
  scrollToBottom();
});
</script>

<template>
  <div class="chat-container">
    <!-- 侧边栏 -->
    <aside class="chat-sidebar" :class="{ collapsed: sidebarCollapsed }">
      <div class="sidebar-header">
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
            </svg>
          </div>
          <span v-show="!sidebarCollapsed" class="brand-text">Agent</span>
        </div>
        <button
          class="collapse-btn"
          :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="toggleSidebar"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path v-if="sidebarCollapsed" d="M9 18l6-6-6-6" />
            <path v-else d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      </div>

      <button class="new-chat-btn" @click="clearChat">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span v-show="!sidebarCollapsed">新对话</span>
      </button>

      <div v-show="!sidebarCollapsed" class="sidebar-conversations">
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

      <div v-show="!sidebarCollapsed" class="sidebar-settings">
        <div class="settings-label">设置</div>
        <div class="setting-item">
          <el-switch v-model="showThinking" size="small" />
          <span class="setting-text">显示思考过程</span>
        </div>
      </div>

      <div v-show="!sidebarCollapsed" class="sidebar-footer">
        <div class="footer-text">Agent 智能助手</div>
        <div class="footer-sub">支持工具调用与人工审批</div>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="chat-main">
      <!-- 顶部栏 -->
      <header class="chat-header">
        <button class="mobile-menu-btn" @click="toggleSidebar">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <div class="header-title">
          <span>{{ currentConversationTitle }}</span>
        </div>
        <div class="header-actions">
          <el-tooltip content="清空对话" placement="bottom">
            <button class="header-action-btn" @click="clearChat">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                />
              </svg>
            </button>
          </el-tooltip>
        </div>
      </header>

      <!-- 消息区域 -->
      <div ref="chatContainerRef" class="chat-messages">
        <!-- 空状态 -->
        <div v-if="!messages.length" class="empty-state">
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
          <h2 class="empty-title">Agent 智能助手</h2>
          <p class="empty-desc">
            我可以帮你完成各种任务，包括代码编写、数据分析、文档处理等
          </p>
          <div class="example-prompts">
            <button
              class="example-btn"
              @click="insertExample('帮我写一个快速排序算法')"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              <span>帮我写一个快速排序算法</span>
            </button>
            <button
              class="example-btn"
              @click="insertExample('解释一下什么是微服务架构')"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              <span>解释一下什么是微服务架构</span>
            </button>
            <button
              class="example-btn"
              @click="insertExample('分析这段代码的性能问题')"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"
                />
              </svg>
              <span>分析这段代码的性能问题</span>
            </button>
          </div>
        </div>

        <!-- 消息列表 -->
        <div v-else class="messages-container">
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            class="message-wrapper"
            :class="[
              `message-${msg.role}`,
              { 'message-approval': msg.role === 'approval' }
            ]"
          >
            <!-- 审批消息 -->
            <template v-if="msg.role === 'approval'">
              <div
                class="approval-card"
                :class="[`approval-${msg.approvalStatus}`]"
              >
                <div class="approval-header">
                  <div class="approval-icon">
                    <svg
                      v-if="msg.approvalStatus === 'pending'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <svg
                      v-else-if="msg.approvalStatus === 'approved'"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                    <svg
                      v-else
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  </div>
                  <div class="approval-title">
                    <span v-if="msg.approvalStatus === 'pending'"
                      >需要您的确认</span
                    >
                    <span v-else-if="msg.approvalStatus === 'approved'"
                      >已批准</span
                    >
                    <span v-else>已拒绝</span>
                  </div>
                </div>

                <div class="approval-message">{{ msg.content }}</div>

                <div v-if="msg.tools?.length" class="approval-tools">
                  <div
                    v-for="(tool, tIdx) in msg.tools"
                    :key="tIdx"
                    class="tool-item"
                  >
                    <div class="tool-header">
                      <el-tag
                        size="small"
                        :type="
                          msg.approvalStatus === 'pending' ? 'warning' : 'info'
                        "
                        effect="plain"
                      >
                        {{ tool.toolName }}
                      </el-tag>
                    </div>
                    <div v-if="tool.description" class="tool-desc">
                      {{ tool.description }}
                    </div>
                    <el-collapse
                      v-if="tool.arguments"
                      class="tool-args-collapse"
                    >
                      <el-collapse-item title="查看参数">
                        <pre class="tool-args">{{ tool.arguments }}</pre>
                      </el-collapse-item>
                    </el-collapse>
                  </div>
                </div>

                <div
                  v-if="msg.approvalStatus === 'pending'"
                  class="approval-actions"
                >
                  <el-button
                    type="primary"
                    :loading="sending"
                    @click="approveAll(msg)"
                  >
                    <el-icon v-if="!sending"><Check /></el-icon>
                    批准执行
                  </el-button>
                  <el-button
                    type="danger"
                    :loading="sending"
                    @click="rejectAll(msg)"
                  >
                    <el-icon v-if="!sending"><Close /></el-icon>
                    拒绝
                  </el-button>
                </div>

                <div class="approval-time">
                  {{ formatRelativeTime(msg.time) }}
                </div>
              </div>
            </template>

            <!-- 普通消息 -->
            <template v-else>
              <!-- 用户消息 -->
              <div
                v-if="msg.role === 'user'"
                class="message-content-wrapper user-message-wrapper"
              >
                <div class="user-avatar">
                  <span>{{ getUserInitial() }}</span>
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
                    {{ formatRelativeTime(msg.time) }}
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
                  <!-- 思考过程 -->
                  <template v-if="showThinking && msg.reasoning">
                    <div class="thinking-section">
                      <div
                        class="thinking-header"
                        @click="
                          e =>
                            (
                              e.currentTarget as HTMLElement
                            ).parentElement?.classList.toggle('expanded')
                        "
                      >
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4M12 8h.01" />
                        </svg>
                        <span>思考过程</span>
                        <svg
                          class="thinking-arrow"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </div>
                      <div class="thinking-content">
                        <div class="thinking-text">{{ msg.reasoning }}</div>
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
                    {{ formatRelativeTime(msg.time) }}
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="chat-input-area">
        <div class="input-container">
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
            <textarea
              ref="textareaRef"
              v-model="inputText"
              placeholder="输入问题，Enter 发送，Shift+Enter 换行"
              :disabled="sending"
              rows="1"
              @keydown="handleKeydown"
            />
            <button
              class="send-btn"
              :class="{ active: inputText.trim() && !sending }"
              :disabled="!inputText.trim() || sending"
              @click="sendMessage"
            >
              <el-icon v-if="sending"><Loading /></el-icon>
              <svg
                v-else
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
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
          <span>Enter 发送 · Shift+Enter 换行</span>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
/* ==================== 基础变量 ==================== */
.chat-container {
  --sidebar-width: 200px;
  --sidebar-collapsed-width: 60px;
  --header-height: 56px;
  --input-area-height: 120px;
  --msg-max-width: 768px;

  position: fixed;
  inset: 82px 0 0 210px;
  display: flex;
  overflow: hidden;
  background: var(--el-bg-color);
}

/* ==================== 侧边栏 ==================== */
.chat-sidebar {
  display: flex;
  flex-direction: column;
  width: var(--sidebar-width);
  background: var(--el-bg-color-page);
  border-right: 1px solid var(--el-border-color-lighter);
  transition: width 0.3s ease;
}

.chat-sidebar.collapsed {
  width: var(--sidebar-collapsed-width);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.sidebar-brand {
  display: flex;
  gap: 10px;
  align-items: center;
}

.brand-icon {
  width: 28px;
  height: 28px;
  color: var(--el-color-primary);
}

.brand-icon svg {
  width: 100%;
  height: 100%;
}

.brand-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 6px;
  transition: all 0.2s;
}

.collapse-btn:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color);
}

.collapse-btn svg {
  width: 16px;
  height: 16px;
}

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

.chat-sidebar.collapsed .new-chat-btn {
  padding: 10px;
  margin: 12px 16px;
}

.chat-sidebar.collapsed .new-chat-btn span {
  display: none;
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

/* ==================== 主内容区 ==================== */
.chat-main {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

/* ==================== 顶部栏 ==================== */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: var(--header-height);
  padding: 0 20px;
  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.mobile-menu-btn {
  display: none;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--el-text-color-primary);
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 8px;
}

.mobile-menu-btn svg {
  width: 20px;
  height: 20px;
}

.header-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.header-actions {
  display: flex;
  gap: 4px;
}

.header-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--el-text-color-secondary);
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 8px;
  transition: all 0.2s;
}

.header-action-btn:hover {
  color: var(--el-text-color-primary);
  background: var(--el-fill-color);
}

.header-action-btn svg {
  width: 18px;
  height: 18px;
}

/* ==================== 消息区域 ==================== */
.chat-messages {
  flex: 1;
  padding: 24px 20px;
  overflow-y: auto;
  scroll-behavior: smooth;
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
  margin: 0 0 32px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

.example-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  max-width: 600px;
}

.example-btn {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 14px 18px;
  font-size: 13px;
  color: var(--el-text-color-regular);
  text-align: left;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  transition: all 0.2s;
}

.example-btn:hover {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-color: var(--el-color-primary);
  box-shadow: 0 4px 12px rgb(0 0 0 / 5%);
  transform: translateY(-2px);
}

.example-btn svg {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
}

/* ==================== 消息列表 ==================== */
.messages-container {
  max-width: var(--msg-max-width);
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

/* 用户消息 */
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

/* ==================== 思考过程 ==================== */
.thinking-section {
  margin-bottom: 12px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.thinking-header {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  cursor: pointer;
  background: var(--el-fill-color-light);
  transition: background 0.2s;
}

.thinking-header:hover {
  background: var(--el-fill-color);
}

.thinking-header svg:first-child {
  width: 14px;
  height: 14px;
  color: var(--el-text-color-secondary);
}

.thinking-header span {
  font-size: 12px;
  font-weight: 500;
  color: var(--el-text-color-secondary);
}

.thinking-arrow {
  width: 14px;
  height: 14px;
  margin-left: auto;
  color: var(--el-text-color-secondary);
  transition: transform 0.2s;
}

.thinking-section.expanded .thinking-arrow {
  transform: rotate(180deg);
}

.thinking-content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.thinking-section.expanded .thinking-content {
  max-height: 500px;
}

.thinking-text {
  padding: 12px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--el-text-color-secondary);
  word-break: break-all;
  white-space: pre-wrap;
}

/* ==================== 审批卡片 ==================== */
.approval-card {
  max-width: 100%;
  padding: 20px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
  transition: all 0.3s;
}

.approval-card.approval-pending {
  background: var(--el-color-warning-light-9);
  border-color: var(--el-color-warning);
}

.approval-card.approval-approved {
  background: var(--el-color-success-light-9);
  border-color: var(--el-color-success);
}

.approval-card.approval-rejected {
  background: var(--el-color-danger-light-9);
  border-color: var(--el-color-danger);
}

.approval-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}

.approval-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
}

.approval-icon svg {
  width: 24px;
  height: 24px;
}

.approval-pending .approval-icon {
  color: var(--el-color-warning);
}

.approval-approved .approval-icon {
  color: var(--el-color-success);
}

.approval-rejected .approval-icon {
  color: var(--el-color-danger);
}

.approval-title {
  font-size: 15px;
  font-weight: 600;
}

.approval-pending .approval-title {
  color: var(--el-color-warning);
}

.approval-approved .approval-title {
  color: var(--el-color-success);
}

.approval-rejected .approval-title {
  color: var(--el-color-danger);
}

.approval-message {
  margin-bottom: 16px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-regular);
}

.approval-tools {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.tool-item {
  padding: 12px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.tool-header {
  margin-bottom: 6px;
}

.tool-desc {
  margin-bottom: 8px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.tool-args-collapse {
  margin-top: 8px;
}

:deep(.tool-args-collapse .el-collapse-item__header) {
  height: 28px;
  font-size: 12px;
  line-height: 28px;
  background: none;
  border: none;
}

:deep(.tool-args-collapse .el-collapse-item__wrap) {
  background: none;
  border: none;
}

.tool-args {
  max-height: 150px;
  padding: 8px;
  overflow-y: auto;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  word-break: break-all;
  white-space: pre-wrap;
  background: var(--el-fill-color-lighter);
  border-radius: 4px;
}

.approval-actions {
  display: flex;
  gap: 10px;
}

.approval-time {
  margin-top: 12px;
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

/* ==================== 输入区域 ==================== */
.chat-input-area {
  padding: 16px 20px 20px;
  background: var(--el-bg-color);
}

.input-container {
  max-width: var(--msg-max-width);
  padding: 8px 12px;
  margin: 0 auto;
  background: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color);
  border-radius: 16px;
  transition: all 0.2s;
}

.input-container:focus-within {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 3px var(--el-color-primary-light-9);
}

.input-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
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
  width: 60px;
  height: 60px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
}

.image-preview-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.image-remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  color: white;
  cursor: pointer;
  background: rgb(0 0 0 / 50%);
  border: none;
  border-radius: 50%;
  opacity: 0;
  transition: opacity 0.2s;
}

.image-preview-item:hover .image-remove-btn {
  opacity: 1;
}

.image-remove-btn svg {
  width: 12px;
  height: 12px;
}

.input-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-row textarea {
  flex: 1;
  min-height: 24px;
  max-height: 200px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  resize: none;
  outline: none;
  background: none;
  border: none;
}

.input-row textarea::placeholder {
  color: var(--el-text-color-secondary);
}

.input-row textarea:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.send-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  color: var(--el-text-color-secondary);
  cursor: not-allowed;
  background: var(--el-fill-color);
  border: none;
  border-radius: 10px;
  transition: all 0.2s;
}

.send-btn.active {
  color: white;
  cursor: pointer;
  background: var(--el-color-primary);
}

.send-btn.active:hover {
  background: var(--el-color-primary-light-3);
  transform: scale(1.05);
}

.send-btn svg {
  width: 18px;
  height: 18px;
}

.input-hint {
  max-width: var(--msg-max-width);
  margin: 8px auto 0;
  font-size: 11px;
  color: var(--el-text-color-secondary);
  text-align: center;
}

/* ==================== Markdown 样式 ==================== */
.markdown-body {
  font-size: 14px;
  line-height: 1.7;
  color: var(--el-text-color-primary);
  overflow-wrap: break-word;
}

:deep(.markdown-body p) {
  margin: 0 0 12px;
}

:deep(.markdown-body p:last-child) {
  margin-bottom: 0;
}

:deep(.markdown-body h1),
:deep(.markdown-body h2),
:deep(.markdown-body h3),
:deep(.markdown-body h4) {
  margin: 16px 0 8px;
  font-weight: 600;
  line-height: 1.4;
}

:deep(.markdown-body h1:first-child),
:deep(.markdown-body h2:first-child),
:deep(.markdown-body h3:first-child),
:deep(.markdown-body h4:first-child) {
  margin-top: 0;
}

:deep(.markdown-body h1) {
  font-size: 1.5em;
}

:deep(.markdown-body h2) {
  font-size: 1.3em;
}

:deep(.markdown-body h3) {
  font-size: 1.1em;
}

:deep(.markdown-body ul),
:deep(.markdown-body ol) {
  padding-left: 24px;
  margin: 8px 0;
}

:deep(.markdown-body li) {
  margin: 4px 0;
  line-height: 1.6;
}

:deep(.markdown-body code) {
  padding: 2px 6px;
  font-family: "Fira Code", Consolas, Monaco, monospace;
  font-size: 13px;
  background: var(--el-fill-color);
  border-radius: 4px;
}

:deep(.markdown-body pre) {
  padding: 16px;
  margin: 12px 0;
  overflow-x: auto;
  background: var(--el-fill-color-dark);
  border-radius: 8px;
}

:deep(.markdown-body pre code) {
  padding: 0;
  color: var(--el-text-color-primary);
  background: none;
}

:deep(.markdown-body table) {
  width: 100%;
  margin: 12px 0;
  border-collapse: collapse;
}

:deep(.markdown-body th),
:deep(.markdown-body td) {
  padding: 8px 12px;
  text-align: left;
  border: 1px solid var(--el-border-color);
}

:deep(.markdown-body th) {
  font-weight: 600;
  background: var(--el-fill-color-light);
}

:deep(.markdown-body tr:hover) {
  background: var(--el-fill-color-lighter);
}

:deep(.markdown-body blockquote) {
  padding: 8px 16px;
  margin: 12px 0;
  color: var(--el-text-color-regular);
  background: var(--el-color-primary-light-9);
  border-left: 4px solid var(--el-color-primary);
}

:deep(.markdown-body hr) {
  margin: 16px 0;
  border: none;
  border-top: 1px solid var(--el-border-color);
}

:deep(.markdown-body a) {
  color: var(--el-color-primary);
  text-decoration: none;
}

:deep(.markdown-body a:hover) {
  text-decoration: underline;
}

:deep(.markdown-body strong) {
  font-weight: 600;
}

:deep(.markdown-body img) {
  max-width: 100%;
  border-radius: 8px;
}

/* ==================== 响应式 ==================== */
@media (width <= 768px) {
  .chat-container {
    inset: 0;
  }

  .chat-sidebar {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    z-index: 200;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }

  .chat-sidebar:not(.collapsed) {
    width: 280px;
    box-shadow: 4px 0 20px rgb(0 0 0 / 10%);
    transform: translateX(0);
  }

  .mobile-menu-btn {
    display: flex;
  }

  .messages-container {
    padding: 0 4px;
  }

  .message-text {
    max-width: 90%;
  }

  .example-prompts {
    flex-direction: column;
    width: 100%;
  }

  .example-btn {
    width: 100%;
  }
}
</style>
