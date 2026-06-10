<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useDark, useECharts } from "@pureadmin/utils";
import type { ChartConfig } from "@/api/text-to-sql";

const props = defineProps({
  config: {
    type: Object as () => ChartConfig,
    required: true
  }
});

const { isDark } = useDark();
const theme = computed(() => (isDark.value ? "dark" : "light"));

const chartRef = ref();
const { setOptions } = useECharts(chartRef, { theme });

// 渲染图表
function renderChart(config: ChartConfig) {
  if (!config || config.type === "table" || config.type === "card") {
    return;
  }

  const options: any = {
    title: {
      text: config.title,
      left: "center",
      textStyle: {
        fontSize: 14,
        fontWeight: "bold"
      }
    },
    tooltip: {
      trigger: config.type === "pie" ? "item" : "axis"
    },
    grid: {
      top: "60px",
      left: "50px",
      right: "20px",
      bottom: "40px"
    }
  };

  // 图例
  if (config.legend) {
    options.legend = {
      data: config.legend,
      bottom: 0
    };
  } else if (config.series && config.series.length > 1) {
    options.legend = {
      data: config.series.map(s => s.name),
      bottom: 0
    };
  }

  // X 轴
  if (config.xAxis && config.type !== "pie") {
    options.xAxis = {
      type: "category",
      data: config.xAxis,
      axisLabel: {
        rotate: config.xAxis.length > 6 ? 30 : 0
      }
    };
    options.yAxis = {
      type: "value"
    };
  }

  // 系列数据
  if (config.series) {
    options.series = config.series.map(s => ({
      name: s.name,
      type: s.type || config.type,
      data: s.data,
      ...(config.type === "pie"
        ? {
            radius: "50%",
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: "rgba(0, 0, 0, 0.5)"
              }
            }
          }
        : {
            barWidth: config.series.length > 1 ? undefined : 30,
            itemStyle: {
              borderRadius: [4, 4, 0, 0]
            }
          })
    }));
  }

  setOptions(options);
}

watch(
  () => props.config,
  async () => {
    await nextTick();
    renderChart(props.config);
  },
  { deep: true, immediate: true }
);
</script>

<template>
  <div class="chart-panel">
    <!-- 数字卡片 -->
    <div v-if="config.type === 'card'" class="card-container">
      <div class="card-title">{{ config.title }}</div>
      <div class="card-value">
        {{ config.series?.[0]?.data?.[0] ?? "-" }}
      </div>
      <div class="card-label">{{ config.series?.[0]?.name }}</div>
    </div>

    <!-- ECharts 图表 -->
    <div
      v-else-if="config.type !== 'table'"
      ref="chartRef"
      class="chart-container"
    />

    <!-- 空状态 -->
    <el-empty v-else description="请选择表格视图查看数据" :image-size="80" />
  </div>
</template>

<style scoped>
.chart-panel {
  min-height: 300px;
}

.chart-container {
  width: 100%;
  height: 350px;
}

.card-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.card-title {
  margin-bottom: 16px;
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.card-value {
  margin-bottom: 8px;
  font-size: 48px;
  font-weight: bold;
  line-height: 1;
  color: var(--el-color-primary);
}

.card-label {
  font-size: 14px;
  color: var(--el-text-color-regular);
}
</style>
