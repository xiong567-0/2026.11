import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Post } from '../lib/post'
import PostCard from './PostCard.vue'

const CREATED_AT = new Date(2026, 10, 13, 9, 0, 0).getTime()
const FIVE_MINUTES_LATER = CREATED_AT + 5 * 60 * 1000

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: '张三',
    content: '第一行\n第二行',
    likes: 2,
    liked: false,
    createdAt: CREATED_AT,
    ...overrides,
  }
}

function mountCard(post = makePost(), now = FIVE_MINUTES_LATER) {
  return mount(PostCard, { props: { post, now } })
}

describe('PostCard', () => {
  it('展示作者、头像首字与正文（保留换行）', () => {
    const wrapper = mountCard()

    expect(wrapper.get('[data-testid="post-author"]').text()).toBe('张三')
    expect(wrapper.get('[data-testid="post-avatar"]').text()).toBe('张')

    const content = wrapper.get('[data-testid="post-content"]')
    expect(content.text()).toBe('第一行\n第二行')
    expect(content.classes()).toContain('post-content')
  })

  it('按传入的当前时间显示相对时间', () => {
    const wrapper = mountCard()

    const time = wrapper.get('time')
    expect(time.text()).toBe('5 分钟前')
    expect(time.attributes('datetime')).toBe(new Date(CREATED_AT).toISOString())
    expect(time.attributes('title')).toBe('2026-11-13 09:00')
  })

  it('展示点赞数与未点赞状态', () => {
    const wrapper = mountCard()
    const button = wrapper.get('[data-testid="post-like"]')

    expect(wrapper.get('[data-testid="like-count"]').text()).toBe('2')
    expect(button.attributes('aria-pressed')).toBe('false')
    expect(button.attributes('aria-label')).toBe('点赞')
    expect(button.classes()).not.toContain('is-liked')
  })

  it('已点赞时展示选中态与取消点赞语义', () => {
    const wrapper = mountCard(makePost({ liked: true, likes: 3 }))
    const button = wrapper.get('[data-testid="post-like"]')

    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('aria-label')).toBe('取消点赞')
    expect(button.classes()).toContain('is-liked')
  })

  it('点击点赞时抛出内容 id', async () => {
    const wrapper = mountCard()

    await wrapper.get('[data-testid="post-like"]').trigger('click')

    expect(wrapper.emitted('like')).toEqual([['p1']])
  })

  it('点击删除时抛出内容 id', async () => {
    const wrapper = mountCard()

    await wrapper.get('[data-testid="post-delete"]').trigger('click')

    expect(wrapper.emitted('delete')).toEqual([['p1']])
  })
})
