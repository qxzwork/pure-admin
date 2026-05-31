import dayjs from "dayjs";
import { message } from "@/utils/message";
import { http } from "@/utils/http";
import { ref, onMounted } from "vue";

export function useRole() {
  const dataList = ref([]);
  const loading = ref(true);
  const columns: TableColumnList = [
    {
      label: "用户名",
      prop: "username",
      minWidth: 100
    },
    {
      label: "登录 IP",
      prop: "ip",
      minWidth: 140
    },
    {
      label: "浏览器",
      prop: "browser",
      minWidth: 100
    },
    {
      label: "操作系统",
      prop: "os",
      minWidth: 100
    },
    {
      label: "登录时间",
      prop: "loginTime",
      minWidth: 180,
      formatter: ({ loginTime }) =>
        loginTime ? dayjs(loginTime).format("YYYY-MM-DD HH:mm:ss") : "-"
    },
    {
      label: "操作",
      fixed: "right",
      slot: "operation"
    }
  ];

  async function onSearch() {
    loading.value = true;
    try {
      const res = await http.request<any>(
        "get",
        "/api/management/online-users"
      );
      dataList.value = res?.data ?? [];
    } catch {
      dataList.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function handleOffline(row) {
    try {
      const res = await http.request<any>(
        "delete",
        `/api/management/online-users/${row.userId}`
      );
      if (res?.code === 200) {
        message(`${row.username} 已被强制下线`, { type: "success" });
        onSearch();
      } else {
        message(res?.message ?? "操作失败", { type: "error" });
      }
    } catch {
      message("操作失败", { type: "error" });
    }
  }

  onMounted(() => {
    onSearch();
  });

  return {
    loading,
    columns,
    dataList,
    onSearch,
    handleOffline
  };
}
