import { describe, expect, it, vi } from 'vitest'
import { ApiError, api, createApiClient, isNotFound } from './api'
import type { Post } from './post'

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

function headersOf(call: RecordedCall): Record<string, string> {
  return (call.init.headers ?? {}) as Record<string, string>
}

/** 记录每次请求的假 fetch。 */
function createFetchStub(respond: () => Response | Promise<Response>): {
  fetchImpl: typeof fetch
  calls: RecordedCall[]
} {
  const calls: RecordedCall[] = []

  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return respond()
  }) as unknown as typeof fetch

  return { fetchImpl, calls }
}

async function captureApiError(action: () => Promise<unknown>): Promise<ApiError> {
  try {
    await action()
  } catch (error) {
    if (error instanceof ApiError) return error
    throw error
  }

  throw new Error('预期抛出 ApiError，但请求成功返回了')
}

describe('listPosts', () => {
  it('以 GET 请求 /api/posts 并返回列表', async () => {
    const posts = [makePost({ id: 'b' }), makePost({ id: 'a', createdAt: NOW - 1 })]
    const { fetchImpl, calls } = createFetchStub(() => json({ posts }))
    const client = createApiClient({ fetch: fetchImpl })

    await expect(client.listPosts()).resolves.toEqual(posts)

    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('/api/posts')
    expect(calls[0]!.init.method).toBe('GET')
    expect(headersOf(calls[0]!).accept).toBe('application/json')
    expect(calls[0]!.init.body).toBeUndefined()
  })

  it('响应缺少 posts 字段时返回空数组', async () => {
    const { fetchImpl } = createFetchStub(() => json({}))
    const client = createApiClient({ fetch: fetchImpl })

    await expect(client.listPosts()).resolves.toEqual([])
  })

  it('透传 AbortSignal', async () => {
    const { fetchImpl, calls } = createFetchStub(() => json({ posts: [] }))
    const client = createApiClient({ fetch: fetchImpl })
    const controller = new AbortController()

    await client.listPosts(controller.signal)

    expect(calls[0]!.init.signal).toBe(controller.signal)
  })
})

describe('createPost', () => {
  it('以 POST 提交内容并返回创建结果', async () => {
    const post = makePost({ id: 'new', content: '你好' })
    const { fetchImpl, calls } = createFetchStub(() => json({ post }, 201))
    const client = createApiClient({ fetch: fetchImpl })

    await expect(client.createPost({ content: '你好', author: '张三' })).resolves.toEqual(post)

    expect(calls[0]!.url).toBe('/api/posts')
    expect(calls[0]!.init.method).toBe('POST')
    expect(headersOf(calls[0]!)).toMatchObject({
      'content-type': 'application/json',
      accept: 'application/json',
    })
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ content: '你好', author: '张三' })
  })

  it('未提供 author 时请求体不带该字段', async () => {
    const { fetchImpl, calls } = createFetchStub(() => json({ post: makePost() }, 201))
    const client = createApiClient({ fetch: fetchImpl })

    await client.createPost({ content: '只有内容' })

    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ content: '只有内容' })
  })

  it('400 invalid_content 时抛出带服务端提示的 ApiError', async () => {
    const { fetchImpl } = createFetchStub(() =>
      json({ error: { code: 'invalid_content', message: '内容不能为空' } }, 400),
    )
    const client = createApiClient({ fetch: fetchImpl })

    const error = await captureApiError(() => client.createPost({ content: '   ' }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(400)
    expect(error.code).toBe('invalid_content')
    expect(error.message).toBe('内容不能为空')
  })
})

describe('setLike', () => {
  it('以 PATCH 提交点赞状态并返回最新的 post', async () => {
    const post = makePost({ likes: 3, liked: true })
    const { fetchImpl, calls } = createFetchStub(() => json({ post }))
    const client = createApiClient({ fetch: fetchImpl })

    await expect(client.setLike('p 1/2', true)).resolves.toEqual(post)

    expect(calls[0]!.url).toBe('/api/posts/p%201%2F2')
    expect(calls[0]!.init.method).toBe('PATCH')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ liked: true })
  })

  it('404 not_found 可被 isNotFound 识别', async () => {
    const { fetchImpl } = createFetchStub(() =>
      json({ error: { code: 'not_found', message: '内容不存在' } }, 404),
    )
    const client = createApiClient({ fetch: fetchImpl })

    const error = await captureApiError(() => client.setLike('missing', true))

    expect(error.status).toBe(404)
    expect(error.code).toBe('not_found')
    expect(error.message).toBe('内容不存在')
    expect(isNotFound(error)).toBe(true)
  })
})

describe('deletePost', () => {
  it('以 DELETE 请求并接受 204 空响应', async () => {
    const { fetchImpl, calls } = createFetchStub(() => new Response(null, { status: 204 }))
    const client = createApiClient({ fetch: fetchImpl })

    await expect(client.deletePost('abc')).resolves.toBeUndefined()

    expect(calls[0]!.url).toBe('/api/posts/abc')
    expect(calls[0]!.init.method).toBe('DELETE')
  })

  it('404 时抛出 ApiError', async () => {
    const { fetchImpl } = createFetchStub(() =>
      json({ error: { code: 'not_found', message: '内容不存在' } }, 404),
    )
    const client = createApiClient({ fetch: fetchImpl })

    const error = await captureApiError(() => client.deletePost('missing'))

    expect(isNotFound(error)).toBe(true)
    expect(error.message).toBe('内容不存在')
  })
})

describe('profile', () => {
  it('GET /api/profile 返回昵称字符串', async () => {
    const { fetchImpl, calls } = createFetchStub(() => json({ name: '李四' }))
    const client = createApiClient({ fetch: fetchImpl })

    await expect(client.getProfile()).resolves.toBe('李四')

    expect(calls[0]!.url).toBe('/api/profile')
    expect(calls[0]!.init.method).toBe('GET')
  })

  it('PUT /api/profile 提交昵称并返回服务端结果', async () => {
    const { fetchImpl, calls } = createFetchStub(() => json({ name: '李四' }))
    const client = createApiClient({ fetch: fetchImpl })

    await expect(client.setProfile('李四')).resolves.toBe('李四')

    expect(calls[0]!.url).toBe('/api/profile')
    expect(calls[0]!.init.method).toBe('PUT')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ name: '李四' })
  })

  it('400 invalid_name 时抛出带服务端提示的 ApiError', async () => {
    const { fetchImpl } = createFetchStub(() =>
      json({ error: { code: 'invalid_name', message: '昵称最多 16 个字符' } }, 400),
    )
    const client = createApiClient({ fetch: fetchImpl })

    const error = await captureApiError(() => client.setProfile('名'.repeat(20)))

    expect(error.status).toBe(400)
    expect(error.code).toBe('invalid_name')
    expect(error.message).toBe('昵称最多 16 个字符')
  })
})

describe('错误处理', () => {
  it('网络异常时抛出 status 为 0 的 network_error', async () => {
    const { fetchImpl } = createFetchStub(() => {
      throw new TypeError('Failed to fetch')
    })
    const client = createApiClient({ fetch: fetchImpl })

    const error = await captureApiError(() => client.listPosts())

    expect(error.code).toBe('network_error')
    expect(error.status).toBe(0)
    expect(error.message).toBe('网络请求失败，请检查后端服务是否已启动')
    expect(isNotFound(error)).toBe(false)
  })

  it('错误响应无法解析时回退到 HTTP 状态码文案', async () => {
    const { fetchImpl } = createFetchStub(() => new Response('boom', { status: 500 }))
    const client = createApiClient({ fetch: fetchImpl })

    const error = await captureApiError(() => client.listPosts())

    expect(error.status).toBe(500)
    expect(error.message).toBe('HTTP 500')
  })

  it('成功响应不是合法 JSON 时抛出 invalid_json', async () => {
    const { fetchImpl } = createFetchStub(() => new Response('<html>', { status: 200 }))
    const client = createApiClient({ fetch: fetchImpl })

    const error = await captureApiError(() => client.listPosts())

    expect(error.code).toBe('invalid_json')
  })

  it('isNotFound 只对 404 的 ApiError 返回 true', () => {
    expect(isNotFound(new ApiError('not_found', 404, '内容不存在'))).toBe(true)
    expect(isNotFound(new ApiError('invalid_content', 400, '内容不能为空'))).toBe(false)
    expect(isNotFound(new Error('404'))).toBe(false)
    expect(isNotFound(null)).toBe(false)
  })
})

describe('baseUrl', () => {
  it('拼接前缀并容忍结尾的斜杠', async () => {
    const { fetchImpl, calls } = createFetchStub(() => json({ posts: [] }))
    const client = createApiClient({ baseUrl: 'http://localhost:8787/', fetch: fetchImpl })

    await client.listPosts()

    expect(calls[0]!.url).toBe('http://localhost:8787/api/posts')
  })

  it('默认实例使用同源相对路径', async () => {
    const { fetchImpl, calls } = createFetchStub(() => json({ posts: [] }))
    vi.stubGlobal('fetch', fetchImpl)

    await api.listPosts()

    expect(calls[0]!.url).toBe('/api/posts')
  })
})
