import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { MAX_NAME_LENGTH } from '../lib/profile'
import NicknameDialog from './NicknameDialog.vue'

function mountDialog(currentName = '张三') {
  return mount(NicknameDialog, {
    props: { currentName },
    attachTo: document.body,
  })
}

function getInput(wrapper: ReturnType<typeof mountDialog>) {
  return wrapper.get('[data-testid="nickname-input"]').element as HTMLInputElement
}

afterEach(() => {
  document.body.innerHTML = ''
  document.body.style.overflow = ''
})

describe('NicknameDialog', () => {
  it('打开时填入当前昵称并聚焦输入框', () => {
    const wrapper = mountDialog('张三')

    expect(getInput(wrapper).value).toBe('张三')
    expect(document.activeElement).toBe(getInput(wrapper))

    wrapper.unmount()
  })

  it('默认昵称时输入框为空，便于直接输入', () => {
    const wrapper = mountDialog('访客')

    expect(getInput(wrapper).value).toBe('')

    wrapper.unmount()
  })

  it('空昵称保存时给出错误且不提交', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="nickname-input"]').setValue('   ')
    await wrapper.get('[data-testid="nickname-save"]').trigger('click')

    expect(wrapper.get('[data-testid="nickname-error"]').text()).toBe('昵称不能为空')
    expect(wrapper.emitted('save')).toBeUndefined()

    wrapper.unmount()
  })

  it('昵称超长时给出错误', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="nickname-input"]').setValue('名'.repeat(MAX_NAME_LENGTH + 1))
    await wrapper.get('[data-testid="nickname-save"]').trigger('click')

    expect(wrapper.get('[data-testid="nickname-error"]').text()).toBe(
      `昵称最多 ${MAX_NAME_LENGTH} 个字符`,
    )
    expect(wrapper.emitted('save')).toBeUndefined()

    wrapper.unmount()
  })

  it('保存时抛出裁剪后的昵称', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="nickname-input"]').setValue('  李四  ')
    await wrapper.get('[data-testid="nickname-save"]').trigger('click')

    expect(wrapper.emitted('save')).toEqual([['李四']])

    wrapper.unmount()
  })

  it('输入后清除错误提示', async () => {
    const wrapper = mountDialog('访客')

    await wrapper.get('[data-testid="nickname-save"]').trigger('click')
    expect(wrapper.get('[data-testid="nickname-error"]').text()).toBe('昵称不能为空')

    await wrapper.get('[data-testid="nickname-input"]').setValue('李')
    expect(wrapper.get('[data-testid="nickname-error"]').text()).toBe('')

    wrapper.unmount()
  })

  it('回车保存，Esc 关闭', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="nickname-input"]').setValue('李四')
    await wrapper.get('[data-testid="nickname-input"]').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('save')).toEqual([['李四']])

    await wrapper
      .get('[data-testid="nickname-dialog"]')
      .trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(1)

    wrapper.unmount()
  })

  it('点击遮罩或取消都会关闭', async () => {
    const wrapper = mountDialog()

    await wrapper.get('[data-testid="nickname-backdrop"]').trigger('click')
    await wrapper.get('[data-testid="nickname-cancel"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(2)

    wrapper.unmount()
  })

  it('打开时锁定页面滚动，关闭后恢复', () => {
    const wrapper = mountDialog()
    expect(document.body.style.overflow).toBe('hidden')

    wrapper.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('具备无障碍对话框语义', () => {
    const wrapper = mountDialog()
    const dialog = wrapper.get('[role="dialog"]')

    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.attributes('aria-labelledby')).toBe('nickname-title')

    wrapper.unmount()
  })
})
