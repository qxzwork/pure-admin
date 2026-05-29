<script setup lang="ts">
import { ref, nextTick, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { getToken, formatToken } from "@/utils/auth";

defineOptions({ name: "RagChat" });

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

  const assistantMsg: ChatMessage = {
    role: "assistant",
    content: "",
    steps: [],
    done: false,
    time: now()
  };
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
            if (line.startsWith("event:")) {
              eventType = line.slice(6).trim();
            } else if (line.startsWith("data:") && eventType) {
              const data = line.slice(5).trim();
              handleSSE(eventType, data, assistantMsg);
              eventType = "";
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
        <span class="text-sm">显示执行流程</span>
      </div>
      <div class="text-xs text-gray-400 mt-auto">
        RAG 智能问答，流式输出，实时展示执行流程。
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
              <!-- 执行流程 -->
              <template v-if="showThinking && msg.steps.length">
                <el-collapse class="mb-2">
                  <el-collapse-item title="执行流程">
                    <div class="space-y-1.5">
                      <div
                        v-for="(step, si) in msg.steps"
                        :key="si"
                        class="text-xs"
                      >
                        <template
                          v-if="
                            step.stage === 'rewrite' && step.status === 'done'
                          "
                        >
                          <div class="flex items-center gap-1 mb-0.5">
                            <span
                              :class="getStepColor(step.status)"
                              class="inline-flex items-center"
                            >
                              <component
                                :is="
                                  useRenderIcon(
                                    getStepIcon(step.stage, step.status)
                                  )
                                "
                                class="size-3.5 mr-0.5"
                              />
                            </span>
                            <span class="font-semibold text-gray-600">
                              问题理解
                            </span>
                            <el-tag
                              v-if="step.queryRewritten"
                              size="small"
                              type="warning"
                              class="ml-1"
                            >
                              已重写
                            </el-tag>
                            <el-tag
                              v-else
                              size="small"
                              type="info"
                              class="ml-1"
                            >
                              原始问题
                            </el-tag>
                          </div>
                          <div
                            v-if="step.queryRewritten"
                            class="ml-5 text-gray-500"
                          >
                            <div>{{ step.original }}</div>
                            <div class="text-(--el-color-warning)">
                              → {{ step.rewritten }}
                            </div>
                          </div>
                        </template>

                        <template
                          v-if="
                            step.stage === 'retrieve' && step.status === 'done'
                          "
                        >
                          <div class="flex items-center gap-1 mb-0.5">
                            <span
                              :class="getStepColor(step.status)"
                              class="inline-flex items-center"
                            >
                              <component
                                :is="
                                  useRenderIcon(
                                    getStepIcon(step.stage, step.status)
                                  )
                                "
                                class="size-3.5 mr-0.5"
                              />
                            </span>
                            <span class="font-semibold text-gray-600">
                              知识检索
                            </span>
                            <el-tag size="small" type="info" class="ml-1">
                              {{ step.count }} 条
                            </el-tag>
                          </div>
                          <div
                            v-if="step.chunks?.length"
                            class="ml-5 space-y-1"
                          >
                            <div
                              v-for="(chunk, ci) in step.chunks"
                              :key="ci"
                              class="bg-white/50 rounded p-1.5 border border-gray-200"
                            >
                              <div class="flex items-center gap-1 mb-0.5">
                                <el-tag size="small" type="info">
                                  {{ (chunk.score * 100).toFixed(1) }}%
                                </el-tag>
                                <span class="text-gray-400 text-[11px]">
                                  {{ chunk.source }}
                                </span>
                              </div>
                              <div class="text-gray-600 line-clamp-3">
                                {{ chunk.content }}
                              </div>
                            </div>
                          </div>
                        </template>

                        <template v-if="step.status === 'start'">
                          <div
                            class="flex items-center gap-1 text-gray-400 animate-pulse"
                          >
                            <component
                              :is="useRenderIcon('ri:loader-4-line')"
                              class="size-3.5 animate-spin"
                            />
                            <span>{{ step.message || "处理中..." }}</span>
                          </div>
                        </template>
                      </div>
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
          输入问题开始对话，我会基于知识库内容为你解答
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
