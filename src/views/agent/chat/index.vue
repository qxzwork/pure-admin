<script setup lang="ts">
import { ref, reactive, nextTick, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { getToken, formatToken } from "@/utils/auth";
import { message } from "@/utils/message";

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
  // 审批专用字段
  threadId?: string;
  tools?: ApprovalTool[];
  approvalStatus?: "pending" | "approved" | "rejected";
};

// ==================== 状态 ====================

const inputText = ref("");
const messages = ref<ChatMessage[]>([]);
const sending = ref(false);
const showThinking = ref(true);
const chatContainerRef = ref<HTMLElement | null>(null);
const conversationId = ref<string>(crypto.randomUUID());

// ==================== 工具函数 ====================

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

/** 构建带鉴权的请求 headers */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  const token = getToken()?.token;
  if (token) headers["Authorization"] = formatToken(token);
  return headers;
}

/** 通用 fetch POST JSON（非 SSE） */
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

// ==================== SSE 对话 ====================

function sendMessage() {
  const text = inputText.value.trim();
  if (!text || sending.value) return;

  inputText.value = "";
  messages.value.push({
    role: "user",
    content: text,
    reasoning: "",
    done: true,
    time: now()
  });

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

  const body = { message: text, conversationId: conversationId.value };

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
            // 如果 assistantMsg 还没有内容（可能整个响应就是中断），移除空消息
            if (!assistantMsg.content && !assistantMsg.reasoning) {
              const idx = messages.value.indexOf(assistantMsg);
              if (idx !== -1) messages.value.splice(idx, 1);
            } else {
              assistantMsg.done = true;
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

              // 检测中断事件
              if (json.type === "INTERRUPTION") {
                // 移除空的 assistant 消息
                const idx = messages.value.indexOf(assistantMsg);
                if (idx !== -1) messages.value.splice(idx, 1);

                // 插入审批卡片
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

              if (json.finished) {
                assistantMsg.done = true;
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
      sending.value = false;
      scrollToBottom();
    });
}

// ==================== 审批操作 ====================

/** 找到最近一个 pending 状态的审批消息 */
function findPendingApproval(): ChatMessage | undefined {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    const msg = messages.value[i];
    if (msg.role === "approval" && msg.approvalStatus === "pending") {
      return msg;
    }
  }
  return undefined;
}

/** 处理审批响应（可能包含链式中断） */
function handleApprovalResponse(threadId: string, resp: any) {
  if (resp.code !== 200) {
    message(resp.message || "审批失败", { type: "error" });
    return;
  }

  const data = resp.data;

  // 检查响应中是否包含新的中断（链式审批）
  // 后端在链式中断时会返回特定的提示文本
  if (data.content && data.content.includes("需要审批")) {
    // 刷新待审批列表
    fetchPendingApproval(threadId);
    return;
  }

  // 正常响应，追加 assistant 消息
  if (data.content) {
    messages.value.push({
      role: "assistant",
      content: data.content,
      reasoning: "",
      done: true,
      time: now()
    });
  }
  scrollToBottom();
}

/** 从后端获取指定 thread 的待审批信息（用于链式审批） */
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

/** 批准所有工具调用 */
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
    msg.approvalStatus = "pending"; // 回滚状态
  } finally {
    sending.value = false;
    scrollToBottom();
  }
}

/** 拒绝所有工具调用 */
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
  conversationId.value = crypto.randomUUID();
}

onMounted(() => {
  scrollToBottom();
});
</script>

<template>
  <div class="flex h-full">
    <!-- 左侧 -->
    <div
      class="w-50 shrink-0 border-r border-(--el-border-color) p-3 flex flex-col"
    >
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
        <span class="text-sm">显示思考过程</span>
      </div>
      <div class="text-xs text-gray-400 mt-auto">
        Agent 智能对话，支持工具调用与人工审批。
      </div>
    </div>

    <!-- 右侧：对话区 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div ref="chatContainerRef" class="flex-1 overflow-auto p-4 space-y-4">
        <template v-if="messages.length">
          <div
            v-for="(msg, idx) in messages"
            :key="idx"
            :class="[
              'flex',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            ]"
          >
            <!-- ==================== 审批卡片 ==================== -->
            <div
              v-if="msg.role === 'approval'"
              class="max-w-[80%] w-full rounded-2xl border px-4 py-3 shadow-sm"
              :class="{
                'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700':
                  msg.approvalStatus === 'pending',
                'border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-700':
                  msg.approvalStatus === 'approved',
                'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-700':
                  msg.approvalStatus === 'rejected'
              }"
            >
              <!-- 标题 -->
              <div class="flex items-center gap-2 mb-2">
                <span class="text-base">🔒</span>
                <span
                  class="font-medium text-sm"
                  :class="{
                    'text-amber-700 dark:text-amber-400':
                      msg.approvalStatus === 'pending',
                    'text-green-700 dark:text-green-400':
                      msg.approvalStatus === 'approved',
                    'text-red-700 dark:text-red-400':
                      msg.approvalStatus === 'rejected'
                  }"
                >
                  <template v-if="msg.approvalStatus === 'pending'"
                    >需要您的确认</template
                  >
                  <template v-else-if="msg.approvalStatus === 'approved'"
                    >✅ 已批准</template
                  >
                  <template v-else>❌ 已拒绝</template>
                </span>
              </div>

              <!-- 待审批工具列表 -->
              <div class="space-y-2 mb-3">
                <div
                  v-for="(tool, tIdx) in msg.tools"
                  :key="tIdx"
                  class="rounded-lg bg-white/60 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-2.5 text-sm"
                >
                  <div class="flex items-center gap-1.5 mb-1">
                    <el-tag size="small" type="warning">{{
                      tool.toolName
                    }}</el-tag>
                  </div>
                  <div
                    v-if="tool.description"
                    class="text-gray-600 dark:text-gray-300 text-xs mb-1.5 whitespace-pre-wrap"
                  >
                    {{ tool.description }}
                  </div>
                  <el-collapse v-if="tool.arguments">
                    <el-collapse-item title="查看参数">
                      <pre
                        class="text-xs text-gray-500 whitespace-pre-wrap break-all overflow-auto max-h-40"
                        >{{ tool.arguments }}</pre
                      >
                    </el-collapse-item>
                  </el-collapse>
                </div>
              </div>

              <!-- 操作按钮 -->
              <div v-if="msg.approvalStatus === 'pending'" class="flex gap-2">
                <el-button
                  type="primary"
                  size="small"
                  :loading="sending"
                  @click="approveAll(msg)"
                >
                  批准执行
                </el-button>
                <el-button
                  type="danger"
                  size="small"
                  :loading="sending"
                  @click="rejectAll(msg)"
                >
                  拒绝
                </el-button>
              </div>

              <!-- 时间 -->
              <div class="text-[10px] mt-2 text-gray-400 text-right">
                {{ msg.time }}
              </div>
            </div>

            <!-- ==================== 普通消息 ==================== -->
            <div
              v-else
              :class="[
                'max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm',
                msg.role === 'user'
                  ? 'bg-(--el-color-primary) text-white rounded-br-sm'
                  : 'bg-(--el-fill-color-light) text-(--el-text-color-primary) rounded-bl-sm'
              ]"
            >
              <!-- 思考过程 -->
              <template v-if="showThinking && msg.reasoning">
                <el-collapse class="mb-2">
                  <el-collapse-item title="思考过程">
                    <div
                      class="text-xs text-gray-500 whitespace-pre-wrap break-all"
                    >
                      {{ msg.reasoning }}
                    </div>
                  </el-collapse-item>
                </el-collapse>
              </template>

              <!-- 消息内容 -->
              <div class="whitespace-pre-wrap break-all min-h-5">
                <template
                  v-if="msg.role === 'assistant' && !msg.content && !msg.done"
                >
                  <span class="text-gray-400 animate-pulse">思考中...</span>
                </template>
                <template v-else>
                  {{ msg.content }}
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
          输入问题开始对话，敏感操作会触发人工审批
        </div>
      </div>

      <!-- 输入区 -->
      <div class="border-t border-(--el-border-color) p-3 flex items-end gap-2">
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
:deep(.el-collapse-item__header) {
  height: 28px;
  font-size: 12px;
  line-height: 28px;
}

:deep(.el-collapse-item__content) {
  padding-bottom: 4px;
}

:deep(.el-collapse-item__wrap) {
  border-bottom: none;
}
</style>
