import { defineStore } from "pinia";
import {
  type userType,
  store,
  router,
  resetRouter,
  routerArrays,
  storageLocal
} from "../utils";
import {
  type LoginResult,
  type RefreshTokenResult,
  getLogin,
  getLogout,
  refreshTokenApi,
  getUserInfo
} from "@/api/user";
import { useMultiTagsStoreHook } from "./multiTags";
import {
  type DataInfo,
  setToken,
  setUserInfo,
  removeToken,
  userKey
} from "@/utils/auth";

export const useUserStore = defineStore("pure-user", {
  state: (): userType => ({
    // 头像
    avatar: storageLocal().getItem<DataInfo<number>>(userKey)?.avatar ?? "",
    // 用户名
    username: storageLocal().getItem<DataInfo<number>>(userKey)?.username ?? "",
    // 昵称
    nickname: storageLocal().getItem<DataInfo<number>>(userKey)?.nickname ?? "",
    // 页面级别权限
    roles: storageLocal().getItem<DataInfo<number>>(userKey)?.roles ?? [],
    // 按钮级别权限
    permissions:
      storageLocal().getItem<DataInfo<number>>(userKey)?.permissions ?? [],
    // 前端生成的验证码（按实际需求替换）
    verifyCode: "",
    // 判断登录页面显示哪个组件（0：登录（默认）、1：手机登录、2：二维码登录、3：注册、4：忘记密码）
    currentPage: 0,
    // 是否勾选了登录页的免登录
    isRemembered: false,
    // 登录页的免登录存储几天，默认7天
    loginDay: 7
  }),
  actions: {
    /** 存储头像 */
    SET_AVATAR(avatar: string) {
      this.avatar = avatar;
    },
    /** 存储用户名 */
    SET_USERNAME(username: string) {
      this.username = username;
    },
    /** 存储昵称 */
    SET_NICKNAME(nickname: string) {
      this.nickname = nickname;
    },
    /** 存储角色 */
    SET_ROLES(roles: Array<string>) {
      this.roles = roles;
    },
    /** 存储按钮级别权限 */
    SET_PERMS(permissions: Array<string>) {
      this.permissions = permissions;
    },
    /** 存储前端生成的验证码 */
    SET_VERIFYCODE(verifyCode: string) {
      this.verifyCode = verifyCode;
    },
    /** 存储登录页面显示哪个组件 */
    SET_CURRENTPAGE(value: number) {
      this.currentPage = value;
    },
    /** 存储是否勾选了登录页的免登录 */
    SET_ISREMEMBERED(bool: boolean) {
      this.isRemembered = bool;
    },
    /** 设置登录页的免登录存储几天 */
    SET_LOGINDAY(value: number) {
      this.loginDay = Number(value);
    },
    /** 登入 */
    async loginByUsername(data) {
      return new Promise<LoginResult>((resolve, reject) => {
        getLogin(data)
          .then(async res => {
            if (res.code === 200) {
              const loginData = res.data;
              setToken({
                token: loginData.token,
                expires: new Date(Date.now() + loginData.expiresIn * 1000)
              } as DataInfo<Date>);
              try {
                const userRes = await getUserInfo();
                if (userRes.code === 200) {
                  setUserInfo({
                    avatar: userRes.data.avatar,
                    username: userRes.data.username,
                    nickname: userRes.data.nickname,
                    roles: userRes.data.roles,
                    permissions: userRes.data.permissions
                  });
                }
              } catch {
                // 即使获取用户信息失败，登录仍然成功
              }
              resolve(res);
            } else {
              reject(res.message);
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /** 登出（调用后端接口） */
    async logOut() {
      try {
        await getLogout();
      } catch {
        // 即使登出接口失败，也清空本地状态
      }
      this.username = "";
      this.roles = [];
      this.permissions = [];
      removeToken();
      useMultiTagsStoreHook().handleTags("equal", [...routerArrays]);
      resetRouter();
      router.push("/login");
    },
    /** 刷新`token` */
    async handRefreshToken() {
      return new Promise<RefreshTokenResult>((resolve, reject) => {
        refreshTokenApi()
          .then(res => {
            if (res.code === 200) {
              const refreshData = res.data;
              setToken({
                token: refreshData.token,
                expires: new Date(Date.now() + refreshData.expiresIn * 1000)
              } as DataInfo<Date>);
              resolve(res);
            } else {
              reject(res.message);
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    }
  }
});

export function useUserStoreHook() {
  return useUserStore(store);
}
