import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_USER_NAME, MAX_NAME_LENGTH } from '../lib/profile'
import { useUserStore } from './user'

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

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('load', () => {
  it('从 GET /api/profile 恢复昵称', async () => {
    const calls = stubFetch(() => json({ name: '李四' }))

    const store = useUserStore()

    await expect(store.load()).resolves.toBe(true)

    expect(calls[0]!.url).toBe('/api/profile')
    expect(calls[0]!.init.method).toBe('GET')
    expect(store.name).toBe('李四')
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('请求失败时保持访客昵称并设置提示', async () => {
    stubFetch(() => json({ error: { code: 'internal_error', message: '服务器开小差了' } }, 500))

    const store = useUserStore()

    await expect(store.load()).resolves.toBe(false)

    expect(store.name).toBe(DEFAULT_USER_NAME)
    expect(store.error).toBe('服务器开小差了')
    expect(store.loading).toBe(false)
  })

  it('网络异常时同样回退到访客昵称', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch')
    })

    const store = useUserStore()
    await store.load()

    expect(store.name).toBe(DEFAULT_USER_NAME)
    expect(store.error).toBe('网络请求失败，请检查后端服务是否已启动')
  })
})

describe('rename', () => {
  it('PUT 提交去空白后的昵称并采用服务端结果', async () => {
    const calls = stubFetch(() => json({ name: '李四' }))

    const store = useUserStore()

    await expect(store.rename('  李四  ')).resolves.toEqual({
      ok: true,
      name: '李四',
      error: null,
    })

    expect(store.name).toBe('李四')
    expect(store.error).toBeNull()
    expect(calls[0]!.url).toBe('/api/profile')
    expect(calls[0]!.init.method).toBe('PUT')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ name: '李四' })
  })

  it('空昵称在本地被拒绝且不发请求', async () => {
    const calls = stubFetch(() => json({ name: '李四' }))

    const store = useUserStore()

    await expect(store.rename('   ')).resolves.toEqual({
      ok: false,
      name: '',
      error: '昵称不能为空',
    })

    expect(calls).toHaveLength(0)
    expect(store.name).toBe(DEFAULT_USER_NAME)
  })

  it('超长昵称在本地被拒绝且不发请求', async () => {
    const calls = stubFetch(() => json({ name: '李四' }))
    const store = useUserStore()

    const result = await store.rename('名'.repeat(MAX_NAME_LENGTH + 1))

    expect(result.ok).toBe(false)
    expect(result.error).toBe(`昵称最多 ${MAX_NAME_LENGTH} 个字符`)
    expect(calls).toHaveLength(0)
    expect(store.name).toBe(DEFAULT_USER_NAME)
  })

  it('400 invalid_name 时返回失败并使用服务端提示，昵称不变', async () => {
    stubFetch(() => json({ error: { code: 'invalid_name', message: '昵称不合法' } }, 400))

    const store = useUserStore()
    const result = await store.rename('李四')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('昵称不合法')
    expect(store.name).toBe(DEFAULT_USER_NAME)
    expect(store.error).toBe('昵称不合法')
  })

  it('网络异常时返回失败提示且昵称不变', async () => {
    stubFetch(() => {
      throw new TypeError('Failed to fetch')
    })

    const store = useUserStore()
    const result = await store.rename('李四')

    expect(result.ok).toBe(false)
    expect(result.error).toBe('网络请求失败，请检查后端服务是否已启动')
    expect(store.name).toBe(DEFAULT_USER_NAME)
  })

  it('保存成功后清空上一次的错误', async () => {
    let shouldFail = true
    stubFetch(() =>
      shouldFail
        ? json({ error: { code: 'invalid_name', message: '昵称不合法' } }, 400)
        : json({ name: '李四' }),
    )

    const store = useUserStore()
    await store.rename('李四')
    expect(store.error).toBe('昵称不合法')

    shouldFail = false
    await store.rename('李四')

    expect(store.error).toBeNull()
    expect(store.name).toBe('李四')
  })
})
