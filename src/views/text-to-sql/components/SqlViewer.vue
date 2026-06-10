<script setup lang="ts">
import { computed } from "vue";

const props = defineProps({
  sql: {
    type: String,
    default: ""
  }
});

// 格式化 SQL
const formattedSQL = computed(() => {
  if (!props.sql) return "";

  let sql = props.sql.trim();

  // 关键字大写
  const keywords = [
    "SELECT",
    "FROM",
    "WHERE",
    "AND",
    "OR",
    "NOT",
    "IN",
    "BETWEEN",
    "LIKE",
    "IS",
    "NULL",
    "AS",
    "ON",
    "JOIN",
    "LEFT",
    "RIGHT",
    "INNER",
    "OUTER",
    "CROSS",
    "GROUP",
    "BY",
    "ORDER",
    "HAVING",
    "LIMIT",
    "OFFSET",
    "UNION",
    "ALL",
    "DISTINCT",
    "INSERT",
    "INTO",
    "VALUES",
    "UPDATE",
    "SET",
    "DELETE",
    "CREATE",
    "TABLE",
    "ALTER",
    "DROP",
    "INDEX",
    "VIEW",
    "TRIGGER",
    "PROCEDURE",
    "FUNCTION",
    "CASE",
    "WHEN",
    "THEN",
    "ELSE",
    "END",
    "EXISTS",
    "COUNT",
    "SUM",
    "AVG",
    "MAX",
    "MIN",
    "CAST",
    "CONVERT"
  ];

  keywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw}\\b`, "gi");
    sql = sql.replace(regex, kw);
  });

  // 换行处理
  sql = sql
    .replace(/\bSELECT\b/g, "\nSELECT")
    .replace(/\bFROM\b/g, "\nFROM")
    .replace(/\bWHERE\b/g, "\nWHERE")
    .replace(/\bAND\b/g, "\n  AND")
    .replace(/\bOR\b/g, "\n  OR")
    .replace(/\bORDER BY\b/g, "\nORDER BY")
    .replace(/\bGROUP BY\b/g, "\nGROUP BY")
    .replace(/\bHAVING\b/g, "\nHAVING")
    .replace(/\bLIMIT\b/g, "\nLIMIT")
    .replace(/\bOFFSET\b/g, "\nOFFSET")
    .replace(/\bJOIN\b/g, "\nJOIN")
    .replace(/\bLEFT JOIN\b/g, "\nLEFT JOIN")
    .replace(/\bRIGHT JOIN\b/g, "\nRIGHT JOIN")
    .replace(/\bINNER JOIN\b/g, "\nINNER JOIN")
    .replace(/\bUNION\b/g, "\nUNION")
    .trim();

  return sql;
});
</script>

<template>
  <div class="sql-viewer">
    <pre class="sql-content"><code>{{ formattedSQL }}</code></pre>
  </div>
</template>

<style scoped>
.sql-viewer {
  padding: 12px 16px;
  overflow-x: auto;
}

.sql-content {
  margin: 0;
  font-family: "Fira Code", Consolas, Monaco, monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--el-text-color-primary);
  word-break: break-all;
  white-space: pre-wrap;
}

.sql-content code {
  font-family: inherit;
}
</style>
