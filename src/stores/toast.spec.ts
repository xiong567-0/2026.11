import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TOAST_DURATION, useToastStore } from './toast'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('toast', () => {
  it('展示消息并在 2.2 秒后自动隐藏', () => {
    const toast = useToastStore()

    toast.notify('已删除')
    expect(toast.visible).toBe(true)
    expect(toast.message).toBe('已删除')

    vi.advanceTimersByTime(TOAST_DURATION - 1)
    expect(toast.visible).toBe(true)

    vi.advanceTimersByTime(1)
    expect(toast.visible).toBe(false)
  })

  it('新消息重置计时并替换文案', () => {
    const toast = useToastStore()

    toast.notify('第一条')
    vi.advanceTimersByTime(2000)

    toast.notify('第二条')
    vi.advanceTimersByTime(1000)
    expect(toast.visible).toBe(true)
    expect(toast.message).toBe('第二条')

    vi.advanceTimersByTime(TOAST_DURATION - 1000)
    expect(toast.visible).toBe(false)
  })

  it('可以手动关闭', () => {
    const toast = useToastStore()

    toast.notify('昵称已更新')
    toast.dismiss()

    expect(toast.visible).toBe(false)
    vi.advanceTimersByTime(TOAST_DURATION * 2)
    expect(toast.visible).toBe(false)
  })

  it('空消息不展示', () => {
    const toast = useToastStore()

    toast.notify('   ')
    expect(toast.visible).toBe(false)
  })
})
