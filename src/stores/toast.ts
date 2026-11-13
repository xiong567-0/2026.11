import { defineStore } from 'pinia'
import { ref } from 'vue'

export const TOAST_DURATION = 2200

/** 全局轻提示：一次只展示一条，新消息会重置计时。 */
export const useToastStore = defineStore('toast', () => {
  const message = ref('')
  const visible = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }

  function dismiss(): void {
    clearTimer()
    visible.value = false
  }

  function notify(text: string): void {
    const value = text.trim()
    if (!value) return

    clearTimer()
    message.value = value
    visible.value = true
    timer = setTimeout(() => {
      visible.value = false
      timer = null
    }, TOAST_DURATION)
  }

  return { message, visible, notify, dismiss }
})
