import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppHeader from './AppHeader.vue'

describe('AppHeader', () => {
  it('展示当前昵称与头像首字', () => {
    const wrapper = mount(AppHeader, { props: { userName: '张三' } })

    expect(wrapper.get('[data-testid="user-name"]').text()).toBe('张三')
    expect(wrapper.get('[data-testid="user-avatar"]').text()).toBe('张')
  })

  it('点击昵称按钮请求修改昵称', async () => {
    const wrapper = mount(AppHeader, { props: { userName: '访客' } })

    await wrapper.get('[data-testid="user-chip"]').trigger('click')

    expect(wrapper.emitted('edit')).toHaveLength(1)
  })
})
