import editForm from "../form.vue";
import { handleTree } from "@/utils/tree";
import { message } from "@/utils/message";
import { getMenuList, createMenu, updateMenu, deleteMenu } from "@/api/system";
import { transformI18n } from "@/plugins/i18n";
import { addDialog } from "@/components/ReDialog";
import { reactive, ref, onMounted, h } from "vue";
import type { FormItemProps } from "../utils/types";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { cloneDeep, isAllEmpty, deviceDetection } from "@pureadmin/utils";

export function useMenu() {
  const form = reactive({
    title: ""
  });

  const formRef = ref();
  const dataList = ref([]);
  const loading = ref(true);

  const getMenuType = (type, text = false) => {
    switch (type) {
      case 0:
        return text ? "菜单" : "primary";
      case 1:
        return text ? "iframe" : "warning";
      case 2:
        return text ? "外链" : "danger";
      case 3:
        return text ? "按钮" : "info";
    }
  };

  const columns: TableColumnList = [
    {
      label: "菜单名称",
      prop: "title",
      align: "left",
      cellRenderer: ({ row }) => (
        <>
          <span class="inline-block mr-1">
            {h(useRenderIcon(row.icon), {
              style: { paddingTop: "1px" }
            })}
          </span>
          <span>{transformI18n(row.title)}</span>
        </>
      )
    },
    {
      label: "菜单类型",
      prop: "menuType",
      width: 100,
      cellRenderer: ({ row, props }) => (
        <el-tag
          size={props.size}
          type={getMenuType(row.menuType) as any}
          effect="plain"
        >
          {getMenuType(row.menuType, true)}
        </el-tag>
      )
    },
    {
      label: "路由路径",
      prop: "path"
    },
    {
      label: "组件路径",
      prop: "component",
      formatter: ({ path, component }) =>
        isAllEmpty(component) ? path : component
    },
    {
      label: "权限标识",
      prop: "auths"
    },
    {
      label: "排序",
      prop: "rank",
      width: 100
    },
    {
      label: "隐藏",
      prop: "showLink",
      formatter: ({ showLink }) => (showLink ? "否" : "是"),
      width: 100
    },
    {
      label: "操作",
      fixed: "right",
      width: 210,
      slot: "operation"
    }
  ];

  function handleSelectionChange(val) {
    console.log("handleSelectionChange", val);
  }

  function resetForm(formEl) {
    if (!formEl) return;
    formEl.resetFields();
    onSearch();
  }

  async function onSearch() {
    loading.value = true;
    try {
      const { code, data } = await getMenuList();
      if (code === 200) {
        let newData = data ?? [];
        if (!isAllEmpty(form.title)) {
          newData = newData.filter(item =>
            transformI18n(item.title).includes(form.title)
          );
        }
        dataList.value = handleTree(newData);
      }
    } catch {
      message("获取菜单列表失败", { type: "error" });
    } finally {
      setTimeout(() => {
        loading.value = false;
      }, 500);
    }
  }

  function formatHigherMenuOptions(treeList) {
    if (!treeList || !treeList.length) return;
    const newTreeList = [];
    for (let i = 0; i < treeList.length; i++) {
      treeList[i].title = transformI18n(treeList[i].title);
      formatHigherMenuOptions(treeList[i].children);
      newTreeList.push(treeList[i]);
    }
    return newTreeList;
  }

  function openDialog(title = "新增", row?: FormItemProps) {
    addDialog({
      title: `${title}菜单`,
      props: {
        formInline: {
          id: row?.id ?? "",
          menuType: row?.menuType ?? 0,
          higherMenuOptions: formatHigherMenuOptions(cloneDeep(dataList.value)),
          parentId: row?.parentId ?? 0,
          title: row?.title ?? "",
          name: row?.name ?? "",
          path: row?.path ?? "",
          component: row?.component ?? "",
          rank: row?.rank ?? 99,
          redirect: row?.redirect ?? "",
          icon: row?.icon ?? "",
          extraIcon: row?.extraIcon ?? "",
          enterTransition: row?.enterTransition ?? "",
          leaveTransition: row?.leaveTransition ?? "",
          activePath: row?.activePath ?? "",
          auths: row?.auths ?? "",
          frameSrc: row?.frameSrc ?? "",
          frameLoading: row?.frameLoading ?? true,
          keepAlive: row?.keepAlive ?? false,
          hiddenTag: row?.hiddenTag ?? false,
          fixedTag: row?.fixedTag ?? false,
          showLink: row?.showLink ?? true,
          showParent: row?.showParent ?? false
        }
      },
      width: "45%",
      draggable: true,
      fullscreen: deviceDetection(),
      fullscreenIcon: true,
      closeOnClickModal: false,
      contentRenderer: () => h(editForm, { ref: formRef, formInline: null }),
      beforeSure: async (done, { options }) => {
        const FormRef = formRef.value.getRef();
        const curData = options.props.formInline as FormItemProps;
        function chores() {
          message(
            `您${title}了菜单名称为${transformI18n(curData.title)}的这条数据`,
            {
              type: "success"
            }
          );
          done();
          onSearch();
        }
        FormRef.validate(async valid => {
          if (valid) {
            try {
              if (title === "新增") {
                const res = await createMenu({
                  menuType: curData.menuType,
                  parentId: curData.parentId,
                  title: curData.title,
                  name: curData.name || undefined,
                  path: curData.path || undefined,
                  component: curData.component || undefined,
                  rank: curData.rank ?? 99,
                  redirect: curData.redirect || undefined,
                  icon: curData.icon || undefined,
                  extraIcon: curData.extraIcon || undefined,
                  enterTransition: curData.enterTransition || undefined,
                  leaveTransition: curData.leaveTransition || undefined,
                  activePath: curData.activePath || undefined,
                  auths: curData.auths || undefined,
                  frameSrc: curData.frameSrc || undefined,
                  frameLoading: curData.frameLoading ?? true,
                  keepAlive: curData.keepAlive ?? false,
                  hiddenTag: curData.hiddenTag ?? false,
                  fixedTag: curData.fixedTag ?? false,
                  showLink: curData.showLink ?? true,
                  showParent: curData.showParent ?? false
                });
                if (res.code === 200) {
                  chores();
                }
              } else {
                const res = await updateMenu(curData.id, {
                  menuType: curData.menuType,
                  parentId: curData.parentId,
                  title: curData.title,
                  name: curData.name || undefined,
                  path: curData.path || undefined,
                  component: curData.component || undefined,
                  rank: curData.rank ?? 99,
                  redirect: curData.redirect || undefined,
                  icon: curData.icon || undefined,
                  extraIcon: curData.extraIcon || undefined,
                  enterTransition: curData.enterTransition || undefined,
                  leaveTransition: curData.leaveTransition || undefined,
                  activePath: curData.activePath || undefined,
                  auths: curData.auths || undefined,
                  frameSrc: curData.frameSrc || undefined,
                  frameLoading: curData.frameLoading ?? true,
                  keepAlive: curData.keepAlive ?? false,
                  hiddenTag: curData.hiddenTag ?? false,
                  fixedTag: curData.fixedTag ?? false,
                  showLink: curData.showLink ?? true,
                  showParent: curData.showParent ?? false
                });
                if (res.code === 200) {
                  chores();
                }
              }
            } catch {
              message(`${title}菜单失败`, { type: "error" });
            }
          }
        });
      }
    });
  }

  async function handleDelete(row) {
    try {
      const res = await deleteMenu(row.id);
      if (res.code === 200) {
        message(`已删除菜单 ${transformI18n(row.title)}`, {
          type: "success"
        });
        onSearch();
      }
    } catch {
      message("删除菜单失败", { type: "error" });
    }
  }

  onMounted(() => {
    onSearch();
  });

  return {
    form,
    loading,
    columns,
    dataList,
    /** 搜索 */
    onSearch,
    /** 重置 */
    resetForm,
    /** 新增、修改菜单 */
    openDialog,
    /** 删除菜单 */
    handleDelete,
    handleSelectionChange
  };
}
