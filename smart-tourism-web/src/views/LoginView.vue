<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { setUser } = useAuth()
// 确保使用 index.html 引入的全局 axios
const axios = window.axios 

const activeTab = ref('login')
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: '',
})

const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: '',
})

// 1. 登录逻辑 (对接后端数据库)
const handleLogin = async () => {
  const { username, password } = loginForm
  if (!username?.trim() || !password?.trim()) {
    ElMessage.warning('请输入用户名和密码')
    return
  }
  
  loading.value = true
  try {
    // 发送 POST 请求到 Java 后端登录接口
    const res = await axios.post('http://localhost:8080/api/users/login', {
      username: username.trim(),
      password: password.trim()
    })
    
    // 这里的 res.data.code 对应你 UserController 返回的 map.put("code", 200)
    if (res.data.code === 200) {
      setUser(res.data.data) // 将后端返回的真实 User 对象存入本地状态
      ElMessage.success('登录成功')
      router.push('/')
    } else {
      ElMessage.error(res.data.msg || '账号或密码错误')
    }
  } catch (err) {
    console.error('登录请求异常:', err)
    ElMessage.error('无法连接到服务器，请检查后端是否启动')
  } finally {
    loading.value = false
  }
}

// 2. 注册逻辑 (对接后端数据库)
const handleRegister = async () => {
  const { username, password, confirmPassword } = registerForm
  if (!username?.trim() || !password?.trim()) {
    ElMessage.warning('用户名和密码不能为空')
    return
  }
  if (password !== confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }
  
  loading.value = true
  try {
    // 发送 POST 请求到 Java 后端注册接口
    const res = await axios.post('http://localhost:8080/api/users/register', {
      username: username.trim(),
      password: password.trim()
    })
    
    if (res.data.code === 200) {
      ElMessage.success('注册成功，请登录')
      activeTab.value = 'login' // 自动切换到登录选项卡
      // 清空注册表单
      registerForm.username = ''
      registerForm.password = ''
      registerForm.confirmPassword = ''
    } else {
      ElMessage.error(res.data.msg || '注册失败')
    }
  } catch (err) {
    console.error('注册请求异常:', err)
    ElMessage.error('服务器连接失败，请检查后端跨域配置或服务状态')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-view">
    <div class="login-bg" />
    <div class="login-card-wrapper">
      <el-card class="login-card" shadow="always" v-loading="loading">
        <template #header>
          <div class="card-header">
            <span class="card-title">智慧旅游系统</span>
          </div>
        </template>
        <el-tabs v-model="activeTab" class="login-tabs">
          <el-tab-pane label="登录" name="login">
            <el-form :model="loginForm" label-position="top" class="login-form">
              <el-form-item label="用户名">
                <el-input
                  v-model="loginForm.username"
                  placeholder="请输入用户名"
                  size="large"
                  clearable
                />
              </el-form-item>
              <el-form-item label="密码">
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  placeholder="请输入密码"
                  size="large"
                  show-password
                  clearable
                  @keyup.enter="handleLogin"
                />
              </el-form-item>
              <el-form-item>
                <el-button
                  type="primary"
                  size="large"
                  class="submit-btn"
                  @click="handleLogin"
                >
                  登录
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane label="注册" name="register">
            <el-form :model="registerForm" label-position="top" class="login-form">
              <el-form-item label="用户名">
                <el-input
                  v-model="registerForm.username"
                  placeholder="请输入用户名"
                  size="large"
                  clearable
                />
              </el-form-item>
              <el-form-item label="密码">
                <el-input
                  v-model="registerForm.password"
                  type="password"
                  placeholder="请输入密码"
                  size="large"
                  show-password
                  clearable
                />
              </el-form-item>
              <el-form-item label="确认密码">
                <el-input
                  v-model="registerForm.confirmPassword"
                  type="password"
                  placeholder="请再次输入密码"
                  size="large"
                  show-password
                  clearable
                  @keyup.enter="handleRegister"
                />
              </el-form-item>
              <el-form-item>
                <el-button
                  type="primary"
                  size="large"
                  class="submit-btn"
                  @click="handleRegister"
                >
                  提交注册
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.login-view {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.login-bg {
  position: absolute;
  inset: 0;
  background: url('https://picsum.photos/1920/1080?blur=2') center/cover no-repeat;
  filter: blur(4px);
}

.login-card-wrapper {
  position: relative;
  z-index: 2;
  width: 100%;
  max-width: 420px;
  padding: 20px;
}

.login-card {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(10px);
  border-radius: 12px;
}

.login-card :deep(.el-card__header) {
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.login-card :deep(.el-card__body) {
  padding: 24px;
}

.card-header {
  text-align: center;
}

.card-title {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}

.login-tabs :deep(.el-tabs__header) {
  margin-bottom: 20px;
}

.login-tabs :deep(.el-tabs__item) {
  font-size: 16px;
}

.login-tabs :deep(.el-tabs__content) {
  overflow: visible;
}

.login-form {
  padding-top: 8px;
}

.submit-btn {
  width: 100%;
  font-size: 16px;
}
</style>