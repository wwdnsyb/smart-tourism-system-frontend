<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import AMapLoader from '@amap/amap-jsapi-loader'

// 接收父组件传来的目的地经纬度和名称
const props = defineProps({
  destName: { type: String, default: '目的地' },
  destLngLat: { type: Array, required: true } // 格式: [经度, 纬度] 比如 [116.397428, 39.90923]
})

const map = ref(null)
const activeMode = ref('driving') // 默认自驾: driving, walking, transfer
const startInput = ref('') // 自定义起点输入
let AMap = null
let routePlugin = null

// 初始化地图
const initMap = () => {
  // 务必确保你的安全密钥配置正确
  window._AMapSecurityConfig = {
    securityJsCode: '8a9b58064aafb7226117c4950f6a3993', 
  }

  AMapLoader.load({
    key: '48d8a8e5e7c1040324124a3cf9519921', 
    version: '2.0',
    // 核心：加载高德的路线规划和搜索插件
    plugins: ['AMap.Driving', 'AMap.Walking', 'AMap.Transfer', 'AMap.PlaceSearch']
  }).then((amap) => {
    AMap = amap
    map.value = new AMap.Map('route-map', {
      center: props.destLngLat,
      zoom: 14
    })
    
    // 在地图上给目的地打个标
    new AMap.Marker({
      position: props.destLngLat,
      map: map.value,
      title: props.destName,
      label: { content: '终点', direction: 'top' }
    })
  }).catch(e => {
    console.error('高德地图加载失败', e)
    ElMessage.error('地图加载失败，请检查网络或密钥配置')
  })
}

// 搜索起点并开始规划
const searchRoute = () => {
  if (!startInput.value) {
    ElMessage.warning('请输入出发地名称！')
    return
  }
  
  // 第一步：用 PlaceSearch 把用户输入的文本变成经纬度
  const placeSearch = new AMap.PlaceSearch({ city: '全国' })
  placeSearch.search(startInput.value, (status, result) => {
    if (status === 'complete' && result.info === 'OK') {
      const startPoi = result.poiList.pois[0].location
      planRoute([startPoi.lng, startPoi.lat], props.destLngLat)
    } else {
      ElMessage.error('找不到该出发地，换个详细点的地名试试？')
    }
  })
}

// 执行具体的路线规划
const planRoute = (start, end) => {
  // 每次重新规划前，清除上一次的旧路线
  if (routePlugin) {
    routePlugin.clear()
  }

  // 根据当前选择的出行方式实例化不同的插件
  const pluginMap = {
    driving: AMap.Driving,
    walking: AMap.Walking,
    transfer: AMap.Transfer
  }
  const PluginClass = pluginMap[activeMode.value]
  
  routePlugin = new PluginClass({
    map: map.value,
    panel: 'route-panel', // 这里的面板ID是精髓，高德会自动把导航文字塞进这个div里
    city: '全国' // 公交跨城需要
  })

  // 发起请求绘制路线
  routePlugin.search(start, end, (status, result) => {
    if (status === 'complete') {
      ElMessage.success('路线规划成功！')
    } else {
      ElMessage.error('距离太远或无有效路线！')
    }
  })
}

// 切换出行方式时，如果有起点，自动重新规划
const onModeChange = () => {
  if (startInput.value && routePlugin) {
    searchRoute()
  }
}

onMounted(() => {
  initMap()
})

onUnmounted(() => {
  if (map.value) map.value.destroy()
})
</script>

<template>
  <div class="route-plan-container">
    <div class="control-bar">
      <el-input 
        v-model="startInput" 
        placeholder="请输入你的当前位置 (如：北京南站)" 
        style="width: 300px; margin-right: 15px;"
        @keyup.enter="searchRoute"
        clearable
      >
        <template #append>
          <el-button icon="Search" @click="searchRoute">导航</el-button>
        </template>
      </el-input>

      <el-radio-group v-model="activeMode" @change="onModeChange">
        <el-radio-button label="driving">🚗 自驾</el-radio-button>
        <el-radio-button label="transfer">🚌 公交/地铁</el-radio-button>
        <el-radio-button label="walking">🚶 步行</el-radio-button>
      </el-radio-group>
    </div>

    <div class="map-and-panel">
      <div id="route-map" class="map-area"></div>
      <div id="route-panel" class="panel-area"></div>
    </div>
  </div>
</template>

<style scoped>
.route-plan-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 600px;
}

.control-bar {
  display: flex;
  align-items: center;
}

.map-and-panel {
  display: flex;
  flex: 1;
  gap: 15px;
  overflow: hidden;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}

/* 左侧地图 */
.map-area {
  flex: 2;
  height: 100%;
}

/* 右侧高德自动生成的文字导航区 */
.panel-area {
  flex: 1;
  height: 100%;
  overflow-y: auto;
  background-color: #f8f9fa;
}
/* ... 你原本的样式保持不变 ... */

/* ========================================== */
/* 🔥 终极隐藏大法：彻底移除高德引流按钮 🔥 */
/* ========================================== */

/* 方法1：针对已知类名的精准打击 */
:deep(.amap-call), 
:deep(.amap-route-panel-title-call) {
  display: none !important;
}

/* 方法2：范围打击 - 隐藏所有模式面板头部 header 里的 a 标签链接 */
:deep(.amap-lib-driving-header a),
:deep(.amap-lib-walking-header a),
:deep(.amap-lib-transfer-header a) {
    display: none !important;
    visibility: hidden !important; /* 双重保险 */
    opacity: 0 !important; /* 三重保险 */
    pointer-events: none !important; /* 让它点不了 */
}

/* 方法3：核打击 - 只要链接地址里包含 'gaode.com' 的，统统干掉！ */
:deep(a[href*="gaode.com"]) {
  display: none !important;
}

/* 隐藏高德 Logo 和版权（保持之前的设置） */
:deep(.amap-logo),
:deep(.amap-copyright) {
  display: none !important;
}
</style>