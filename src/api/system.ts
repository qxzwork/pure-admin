import { http } from "@/utils/http";

/** 用户管理 - 后端 UserDTO */
export type UserRecord = {
  id: number;
  username: string;
  password?: string;
  nickname: string;
  email: string;
  phone: string;
  avatar: string;
  status: number;
  roleIds: number[];
  createTime: string;
  updateTime: string;
};

/** 角色管理 - 后端 RoleDTO */
export type RoleRecord = {
  id: number;
  roleName: string;
  roleCode: string;
  description: string;
  status: number;
  permissionIds: number[];
  createTime: string;
  updateTime: string;
};

/** 后端分页响应 */
type PageResult<T> = {
  code: number;
  message: string;
  data: {
    records: T[];
    total: number;
    size: number;
    current: number;
    pages: number;
  };
  timestamp: number;
};

type SimpleResult<T> = {
  code: number;
  message: string;
  data: T;
  timestamp: number;
};

// ========== 用户管理 API ==========

/** 分页查询用户列表 */
export const getUserList = (params: {
  current: number;
  size: number;
  username?: string;
  status?: number;
}) => {
  return http.request<PageResult<UserRecord>>("get", "/api/management/users", {
    params
  });
};

/** 新增用户 */
export const createUser = (data: {
  username: string;
  password: string;
  nickname: string;
  email?: string;
  phone?: string;
  status?: number;
}) => {
  return http.request<SimpleResult<number>>("post", "/api/management/users", {
    data
  });
};

/** 编辑用户 */
export const updateUser = (
  id: number,
  data: {
    username: string;
    nickname: string;
    email?: string;
    phone?: string;
    status?: number;
  }
) => {
  return http.request<SimpleResult<null>>(
    "put",
    `/api/management/users/${id}`,
    {
      data
    }
  );
};

/** 删除用户 */
export const deleteUser = (id: number) => {
  return http.request<SimpleResult<null>>(
    "delete",
    `/api/management/users/${id}`
  );
};

/** 重置密码 */
export const resetUserPassword = (id: number, newPassword: string) => {
  return http.request<SimpleResult<null>>(
    "put",
    `/api/management/users/${id}/password`,
    { data: { key: newPassword } }
  );
};

/** 获取用户角色ID列表 */
export const getRoleIds = (userId: number) => {
  return http.request<SimpleResult<number[]>>(
    "get",
    `/api/management/users/${userId}/roles`
  );
};

/** 设置用户角色 */
export const setUserRoles = (userId: number, roleIds: number[]) => {
  return http.request<SimpleResult<null>>(
    "put",
    `/api/management/users/${userId}/roles`,
    { data: roleIds }
  );
};

// ========== 角色管理 API ==========

/** 查询所有角色（用于下拉选择） */
export const getAllRoleList = () => {
  return http.request<SimpleResult<RoleRecord[]>>(
    "get",
    "/api/management/roles/all"
  );
};

// ========== 以下为仍使用 mock 的接口（暂未对接后端） ==========

type Result = {
  code: number;
  message: string;
  data?: Array<any>;
};

type ResultTable = {
  code: number;
  message: string;
  data?: {
    /** 列表数据 */
    list: Array<any>;
    /** 总条目数 */
    total?: number;
    /** 每页显示条目个数 */
    pageSize?: number;
    /** 当前页数 */
    currentPage?: number;
  };
};

/** 获取系统管理-角色管理列表 */
export const getRoleList = (data?: object) => {
  return http.request<ResultTable>("post", "/role", { data });
};

/** 获取系统管理-菜单管理列表 */
export const getMenuList = (data?: object) => {
  return http.request<Result>("post", "/menu", { data });
};

/** 获取系统管理-部门管理列表 */
export const getDeptList = (data?: object) => {
  return http.request<Result>("post", "/dept", { data });
};

/** 获取系统监控-在线用户列表 */
export const getOnlineLogsList = (data?: object) => {
  return http.request<ResultTable>("post", "/online-logs", { data });
};

/** 获取系统监控-登录日志列表 */
export const getLoginLogsList = (data?: object) => {
  return http.request<ResultTable>("post", "/login-logs", { data });
};

/** 获取系统监控-操作日志列表 */
export const getOperationLogsList = (data?: object) => {
  return http.request<ResultTable>("post", "/operation-logs", { data });
};

/** 获取系统监控-系统日志列表 */
export const getSystemLogsList = (data?: object) => {
  return http.request<ResultTable>("post", "/system-logs", { data });
};

/** 获取系统监控-系统日志-根据 id 查日志详情 */
export const getSystemLogsDetail = (data?: object) => {
  return http.request<Result>("post", "/system-logs-detail", { data });
};

/** 获取角色管理-权限-菜单权限 */
export const getRoleMenu = (data?: object) => {
  return http.request<Result>("post", "/role-menu", { data });
};

/** 获取角色管理-权限-菜单权限-根据角色 id 查对应菜单 */
export const getRoleMenuIds = (data?: object) => {
  return http.request<Result>("post", "/role-menu-ids", { data });
};
