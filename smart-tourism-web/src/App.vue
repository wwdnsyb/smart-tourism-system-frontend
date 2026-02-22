<script setup>
import { RouterView } from 'vue-router'
import SmartAssistant from './components/SmartAssistant.vue'
</script>

<template>
  <div class="app-root">
    <RouterView />
    <!-- 智能助手，不在后台页面显示 -->
    <SmartAssistant v-if="!$route.path.includes('/admin')" />
  </div>
</template>

<style scoped>
.app-root {
  min-height: 100vh;
}
</style>
