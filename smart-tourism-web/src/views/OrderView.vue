<script setup>
import { onMounted, ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const { userInfo } = useAuth()
const orders = ref([])

// --- 新增：弹窗控制变量 ---
const detailDialogVisible = ref(false)
const currentOrder = ref(null)

const showOrderDetail = (row) => {
  currentOrder.value = row
  detailDialogVisible.value = true
}

const loadOrders = () => {
  // 废弃之前的本地假数据 getUserOrders，统一使用我们预订时存入的真实数据
  const savedOrders = JSON.parse(localStorage.getItem('orders') || '[]')
  orders.value = savedOrders
}

onMounted(() => {
  loadOrders()
})
</script>

<template>
  <div class="orders-page">
    <div class="orders-container">
      <div class="orders-header">
        <h2 class="title">我的订单</h2>
      </div>

      <el-card shadow="never" class="orders-card">
        <el-empty v-if="orders.length === 0" description="暂无订单，快去预订吧～" />

        <el-table
          v-else
          :data="orders"
          style="width: 100%"
          stripe
        >
          <el-table-column prop="id" label="订单号" width="160" />
          
          <el-table-column label="项目名称" min-width="200">
            <template #default="{ row }">
              <div style="display: flex; align-items: center; gap: 12px;">
                <img :src="row.image || row.imageUrl" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;" />
                <span>{{ row.attractionName }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="date" label="游玩/入住日期" width="130" />
          
          <el-table-column label="总金额" width="110">
            <template #default="{ row }">
              <span class="money">¥{{ row.price || row.totalPrice }}</span>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag type="success">{{ row.status || '已支付' }}</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="showOrderDetail(row)">
                查看详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-dialog
        v-model="detailDialogVisible"
        title="订单明细"
        width="450px"
        center
        destroy-on-close
        append-to-body
      >
        <div v-if="currentOrder" class="order-detail-content">
          <div style="text-align: center; margin-bottom: 20px;">
            <img :src="currentOrder.image || currentOrder.imageUrl" style="width: 100%; height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;" />
            <h3 style="margin: 0; color: #303133;">{{ currentOrder.attractionName }}</h3>
          </div>
          <el-descriptions :column="1" border size="large">
            <el-descriptions-item label="订单编号">{{ currentOrder.id }}</el-descriptions-item>
            <el-descriptions-item label="日期">{{ currentOrder.date }}</el-descriptions-item>
            <el-descriptions-item label="下单时间">{{ currentOrder.createTime || '近期下单' }}</el-descriptions-item>
            <el-descriptions-item label="支付金额">
              <span style="color: #f56c6c; font-weight: bold; font-size: 18px;">¥{{ currentOrder.price || currentOrder.totalPrice }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag type="success">{{ currentOrder.status || '已支付' }}</el-tag>
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
.orders-page {
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 24px 0 60px;
}

.orders-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

.orders-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.title {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #303133;
}

.orders-card {
  border-radius: 12px;
}

.money {
  color: #f56c6c;
  font-weight: 700;
  font-size: 16px;
}
</style>