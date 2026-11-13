import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useToastStore } from '../stores/toast'
import AppToast from './AppToast.vue'

let pinia: ReturnType<typeof createPinia>

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

function mountToast() {
  return mount(AppToast, { global: { plugins: [pinia] } })
}

describe('AppToast', () => {
  it('初始不展示', () => {
    const wrapper = mountToast()

    expect(wrapper.get('[data-testid="toast"]').classes()).not.toContain('is-visible')
    expect(wrapper.text()).toBe('')
  })

  it('收到消息时展示文案与可见样式', async () => {
    const wrapper = mountToast()
    useToastStore().notify('已删除')

    await wrapper.vm.$nextTick()

    const toast = wrapper.get('[data-testid="toast"]')
    expect(toast.text()).toBe('已删除')
    expect(toast.classes()).toContain('is-visible')
    expect(toast.attributes('role')).toBe('status')
  })

  it('提示隐藏后保留无障碍状态', async () => {
    const wrapper = mountToast()
    const toast = useToastStore()

    toast.notify('昵称已更新')
    await wrapper.vm.$nextTick()
    toast.dismiss()
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="toast"]').classes()).not.toContain('is-visible')
  })
})
