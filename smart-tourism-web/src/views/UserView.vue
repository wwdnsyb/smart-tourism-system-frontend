<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { ElMessage } from 'element-plus'

const router = useRouter()
const route = useRoute()
const { userInfo } = useAuth()

// 当前激活的标签页
const activeTab = ref('orders')

// 订单列表
const orderList = ref([])

// 收藏列表
const favoriteList = ref([])

// --- 控制订单详情弹窗的变量和函数 (只保留这一份) ---
const detailDialogVisible = ref(false)
const currentOrder = ref(null)

const showOrderDetail = (row) => {
  currentOrder.value = row
  detailDialogVisible.value = true
}

// 个人资料
const profileForm = ref({
  username: userInfo.value?.username || '',
  avatar: `https://picsum.photos/100/100?random=${Math.floor(Math.random() * 1000)}`
})

// 修改密码表单
const passwordForm = ref({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

// 表单验证规则
const rules = {
  oldPassword: [
    { required: true, message: '请输入原密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度至少6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请确认新密码', trigger: 'blur' },
    {
      validator: (rule, value, callback) => {
        if (value !== passwordForm.value.newPassword) {
          callback(new Error('两次输入的密码不一致'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

// 加载订单数据
// 核心：从 Java 后端加载真实订单
const loadOrders = async () => {
  if (!userInfo.value) return; // 没登录就不查
  
  try {
    // 1. 发送请求，路径要和你后端的 @GetMapping("/user/{userName}") 对应
    const res = await window.axios.get(`http://localhost:8080/api/orders/user/${userInfo.value.username}`);
    
    if (res.data.code === 200) {
      // 2. 字段映射：把数据库的“坑”填到前端的“位”上
      orderList.value = res.data.data.map(item => ({
        id: item.id,
        attractionName: item.hotelName, // 数据库里存的是景点/酒店名
        date: item.checkIn,            // 游玩/入住日期
        price: item.amount,            // 订单金额
        status: item.status === 'PAID' ? '已支付' : item.status,
        createTime: item.createTime,
        // 列表图片：由于 Order 表没存图，这里可以根据 ID 随机一张或给个默认图
        image: 'https://picsum.photos/200/150?random=' + item.id 
      }));
    }
  } catch (error) {
    console.error('获取订单失败:', error);
    ElMessage.error('无法连接数据库获取订单');
  }
}

// 加载收藏数据
const loadFavorites = () => {
  const favorites = JSON.parse(localStorage.getItem('my_favorites') || '[]')
  favoriteList.value = favorites
}

// 取消收藏
const removeFavorite = (id) => {
  const favorites = JSON.parse(localStorage.getItem('my_favorites') || '[]')
  const updatedFavorites = favorites.filter(item => item.id !== id)
  localStorage.setItem('my_favorites', JSON.stringify(updatedFavorites))
  favoriteList.value = updatedFavorites
  ElMessage.success('已取消收藏')
}

// --- 核心修改：实现个人资料真实保存 ---
const handleProfileSubmit = () => {
  // 1. 做简单的非空校验
  if (!profileForm.value.username) {
    ElMessage.warning('用户名不能为空')
    return
  }

  // 2. 获取旧的用户数据 (防止把 id 或 role 等其他字段弄丢了)
  const currentUser = JSON.parse(localStorage.getItem('user_info') || '{}')

  // 3. 合并新数据：保留旧数据的 id/role，覆盖新的 username/email/phone/avatar
  const updatedUser = {
    ...currentUser,
    username: profileForm.value.username,
    email: profileForm.value.email,
    phone: profileForm.value.phone,
    avatar: profileForm.value.avatar
  }

  // 4. 存回 LocalStorage (这就是“持久化保存”)
  localStorage.setItem('user_info', JSON.stringify(updatedUser))

  // 5. 提示成功并刷新页面 (为了让顶部导航栏的名字也立刻更新)
  ElMessage.success('个人资料修改成功！页面即将刷新...')
  setTimeout(() => {
    window.location.reload()
  }, 1000)
}

// 修改 src/views/UserView.vue 中的 handlePasswordSubmit 函数

// --- 核心修改：连接后端数据库真实修改密码 ---
const handlePasswordSubmit = async () => {
  if (!passwordForm.value.oldPassword || !passwordForm.value.newPassword || !passwordForm.value.confirmPassword) {
    ElMessage.warning('请填写完整的密码信息')
    return
  }
  
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    ElMessage.error('两次输入的新密码不一致')
    return
  }

  try {
    // 获取当前登录的用户名 (从你现有的 userInfo 里拿)
    const currentUsername = userInfo.value.username

    // 发起真实的 PUT 请求修改数据库
    const res = await window.axios.put('http://localhost:8080/api/users/password', {
      username: currentUsername,
      oldPassword: passwordForm.value.oldPassword,
      newPassword: passwordForm.value.newPassword
    })

    // 对应你后端返回的 res.put("code", 200)
    if (res.data.code === 200) {
      ElMessage.success('密码修改成功！请重新登录')
      
      setTimeout(() => {
        localStorage.removeItem('user_info')
        localStorage.removeItem('token')
        router.push('/login')
        setTimeout(() => window.location.reload(), 100)
      }, 1500)
    } else {
      // 对应后端返回的 res.put("msg", "原密码错误")
      ElMessage.error(res.data.msg || '修改失败')
    }
  } catch (error) {
    console.error('修改密码接口报错:', error)
    ElMessage.error('服务器连接失败')
  }
}

// 监听标签页切换，确保数据实时更新
const handleTabChange = () => {
  if (activeTab.value === 'orders') {
    loadOrders() // 🔥 切换到订单页时，重新从后端拉取最新数据
  }
  if (activeTab.value === 'favorites') {
    loadFavorites()
  }
}
onMounted(() => {
  loadOrders() // 🔥 初始加载真实订单
  loadFavorites()
  
  // 处理从详情页下单成功跳转过来的情况（带了 ?tab=orders 参数）
  if (route.query.tab) {
    activeTab.value = route.query.tab
  }
})
</script>

<template>
  <div class="user-view">
    <div class="container">
      <h1 class="page-title">👤 个人中心</h1>
      
      <el-card shadow="hover" class="user-card">
        <el-tabs v-model="activeTab" type="border-card" style="margin-top: 20px;" @tab-click="handleTabChange">
          <el-tab-pane label="我的订单" name="orders">
            <div class="orders-tab">
              <template v-if="orderList.length === 0">
                <el-empty description="暂无订单" />
              </template>
              <template v-else>
                <el-table :data="orderList" style="width: 100%" stripe>
                  <el-table-column prop="id" label="订单号" width="180">
                    <template #default="scope">
                      {{ scope.row.id }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="attractionName" label="项目名称" min-width="150">
                    <template #default="scope">
                      <div class="attraction-info">
                        <img :src="scope.row.image || scope.row.imageUrl" :alt="scope.row.attractionName" class="attraction-image" />
                        <span>{{ scope.row.attractionName }}</span>
                      </div>
                    </template>
                  </el-table-column>
                  <el-table-column prop="date" label="预订日期" width="120">
                    <template #default="scope">
                      {{ scope.row.date }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="price" label="支付金额" width="100">
                    <template #default="scope">
                      ¥{{ scope.row.price }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="status" label="状态" width="100">
                    <template #default="scope">
                      <el-tag type="success">{{ scope.row.status }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="120">
                    <template #default="scope">
                      <el-button size="small" type="primary" @click="showOrderDetail(scope.row)">查看详情</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </template>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="个人资料" name="profile">
            <div class="profile-tab">
              <el-form :model="profileForm" label-width="100px" style="max-width: 600px;">
                <el-form-item label="头像">
                  <el-avatar :src="profileForm.avatar" size="large" style="margin-bottom: 10px;">
                    {{ profileForm.username.charAt(0) }}
                  </el-avatar>
                  <el-button type="primary" size="small" style="margin-left: 10px;">更换头像</el-button>
                </el-form-item>
                <el-form-item label="用户名">
                  <el-input v-model="profileForm.username" placeholder="请输入用户名" />
                </el-form-item>
                <el-form-item label="邮箱">
                  <el-input v-model="profileForm.email" placeholder="请输入邮箱" />
                </el-form-item>
                <el-form-item label="手机号">
                  <el-input v-model="profileForm.phone" placeholder="请输入手机号" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="handleProfileSubmit">保存修改</el-button>
                  <el-button>取消</el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="账号安全" name="security">
            <div class="security-tab">
              <el-form :model="passwordForm" :rules="rules" label-width="100px" style="max-width: 600px;">
                <el-form-item label="原密码" prop="oldPassword">
                  <el-input type="password" v-model="passwordForm.oldPassword" placeholder="请输入原密码" />
                </el-form-item>
                <el-form-item label="新密码" prop="newPassword">
                  <el-input type="password" v-model="passwordForm.newPassword" placeholder="请输入新密码" />
                </el-form-item>
                <el-form-item label="确认密码" prop="confirmPassword">
                  <el-input type="password" v-model="passwordForm.confirmPassword" placeholder="请确认新密码" />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" @click="handlePasswordSubmit">提交修改</el-button>
                  <el-button @click="passwordForm = { oldPassword: '', newPassword: '', confirmPassword: '' }">重置</el-button>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>
          
          <el-tab-pane label="我的收藏" name="favorites">
            <div class="favorites-tab">
              <template v-if="favoriteList.length === 0">
                <el-empty description="暂无收藏景点" />
              </template>
              <template v-else>
                <el-row :gutter="20">
                  <el-col
                    v-for="item in favoriteList"
                    :key="item.id"
                    :xs="24"
                    :sm="12"
                    :md="8"
                    :lg="6"
                    :xl="6"
                  >
                    <el-card class="favorite-card" shadow="hover">
                      <div class="favorite-image-wrapper">
                        <img
                          :src="item.image"
                          :alt="item.name"
                          class="favorite-image"
                        >
                      </div>
                      <div class="favorite-content">
                        <h3 class="favorite-title">{{ item.name }}</h3>
                        <div class="favorite-price">
                          ¥{{ item.price }}
                        </div>
                        <div class="favorite-actions">
                          <el-button
                            type="primary"
                            size="small"
                            @click="router.push({ path: `/attraction/${item.id}` })"
                          >
                            查看详情
                          </el-button>
                          <el-button
                            type="danger"
                            size="small"
                            @click="removeFavorite(item.id)"
                          >
                            取消收藏
                          </el-button>
                        </div>
                      </div>
                    </el-card>
                  </el-col>
                </el-row>
              </template>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <el-dialog
        v-model="detailDialogVisible"
        title="订单明细"
        width="500px"
        center
        destroy-on-close
        append-to-body
      >
        <div v-if="currentOrder" class="order-detail-content">
          <div class="detail-header" style="text-align: center; margin-bottom: 20px;">
            <img 
              :src="currentOrder.image || currentOrder.imageUrl" 
              style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;" 
            />
            <h3 style="margin: 10px 0;">{{ currentOrder.attractionName }}</h3>
          </div>
          <el-descriptions :column="1" border>
            <el-descriptions-item label="订单编号">{{ currentOrder.id }}</el-descriptions-item>
            <el-descriptions-item label="预订/游玩日期">{{ currentOrder.date }}</el-descriptions-item>
            <el-descriptions-item label="下单时间">{{ currentOrder.createTime || '最近下单' }}</el-descriptions-item>
            <el-descriptions-item label="支付金额">
              <span style="color: #f56c6c; font-weight: bold;">¥{{ currentOrder.price }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="订单状态">
              <el-tag type="success" effect="dark">{{ currentOrder.status }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>
        </div>
        <template #footer>
          <el-button type="primary" @click="detailDialogVisible = false">关闭窗口</el-button>
        </template>
      </el-dialog>

    </div>
  </div>
</template>

<style scoped>
.user-view {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 40px 0;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.page-title {
  font-size: 32px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 40px 0;
  text-align: center;
}

.user-card {
  border-radius: 12px;
  overflow: hidden;
}

/* 订单标签页样式 */
.orders-tab {
  padding: 20px 0;
}

.attraction-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.attraction-image {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
}

/* 个人资料标签页样式 */
.profile-tab {
  padding: 20px 0;
}

/* 账号安全标签页样式 */
.security-tab {
  padding: 20px 0;
}

/* 收藏标签页样式 */
.favorites-tab {
  padding: 20px 0;
}

.favorite-card {
  margin-bottom: 20px;
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.favorite-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1) !important;
}

.favorite-image-wrapper {
  width: 100%;
  height: 120px;
  overflow: hidden;
  background-color: #f0f0f0;
}

.favorite-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.favorite-card:hover .favorite-image {
  transform: scale(1.1);
}

.favorite-content {
  padding: 16px;
}

.favorite-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.favorite-price {
  font-size: 18px;
  font-weight: 700;
  color: #f56c6c;
  margin: 0 0 12px 0;
}

.favorite-actions {
  display: flex;
  gap: 8px;
}

.favorite-actions .el-button {
  flex: 1;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .user-view {
    padding: 20px 0;
  }
  
  .container {
    padding: 0 16px;
  }
  
  .page-title {
    font-size: 24px;
    margin-bottom: 24px;
  }
  
  .attraction-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .attraction-image {
    width: 60px;
    height: 60px;
  }
}
</style>