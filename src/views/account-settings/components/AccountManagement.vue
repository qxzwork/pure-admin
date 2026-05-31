<script setup lang="ts">
import { ref, reactive } from "vue";
import { message } from "@/utils/message";
import { deviceDetection } from "@pureadmin/utils";
import { http } from "@/utils/http";
import { removeToken } from "@/utils/auth";
import { useRouter } from "vue-router";
import type { FormInstance, FormRules } from "element-plus";

defineOptions({
  name: "AccountManagement"
});

const router = useRouter();
const pwdDialogVisible = ref(false);
const pwdLoading = ref(false);
const pwdFormRef = ref<FormInstance>();

const pwdForm = reactive({
  oldPassword: "",
  newPassword: "",
  confirmPassword: ""
});

const pwdRules = reactive<FormRules>({
  oldPassword: [{ required: true, message: "请输入旧密码", trigger: "blur" }],
  newPassword: [
    { required: true, message: "请输入新密码", trigger: "blur" },
    { min: 6, message: "密码长度不能少于6位", trigger: "blur" }
  ],
  confirmPassword: [
    { required: true, message: "请确认新密码", trigger: "blur" },
    {
      validator: (_rule, value, callback) => {
        if (value !== pwdForm.newPassword) {
          callback(new Error("两次输入的密码不一致"));
        } else {
          callback();
        }
      },
      trigger: "blur"
    }
  ]
});

function openPwdDialog() {
  pwdForm.oldPassword = "";
  pwdForm.newPassword = "";
  pwdForm.confirmPassword = "";
  pwdDialogVisible.value = true;
}

async function handleSubmitPwd() {
  await pwdFormRef.value.validate();
  pwdLoading.value = true;
  try {
    const res = await http.request<any>("put", "/api/auth/password", {
      data: {
        oldPassword: pwdForm.oldPassword,
        newPassword: pwdForm.newPassword
      }
    });
    if (res?.code === 200) {
      message("密码修改成功，请重新登录", { type: "success" });
      pwdDialogVisible.value = false;
      removeToken();
      router.push("/login");
    } else {
      message(res?.message ?? "修改失败", { type: "error" });
    }
  } catch {
    message("修改失败", { type: "error" });
  } finally {
    pwdLoading.value = false;
  }
}

const list = ref([
  {
    title: "账户密码",
    illustrate: "定期修改密码可以保护账户安全",
    button: "修改",
    action: openPwdDialog
  }
]);
</script>

<template>
  <div :class="['min-w-45', deviceDetection() ? 'max-w-full' : 'max-w-[70%]']">
    <h3 class="my-8!">账户管理</h3>
    <div v-for="(item, index) in list" :key="index">
      <div class="flex items-center">
        <div class="flex-1">
          <p>{{ item.title }}</p>
          <el-text class="mx-1" type="info">{{ item.illustrate }}</el-text>
        </div>
        <el-button type="primary" text @click="item.action">
          {{ item.button }}
        </el-button>
      </div>
      <el-divider />
    </div>

    <!-- 修改密码弹窗 -->
    <el-dialog
      v-model="pwdDialogVisible"
      title="修改密码"
      width="420px"
      destroy-on-close
    >
      <el-form
        ref="pwdFormRef"
        :model="pwdForm"
        :rules="pwdRules"
        label-width="80px"
      >
        <el-form-item label="旧密码" prop="oldPassword">
          <el-input
            v-model="pwdForm.oldPassword"
            type="password"
            show-password
            placeholder="请输入旧密码"
          />
        </el-form-item>
        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="pwdForm.newPassword"
            type="password"
            show-password
            placeholder="请输入新密码"
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="pwdForm.confirmPassword"
            type="password"
            show-password
            placeholder="请再次输入新密码"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="pwdLoading"
          @click="handleSubmitPwd"
        >
          确认修改
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
.el-divider--horizontal {
  border-top: 0.1px var(--el-border-color) var(--el-border-style);
}
</style>
