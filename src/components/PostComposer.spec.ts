import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { MAX_CONTENT_LENGTH } from '../lib/post'
import PostComposer from './PostComposer.vue'

function mountComposer(authorName = '张三') {
  return mount(PostComposer, { props: { authorName } })
}

function getTextarea(wrapper: ReturnType<typeof mountComposer>) {
  return wrapper.get('textarea').element as HTMLTextAreaElement
}

function getPublishButton(wrapper: ReturnType<typeof mountComposer>) {
  return wrapper.get('[data-testid="publish-button"]').element as HTMLButtonElement
}

describe('PostComposer', () => {
  it('展示作者首字头像', () => {
    const wrapper = mountComposer('张三')
    expect(wrapper.get('[data-testid="composer-avatar"]').text()).toBe('张')
  })

  it('初始计数为 0，发布按钮不可用', () => {
    const wrapper = mountComposer()

    expect(wrapper.get('[data-testid="composer-counter"]').text()).toBe(
      `0 / ${MAX_CONTENT_LENGTH}`,
    )
    expect(getPublishButton(wrapper).disabled).toBe(true)
  })

  it('输入内容后更新字数并启用发布按钮', async () => {
    const wrapper = mountComposer()

    await wrapper.get('textarea').setValue('此刻的想法')

    expect(wrapper.get('[data-testid="composer-counter"]').text()).toBe(
      `5 / ${MAX_CONTENT_LENGTH}`,
    )
    expect(getPublishButton(wrapper).disabled).toBe(false)
  })

  it('纯空白内容不可发布', async () => {
    const wrapper = mountComposer()

    await wrapper.get('textarea').setValue('    ')

    expect(getPublishButton(wrapper).disabled).toBe(true)
  })

  it('接近上限时给出提醒样式', async () => {
    const wrapper = mountComposer()

    await wrapper.get('textarea').setValue('字'.repeat(MAX_CONTENT_LENGTH - 20))

    expect(wrapper.get('[data-testid="composer-counter"]').classes()).toContain('is-warn')
  })

  it('超出上限时禁用发布并显示提示', async () => {
    const wrapper = mountComposer()

    await wrapper.get('textarea').setValue('字'.repeat(MAX_CONTENT_LENGTH + 1))

    const counter = wrapper.get('[data-testid="composer-counter"]')
    const hint = wrapper.get('[data-testid="composer-hint"]')

    expect(counter.text()).toBe(`${MAX_CONTENT_LENGTH + 1} / ${MAX_CONTENT_LENGTH}`)
    expect(counter.classes()).toContain('is-over')
    expect(hint.text()).toBe(`内容最多 ${MAX_CONTENT_LENGTH} 字，请精简后再发布`)
    expect(hint.classes()).toContain('is-visible')
    expect(getPublishButton(wrapper).disabled).toBe(true)
  })

  it('回到上限内后清除超限提示', async () => {
    const wrapper = mountComposer()

    await wrapper.get('textarea').setValue('字'.repeat(MAX_CONTENT_LENGTH + 1))
    await wrapper.get('textarea').setValue('字'.repeat(10))

    expect(wrapper.get('[data-testid="composer-hint"]').text()).toBe('')
  })

  it('提交时向上抛出裁剪后的内容并清空输入', async () => {
    const wrapper = mountComposer()

    await wrapper.get('textarea').setValue('  今天也要好好写代码  ')
    await wrapper.get('[data-testid="composer-form"]').trigger('submit')

    expect(wrapper.emitted('publish')).toEqual([['今天也要好好写代码']])
    expect(getTextarea(wrapper).value).toBe('')
    expect(wrapper.get('[data-testid="composer-counter"]').text()).toBe(
      `0 / ${MAX_CONTENT_LENGTH}`,
    )
  })

  it('Ctrl + Enter 快捷发布', async () => {
    const wrapper = mountComposer()

    await wrapper.get('textarea').setValue('快捷键发布')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted('publish')).toEqual([['快捷键发布']])
  })

  it('Cmd + Enter 快捷发布', async () => {
    const wrapper = mountComposer()

    await wrapper.get('textarea').setValue('快捷键发布')
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', metaKey: true })

    expect(wrapper.emitted('publish')).toEqual([['快捷键发布']])
  })

  it('空内容提交时提示而不是发布', async () => {
    const wrapper = mountComposer()

    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })

    expect(wrapper.emitted('publish')).toBeUndefined()
    expect(wrapper.get('[data-testid="composer-hint"]').text()).toBe('说点什么再发布吧')
  })
})
