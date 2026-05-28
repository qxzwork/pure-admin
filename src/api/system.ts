import { http } from "@/utils/http";

/** 用户管理 - 后端 UserDTO */
export type UserRecord = {
  id: string;
  username: string;
  password?: string;
  nickname: string;
  email: string;
  phone: string;
  avatar: string;
  status: number;
  roleIds: string[];
  createTime: string;
  updateTime: string;
};

/** 角色管理 - 后端 RoleDTO */
export type RoleRecord = {
  id: string;
  roleName: string;
  roleCode: string;
  description: string;
  status: number;
  permissionIds: string[];
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
  return http.request<SimpleResult<string>>("post", "/api/management/users", {
    data
  });
};

/** 编辑用户 */
export const updateUser = (
  id: string,
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
export const deleteUser = (id: string) => {
  return http.request<SimpleResult<null>>(
    "delete",
    `/api/management/users/${id}`
  );
};

/** 重置密码 */
export const resetUserPassword = (id: string, newPassword: string) => {
  return http.request<SimpleResult<null>>(
    "put",
    `/api/management/users/${id}/password`,
    { data: { newPassword } }
  );
};

/** 获取用户角色ID列表 */
export const getRoleIds = (userId: string) => {
  return http.request<SimpleResult<string[]>>(
    "get",
    `/api/management/users/${userId}/roles`
  );
};

/** 设置用户角色 */
export const setUserRoles = (userId: string, roleIds: string[]) => {
  return http.request<SimpleResult<null>>(
    "put",
    `/api/management/users/${userId}/roles`,
    { data: roleIds }
  );
};

// ========== 角色管理 API ==========

/** 角色分页响应 */
type RolePageResult = {
  code: number;
  message: string;
  data: {
    records: RoleRecord[];
    total: number;
    size: number;
    current: number;
    pages: number;
  };
  timestamp: number;
};

/** 分页查询角色列表 */
export const getRoleList = (params: {
  current?: number;
  size?: number;
  roleName?: string;
  roleCode?: string;
  status?: number;
}) => {
  return http.request<RolePageResult>("get", "/api/management/roles", {
    params
  });
};

/** 查询所有角色（用于下拉选择） */
export const getAllRoleList = () => {
  return http.request<SimpleResult<RoleRecord[]>>(
    "get",
    "/api/management/roles/all"
  );
};

/** 新增角色 */
export const createRole = (data: {
  roleName: string;
  roleCode: string;
  description?: string;
  status?: number;
  permissionIds?: string[];
}) => {
  return http.request<SimpleResult<string>>("post", "/api/management/roles", {
    data
  });
};

/** 编辑角色 */
export const updateRole = (
  id: string,
  data: {
    roleName?: string;
    description?: string;
    status?: number;
  }
) => {
  return http.request<SimpleResult<null>>(
    "put",
    `/api/management/roles/${id}`,
    { data }
  );
};

/** 删除角色 */
export const deleteRole = (id: string) => {
  return http.request<SimpleResult<null>>(
    "delete",
    `/api/management/roles/${id}`
  );
};

/** 获取角色权限ID列表 */
export const getRolePermissionIds = (id: string) => {
  return http.request<SimpleResult<string[]>>(
    "get",
    `/api/management/roles/${id}/permissions`
  );
};

/** 设置角色权限 */
export const setRolePermissions = (id: string, permissionIds: string[]) => {
  return http.request<SimpleResult<null>>(
    "put",
    `/api/management/roles/${id}/permissions`,
    { data: permissionIds }
  );
};

// ========== 权限管理 API（角色权限树用） ==========

/** 权限记录类型 */
export type PermissionRecord = {
  id: string;
  permissionName: string;
  title: string;
  menuType: number;
  permissionCode: string;
  permissionType: string;
  parentId: number;
  path: string;
  icon: string;
  sortOrder: number;
  status: number;
  createTime: string;
  children: PermissionRecord[];
};

/** 获取权限列表（平铺一维数组，用于角色权限分配树） */
export const getPermissionList = () => {
  return http.request<SimpleResult<PermissionRecord[]>>(
    "get",
    "/api/management/permissions"
  );
};

// ========== 部门管理 API ==========

/** 部门记录类型 - 匹配后端 DeptDTO */
export type DeptRecord = {
  id: string;
  parentId: number;
  name: string;
  principal: string;
  phone: string;
  email: string;
  sort: number;
  status: number;
  remark: string;
  createTime: string;
  updateTime: string;
  children: DeptRecord[];
};

/** 获取部门列表（平铺一维数组，前端自行处理成树结构） */
export const getDeptList = () => {
  return http.request<SimpleResult<DeptRecord[]>>(
    "get",
    "/api/management/depts"
  );
};

/** 新增部门 */
export const createDept = (data: {
  parentId?: number;
  name: string;
  principal?: string;
  phone?: string;
  email?: string;
  sort?: number;
  status?: number;
  remark?: string;
}) => {
  return http.request<SimpleResult<string>>("post", "/api/management/depts", {
    data
  });
};

/** 编辑部门 */
export const updateDept = (
  id: string,
  data: {
    parentId?: number;
    name?: string;
    principal?: string;
    phone?: string;
    email?: string;
    sort?: number;
    status?: number;
    remark?: string;
  }
) => {
  return http.request<SimpleResult<null>>(
    "put",
    `/api/management/depts/${id}`,
    { data }
  );
};

/** 删除部门（会级联删除子部门） */
export const deleteDept = (id: string) => {
  return http.request<SimpleResult<null>>(
    "delete",
    `/api/management/depts/${id}`
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

// ========== 菜单管理 API ==========

/** 菜单记录类型 - 匹配后端 MenuDTO */
export type MenuRecord = {
  id: string;
  menuType: number;
  parentId: number;
  title: string;
  name: string;
  path: string;
  component: string;
  rank: number;
  redirect: string;
  icon: string;
  extraIcon: string;
  enterTransition: string;
  leaveTransition: string;
  activePath: string;
  auths: string;
  frameSrc: string;
  frameLoading: boolean;
  keepAlive: boolean;
  hiddenTag: boolean;
  fixedTag: boolean;
  showLink: boolean;
  showParent: boolean;
  status: number;
  createTime: string;
  updateTime: string;
  children: MenuRecord[];
};

/** 获取菜单列表（平铺一维数组，前端自行处理成树结构） */
export const getMenuList = () => {
  return http.request<SimpleResult<MenuRecord[]>>(
    "get",
    "/api/management/menus"
  );
};

/** 根据ID获取菜单 */
export const getMenuById = (id: string) => {
  return http.request<SimpleResult<MenuRecord>>(
    "get",
    `/api/management/menus/${id}`
  );
};

/** 新增菜单 */
export const createMenu = (data: {
  menuType: number;
  parentId: number;
  title: string;
  name?: string;
  path?: string;
  component?: string;
  rank?: number;
  redirect?: string;
  icon?: string;
  extraIcon?: string;
  enterTransition?: string;
  leaveTransition?: string;
  activePath?: string;
  auths?: string;
  frameSrc?: string;
  frameLoading?: boolean;
  keepAlive?: boolean;
  hiddenTag?: boolean;
  fixedTag?: boolean;
  showLink?: boolean;
  showParent?: boolean;
}) => {
  return http.request<SimpleResult<string>>("post", "/api/management/menus", {
    data
  });
};

/** 编辑菜单 */
export const updateMenu = (
  id: string,
  data: {
    menuType?: number;
    parentId?: number;
    title?: string;
    name?: string;
    path?: string;
    component?: string;
    rank?: number;
    redirect?: string;
    icon?: string;
    extraIcon?: string;
    enterTransition?: string;
    leaveTransition?: string;
    activePath?: string;
    auths?: string;
    frameSrc?: string;
    frameLoading?: boolean;
    keepAlive?: boolean;
    hiddenTag?: boolean;
    fixedTag?: boolean;
    showLink?: boolean;
    showParent?: boolean;
  }
) => {
  return http.request<SimpleResult<null>>(
    "put",
    `/api/management/menus/${id}`,
    { data }
  );
};

/** 删除菜单（会级联删除子菜单） */
export const deleteMenu = (id: string) => {
  return http.request<SimpleResult<null>>(
    "delete",
    `/api/management/menus/${id}`
  );
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
