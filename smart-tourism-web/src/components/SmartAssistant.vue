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

        <div class="input-box">
          <el-input 
            v-model="inputVal" 
            placeholder="问问票价、天气..." 
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
const msgRef = ref(null)
const messages = ref([
  { text: '👋 您好！我是您的AI导游。有什么可以帮您的吗？', isMe: false }
])

// --- Markdown 渲染函数 ---
const renderMD = (text) => {
  // 这里的 window.marked 来自 index.html 引入的 CDN
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

    // 🔥🔥🔥 修复核心：定义缓冲区，解决丢字问题 🔥🔥🔥
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      
      // 1. 解码当前收到的数据片段
      const chunk = decoder.decode(value, { stream: true })
      
      // 2. 拼接到缓冲区
      buffer += chunk
      
      // 3. 按换行符拆分消息 (SSE 协议以 \n 分隔)
      const lines = buffer.split('\n')
      
      // 4. 🔥 关键步骤：取出最后一个可能不完整的片段，放回 buffer 等待下一次拼接
      // 如果没有这一步，断在中间的汉字就会丢失！
      buffer = lines.pop() 

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine.startsWith('data:')) {
          const content = trimmedLine.substring(5) 
          
          // 🔥 核心修改：把后端的 [BR] 替换回 \n 换行符
          // 这样 marked 库才能正确识别列表和段落
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
  messages.value.push({ text: text, isMe: true })
  inputVal.value = ''
  scrollToBottom()
  isTyping.value = true
  await callAiBackend(text)
}

const clearMessages = () => messages.value = []
const scrollToBottom = () => {
  nextTick(() => { if (msgRef.value) msgRef.value.scrollTop = msgRef.value.scrollHeight })
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
})
onUnmounted(() => window.removeEventListener('resize', handleResize))

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
/* 1. 锚点容器 */
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

/* 2. 悬浮球 */
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

/* 3. 聊天窗口 */
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

/* 自动对齐模式 */
.align-right { right: 0; }
.align-left { left: 0; }

.align-up {
  bottom: 100%;
  margin-bottom: 15px;
  transform-origin: bottom right;
}
.align-left.align-up { transform-origin: bottom left; }

.align-down {
  top: 100%;
  margin-top: 15px;
  transform-origin: top right;
}
.align-left.align-down { transform-origin: top left; }

/* 内部样式 */
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

/* 👇👇👇 优化：增加了左对齐、行高，保证 Markdown 易读 */
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

/* 👇👇👇 新增：Markdown 样式微调 */
.markdown-body {
  white-space: pre-wrap; /* 保证换行不丢失 */
  font-family: inherit; /* 继承字体 */
}
.markdown-body :deep(p) { margin: 0 0 8px 0; }

/* 🔥🔥🔥 核心修复：最后一个段落去掉下边距，防止气泡底部留白 🔥🔥🔥 */
.markdown-body :deep(p):last-child {
  margin-bottom: 0;
}

.markdown-body :deep(strong) { color: #d63384; font-weight: bold; }
/* 让列表有缩进，不再挤在左边 */
.markdown-body :deep(ul), .markdown-body :deep(ol) { margin: 4px 0 4px 20px; padding: 0; }
.markdown-body :deep(li) { margin-bottom: 4px; }

.input-box { padding: 10px; border-top: 1px solid #eee; background: #fff; }
.typing span { animation: blink 1.4s infinite both; margin: 0 2px; }
@keyframes blink { 0% { opacity: 0.2; } 20% { opacity: 1; } 100% { opacity: 0.2; } }

/* 动画效果 */
.scale-pop-enter-active, .scale-pop-leave-active { transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.scale-pop-enter-from, .scale-pop-leave-to { opacity: 0; transform: scale(0.5); }
</style>  =                                                                                                                                                                                                                                                                                                                                                                                   