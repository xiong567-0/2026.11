import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Post } from '../lib/post'
import { usePostsStore } from './posts'

const NOW = new Date(2026, 10, 13, 9, 5, 0).getTime()

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: '访客',
    content: '此刻的想法',
    likes: 0,
    liked: false,
    favorites: 0,
    favorited: false,
    createdAt: NOW,
    ...overrides,
  }
}

interface RecordedCall {
  url: string
  init: RequestInit
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** 用假 fetch 替换全局实现，并记录请求。 */
function stubFetch(
  respond: (call: RecordedCall) => Response | Promise<Response>,
): RecordedCall[] {
  const calls: RecordedCall[] = []

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} }
    calls.push(call)
    return respond(call)
  }) as unknown as typeof fetch

  vi.stubGlobal('fetch', fetchImpl)
  return calls
}

function bodyOf(call: RecordedCall): unknown {
  return JSON.parse(String(call.init.body))
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('load', () => {
  it('拉取列表并按 createdAt 倒序放入 state', async () => {
    const calls = stubFetch(() =>
      json({
        posts: [makePost({ id: 'older', createdAt: NOW - 5000 }), makePost({ id: 'newer', createdAt: NOW })],
      }),
    )

    const store = usePostsStore()

    await expect(store.load()).resolves.toBe(true)

    expect(calls[0]!.url).toBe('/api/posts')
    expect(calls[0]!.init.method).toBe('GET')
    expect(store.posts.map((post) => post.id)).toEqual(['newer', 'older'])
    expect(store.count).toBe(2)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('请求进行中 loading 为 true', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    stubFetch(async () => {
      await gate
      return json({ posts: [] })
    })

    const store = usePostsStore()
    const pending = store.load()

    expect(store.loading).toBe(true)

    release?.()
    await pending

    expect(store.loading).toBe(false)
  })

  it('服务端错误时返回 false 并保留可读提示', async () => {
    stubFetch(() => json({ error: { code: 'internal_error', message: '服务器开小差了' } }, 500))

    const store = usePostsStore()

    await expect(store.load()).resolves.toBe(false)

    expect(store.posts).toEqual([])
    expect(store.error).toBe('服务器开小差了')
    expect(store.loading).toBe(false)
  })

  it('网络异常时给出网络提示', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch')
    })

    const store = usePostsStore()
    await store.load()

    expect(store.error).toBe('网络请求失败，请检查后端服务是否已启动')
  })

  it('重新加载成功后清空上一次的错误', async () => {
    let shouldFail = true
    stubFetch(() =>
      shouldFail
        ? json({ error: { code: 'internal_error', message: '服务器开小差了' } }, 500)
        : json({ posts: [makePost()] }),
    )

    const store = usePostsStore()
    await store.load()
    expect(store.error).not.toBeNull()

    shouldFail = false
    await expect(store.load()).resolves.toBe(true)

    expect(store.error).toBeNull()
    expect(store.count).toBe(1)
  })
})

describe('add', () => {
  it('提交内容并把服务端返回的 post 放在最前', async () => {
    const calls = stubFetch((call) => {
      if (call.init.method === 'GET') {
        return json({ posts: [makePost({ id: 'old', createdAt: NOW - 1000 })] })
      }
      return json({ post: makePost({ id: 'new', content: '第一条新内容', author: '张三' }) }, 201)
    })

    const store = usePostsStore()
    await store.load()

    const created = await store.add('第一条新内容', '张三')

    expect(created).toEqual(makePost({ id: 'new', content: '第一条新内容', author: '张三' }))
    expect(store.posts.map((post) => post.id)).toEqual(['new', 'old'])
    expect(store.count).toBe(2)
    expect(store.error).toBeNull()

    const postCall = calls[1]!
    expect(postCall.url).toBe('/api/posts')
    expect(postCall.init.method).toBe('POST')
    expect(bodyOf(postCall)).toEqual({ content: '第一条新内容', author: '张三' })
  })

  it('服务端返回更早的内容时也保持倒序', async () => {
    stubFetch((call) =>
      call.init.method === 'GET'
        ? json({ posts: [makePost({ id: 'newer', createdAt: NOW })] })
        : json({ post: makePost({ id: 'older', createdAt: NOW - 1000 }) }, 201),
    )

    const store = usePostsStore()
    await store.load()
    await store.add('较早的内容', '张三')

    expect(store.posts.map((post) => post.id)).toEqual(['newer', 'older'])
  })

  it('400 invalid_content 时返回 null、设置提示且不改变列表', async () => {
    stubFetch((call) =>
      call.init.method === 'GET'
        ? json({ posts: [makePost()] })
        : json({ error: { code: 'invalid_content', message: '内容不能为空' } }, 400),
    )

    const store = usePostsStore()
    await store.load()

    await expect(store.add('   ', '张三')).resolves.toBeNull()

    expect(store.error).toBe('内容不能为空')
    expect(store.posts.map((post) => post.id)).toEqual(['p1'])
    expect(store.count).toBe(1)
  })
})

describe('toggleLike', () => {
  it('以取反后的状态发起 PATCH，并用服务端结果替换本地项', async () => {
    const calls = stubFetch((call) =>
      call.init.method === 'GET'
        ? json({ posts: [makePost({ id: 'p1', likes: 2, liked: false })] })
        : json({ post: makePost({ id: 'p1', likes: 3, liked: true }) }),
    )

    const store = usePostsStore()
    await store.load()

    await expect(store.toggleLike('p1')).resolves.toBe(true)

    expect(store.posts[0]).toMatchObject({ likes: 3, liked: true })
    expect(store.error).toBeNull()

    const patchCall = calls[1]!
    expect(patchCall.url).toBe('/api/posts/p1')
    expect(patchCall.init.method).toBe('PATCH')
    expect(bodyOf(patchCall)).toEqual({ liked: true })
  })

  it('已点赞时再次点击取消点赞', async () => {
    const calls = stubFetch((call) =>
      call.init.method === 'GET'
        ? json({ posts: [makePost({ id: 'p1', likes: 3, liked: true })] })
        : json({ post: makePost({ id: 'p1', likes: 2, liked: false }) }),
    )

    const store = usePostsStore()
    await store.load()

    await expect(store.toggleLike('p1')).resolves.toBe(true)

    expect(store.posts[0]).toMatchObject({ likes: 2, liked: false })
    expect(bodyOf(calls[1]!)).toEqual({ liked: false })
  })

  it('未知 id 不发请求直接返回 false', async () => {
    const calls = stubFetch(() => json({ posts: [makePost({ id: 'p1' })] }))

    const store = usePostsStore()
    await store.load()

    await expect(store.toggleLike('missing')).resolves.toBe(false)
    expect(calls).toHaveLength(1)
  })

  it('请求失败时返回 false、保留原值并设置提示', async () => {
    stubFetch((call) =>
      call.init.method === 'GET'
        ? json({ posts: [makePost({ id: 'p1', likes: 2, liked: false })] })
        : json({ error: { code: 'not_found', message: '内容不存在' } }, 404),
    )

    const store = usePostsStore()
    await store.load()

    await expect(store.toggleLike('p1')).resolves.toBe(false)

    expect(store.posts[0]).toMatchObject({ likes: 2, liked: false })
    expect(store.error).toBe('内容不存在')
  })
})

describe('toggleFavorite', () => {
  it('以取反后的状态发起 PATCH，并用服务端结果替换本地项', async () => {
    const calls = stubFetch((call) =>
      call.init.method === 'GET'
        ? json({ posts: [makePost({ id: 'p1', favorites: 1, favorited: false })] })
        : json({ post: makePost({ id: 'p1', favorites: 2, favorited: true }) }),
    )

    const store = usePostsStore()
    await store.load()

    await expect(store.toggleFavorite('p1')).resolves.toBe(true)

    expect(store.posts[0]).toMatchObject({ favorites: 2, favorited: true })
    expect(store.error).toBeNull()

    const patchCall = calls[1]!
    expect(patchCall.url).toBe('/api/posts/p1')
    expect(patchCall.init.method).toBe('PATCH')
    expect(bodyOf(patchCall)).toEqual({ favorited: true })
  })

  it('已收藏时再次点击取消收藏', async () => {
    const calls = stubFetch((call) =>
      call.init.method === 'GET'
        ? json({ posts: [makePost({ id: 'p1', favorites: 3, favorited: true })] })
        : json({ post: makePost({ id: 'p1', favorites: 2, favorited: false }) }),
    )

    const store = usePostsStore()
    await store.load()

    await expect(store.toggleFavorite('p1')).resolves.toBe(true)

    expect(store.posts[0]).toMatchObject({ favorites: 2, favorited: false })
    expect(bodyOf(calls[1]!)).toEqual({ favorited: false })
  })

  it('请求失败时返回 false、保留原值并设置提示', async () => {
    stubFetch((call) =>
      call.init.method === 'GET'
        ? json({ posts: [makePost({ id: 'p1', favorites: 1, favorited: false })] })
        : json({ error: { code: 'internal_error', message: '服务器开小差了' } }, 500),
    )

    const store = usePostsStore()
    await store.load()

    await expect(store.toggleFavorite('p1')).resolves.toBe(false)

    expect(store.posts[0]).toMatchObject({ favorites: 1, favorited: false })
    expect(store.error).toBe('服务器开小差了')
    expect(store.loading).toBe(false)
  })

  it('未知 id 不发请求直接返回 false', async () => {
    const calls = stubFetch(() => json({ posts: [makePost({ id: 'p1' })] }))

    const store = usePostsStore()
    await store.load()

    await expect(store.toggleFavorite('missing')).resolves.toBe(false)
    expect(calls).toHaveLength(1)
  })
})

describe('remove', () => {
  it('删除成功后从列表移除', async () => {
    const calls = stubFetch((call) =>
      call.init.method === 'GET'
        ? json({ posts: [makePost({ id: 'a', createdAt: NOW }), makePost({ id: 'b', createdAt: NOW - 1 })] })
        : new Response(null, { status: 204 }),
    )

    const store = usePostsStore()
    await store.load()

    await expect(store.remove('a')).resolves.toBe(true)

    expect(store.posts.map((post) => post.id)).toEqual(['b'])
    expect(calls[1]!.url).toBe('/api/posts/a')
    expect(calls[1]!.init.method).toBe('DELETE')
  })

  it('404 视为已删除，返回 true 并移除本地项', async () => {
    stubFetch((call) =>
      call.init.method === 'GET'
        ? json({ posts: [makePost({ id: 'a' })] })
        : json({ error: { code: 'not_found', message: '内容不存在' } }, 404),
    )

    const store = usePostsStore()
    await store.load()

    await expect(store.remove('a')).resolves.toBe(true)

    expect(store.posts).toEqual([])
    expect(store.error).toBeNull()
  })

  it('其他错误返回 false 并保留该内容', async () => {
    stubFetch((call) =>
      call.init.method === 'GET'
        ? json({ posts: [makePost({ id: 'a' })] })
        : json({ error: { code: 'internal_error', message: '服务器开小差了' } }, 500),
    )

    const store = usePostsStore()
    await store.load()

    await expect(store.remove('a')).resolves.toBe(false)

    expect(store.posts.map((post) => post.id)).toEqual(['a'])
    expect(store.error).toBe('服务器开小差了')
  })
})
