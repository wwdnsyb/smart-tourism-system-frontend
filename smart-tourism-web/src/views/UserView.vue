<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { ElMessage } from 'element-plus'

const axios = window.axios

const router = useRouter()
const route = useRoute()
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

// 1. 先确保是从缓存拿数据
const userInfo = ref(JSON.parse(localStorage.getItem('user_info') || '{}'))

// 2. 这里的 avatar 逻辑：增加一个“包含 random”的判断
const profileForm = ref({
  username: userInfo.value?.username || '',
  email: userInfo.value?.email || '',
  phone: userInfo.value?.phone || '',
  // 🔥 修改重点：如果 avatar 链接里有 "random" 这个词，就直接判定为无效，显示默认图
  avatar: (userInfo.value?.avatar && !userInfo.value.avatar.includes('random'))
    ? userInfo.value.avatar
    : 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'
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

// --- 🔥 核心修改：从 Java 后端加载真实的收藏数据 ---
const loadFavorites = async () => {
  if (!userInfo.value || !userInfo.value.id) return
  try {
    const res = await window.axios.get(`http://localhost:8080/api/favorites/${userInfo.value.id}`)
    if (res.data.code === 200) {
      favoriteList.value = res.data.data
    }
  } catch (error) {
    console.error('获取收藏失败:', error)
    ElMessage.error('无法连接数据库获取收藏列表')
  }
}

// --- 🔥 核心修改：调用后端接口取消收藏，并区分 targetType ---
const removeFavorite = async (item) => {
  try {
    const res = await window.axios.delete(`http://localhost:8080/api/favorites/remove`, {
      params: {
        userId: userInfo.value.id,
        targetId: item.targetId,      // 传对象的真实ID
        targetType: item.targetType   // 传类型（SPOT 还是 HOTEL）
      }
    })
    if (res.data.code === 200) {
      ElMessage.success('已取消收藏')
      loadFavorites() // 删除成功后，重新从数据库拉取最新列表
    } else {
      ElMessage.error(res.data.msg || '取消失败')
    }
  } catch (error) {
    console.error('取消收藏报错:', error)
    ElMessage.error('取消收藏失败，服务器连接异常')
  }
}

// --- 🔥 新增助手函数：根据收藏的类型，跳转到不同的详情页 ---
const goToDetail = (item) => {
  if (item.targetType === 'HOTEL') {
    router.push(`/hotel/${item.targetId}`)
  } else {
    // 默认当做景点 (SPOT) 处理
    router.push(`/attraction/${item.targetId}`)
  }
}

const getSafeAvatar = (url) => {
  // 如果链接包含随机图、占位图或者是空的，返回国内稳定的默认图
  if (!url || url.includes('random') || url.includes('picsum') || url.trim() === '') {
    return 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'
  }
  return url
}

// --- 核心修改：连接后端数据库真实修改资料 ---
const handleProfileSubmit = async () => {
  if (!profileForm.value.username) {
    ElMessage.warning('用户名不能为空')
    return
  }

  // 🚨 安全检查：如果没有 ID，说明登录失效，直接更新会报错
  if (!userInfo.value || !userInfo.value.id) {
    ElMessage.error('用户信息缺失，请重新登录')
    return
  }

  try {
    const res = await window.axios.put('http://localhost:8080/api/users/profile', {
      id: userInfo.value.id,
      username: profileForm.value.username,
      email: profileForm.value.email,
      phone: profileForm.value.phone,
      avatar: profileForm.value.avatar // 这里是用户新粘贴的链接
    })

    if (res.data.code === 200) {
      const serverUser = res.data.data // 后端返回的最新对象

      // 🚨 核心修正：同步三处地方
      // 1. 更新全局响应式用户信息
      userInfo.value = { ...userInfo.value, ...serverUser }

      // 2. 更新表单绑定的数据（特别是头像链接）
      profileForm.value.avatar = getSafeAvatar(serverUser.avatar)
      profileForm.value.username = serverUser.username

      // 3. 更新本地持久化存储
      localStorage.setItem('user_info', JSON.stringify(userInfo.value))

      ElMessage.success('🎉 个人资料已同步！')
    } else {
      ElMessage.error(res.data.msg || '保存失败')
    }
  } catch (error) {
    console.error('报错:', error)
    ElMessage.error('服务器连接失败')
  }
}

// --- 核心修改：连接后端真实修改密码 ---
const handlePasswordSubmit = async () => {
  // 1. 基本验证
  if (!passwordForm.value.oldPassword || !passwordForm.value.newPassword || !passwordForm.value.confirmPassword) {
    ElMessage.warning('请填写完整的密码信息')
    return
  }
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    ElMessage.error('两次输入的新密码不一致')
    return
  }

  try {
    // 2. 发起 PUT 请求调用后端接口
    const res = await window.axios.put('http://localhost:8080/api/users/password', {
      username: userInfo.value.username, // 传用户名去找人
      oldPassword: passwordForm.value.oldPassword, // 传原密码去校验
      newPassword: passwordForm.value.newPassword  // 传新密码去修改
    })

    if (res.data.code === 200) {
      // 3. 真正的成功逻辑
      ElMessage.success('🔒 密码修改成功！请使用新密码重新登录')

      // 修改成功后必须强制踢出登录，让缓存失效
      setTimeout(() => {
        localStorage.clear() // 清空所有缓存
        router.push('/login')
        setTimeout(() => window.location.reload(), 100)
      }, 1500)
    } else {
      // 🚨 这里会拦截到“原密码错误”的报错
      ElMessage.error(res.data.msg || '修改失败')
    }
  } catch (error) {
    console.error('修改密码报错:', error)
    ElMessage.error('服务器连接失败，请检查后端接口')
  }
}

// ==========================================
// 🔥 新增：智能推荐算法逻辑
// ==========================================
const recommendList = ref([])
const recommendLoading = ref(false)

const loadRecommendations = async () => {
  if (!userInfo.value) return
  recommendLoading.value = true

  try {
    // 调用后端刚才写的推荐接口
    const res = await window.axios.get(`http://localhost:8080/api/scenic-spots/recommend/${userInfo.value.username}`)
    if (res.data.code === 200) {
      recommendList.value = res.data.data
    }
  } catch (error) {
    console.error('获取智能推荐失败:', error)
  } finally {
    recommendLoading.value = false
  }
}

// 监听标签页切换，确保数据实时更新
const handleTabChange = () => {
  if (activeTab.value === 'orders') {
    loadOrders() // 🔥 切换到订单页时，重新从后端拉取最新数据
    loadRecommendations() // 重新拉取推荐
  }
  if (activeTab.value === 'favorites') {
    loadFavorites()
  }
}

onMounted(async () => { // ⚠️ 核心修改 1：加上 async
  loadOrders() // 🔥 初始加载真实订单
  loadFavorites()
  loadRecommendations() // 🔥 初始加载智能推荐

  // 处理从详情页下单成功跳转过来的情况（带了 ?tab=orders 参数）
  if (route.query.tab) {
    activeTab.value = route.query.tab
  }

  // ==========================================
  // 🔥 核心大招：拦截支付宝同步回调，更新订单状态为 PAID
  // ==========================================
  const out_trade_no = route.query.out_trade_no // 我们自己生成的业务订单号
  const trade_no = route.query.trade_no         // 支付宝官方流水号

  // 如果网址里带了这两个参数，说明刚从支付宝付款回来！
  if (out_trade_no && trade_no) {
    try {
      const formData = new URLSearchParams()
      formData.append('orderNo', out_trade_no)
      formData.append('alipayTradeNo', trade_no)

      // 1. 主动告诉后端：支付宝说钱付啦，快把这笔订单改成 PAID！
      await axios.post('http://localhost:8080/api/orders/paySuccess', formData)

      ElMessage.success('🎉 支付宝付款成功！订单已生效。')

      // 2. 强制切换到“我的订单”标签页
      activeTab.value = 'orders'

      // 3. 重新加载最新的订单数据（用户会亲眼看到 UNPAID 瞬间变绿变成 PAID）
      loadOrders()

      // 4. 为了防止用户按 F5 刷新页面重复弹窗报错，我们把 URL 里的支付宝参数抹掉
      router.replace({ path: route.path, query: { tab: 'orders' } })

    } catch (err) {
      console.error('更新支付宝状态失败', err)
      ElMessage.error('订单状态同步存在延迟，请稍后刷新查看')
    }
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
                        <img :src="scope.row.image || scope.row.imageUrl" :alt="scope.row.attractionName"
                          class="attraction-image" />
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

            <div class="recommend-section" v-if="recommendList && recommendList.length > 0"
              v-loading="recommendLoading">
              <div class="recommend-header">
                <h3 style="margin: 0; color: #303133; display: flex; align-items: center;">
                  ✨ 猜你喜欢
                  <el-tag size="small" type="warning" effect="light" style="margin-left: 10px; border-radius: 12px;">
                    AI 智能推荐
                  </el-tag>
                  <span style="font-size: 13px; color: #909399; font-weight: normal; margin-left: 10px;">
                    基于您的游玩偏好生成
                  </span>
                </h3>
              </div>

              <el-row :gutter="20" style="margin-top: 20px;">
                <el-col :span="6" v-for="item in recommendList" :key="item.id">
                  <el-card class="recommend-card" shadow="hover" :body-style="{ padding: '0px' }"
                    @click="router.push(`/attraction/${item.id}`)">
                    <img :src="item.imageUrl || item.cover || `https://picsum.photos/300/200?random=${item.id}`"
                      class="recommend-img">
                    <div style="padding: 14px;">
                      <div class="recommend-title">{{ item.name }}</div>
                      <div class="recommend-bottom">
                        <span class="recommend-price">¥{{ item.price || 99 }}</span>
                        <el-button type="primary" size="small" plain round>去看看</el-button>
                      </div>
                    </div>
                  </el-card>
                </el-col>
              </el-row>
            </div>
          </el-tab-pane>

          <el-tab-pane label="个人资料" name="profile">
            <div class="profile-tab">
              <el-form :model="profileForm" label-width="100px" style="max-width: 600px;">

                <el-form-item label="头像设置">
                  <div style="display: flex; align-items: center; gap: 15px;">
                    <el-avatar :src="profileForm.avatar" size="large">
                      {{ profileForm.username?.charAt(0) || 'U' }}
                    </el-avatar>
                    <el-input v-model="profileForm.avatar" placeholder="请粘贴一张网上的图片链接到这里" style="width: 300px;"
                      clearable />
                  </div>
                </el-form-item>

                <el-form-item label="用户名">
                  <el-input v-model="profileForm.username" placeholder="请输入全新的用户名" />
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
                  <el-button
                    @click="passwordForm = { oldPassword: '', newPassword: '', confirmPassword: '' }">重置</el-button>
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
                  <el-col v-for="item in favoriteList" :key="item.id" :xs="24" :sm="12" :md="8" :lg="6" :xl="6">
                    <el-card class="favorite-card" shadow="hover">
                      <div class="favorite-image-wrapper">
                        <img :src="item.image" :alt="item.name" class="favorite-image">
                      </div>
                      <div class="favorite-content">
                        <h3 class="favorite-title">{{ item.name }}</h3>
                        <div class="favorite-price">
                          ¥{{ item.price }}
                        </div>
                        <div class="favorite-actions">
                          <el-button type="primary" size="small" @click="goToDetail(item)">
                            查看详情
                          </el-button>

                          <el-button type="danger" size="small" @click="removeFavorite(item)">
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

      <el-dialog v-model="detailDialogVisible" title="订单明细" width="500px" center destroy-on-close append-to-body>
        <div v-if="currentOrder" class="order-detail-content">
          <div class="detail-header" style="text-align: center; margin-bottom: 20px;">
            <img :src="currentOrder.image || currentOrder.imageUrl"
              style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;" />
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
/* 🔥 核心修复：全屏沉浸式背景 */
.user-view {
  min-height: 100vh;
  /* 1. 第一层：半透明黑色遮罩，确保白色卡片清晰可见 
     2. 第二层：稳定的微软必应高清壁纸（国内访问极快）
     3. 第三层：兜底渐变色，防止断网时完全发白
  */
  background: 
    linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), 
    url('https://tse2.mm.bing.net/th/id/OIP.PmmNXGifN5xcvDNscFnzggHaEK?rs=1&pid=ImgDetMain&o=7&rm=3') center/cover no-repeat fixed,
    linear-gradient(135deg, #2c3e50 0%, #000000 100%);
  
  padding: 40px 0;
  position: relative;
  z-index: 1;
}

/* --- 注意：这里删除了原本多余且容易出错的 .user-view::before 块 --- */

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* 标题样式：增加白色光影，在深色背景下更亮眼 */
.page-title {
  font-size: 36px;
  font-weight: 800;
  color: #ffffff; /* 改为白色，配合深色背景 */
  margin: 0 0 40px 0;
  text-align: center;
  text-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
  letter-spacing: 2px;
}

/* 🔥 UI 保持：毛玻璃玻璃化容器 */
.user-card {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.3);
  /* 稍微调低透明度，让背后的景色隐约透出来，更有高级感 */
  background: rgba(255, 255, 255, 0.8) !important;
  backdrop-filter: blur(12px);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
}

/* 订单标签页样式 */
.orders-tab {
  padding: 10px 0;
}

.attraction-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.attraction-image {
  width: 50px;
  height: 50px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

/* 个人资料/账号安全标签页 */
.profile-tab,
.security-tab {
  padding: 20px 0;
}

/* 收藏卡片升级 */
.favorite-card {
  margin-bottom: 20px;
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  background: rgba(255, 255, 255, 0.9);
  border: none !important;
}

.favorite-card:hover {
  transform: translateY(-8px) scale(1.02);
  box-shadow: 0 15px 30px rgba(0, 0, 0, 0.2) !important;
}

.favorite-image-wrapper {
  width: 100%;
  height: 140px;
  overflow: hidden;
  background-color: #f0f0f0;
}

.favorite-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s;
}

.favorite-card:hover .favorite-image {
  transform: scale(1.15);
}

.favorite-content {
  padding: 18px;
}

.favorite-title {
  font-size: 17px;
  font-weight: 700;
  color: #303133;
  margin: 0 0 10px 0;
  line-height: 1.4;
}

.favorite-price {
  font-size: 20px;
  font-weight: 800;
  color: #f56c6c;
  margin: 0 0 15px 0;
}

.favorite-actions {
  display: flex;
  gap: 10px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .user-view { padding: 20px 0; }
  .container { padding: 0 16px; }
  .page-title { font-size: 26px; }
  .attraction-info { flex-direction: column; align-items: center; text-align: center; }
}

/* 推荐算法模块 */
.recommend-section {
  margin-top: 50px;
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  padding-top: 30px;
}

.recommend-section h3 {
  font-size: 22px;
  color: #303133;
  margin-bottom: 25px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.recommend-card {
  border-radius: 14px;
  overflow: hidden;
  transition: all 0.4s;
  cursor: pointer;
  border: none !important;
  background: #ffffff;
}

.recommend-card:hover {
  transform: translateY(-10px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.1);
}

.recommend-img {
  width: 100%;
  height: 160px;
  object-fit: cover;
  display: block;
}

.recommend-price {
  color: #f56c6c;
  font-size: 22px;
  font-weight: 800;
}

/* Tabs 样式微调 */
:deep(.el-tabs__item.is-active) {
  font-weight: 800;
  color: #409eff !important;
}

:deep(.el-tabs__active-bar) {
  background: linear-gradient(90deg, #409eff, #36d1dc);
  height: 3px;
}

:deep(.el-tabs--border-card) {
  border: none;
  background: transparent;
}
</style>