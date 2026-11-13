import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Post } from '../lib/post'
import PostCard from './PostCard.vue'
import PostFeed from './PostFeed.vue'

const NOW = new Date(2026, 10, 13, 9, 5, 0).getTime()

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: '张三',
    content: '内容',
    likes: 0,
    liked: false,
    createdAt: NOW,
    ...overrides,
  }
}

describe('PostFeed', () => {
  it('没有内容时展示空状态与 0 条', () => {
    const wrapper = mount(PostFeed, { props: { posts: [] } })

    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('0 条')
    expect(wrapper.text()).toContain('还没有内容')
    expect(wrapper.text()).toContain('在顶部写下第一条想法吧')
    expect(wrapper.findAllComponents(PostCard)).toHaveLength(0)
  })

  it('有内容时展示数量与卡片列表', () => {
    const posts = [
      makePost({ id: 'a', content: '第一条', createdAt: NOW }),
      makePost({ id: 'b', content: '第二条', createdAt: NOW - 1000 }),
    ]

    const wrapper = mount(PostFeed, { props: { posts } })

    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('2 条')
    expect(wrapper.text()).not.toContain('还没有内容')
    expect(wrapper.findAllComponents(PostCard)).toHaveLength(2)
    expect(wrapper.text()).toContain('第一条')
    expect(wrapper.text()).toContain('第二条')
  })

  it('首次加载且没有内容时展示加载态而不是空状态', () => {
    const wrapper = mount(PostFeed, { props: { posts: [], loading: true } })

    expect(wrapper.get('[data-testid="feed-loading"]').text()).toBe('正在加载内容…')
    expect(wrapper.find('[data-testid="feed-empty"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('还没有内容')
  })

  it('加载结束且仍没有内容时回到空状态', () => {
    const wrapper = mount(PostFeed, { props: { posts: [], loading: false } })

    expect(wrapper.find('[data-testid="feed-loading"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="feed-empty"]').text()).toContain('还没有内容')
  })

  it('转发卡片的点赞与删除事件', async () => {
    const wrapper = mount(PostFeed, { props: { posts: [makePost({ id: 'p1' })] } })
    const card = wrapper.getComponent(PostCard)

    await card.vm.$emit('like', 'p1')
    await card.vm.$emit('delete', 'p1')

    expect(wrapper.emitted('like')).toEqual([['p1']])
    expect(wrapper.emitted('delete')).toEqual([['p1']])
  })
})

describe('PostFeed 时间刷新', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('停留页面时相对时间会自动刷新', async () => {
    const createdAt = Date.now()
    const wrapper = mount(PostFeed, {
      props: { posts: [makePost({ createdAt })] },
    })

    expect(wrapper.get('time').text()).toBe('刚刚')

    vi.advanceTimersByTime(61 * 1000)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('time').text()).toBe('1 分钟前')

    wrapper.unmount()
  })
})
