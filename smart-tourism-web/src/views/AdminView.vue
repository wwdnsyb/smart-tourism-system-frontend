<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()
const activeMenu = ref('dashboard')
const allOrders = ref([])
const searchKeyword = ref('')

// 模拟的图表数据 (最近7天销售趋势)
const chartData = ref([
  { day: '周一', value: 120, height: '40%' },
  { day: '周二', value: 200, height: '70%' },
  { day: '周三', value: 150, height: '50%' },
  { day: '周四', value: 80, height: '30%' },
  { day: '周五', value: 70, height: '25%' },
  { day: '周六', value: 280, height: '90%' },
  { day: '周日', value: 310, height: '100%' },
])

// 真实请求后端所有订单数据
const loadAllOrders = async () => {
  try {
    const res = await window.axios.get('http://localhost:8080/api/orders/all')
    if (res.data.code === 200) {
      allOrders.value = res.data.data
      
      // 如果有真实数据，动态更新一下图表最后一天的柱子高度
      if (allOrders.value.length > 0) {
        const lastOrderPrice = allOrders.value[0].price || 0 // 取最新一单的价格
        chartData.value[6].value = lastOrderPrice
        chartData.value[6].height = Math.min(lastOrderPrice / 3, 100) + '%'
      }
    }
  } catch (error) {
    console.error('获取后端订单失败:', error)
    ElMessage.error('无法连接到数据库，请检查后端服务是否启动')
  }
}

onMounted(() => {
  // 1. 读取管理员信息
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  console.log('当前后台操作员:', user?.username)

  // 2. 调用加载真实数据的函数
  loadAllOrders()
})

// --- 计算属性 ---
const totalRevenue = computed(() => {
  return allOrders.value.reduce((sum, item) => sum + Number(item.price || 0), 0)
})

const totalOrders = computed(() => allOrders.value.length)

// 获取最近的订单 (取前8条，因为后端已经按时间倒序排好了)
const recentOrders = computed(() => {
  return allOrders.value.slice(0, 8)
})

// 搜索过滤
const filteredOrders = computed(() => {
  if (!searchKeyword.value) return allOrders.value
  const keyword = searchKeyword.value.toLowerCase()
  return allOrders.value.filter(item => 
    String(item.id).includes(keyword) || 
    (item.attractionName && item.attractionName.toLowerCase().includes(keyword))
  )
})

// 真实调用后端删除接口
const handleDelete = (id) => {
  ElMessageBox.confirm('确定要删除这条订单吗？数据删除后不可恢复。', '警告', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  }).then(async () => {
    try {
      const res = await window.axios.delete(`http://localhost:8080/api/orders/${id}`)
      if (res.data.code === 200) {
        // 后端删除成功后，前端数组同步移除这行数据
        allOrders.value = allOrders.value.filter(item => item.id !== id)
        ElMessage.success('订单已从数据库彻底删除')
      } else {
        ElMessage.error(res.data.msg || '删除失败')
      }
    } catch (error) {
      console.error('删除接口报错:', error)
      ElMessage.error('服务器连接失败')
    }
  })
}

const handleLogout = () => {
  localStorage.removeItem('user') 
  localStorage.removeItem('token') 
  router.push('/login')
}
</script>

<template>
  <div class="admin-container">
    <div class="sidebar">
      <div class="logo">🚀 智慧旅游管理</div>
      <div class="menu">
        <div 
          class="menu-item" 
          :class="{ active: activeMenu === 'dashboard' }"
          @click="activeMenu = 'dashboard'"
        >
          📊 数据看板
        </div>
        <div 
          class="menu-item" 
          :class="{ active: activeMenu === 'orders' }"
          @click="activeMenu = 'orders'"
        >
          📄 订单管理
        </div>
      </div>
      <div class="logout-btn" @click="handleLogout">
        🚪 退出系统
      </div>
    </div>

    <div class="main-content">
      <div class="top-bar">
        <h2>{{ activeMenu === 'dashboard' ? '数据可视化大屏' : '订单与财务管理' }}</h2>
        <div class="admin-info">
            <span class="role-badge">超级管理员</span>
            <span>Admin</span>
        </div>
      </div>

      <div v-if="activeMenu === 'dashboard'" class="dashboard-panel">
        <div class="stat-cards">
          <div class="stat-card blue">
            <div class="stat-title">总销售额 (Revenue)</div>
            <div class="stat-num">¥{{ totalRevenue }}</div>
            <div class="stat-icon">💰</div>
          </div>
          <div class="stat-card green">
            <div class="stat-title">总订单数 (Orders)</div>
            <div class="stat-num">{{ totalOrders }}</div>
            <div class="stat-icon">📦</div>
          </div>
          <div class="stat-card purple">
            <div class="stat-title">访问量 (Visits)</div>
            <div class="stat-num">1,284</div>
            <div class="stat-icon">📈</div>
          </div>
          <div class="stat-card orange">
            <div class="stat-title">好评率 (Rate)</div>
            <div class="stat-num">98%</div>
            <div class="stat-icon">⭐</div>
          </div>
        </div>

        <div class="chart-section">
            <h3 class="panel-title">📅 近一周销售趋势图</h3>
            <div class="bar-chart">
                <div class="bar-item" v-for="(item, index) in chartData" :key="index">
                    <div class="bar-value">{{ item.value }}</div>
                    <div class="bar" :style="{ height: item.height }"></div>
                    <div class="bar-label">{{ item.day }}</div>
                </div>
            </div>
        </div>
        
        <div class="recent-table-section">
            <h3 class="panel-title">🚀 最新实时订单</h3>
            <el-table :data="recentOrders" border style="width: 100%">
                <el-table-column prop="attractionName" label="景点名称" />
                <el-table-column prop="price" label="金额">
                    <template #default="scope">¥{{ scope.row.price }}</template>
                </el-table-column>
                <el-table-column prop="date" label="游玩日期" />
                <el-table-column prop="status" label="状态">
                    <template #default><el-tag type="success" size="small">已支付</el-tag></template>
                </el-table-column>
            </el-table>
        </div>
      </div>

      <div v-if="activeMenu === 'orders'" class="orders-panel">
        <el-card>
          <div style="margin-bottom: 20px; display: flex; gap: 10px;">
            <el-input v-model="searchKeyword" placeholder="🔍 搜索订单号或景点名称..." style="width: 300px;" clearable />
            <el-button type="primary">搜索</el-button>
          </div>
          <el-table :data="filteredOrders" border stripe style="width: 100%">
            <el-table-column prop="id" label="订单号" width="180" />
            <el-table-column prop="attractionName" label="景点名称" />
            <el-table-column prop="price" label="金额" width="120">
              <template #default="scope">¥{{ scope.row.price }}</template>
            </el-table-column>
            <el-table-column prop="date" label="游玩日期" width="150" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default>
                <el-tag type="success">已支付</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作">
              <template #default="scope">
                <el-button size="small" type="danger" icon="Delete" @click="handleDelete(scope.row.id)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 布局基础 */
.admin-container {
  display: flex;
  height: 100vh;
  background-color: #f5f7fa;
  font-family: 'Segoe UI', sans-serif;
}

/* 侧边栏 */
.sidebar {
  width: 240px;
  background: linear-gradient(180deg, #304156 0%, #1f2d3d 100%);
  color: #fff;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 6px rgba(0,0,0,0.1);
}

.logo {
  height: 64px;
  line-height: 64px;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  background-color: #2b2f3a;
  color: #409EFF;
  border-bottom: 1px solid #1f2d3d;
}

.menu {
  flex: 1;
  padding-top: 20px;
}

.menu-item {
  height: 56px;
  line-height: 56px;
  padding-left: 30px;
  cursor: pointer;
  transition: all 0.3s;
  font-size: 15px;
  border-left: 4px solid transparent;
}

.menu-item:hover {
  background-color: #263445;
}

.menu-item.active {
  background-color: #1f2d3d;
  color: #409EFF;
  border-left-color: #409EFF;
}

.logout-btn {
  height: 50px;
  line-height: 50px;
  text-align: center;
  background-color: #d94545;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.3s;
}
.logout-btn:hover { background-color: #b93232; }

/* 主体内容 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 防止双滚动条 */
}

.top-bar {
  height: 64px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0,21,41,.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  z-index: 10;
}
.role-badge {
    background: #e6f7ff;
    color: #1890ff;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 12px;
    margin-right: 10px;
}

.dashboard-panel, .orders-panel {
  padding: 24px;
  flex: 1;
  overflow-y: auto;
}

/* 统计卡片 */
.stat-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
  margin-bottom: 24px;
}

.stat-card {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05);
  position: relative;
  overflow: hidden;
  transition: transform 0.3s;
}
.stat-card:hover { transform: translateY(-5px); }

.stat-title { font-size: 14px; color: #909399; margin-bottom: 10px; }
.stat-num { font-size: 28px; font-weight: bold; color: #303133; }
.stat-icon { position: absolute; right: 20px; top: 20px; font-size: 40px; opacity: 0.2; }

/* 颜色装饰 */
.blue { border-top: 4px solid #409EFF; }
.green { border-top: 4px solid #67C23A; }
.purple { border-top: 4px solid #a65cee; }
.orange { border-top: 4px solid #E6A23C; }

/* 🔥 图表区域样式 */
.chart-section {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 12px 0 rgba(0,0,0,0.05);
    margin-bottom: 24px;
}
.panel-title { margin: 0 0 20px 0; font-size: 16px; color: #333; }

.bar-chart {
    height: 250px;
    display: flex;
    justify-content: space-around;
    align-items: flex-end;
    padding-bottom: 20px;
    border-bottom: 1px solid #eee;
}

.bar-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 60px;
    height: 100%;
    justify-content: flex-end;
}

.bar {
    width: 30px;
    background: linear-gradient(to top, #409EFF, #66b1ff);
    border-radius: 4px 4px 0 0;
    transition: height 0.5s ease;
    min-height: 4px; /* 至少显示一点 */
}

.bar-value { font-size: 12px; color: #666; margin-bottom: 5px; }
.bar-label { margin-top: 10px; font-size: 13px; color: #333; font-weight: bold; }

.recent-table-section {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
}
</style>