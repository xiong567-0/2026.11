import { vi } from 'vitest'
import { createApp } from '../../server/app'
import { createMemoryStore } from '../../server/store'
import type { MemoryStore, MemoryStoreSeed } from '../../server/store'

const ORIGIN = 'http://localhost'

function toUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.toString()
  return input.url
}

/**
 * 用真实的 Hono app 当成内存后端，接管全局 fetch。
 * 前端代码仍走 `api` 默认实例（同源 `/api/...`），请求会被转成 `Request` 交给 `app.request()`。
 * @returns 可直接断言/种数据的内存 store
 */
export function installFakeApi(seed: MemoryStoreSeed = {}): MemoryStore {
  const store = createMemoryStore(seed)
  const app = createApp({ store })

  const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(new URL(toUrlString(input), ORIGIN), init)
    return app.request(request)
  }

  vi.stubGlobal('fetch', vi.fn(fakeFetch))
  return store
}
