<template>
  <div class="map-wrap">
    <div id="container" class="map-container"></div>
    <div id="panel" style="display: none;"></div>
  </div>
</template>

<script setup>
import { onMounted, watch, onUnmounted } from 'vue';

// 接收父组件传来的“终点坐标”
const props = defineProps({
  endLng: Number,
  endLat: Number
});

let map = null;
let driving = null;

// 初始化地图
const initMap = () => {
  // 1. 创建地图实例
  map = new AMap.Map('container', {
    zoom: 12,
    center: [116.397428, 39.90923], // 默认北京中心
    resizeEnable: true
  });

  // 2. 创建驾车规划实例
  driving = new AMap.Driving({
    map: map,
    panel: "panel" // 结果列表容器
  });
};

// 规划路线函数
const planRoute = () => {
  if (!map || !props.endLng || !props.endLat) return;

  // 清除之前的路线
  driving.clear();

  // 🚗 起点：这里写死“北京西站”作为演示
  // 实际开发可以使用 AMap.Geolocation 获取用户当前位置
  const startPoint = [116.321337, 39.894982]; 
  const endPoint = [props.endLng, props.endLat];

  console.log(`🚗 开始规划路线: ${startPoint} -> ${endPoint}`);

  driving.search(startPoint, endPoint, function(status, result) {
    if (status === 'complete') {
      console.log('✅ 路线绘制成功');
    } else {
      console.error('❌ 路线绘制失败：' + result);
    }
  });
};

onMounted(() => {
  initMap();
  // 如果组件加载时就有坐标，直接规划
  if (props.endLng && props.endLat) {
    planRoute();
  }
});

onUnmounted(() => {
  if (map) map.destroy();
});

// 监听坐标变化：一旦父组件传了新坐标，立即重新规划路线
watch(() => [props.endLng, props.endLat], () => {
  planRoute();
});
</script>

<style scoped>
.map-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}
.map-container {
  width: 100%;
  height: 100%;
  border-radius: 8px;
  border: 1px solid #dcdfe6;
}
</style>