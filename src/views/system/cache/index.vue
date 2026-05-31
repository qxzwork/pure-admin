<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { message } from "@/utils/message";
import { ElMessageBox } from "element-plus";
import { http } from "@/utils/http";

defineOptions({ name: "ManagementCache" });

const cacheInfo = ref<Record<string, any>>({});
const loading = ref(false);
const keyPattern = ref("*");
const keyList = ref<Array<Record<string, any>>>([]);

async function loadInfo() {
  try {
    const res = await http.request<any>("get", "/api/management/cache/info");
    if (res?.code === 200) cacheInfo.value = res.data ?? {};
  } catch {}
}

async function loadKeys() {
  loading.value = true;
  try {
    const res = await http.request<any>("get", "/api/management/cache/keys", {
      params: { pattern: keyPattern.value, limit: 200 }
    });
    keyList.value = res?.data ?? [];
  } catch {
    keyList.value = [];
  } finally {
    loading.value = false;
  }
}

async function handleDeleteKey(key: string) {
  try {
    await ElMessageBox.confirm(`确定删除 Key：${key}？`, "警告", {
      type: "warning"
    });
    const res = await http.request<any>(
      "delete",
      `/api/management/cache/key/${encodeURIComponent(key)}`
    );
    if (res?.code === 200) {
      message("删除成功", { type: "success" });
      loadKeys();
    }
  } catch {}
}

async function handleClearPrefix() {
  if (!keyPattern.value || keyPattern.value === "*") {
    message("请输入具体的前缀再清除", { type: "warning" });
    return;
  }
  try {
    const prefix = keyPattern.value.replace("*", "");
    await ElMessageBox.confirm(
      `确定清除前缀「${prefix}」的所有缓存？`,
      "警告",
      { type: "warning" }
    );
    const res = await http.request<any>(
      "delete",
      `/api/management/cache/clear/${encodeURIComponent(prefix)}`
    );
    if (res?.code === 200) {
      message(`已清除 ${res.data ?? 0} 个 Key`, { type: "success" });
      loadKeys();
    }
  } catch {}
}

async function handleFlush() {
  try {
    await ElMessageBox.confirm(
      "确定清空当前数据库所有缓存？此操作不可恢复！",
      "严重警告",
      { type: "error" }
    );
    const res = await http.request<any>(
      "delete",
      "/api/management/cache/flush"
    );
    if (res?.code === 200) {
      message("已清空", { type: "success" });
      loadKeys();
      loadInfo();
    }
  } catch {}
}

function fmtTtl(ttl: number) {
  if (ttl === -1) return "永久";
  if (ttl === -2) return "不存在";
  if (ttl < 60) return `${ttl}秒`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}分钟`;
  return `${Math.floor(ttl / 3600)}小时`;
}

onMounted(() => {
  loadInfo();
  loadKeys();
});
</script>

<template>
  <div class="p-4">
    <el-row :gutter="16" class="mb-4">
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="text-center">
            <div class="text-2xl text-(--el-color-primary) font-bold">
              {{ cacheInfo.redisVersion ?? "-" }}
            </div>
            <div class="text-sm text-gray-500 mt-1">Redis 版本</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="text-center">
            <div class="text-2xl text-(--el-color-success) font-bold">
              {{ cacheInfo.usedMemory ?? "-" }}
            </div>
            <div class="text-sm text-gray-500 mt-1">内存占用</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="text-center">
            <div class="text-2xl text-(--el-color-warning) font-bold">
              {{ cacheInfo.dbSize ?? "-" }}
            </div>
            <div class="text-sm text-gray-500 mt-1">Key 数量</div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover">
          <div class="text-center">
            <div class="text-2xl text-(--el-color-info) font-bold">
              {{ cacheInfo.connectedClients ?? "-" }}
            </div>
            <div class="text-sm text-gray-500 mt-1">连接数</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <div class="flex items-center mb-4 gap-2">
        <el-input
          v-model="keyPattern"
          placeholder="Key 模式 (如 *)"
          clearable
          class="w-60!"
          @keyup.enter="loadKeys"
        />
        <el-button
          type="primary"
          :icon="useRenderIcon('ri/search-line')"
          @click="loadKeys"
          >查询</el-button
        >
        <el-button
          type="warning"
          :icon="useRenderIcon('ri/delete-bin-line')"
          @click="handleClearPrefix"
          >按前缀清除</el-button
        >
        <el-button
          type="danger"
          :icon="useRenderIcon('ri-delete-bin-5-line')"
          @click="handleFlush"
          >清空全部</el-button
        >
        <el-button
          :icon="useRenderIcon('ri/refresh-line')"
          @click="
            loadInfo();
            loadKeys();
          "
          >刷新</el-button
        >
      </div>

      <el-table v-loading="loading" :data="keyList" border stripe>
        <el-table-column
          prop="key"
          label="Key"
          min-width="300"
          show-overflow-tooltip
        />
        <el-table-column prop="type" label="类型" width="100" />
        <el-table-column label="TTL" width="120">
          <template #default="{ row }">{{ fmtTtl(row.ttl) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="danger"
              :icon="useRenderIcon('ri/delete-bin-line')"
              @click="handleDeleteKey(row.key)"
              >删除</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>
