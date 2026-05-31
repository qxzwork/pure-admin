<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref, computed, onMounted } from "vue";
import { noticesData } from "./data";
import NoticeList from "./components/NoticeList.vue";
import { http } from "@/utils/http";

import BellIcon from "~icons/lucide/bell";
import ArrowRightIcon from "~icons/ri/arrow-right-s-line";

const { t } = useI18n();
const dropdownRef = ref();
const notices = ref(noticesData);
const activeKey = ref(noticesData[0]?.key);
const unreadCount = ref(0);

onMounted(async () => {
  try {
    const res = await http.request<any>(
      "get",
      "/api/auth/notifications/unread-count"
    );
    if (res?.code === 200) unreadCount.value = Number(res.data ?? 0);
  } catch {}
});

const getLabel = computed(
  () => item =>
    t(item.name) + (item.list.length > 0 ? `(${item.list.length})` : "")
);

const currentNoticeHasData = computed(() => {
  const currentNotice = notices.value.find(
    item => item.key === activeKey.value
  );
  return currentNotice && currentNotice.list.length > 0;
});

const hasAnyNoticeData = computed(() => {
  return notices.value.some(
    item => Array.isArray(item.list) && item.list.length > 0
  );
});

const onWatchMore = () => {
  dropdownRef.value.handleClose();
};

const onMarkAsRead = () => {
  const currentNotice = notices.value.find(
    item => item.key === activeKey.value
  );
  if (currentNotice) {
    currentNotice.list = [];
  }
};
</script>

<template>
  <el-dropdown ref="dropdownRef" trigger="click" placement="bottom-end">
    <span
      :class="['dropdown-badge', 'navbar-bg-hover', 'select-none', 'mr-1.75']"
    >
      <el-badge is-dot :hidden="!hasAnyNoticeData && unreadCount === 0">
        <span class="header-notice-icon">
          <IconifyIconOffline :icon="BellIcon" />
          <span
            v-if="unreadCount > 0"
            class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full min-w-4 h-4 flex-c px-1"
          >
            {{ unreadCount > 99 ? "99+" : unreadCount }}
          </span>
        </span>
      </el-badge>
    </span>
    <template #dropdown>
      <el-dropdown-menu>
        <el-tabs
          v-model="activeKey"
          :stretch="true"
          class="dropdown-tabs"
          :style="{ width: notices.length === 0 ? '200px' : '330px' }"
        >
          <el-empty
            v-if="notices.length === 0"
            :description="t('status.pureNoMessage')"
            :image-size="60"
          />
          <span v-else>
            <template v-for="item in notices" :key="item.key">
              <el-tab-pane :label="getLabel(item)" :name="`${item.key}`">
                <el-scrollbar max-height="345px">
                  <div class="noticeList-container">
                    <NoticeList :list="item.list" :emptyText="item.emptyText" />
                  </div>
                </el-scrollbar>
              </el-tab-pane>
            </template>
          </span>
        </el-tabs>
        <div
          v-if="currentNoticeHasData"
          class="border-t border-t-(--el-border-color-light) text-sm"
        >
          <div class="flex-bc m-1">
            <el-button type="primary" size="small" text @click="onWatchMore">
              {{ t("buttons.pureWatchMore") }}
              <IconifyIconOffline :icon="ArrowRightIcon" />
            </el-button>
            <el-button type="primary" size="small" text @click="onMarkAsRead">
              {{ t("buttons.pureMarkAsRead") }}
            </el-button>
          </div>
        </div>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style lang="scss" scoped>
/* ”铃铛“摇晃衰减动画 */
@keyframes pure-bell-ring {
  0%,
  100% {
    transform-origin: top;
  }

  15% {
    transform: rotateZ(10deg);
  }

  30% {
    transform: rotateZ(-10deg);
  }

  45% {
    transform: rotateZ(5deg);
  }

  60% {
    transform: rotateZ(-5deg);
  }

  75% {
    transform: rotateZ(2deg);
  }
}

.dropdown-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 48px;
  cursor: pointer;

  .header-notice-icon {
    font-size: 16px;
  }

  &:hover {
    .header-notice-icon svg {
      animation: pure-bell-ring 1s both;
    }
  }
}

.dropdown-tabs {
  .noticeList-container {
    padding: 15px 24px 0;
  }

  :deep(.el-tabs__header) {
    margin: 0;
  }

  :deep(.el-tabs__nav-wrap)::after {
    height: 1px;
  }

  :deep(.el-tabs__nav-wrap) {
    padding: 0 36px;
  }
}
</style>
