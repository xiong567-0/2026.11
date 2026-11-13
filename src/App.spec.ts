import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import type { Post } from './lib/post'
import { installFakeApi } from './test-utils/fakeApi'

const MINUTE = 60 * 1000

let wrappers: VueWrapper[] = []

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: '访客',
    content: '历史内容',
    likes: 0,
    liked: false,
    favorites: 0,
    favorited: false,
    createdAt: Date.now() - 2 * MINUTE,
    ...overrides,
  }
}

/** 挂载并等待初始化请求（posts.load + user.load）落地 */
async function mountApp(): Promise<VueWrapper> {
  const wrapper = mount(App, { global: { plugins: [createPinia()] } })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

function rejectFetch(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('backend down'))),
  )
}

afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers = []
  document.body.style.overflow = ''
})

describe('App 初始加载', () => {
  it('空后端时展示默认昵称、0 条与空状态', async () => {
    installFakeApi({ name: '访客' })

    const wrapper = await mountApp()

    expect(wrapper.get('[data-testid="user-name"]').text()).toBe('访客')
    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('0 条')
    expect(wrapper.text()).toContain('还没有内容')
    expect(wrapper.find('[data-testid="feed-loading"]').exists()).toBe(false)
  })

  it('后端已有历史内容时加载并展示作者与相对时间', async () => {
    installFakeApi({
      name: '张三',
      posts: [
        makePost({
          id: 'a',
          author: '张三',
          content: '最早的内容',
          createdAt: Date.now() - 30 * MINUTE,
        }),
        makePost({
          id: 'b',
          author: '张三',
          content: '最近的内容',
          createdAt: Date.now() - 2 * MINUTE,
        }),
      ],
    })

    const wrapper = await mountApp()

    expect(wrapper.get('[data-testid="user-name"]').text()).toBe('张三')
    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('2 条')

    const cards = wrapper.findAll('[data-testid="post"]')
    expect(cards).toHaveLength(2)
    // 服务端按 createdAt 倒序返回，最新的排在最前
    expect(cards[0]!.get('[data-testid="post-content"]').text()).toBe('最近的内容')
    expect(cards[0]!.get('[data-testid="post-author"]').text()).toBe('张三')
    expect(cards[0]!.get('time').text()).toBe('2 分钟前')
    expect(cards[1]!.get('time').text()).toBe('30 分钟前')
  })

  it('加载失败时提示错误且页面仍可交互', async () => {
    rejectFetch()

    const wrapper = await mountApp()

    const toast = wrapper.get('[data-testid="toast"]')
    expect(toast.text()).toContain('网络请求失败')
    expect(toast.classes()).toContain('is-visible')
    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('0 条')
    expect(wrapper.get('[data-testid="user-name"]').text()).toBe('访客')
    // 页面不崩溃：发布框与发布按钮仍在
    expect(wrapper.find('textarea').exists()).toBe(true)
    expect(wrapper.find('[data-testid="publish-button"]').exists()).toBe(true)
  })
})

describe('发布内容', () => {
  it('发布后出现在信息流、清空输入并写入后端', async () => {
    const store = installFakeApi({ name: '访客' })
    const wrapper = await mountApp()

    await wrapper.get('textarea').setValue('  第一条想法  ')
    await wrapper.get('[data-testid="composer-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('1 条')
    expect(wrapper.get('[data-testid="post-content"]').text()).toBe('第一条想法')
    expect(wrapper.get('[data-testid="post-author"]').text()).toBe('访客')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe('')

    const stored = store.listPosts()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({
      author: '访客',
      content: '第一条想法',
      likes: 0,
      liked: false,
    })
  })

  it('发布失败时提示错误且列表不变', async () => {
    const store = installFakeApi({ name: '访客', posts: [makePost({ id: 'p1' })] })
    const wrapper = await mountApp()

    rejectFetch()

    await wrapper.get('textarea').setValue('会失败的内容')
    await wrapper.get('[data-testid="composer-form"]').trigger('submit')
    await flushPromises()

    expect(wrapper.get('[data-testid="toast"]').text()).toContain('网络请求失败')
    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('1 条')
    expect(wrapper.text()).not.toContain('会失败的内容')
    expect(store.listPosts().map((post) => post.content)).toEqual(['历史内容'])
  })
})

describe('点赞与删除', () => {
  it('点赞写入后端，再点一次取消', async () => {
    const store = installFakeApi({ name: '访客', posts: [makePost({ id: 'p1' })] })
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="post-like"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="like-count"]').text()).toBe('1')
    expect(wrapper.get('[data-testid="post-like"]').attributes('aria-pressed')).toBe('true')
    expect(store.listPosts()[0]).toMatchObject({ likes: 1, liked: true })

    await wrapper.get('[data-testid="post-like"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="like-count"]').text()).toBe('0')
    expect(wrapper.get('[data-testid="post-like"]').attributes('aria-pressed')).toBe('false')
    expect(store.listPosts()[0]).toMatchObject({ likes: 0, liked: false })
  })

  it('确认后删除内容并提示', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true))
    const store = installFakeApi({ name: '访客', posts: [makePost({ id: 'p1' })] })
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="post-delete"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('0 条')
    expect(wrapper.text()).toContain('还没有内容')
    expect(wrapper.get('[data-testid="toast"]').text()).toBe('已删除')
    expect(store.listPosts()).toEqual([])
  })

  it('取消删除时保留内容', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false))
    const store = installFakeApi({ name: '访客', posts: [makePost({ id: 'p1' })] })
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="post-delete"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="feed-count"]').text()).toBe('1 条')
    expect(wrapper.text()).toContain('历史内容')
    expect(store.listPosts()).toHaveLength(1)
  })
})

describe('收藏', () => {
  interface FavoriteBackend {
    posts: Post[]
    name: string
    failPatch: boolean
    patchBodies: unknown[]
  }

  function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }

  /**
   * 收藏相关用例使用独立的内存后端：服务端 PATCH 的收藏支持由另一条分支实现，
   * 这里按固定契约 `{ post: { favorites, favorited } }` 断言前端行为。
   */
  function stubFavoriteBackend(seed: Post[], name = '访客'): FavoriteBackend {
    const state: FavoriteBackend = {
      posts: seed.map((post) => ({ ...post })),
      name,
      failPatch: false,
      patchBodies: [],
    }

    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
      const method = init?.method ?? 'GET'

      if (method === 'GET' && url.endsWith('/api/posts')) return jsonResponse({ posts: state.posts })
      if (method === 'GET' && url.endsWith('/api/profile')) return jsonResponse({ name: state.name })

      if (method === 'PATCH') {
        const body = JSON.parse(String(init?.body)) as { favorited?: boolean }
        state.patchBodies.push(body)

        if (state.failPatch) {
          return jsonResponse({ error: { code: 'internal_error', message: '服务器开小差了' } }, 500)
        }

        const id = url.split('/').pop()
        const target = state.posts.find((post) => post.id === id)
        if (!target) {
          return jsonResponse({ error: { code: 'not_found', message: '内容不存在' } }, 404)
        }

        target.favorited = body.favorited ?? target.favorited
        target.favorites = target.favorited
          ? target.favorites + 1
          : Math.max(0, target.favorites - 1)
        return jsonResponse({ post: { ...target } })
      }

      return jsonResponse({ error: { code: 'not_found', message: '接口不存在' } }, 404)
    })

    vi.stubGlobal('fetch', fetchImpl)
    return state
  }

  it('点击收藏后计数加一并提示，再点一次取消', async () => {
    const backend = stubFavoriteBackend([makePost({ id: 'p1', favorites: 0, favorited: false })])
    const wrapper = await mountApp()

    expect(wrapper.get('[data-testid="favorite-count"]').text()).toBe('0')
    expect(wrapper.get('[data-testid="post-favorite"]').attributes('aria-pressed')).toBe('false')

    await wrapper.get('[data-testid="post-favorite"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="favorite-count"]').text()).toBe('1')
    expect(wrapper.get('[data-testid="post-favorite"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="toast"]').text()).toBe('已收藏')
    expect(backend.patchBodies).toEqual([{ favorited: true }])
    expect(backend.posts[0]).toMatchObject({ favorites: 1, favorited: true })

    await wrapper.get('[data-testid="post-favorite"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="favorite-count"]').text()).toBe('0')
    expect(wrapper.get('[data-testid="post-favorite"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('[data-testid="toast"]').text()).toBe('已取消收藏')
    expect(backend.patchBodies).toEqual([{ favorited: true }, { favorited: false }])
  })

  it('收藏失败时提示错误且界面状态回滚', async () => {
    const backend = stubFavoriteBackend([makePost({ id: 'p1', favorites: 0, favorited: false })])
    backend.failPatch = true

    const wrapper = await mountApp()

    await wrapper.get('[data-testid="post-favorite"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="favorite-count"]').text()).toBe('0')
    expect(wrapper.get('[data-testid="post-favorite"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('[data-testid="toast"]').text()).toContain('服务器开小差了')
    expect(backend.posts[0]).toMatchObject({ favorites: 0, favorited: false })
  })
})

describe('昵称修改', () => {
  it('改名后顶部与历史内容作者同步更新，并以后端为准', async () => {
    const store = installFakeApi({ name: '访客', posts: [makePost({ id: 'p1' })] })
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="user-chip"]').trigger('click')
    await wrapper.get('[data-testid="nickname-input"]').setValue('李四')
    await wrapper.get('[data-testid="nickname-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="user-name"]').text()).toBe('李四')
    expect(wrapper.get('[data-testid="post-author"]').text()).toBe('李四')
    expect(wrapper.find('[data-testid="nickname-dialog"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="toast"]').text()).toBe('昵称已更新')
    expect(store.getProfileName()).toBe('李四')
    expect(store.listPosts()[0]?.author).toBe('李四')
  })

  it('昵称未变化时提示且不改动历史内容', async () => {
    const store = installFakeApi({ name: '访客', posts: [makePost({ id: 'p1' })] })
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="user-chip"]').trigger('click')
    await wrapper.get('[data-testid="nickname-input"]').setValue('访客')
    await wrapper.get('[data-testid="nickname-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="toast"]').text()).toBe('昵称未变化')
    expect(wrapper.get('[data-testid="post-author"]').text()).toBe('访客')
    expect(store.listPosts()[0]?.author).toBe('访客')
  })

  it('取消关闭弹窗且不修改昵称', async () => {
    const store = installFakeApi({ name: '访客' })
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="user-chip"]').trigger('click')
    await wrapper.get('[data-testid="nickname-cancel"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="nickname-dialog"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="user-name"]').text()).toBe('访客')
    expect(store.getProfileName()).toBe('访客')
  })
})
