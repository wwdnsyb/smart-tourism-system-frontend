<template>
  <div 
    class="assistant-anchor" 
    :style="{ 
      left: pos.x + 'px', 
      top: pos.y + 'px',
      transition: isDragging ? 'none' : 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)' 
    }"
  >
    <transition name="scale-pop">
      <div 
        v-show="isOpen" 
        class="chat-window"
        :class="[
          `align-${horizontalAlign}`, 
          `align-${verticalAlign}`
        ]"
      >
        <div class="window-header">
          <div class="header-left">
            <el-avatar :size="28" src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png" />
            <span class="title">智能导游</span>
          </div>
          <div class="header-actions">
             <el-icon class="action-icon" @click.stop="clearMessages" title="清空"><Delete /></el-icon>
             <el-icon class="action-icon" @click.stop="isOpen = false" title="收起"><ArrowDown /></el-icon>
          </div>
        </div>

        <div class="message-area" ref="msgRef">
          <div v-for="(msg, i) in messages" :key="i" class="msg-row" :class="{ 'is-me': msg.isMe }">
            <div v-if="msg.isMe" class="bubble">{{ msg.text }}</div>
            <div v-else class="bubble markdown-body" v-html="renderMD(msg.text)"></div>
          </div>
          <div v-if="isTyping" class="msg-row">
            <div class="bubble typing"><span>.</span><span>.</span><span>.</span></div>
          </div>
        </div>

        <div class="quick-actions">
          <div class="action-tag" @click="useQuickAction('plan')">🎒 一键行程规划</div>
          <div class="action-tag" @click="useQuickAction('food')">🍜 当地美食推荐</div>
          <div class="action-tag" @click="useQuickAction('hotel')">🏨 特色住宿指南</div>
        </div>

        <div class="input-box">
          <el-input 
            v-model="inputVal" 
            :placeholder="currentPlaceholder" 
            @keyup.enter="handleSend" 
            size="small"
          >
            <template #suffix>
              <el-button type="primary" link @click="handleSend" :disabled="!inputVal">发送</el-button>
            </template>
          </el-input>
        </div>
      </div>
    </transition>

    <div 
      class="float-btn"
      @mousedown.prevent="startDrag"
      @touchstart.prevent="startDrag"
      @click="handleClick"
      :class="{ 'active': isOpen }"
      title="按住拖动"
    >
      <el-icon size="26" color="#fff">
        <Close v-if="isOpen" />
        <ChatDotRound v-else />
      </el-icon>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { ChatDotRound, Close, Delete, ArrowDown } from '@element-plus/icons-vue'

// --- 状态管理 ---
const isOpen = ref(false)
const isTyping = ref(false)
const inputVal = ref('')
// 🔥 新增：动态虚体字与快捷动作记录
const currentPlaceholder = ref('问问票价、天气...') 
const pendingActionType = ref('') 

const msgRef = ref(null)
const messages = ref([
  { text: '👋 您好！我是您的AI导游。有什么可以帮您的吗？', isMe: false }
])

// --- Markdown 渲染函数 ---
const renderMD = (text) => {
  if (window.marked && typeof window.marked.parse === 'function') {
    return window.marked.parse(text || '')
  }
  return text
}

// --- 核心：调用 Java 后端接口 ---
const callAiBackend = async (userText) => {
  try {
    const response = await fetch('http://localhost:8080/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userText })
    })

    if (!response.ok) throw new Error('后端连接失败')

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    
    messages.value.push({ text: '', isMe: false })
    const aiMsgIndex = messages.value.length - 1
    let aiReplyBuffer = ''
    isTyping.value = false 

    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = decoder.decode(value, { stream: true })
      buffer += chunk
      const lines = buffer.split('\n')
      buffer = lines.pop() 

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine.startsWith('data:')) {
          const content = trimmedLine.substring(5) 
          const decodedContent = content.replaceAll('[BR]', '\n');
          aiReplyBuffer += decodedContent
          messages.value[aiMsgIndex].text = aiReplyBuffer
          scrollToBottom()
        }
      }
    }
  } catch (error) {
    console.error(error)
    isTyping.value = false
    messages.value.push({ text: '🔴 连接失败，请检查 Java 后端是否启动。', isMe: false })
    scrollToBottom()
  }
}

// --- 发送逻辑 ---
const handleSend = async () => {
  const text = inputVal.value.trim()
  if (!text) return

  let finalSendText = text

  // 🔥 核心逻辑：如果是快捷指令，将用户填的短地点拼接成专业长提示词
  if (pendingActionType.value === 'plan') {
    finalSendText = `你好！我打算去【${text}】旅游，请帮我生成一份详细的旅游攻略。要求包含：1.必去景点；2.特色酒店；3.地道美食；4.景点背后的历史文化介绍！`
  } else if (pendingActionType.value === 'food') {
    finalSendText = `请给我推荐几个【${text}】必吃的地道特色美食和老字号餐厅！`
  } else if (pendingActionType.value === 'hotel') {
    finalSendText = `我想在【${text}】订一家酒店，要求交通便利、性价比高，有什么推荐吗？`
  }

  // 发送后立刻重置回默认状态
  pendingActionType.value = ''
  currentPlaceholder.value = '问问票价、天气...'

  messages.value.push({ text: finalSendText, isMe: true })
  inputVal.value = ''
  scrollToBottom()
  isTyping.value = true
  
  await callAiBackend(finalSendText)
}

const clearMessages = () => messages.value = []
const scrollToBottom = () => {
  nextTick(() => { if (msgRef.value) msgRef.value.scrollTop = msgRef.value.scrollHeight })
}

// 🔥 优化：快捷指令点击事件，仅改变虚体字和记录动作状态
const useQuickAction = (type) => {
  pendingActionType.value = type
  inputVal.value = '' // 清空实体字
  
  if (type === 'plan') {
    currentPlaceholder.value = '👉 行程规划：请输入目的地 (如: 北京)'
  } else if (type === 'food') {
    currentPlaceholder.value = '👉 美食推荐：请输入目的地 (如: 成都)'
  } else if (type === 'hotel') {
    currentPlaceholder.value = '👉 住宿指南：请输入目的地 (如: 杭州)'
  }
}

// 全局监听逻辑（配合首页的大按钮）
const handleGlobalCall = (e) => {
  const text = e.detail || '帮我生成一份专属旅游攻略！'
  isOpen.value = true // 打开面板
  setTimeout(() => {
    inputVal.value = text
    handleSend() // 自动发送
  }, 300)
}

// --- 定位与拖拽逻辑 ---
const pos = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const btnSize = 56 
let startX = 0, startY = 0, initialX = 0, initialY = 0
let hasMoved = false

const horizontalAlign = computed(() => pos.value.x > window.innerWidth / 2 ? 'right' : 'left')
const verticalAlign = computed(() => pos.value.y > window.innerHeight / 2 ? 'up' : 'down')

const handleResize = () => {
  const { innerWidth, innerHeight } = window
  const maxLeft = innerWidth - btnSize
  const maxTop = innerHeight - btnSize
  
  let newX = Math.min(pos.value.x, maxLeft)
  newX = Math.max(0, newX)
  let newY = Math.min(pos.value.y, maxTop)
  newY = Math.max(0, newY)

  if (newX > innerWidth / 2) newX = maxLeft - 20
  else newX = 20
  
  if (newY > innerHeight - 100) newY = innerHeight - 120

  pos.value.x = newX
  pos.value.y = newY
}

onMounted(() => {
  pos.value.x = window.innerWidth - 80 
  pos.value.y = window.innerHeight - 150
  window.addEventListener('resize', handleResize)
  window.addEventListener('call-ai-assistant', handleGlobalCall)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('call-ai-assistant', handleGlobalCall)
})

const startDrag = (e) => {
  isDragging.value = true
  hasMoved = false
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  startX = clientX
  startY = clientY
  initialX = pos.value.x
  initialY = pos.value.y
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onEnd)
  document.addEventListener('touchmove', onMove, { passive: false })
  document.addEventListener('touchend', onEnd)
}

const onMove = (e) => {
  const clientX = e.touches ? e.touches[0].clientX : e.clientX
  const clientY = e.touches ? e.touches[0].clientY : e.clientY
  const dx = clientX - startX
  const dy = clientY - startY
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true
  
  let newX = initialX + dx
  let newY = initialY + dy
  const maxX = window.innerWidth - btnSize
  const maxY = window.innerHeight - btnSize
  
  pos.value.x = Math.max(0, Math.min(newX, maxX))
  pos.value.y = Math.max(0, Math.min(newY, maxY))
}

const onEnd = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onMove)
  document.removeEventListener('mouseup', onEnd)
  document.removeEventListener('touchmove', onMove)
  document.removeEventListener('touchend', onEnd)
  
  if (hasMoved) {
    const centerX = window.innerWidth / 2
    if (pos.value.x > centerX) pos.value.x = window.innerWidth - btnSize - 20
    else pos.value.x = 20
  }
}

const handleClick = () => {
  if (!hasMoved) isOpen.value = !isOpen.value
}
</script>

<style scoped>
.assistant-anchor {
  position: fixed;
  z-index: 99999;
  width: 56px;
  height: 56px;
  pointer-events: none; 
}
.assistant-anchor > * {
  pointer-events: auto;
}

.float-btn {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #409EFF, #36d1dc);
  box-shadow: 0 4px 15px rgba(64, 158, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  user-select: none;
  transition: transform 0.2s;
  touch-action: none; 
}
.float-btn:active { cursor: grabbing; transform: scale(0.95); }
.float-btn.active { background: #909399; transform: rotate(90deg); }

.chat-window {
  position: absolute;
  width: 320px;
  height: 450px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid #ebeef5;
}

.align-right { right: 0; }
.align-left { left: 0; }
.align-up { bottom: 100%; margin-bottom: 15px; transform-origin: bottom right; }
.align-left.align-up { transform-origin: bottom left; }
.align-down { top: 100%; margin-top: 15px; transform-origin: top right; }
.align-left.align-down { transform-origin: top left; }

.window-header {
  height: 46px;
  background: linear-gradient(to right, #409EFF, #53a8ff);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  color: #fff;
}
.header-left { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 14px; }
.header-actions { display: flex; gap: 10px; }
.action-icon { cursor: pointer; opacity: 0.8; }
.action-icon:hover { opacity: 1; }

.message-area {
  flex: 1;
  padding: 12px;
  background: #f5f7fa;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.msg-row { display: flex; }
.msg-row.is-me { justify-content: flex-end; }

.bubble {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  word-break: break-all;
  text-align: left;
}
.is-me .bubble { background: #409EFF; color: #fff; border-bottom-right-radius: 2px; }

.markdown-body { white-space: pre-wrap; font-family: inherit; }
.markdown-body :deep(p) { margin: 0 0 8px 0; }
.markdown-body :deep(p):last-child { margin-bottom: 0; }
.markdown-body :deep(strong) { color: #d63384; font-weight: bold; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { margin: 4px 0 4px 20px; padding: 0; }
.markdown-body :deep(li) { margin-bottom: 4px; }

/* 🔥 新增：快捷指令区样式 */
.quick-actions {
  display: flex;
  flex-wrap: wrap; /* 核心代码：允许换行 */
  gap: 8px;
  padding: 10px 12px;
  background: #fff;
  border-top: 1px solid #f5f7fa;
}
.quick-actions::-webkit-scrollbar {
  display: none;
}
.action-tag {
  font-size: 12px;
  color: #409eff;
  background: #ecf5ff;
  border: 1px solid #d9ecff;
  padding: 6px 12px;
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: bold;
}
.action-tag:hover {
  background: #409eff;
  color: #fff;
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}

.input-box { padding: 10px; border-top: 1px solid #eee; background: #fff; }
.typing span { animation: blink 1.4s infinite both; margin: 0 2px; }
@keyframes blink { 0% { opacity: 0.2; } 20% { opacity: 1; } 100% { opacity: 0.2; } }

.scale-pop-enter-active, .scale-pop-leave-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.scale-pop-enter-from, .scale-pop-leave-to { opacity: 0; transform: scale(0.5); }
</style>