import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { serializePosts, type Post } from './lib/post'
import { STORAGE_KEYS } from './lib/storage'

const NOW = new Date(2026, 10, 13, 9, 5, 0).getTime()

let wrappers: VueWrapper[] = []

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: '访客',
    content: '历史内容',
    likes: 0,
    liked: false,
    createdAt: NOW,
    ...overrides,
  }
}

function mountApp() {
  const wrapper = mount(App, { global: { plugins: [createPinia()] } })
  wrappers.push(wrapper)
  return wrapper
}

function seedPosts(posts: Post[]): void {
  localStorage.setItem(STORAGE_KEYS.posts, serializePosts(posts))
}

function readStoredPosts(): Post[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.posts) ?? '[]') as Post[]
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers = []
  document.body.style.overflow = ''
})

describe('App 初始渲染', () => {
  it('没有本地数据时展示空状态与默认昵称', () => {
    const wrapper = mountApp()

    expect(wrapper.get('[data-testid="user-name"]').text()).toBe('访客')
    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('0 条')
    expect(wrapper.text()).toContain('还没有内容')
  })

  it('从本地存储恢复历史内容', () => {
    seedPosts([makePost({ id: 'a', content: '恢复的内容' })])

    const wrapper = mountApp()

    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('1 条')
    expect(wrapper.text()).toContain('恢复的内容')
  })

  it('本地数据损坏时提示并使用空列表', () => {
    localStorage.setItem(STORAGE_KEYS.posts, '{broken')

    const wrapper = mountApp()

    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('0 条')
    expect(wrapper.get('[data-testid="toast"]').text()).toBe('本地数据读取失败，已临时使用空列表')
    expect(wrapper.get('[data-testid="toast"]').classes()).toContain('is-visible')
  })
})

describe('发布内容', () => {
  it('发布后立即出现在信息流并写入本地存储', async () => {
    const wrapper = mountApp()

    await wrapper.get('textarea').setValue('  第一条想法  ')
    await wrapper.get('[data-testid="composer-form"]').trigger('submit')

    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('1 条')
    expect(wrapper.get('[data-testid="post-content"]').text()).toBe('第一条想法')
    expect(wrapper.get('[data-testid="post-author"]').text()).toBe('访客')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')
    expect(readStoredPosts()[0]).toMatchObject({
      author: '访客',
      content: '第一条想法',
      likes: 0,
      liked: false,
    })
  })

  it('发布按钮在空内容时不可用', () => {
    const wrapper = mountApp()

    expect(
      (wrapper.get('[data-testid="publish-button"]').element as HTMLButtonElement).disabled,
    ).toBe(true)
  })
})

describe('点赞与删除', () => {
  it('点赞后计数与状态写入本地存储', async () => {
    seedPosts([makePost({ id: 'p1' })])
    const wrapper = mountApp()

    await wrapper.get('[data-testid="post-like"]').trigger('click')

    expect(wrapper.get('[data-testid="like-count"]').text()).toBe('1')
    expect(wrapper.get('[data-testid="post-like"]').attributes('aria-pressed')).toBe('true')
    expect(readStoredPosts()[0]).toMatchObject({ likes: 1, liked: true })
  })

  it('确认后删除内容并提示', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    seedPosts([makePost({ id: 'p1' })])
    const wrapper = mountApp()

    await wrapper.get('[data-testid="post-delete"]').trigger('click')

    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('0 条')
    expect(wrapper.text()).toContain('还没有内容')
    expect(wrapper.get('[data-testid="toast"]').text()).toBe('已删除')
    expect(readStoredPosts()).toEqual([])
  })

  it('取消删除时保留内容', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    seedPosts([makePost({ id: 'p1' })])
    const wrapper = mountApp()

    await wrapper.get('[data-testid="post-delete"]').trigger('click')

    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('1 条')
    expect(readStoredPosts()).toHaveLength(1)
  })
})

describe('昵称修改', () => {
  it('修改昵称后顶部与历史内容作者同步更新', async () => {
    seedPosts([makePost({ id: 'p1' })])
    const wrapper = mountApp()

    await wrapper.get('[data-testid="user-chip"]').trigger('click')
    await wrapper.get('[data-testid="nickname-input"]').setValue('李四')
    await wrapper.get('[data-testid="nickname-save"]').trigger('click')

    expect(wrapper.get('[data-testid="user-name"]').text()).toBe('李四')
    expect(wrapper.get('[data-testid="post-author"]').text()).toBe('李四')
    expect(wrapper.find('[data-testid="nickname-dialog"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="toast"]').text()).toBe('昵称已更新')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.user) ?? '{}')).toEqual({
      name: '李四',
    })
    expect(readStoredPosts()[0]?.author).toBe('李四')
  })

  it('昵称未变化时提示且不改动历史内容', async () => {
    seedPosts([makePost({ id: 'p1', author: '访客' })])
    const wrapper = mountApp()

    await wrapper.get('[data-testid="user-chip"]').trigger('click')
    await wrapper.get('[data-testid="nickname-input"]').setValue('访客')
    await wrapper.get('[data-testid="nickname-save"]').trigger('click')

    expect(wrapper.get('[data-testid="toast"]').text()).toBe('昵称未变化')
    expect(readStoredPosts()[0]?.author).toBe('访客')
  })

  it('取消关闭弹窗且不修改昵称', async () => {
    const wrapper = mountApp()

    await wrapper.get('[data-testid="user-chip"]').trigger('click')
    await wrapper.get('[data-testid="nickname-cancel"]').trigger('click')

    expect(wrapper.find('[data-testid="nickname-dialog"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="user-name"]').text()).toBe('访客')
  })
})

describe('多标签页同步', () => {
  it('收到其他标签页的存储变化后刷新列表', async () => {
    seedPosts([makePost({ id: 'p1' })])
    const wrapper = mountApp()

    seedPosts([makePost({ id: 'p1' }), makePost({ id: 'p2', content: '另一标签页的新内容' })])
    const event = new Event('storage') as StorageEvent
    Object.defineProperty(event, 'key', { value: STORAGE_KEYS.posts })
    window.dispatchEvent(event)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('2 条')
    expect(wrapper.text()).toContain('另一标签页的新内容')
  })
})
