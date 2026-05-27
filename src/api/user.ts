import { http } from "@/utils/http";

export type LoginResult = {
  code: number;
  message: string;
  data: {
    /** JWT Token */
    token: string;
    /** Token 类型 */
    tokenType: string;
    /** 过期时间（秒） */
    expiresIn: number;
    /** 用户ID */
    userId: number;
    /** 用户名 */
    username: string;
    /** 昵称 */
    nickname: string;
  };
};

export type RefreshTokenResult = {
  code: number;
  message: string;
  data: {
    /** JWT Token */
    token: string;
    /** Token 类型 */
    tokenType: string;
    /** 过期时间（秒） */
    expiresIn: number;
    /** 用户ID */
    userId: number;
    /** 用户名 */
    username: string;
    /** 昵称 */
    nickname: string;
  };
};

export type UserInfo = {
  /** 用户ID */
  userId: number;
  /** 用户名 */
  username: string;
  /** 昵称 */
  nickname: string;
  /** 邮箱 */
  email: string;
  /** 头像 */
  avatar: string;
  /** 角色编码列表 */
  roles: Array<string>;
  /** 权限编码列表 */
  permissions: Array<string>;
};

export type UserInfoResult = {
  code: number;
  message: string;
  data: UserInfo;
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

/** 登录 */
export const getLogin = (data?: object) => {
  return http.request<LoginResult>("post", "/api/auth/login", { data });
};

/** 登出 */
export const getLogout = () => {
  return http.request("post", "/api/auth/logout");
};

/** 刷新`token` */
export const refreshTokenApi = () => {
  return http.request<RefreshTokenResult>("post", "/api/auth/refresh");
};

/** 获取当前用户信息（含角色和权限） */
export const getUserInfo = () => {
  return http.request<UserInfoResult>("get", "/api/auth/me");
};

/** 账户设置-个人信息 */
export const getMine = (data?: object) => {
  return http.request<UserInfoResult>("get", "/mine", { data });
};

/** 账户设置-个人安全日志 */
export const getMineLogs = (data?: object) => {
  return http.request<ResultTable>("get", "/mine-logs", { data });
};
