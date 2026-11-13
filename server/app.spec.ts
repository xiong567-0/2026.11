// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Post } from '../src/lib/post'
import { DEFAULT_USER_NAME, MAX_NAME_LENGTH } from '../src/lib/profile'
import { createApp } from './app'
import { createMemoryStore } from './store'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: '张三',
    content: '第一条',
    likes: 0,
    liked: false,
    favorites: 0,
    favorited: false,
    createdAt: 1_000,
    ...overrides,
  }
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function rawInit(method: string, body: string): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body,
  }
}

describe('GET /api/posts', () => {
  it('返回按 createdAt 倒序的 posts 数组', async () => {
    const app = createApp({
      store: createMemoryStore({
        posts: [
          makePost({ id: 'old', createdAt: 100 }),
          makePost({ id: 'new', createdAt: 300 }),
          makePost({ id: 'mid', createdAt: 200 }),
        ],
      }),
    })

    const res = await app.request('/api/posts')

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('application/json')
    const body = await res.json()
    expect(body.posts.map((post: Post) => post.id)).toEqual(['new', 'mid', 'old'])
  })

  it('没有内容时返回空数组', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ posts: [] })
  })
})

describe('POST /api/posts', () => {
  it('创建成功返回 201、Location 头与完整 post', async () => {
    const store = createMemoryStore({ name: '张三' })
    const app = createApp({ store })

    const res = await app.request(
      '/api/posts',
      jsonInit('POST', { content: '  你好世界  ', author: '张三' }),
    )

    expect(res.status).toBe(201)
    expect(res.headers.get('content-type')).toContain('application/json')
    const { post } = await res.json()
    expect(res.headers.get('location')).toBe(`/api/posts/${post.id}`)
    expect(post).toMatchObject({
      author: '张三',
      content: '你好世界',
      likes: 0,
      liked: false,
    })
    expect(typeof post.id).toBe('string')
    expect(typeof post.createdAt).toBe('number')
    expect(store.listPosts()).toHaveLength(1)
  })

  it('author 缺省时回退为访客', async () => {
    const app = createApp({ store: createMemoryStore({ name: '张三' }) })

    const res = await app.request('/api/posts', jsonInit('POST', { content: '你好' }))

    expect(res.status).toBe(201)
    expect((await res.json()).post.author).toBe(DEFAULT_USER_NAME)
  })

  it('author 为空白字符串时回退为访客', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts', jsonInit('POST', { content: '你好', author: '   ' }))

    expect((await res.json()).post.author).toBe(DEFAULT_USER_NAME)
  })

  it('author 超过 16 字按字素截断', async () => {
    const app = createApp({ store: createMemoryStore() })
    const longName = '👍'.repeat(MAX_NAME_LENGTH + 5)

    const res = await app.request('/api/posts', jsonInit('POST', { content: '你好', author: longName }))

    expect((await res.json()).post.author).toBe('👍'.repeat(MAX_NAME_LENGTH))
  })

  it('内容为空字符串返回 400 invalid_content', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts', jsonInit('POST', { content: '' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('invalid_content')
    expect(typeof body.error.message).toBe('string')
    expect(body.error.message.length).toBeGreaterThan(0)
  })

  it('内容全空白返回 400 invalid_content', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts', jsonInit('POST', { content: '   \n\t  ' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_content')
  })

  it('内容缺失返回 400 invalid_content', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts', jsonInit('POST', {}))

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_content')
  })

  it('内容超过 200 字返回 400 invalid_content', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts', jsonInit('POST', { content: '字'.repeat(201) }))

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_content')
  })

  it('正好 200 字可以发布', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts', jsonInit('POST', { content: '字'.repeat(200) }))

    expect(res.status).toBe(201)
  })

  it('200 个 emoji（字素计数）可以发布', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts', jsonInit('POST', { content: '👍'.repeat(200) }))

    expect(res.status).toBe(201)
  })

  it('请求体不是合法 JSON 返回 400 invalid_json', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts', rawInit('POST', '{ content: '))

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_json')
  })
})

describe('PATCH /api/posts/:id', () => {
  it('liked: true 时 likes + 1', async () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'p1', likes: 2 })] })
    const app = createApp({ store })

    const res = await app.request('/api/posts/p1', jsonInit('PATCH', { liked: true }))

    expect(res.status).toBe(200)
    const { post } = await res.json()
    expect(post).toMatchObject({ id: 'p1', likes: 3, liked: true })
    expect(store.findPost('p1')?.likes).toBe(3)
  })

  it('重复 liked: true 幂等，likes 不变', async () => {
    const app = createApp({
      store: createMemoryStore({ posts: [makePost({ id: 'p1', likes: 3, liked: true })] }),
    })

    const res = await app.request('/api/posts/p1', jsonInit('PATCH', { liked: true }))

    expect(res.status).toBe(200)
    expect((await res.json()).post.likes).toBe(3)
  })

  it('liked: false 时 likes - 1 且不小于 0', async () => {
    const app = createApp({
      store: createMemoryStore({ posts: [makePost({ id: 'p1', likes: 1, liked: true })] }),
    })

    const res = await app.request('/api/posts/p1', jsonInit('PATCH', { liked: false }))

    expect((await res.json()).post).toMatchObject({ likes: 0, liked: false })

    const again = await app.request('/api/posts/p1', jsonInit('PATCH', { liked: false }))
    expect((await again.json()).post.likes).toBe(0)
  })

  it('body 缺少 liked 返回 400 invalid_body', async () => {
    const app = createApp({ store: createMemoryStore({ posts: [makePost({ id: 'p1' })] }) })

    const res = await app.request('/api/posts/p1', jsonInit('PATCH', {}))

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_body')
  })

  it('liked 不是布尔值返回 400 invalid_body', async () => {
    const app = createApp({ store: createMemoryStore({ posts: [makePost({ id: 'p1' })] }) })

    const res = await app.request('/api/posts/p1', jsonInit('PATCH', { liked: 'yes' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_body')
  })

  it('favorited: true 时 favorites + 1 并置 favorited 为 true', async () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'p1' })] })
    const app = createApp({ store })

    const res = await app.request('/api/posts/p1', jsonInit('PATCH', { favorited: true }))

    expect(res.status).toBe(200)
    const { post } = await res.json()
    expect(post).toMatchObject({ id: 'p1', favorited: true, favorites: 1 })
    expect(store.findPost('p1')).toMatchObject({ favorited: true, favorites: 1 })
  })

  it('重复 favorited: true 幂等，favorites 不变', async () => {
    const app = createApp({
      store: createMemoryStore({
        posts: [makePost({ id: 'p1', favorites: 1, favorited: true })],
      }),
    })

    const res = await app.request('/api/posts/p1', jsonInit('PATCH', { favorited: true }))

    expect(res.status).toBe(200)
    expect((await res.json()).post).toMatchObject({ favorited: true, favorites: 1 })
  })

  it('favorited: false 时 favorites - 1 且不小于 0', async () => {
    const app = createApp({
      store: createMemoryStore({
        posts: [makePost({ id: 'p1', favorites: 1, favorited: true })],
      }),
    })

    const res = await app.request('/api/posts/p1', jsonInit('PATCH', { favorited: false }))
    expect((await res.json()).post).toMatchObject({ favorited: false, favorites: 0 })

    const again = await app.request('/api/posts/p1', jsonInit('PATCH', { favorited: false }))
    expect((await again.json()).post).toMatchObject({ favorited: false, favorites: 0 })
  })

  it('liked 与 favorited 同时提供时一并生效', async () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'p1', likes: 2 })] })
    const app = createApp({ store })

    const res = await app.request(
      '/api/posts/p1',
      jsonInit('PATCH', { liked: true, favorited: true }),
    )

    expect(res.status).toBe(200)
    const { post } = await res.json()
    expect(post).toMatchObject({ id: 'p1', likes: 3, liked: true, favorites: 1, favorited: true })
    expect(store.findPost('p1')).toMatchObject({
      likes: 3,
      liked: true,
      favorites: 1,
      favorited: true,
    })
  })

  it('favorited 不是布尔值返回 400 invalid_body', async () => {
    const app = createApp({ store: createMemoryStore({ posts: [makePost({ id: 'p1' })] }) })

    const res = await app.request('/api/posts/p1', jsonInit('PATCH', { favorited: 'yes' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('invalid_body')
    expect(body.error.message).toBe('liked 与 favorited 必须是布尔值')
  })

  it('任一字段不是布尔值返回 400 invalid_body，且不写入任何状态', async () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'p1' })] })
    const app = createApp({ store })

    const res = await app.request('/api/posts/p1', jsonInit('PATCH', { liked: true, favorited: 'yes' }))

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_body')
    expect(store.findPost('p1')).toMatchObject({ likes: 0, liked: false })
  })

  it('body 同时缺少 liked 与 favorited 返回 400 invalid_body', async () => {
    const app = createApp({ store: createMemoryStore({ posts: [makePost({ id: 'p1' })] }) })

    const res = await app.request('/api/posts/p1', jsonInit('PATCH', {}))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('invalid_body')
    expect(body.error.message).toBe('liked 或 favorited 至少需要一个布尔值')
  })

  it('favorited 相关的 id 不存在返回 404 not_found', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts/missing', jsonInit('PATCH', { favorited: true }))

    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
  })

  it('收藏状态会持久化到 GET /api/posts', async () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'p1' })] })
    const app = createApp({ store })

    await app.request('/api/posts/p1', jsonInit('PATCH', { favorited: true }))

    const res = await app.request('/api/posts')
    const { posts } = await res.json()
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({ id: 'p1', favorited: true, favorites: 1 })
  })

  it('body 不是合法 JSON 返回 400 invalid_json', async () => {
    const app = createApp({ store: createMemoryStore({ posts: [makePost({ id: 'p1' })] }) })

    const res = await app.request('/api/posts/p1', rawInit('PATCH', 'not-json'))

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_json')
  })

  it('id 不存在返回 404 not_found', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts/missing', jsonInit('PATCH', { liked: true }))

    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
  })
})

describe('DELETE /api/posts/:id', () => {
  it('删除成功返回 204 且无 body', async () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'p1' })] })
    const app = createApp({ store })

    const res = await app.request('/api/posts/p1', { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
    expect(store.listPosts()).toEqual([])
  })

  it('id 不存在返回 404 not_found', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts/missing', { method: 'DELETE' })

    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
  })
})

describe('profile 接口', () => {
  it('GET /api/profile 默认返回访客', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/profile')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: DEFAULT_USER_NAME })
  })

  it('PUT /api/profile 更新昵称并去掉首尾空白', async () => {
    const store = createMemoryStore()
    const app = createApp({ store })

    const res = await app.request('/api/profile', jsonInit('PUT', { name: '  新昵称  ' }))

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: '新昵称' })
    expect(store.getProfileName()).toBe('新昵称')
  })

  it('PUT /api/profile 同步更新所有历史内容的作者', async () => {
    const store = createMemoryStore({
      posts: [
        makePost({ id: 'a', author: '张三' }),
        makePost({ id: 'b', author: '李四', createdAt: 2_000 }),
      ],
      name: '张三',
    })
    const app = createApp({ store })

    await app.request('/api/profile', jsonInit('PUT', { name: '王五' }))

    expect(store.listPosts().map((post) => post.author)).toEqual(['王五', '王五'])
  })

  it('昵称为空返回 400 invalid_name', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/profile', jsonInit('PUT', { name: '   ' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('invalid_name')
    expect(typeof body.error.message).toBe('string')
  })

  it('昵称缺失返回 400 invalid_name', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/profile', jsonInit('PUT', {}))

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_name')
  })

  it('昵称超过 16 字返回 400 invalid_name', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request(
      '/api/profile',
      jsonInit('PUT', { name: '名'.repeat(MAX_NAME_LENGTH + 1) }),
    )

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_name')
  })

  it('请求体不是合法 JSON 返回 400 invalid_json', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/profile', rawInit('PUT', '{{'))

    expect(res.status).toBe(400)
    expect((await res.json()).error.code).toBe('invalid_json')
  })
})

describe('GET /api/health', () => {
  it('返回 status ok', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/health')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })
})

describe('未知路径', () => {
  it('返回 JSON 格式的 404 not_found', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/unknown')

    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect((await res.json()).error.code).toBe('not_found')
  })

  it('根路径也返回 JSON 404（默认不托管静态资源）', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/')

    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('not_found')
  })
})

describe('CORS', () => {
  it('/api/* 响应带 allow-origin 头', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/health', { headers: { origin: 'http://localhost:5173' } })

    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('预检 OPTIONS 返回 204 并提示允许的方法', async () => {
    const app = createApp({ store: createMemoryStore() })

    const res = await app.request('/api/posts', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'PATCH',
      },
    })

    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')?.toUpperCase()).toContain('PATCH')
  })
})

describe('默认 store', () => {
  it('不传 store 时也能正常工作，且每次 createApp 互相隔离', async () => {
    const first = createApp()
    const second = createApp()

    const created = await first.request('/api/posts', jsonInit('POST', { content: '只在第一个实例' }))
    expect(created.status).toBe(201)

    const firstList = await (await first.request('/api/posts')).json()
    const secondList = await (await second.request('/api/posts')).json()
    expect(firstList.posts).toHaveLength(1)
    expect(secondList.posts).toHaveLength(0)
  })
})
