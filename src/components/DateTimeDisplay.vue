<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const currentTime = ref('')
const currentDate = ref('')

function updateDateTime() {
  const now = new Date()

  // 时间：HH:MM（移除秒数）
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  currentTime.value = `${hours}:${minutes}`

  // 日期：MM月DD日星期X（移除年份）
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  const weekday = weekdays[now.getDay()]

  currentDate.value = `${month}月${day}日星期${weekday}`
}

let intervalId: number | null = null

onMounted(() => {
  updateDateTime()
  // 每分钟更新一次（不再显示秒数）
  intervalId = window.setInterval(updateDateTime, 60000)
})

onUnmounted(() => {
  if (intervalId) {
    clearInterval(intervalId)
  }
})
</script>

<template>
  <div class="datetime-display">
    <span class="date">{{ currentDate }}</span>
    <span class="time">{{ currentTime }}</span>
  </div>
</template>

<style scoped>
.datetime-display {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.875rem;
  color: var(--text-primary);
}

.date {
  font-weight: 500;
}

.time {
  opacity: 0.8;
}
</style>
