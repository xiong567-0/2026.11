import { onMounted, onUnmounted, readonly, shallowRef } from 'vue'

export const NOW_TICK_INTERVAL = 30_000

/**
 * 提供一个按固定间隔刷新的「当前时间」，让相对时间不必刷新页面也会更新。
 * 定时器随组件挂载/卸载创建与清理。
 */
export function useNow(interval: number = NOW_TICK_INTERVAL) {
  const now = shallowRef(Date.now())
  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    timer = setInterval(() => {
      now.value = Date.now()
    }, interval)
  })

  onUnmounted(() => {
    if (timer !== null) {
      clearInterval(timer)
      timer = null
    }
  })

  return { now: readonly(now) }
}
