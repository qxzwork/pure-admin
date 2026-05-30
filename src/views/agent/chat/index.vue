<script setup lang="ts">
import { ref, nextTick, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { getToken, formatToken } from "@/utils/auth";

defineOptions({ name: "AgentChat" });

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  reasoning: string;
  done: boolean;
  time: string;
};

const inputText = ref("");
const messages = ref<ChatMessage[]>([]);
const sending = ref(false);
const showThinking = ref(true);
const chatContainerRef = ref<HTMLElement | null>(null);
const conversationId = ref<string>(crypto.randomUUID());

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
    reasoning: "",
    done: true,
    time: now()
  });

  const assistantMsg: ChatMessage = {
    role: "assistant",
    content: "",
    reasoning: "",
    done: false,
    time: now()
  };
  messages.value.push(assistantMsg);
  sending.value = true;
  scrollToBottom();

  const body = { message: text, conversationId: conversationId.value };

  const token = getToken()?.token;
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (token) headers["Authorization"] = formatToken(token);

  fetch("/api/agent/chat/stream", {
    method: "POST",
    headers,
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
            assistantMsg.done = true;
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
        Agent 智能对话，支持工具调用，流式输出。
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
            <div
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
          输入问题开始对话，Agent 会调用工具为你解答
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
