import type { Post } from './post'

export interface ApiClientOptions {
  /** 接口基址，默认同源（空字符串），实际请求 `/api/...` */
  baseUrl?: string
  /** 注入 fetch 实现，便于测试；缺省时使用全局 fetch */
  fetch?: typeof fetch
}

/** 网络或接口错误：`status` 为 0 表示请求没有到达服务端。 */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(code: string, status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export interface ApiClient {
  listPosts(signal?: AbortSignal): Promise<Post[]>
  createPost(input: { content: string; author?: string }, signal?: AbortSignal): Promise<Post>
  setLike(id: string, liked: boolean, signal?: AbortSignal): Promise<Post>
  setFavorite(id: string, favorited: boolean, signal?: AbortSignal): Promise<Post>
  deletePost(id: string, signal?: AbortSignal): Promise<void>
  getProfile(signal?: AbortSignal): Promise<string>
  setProfile(name: string, signal?: AbortSignal): Promise<string>
}

const NETWORK_ERROR_MESSAGE = '网络请求失败，请检查后端服务是否已启动'
const INVALID_JSON_MESSAGE = '服务返回的数据格式异常'

interface RequestOptions {
  body?: unknown
  signal?: AbortSignal
}

interface ServerErrorBody {
  code?: unknown
  message?: unknown
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** 从错误响应体中取出 `{ error: { code, message } }`。 */
function readServerError(payload: unknown): ServerErrorBody {
  if (!isRecord(payload) || !isRecord(payload.error)) return {}
  return payload.error
}

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const baseUrl = options.baseUrl ?? ''
  const injectedFetch = options.fetch

  async function callFetch(url: string, init: RequestInit): Promise<Response> {
    // 浏览器要求 fetch 以 globalThis 为 this 调用，因此不使用解构出来的裸函数
    const fetchImpl = injectedFetch ?? globalThis.fetch
    if (typeof fetchImpl !== 'function') {
      throw new ApiError('network_error', 0, NETWORK_ERROR_MESSAGE)
    }
    return fetchImpl.call(globalThis, url, init)
  }

  async function request<T>(method: string, path: string, req: RequestOptions = {}): Promise<T> {
    const hasBody = req.body !== undefined
    const headers: Record<string, string> = { accept: 'application/json' }
    if (hasBody) headers['content-type'] = 'application/json'

    let response: Response
    try {
      response = await callFetch(joinUrl(baseUrl, path), {
        method,
        headers,
        body: hasBody ? JSON.stringify(req.body) : undefined,
        signal: req.signal,
      })
    } catch (error) {
      if (error instanceof ApiError) throw error
      throw new ApiError('network_error', 0, NETWORK_ERROR_MESSAGE)
    }

    if (!response.ok) {
      // 错误响应解析失败不应掩盖状态码，直接回退到 `HTTP <status>`
      const payload = await tryReadJson(response)
      const serverError = readServerError(payload)
      const message =
        typeof serverError.message === 'string' && serverError.message
          ? serverError.message
          : `HTTP ${response.status}`
      const code =
        typeof serverError.code === 'string' && serverError.code
          ? serverError.code
          : `http_${response.status}`

      throw new ApiError(code, response.status, message)
    }

    const payload = await parseJson(response)
    if (payload === undefined) return undefined as T
    return payload as T
  }

  async function readText(response: Response): Promise<string> {
    // 204 或空 body 没有可解析内容
    if (response.status === 204) return ''

    try {
      return await response.text()
    } catch {
      return ''
    }
  }

  /** 成功响应：非法 JSON 视为契约违约。 */
  async function parseJson(response: Response): Promise<unknown> {
    const text = await readText(response)
    if (!text.trim()) return undefined

    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new ApiError('invalid_json', response.status, INVALID_JSON_MESSAGE)
    }
  }

  /** 错误响应：解析失败时返回 undefined，由调用方回退到状态码文案。 */
  async function tryReadJson(response: Response): Promise<unknown> {
    try {
      return await parseJson(response)
    } catch {
      return undefined
    }
  }

  return {
    async listPosts(signal) {
      const data = await request<{ posts?: Post[] }>('GET', '/api/posts', { signal })
      return Array.isArray(data?.posts) ? data.posts : []
    },

    async createPost(input, signal) {
      const body: { content: string; author?: string } = { content: input.content }
      if (input.author !== undefined) body.author = input.author

      const data = await request<{ post: Post }>('POST', '/api/posts', { body, signal })
      return data.post
    },

    async setLike(id, liked, signal) {
      const data = await request<{ post: Post }>(
        'PATCH',
        `/api/posts/${encodeURIComponent(id)}`,
        { body: { liked }, signal },
      )
      return data.post
    },

    async setFavorite(id, favorited, signal) {
      const data = await request<{ post: Post }>(
        'PATCH',
        `/api/posts/${encodeURIComponent(id)}`,
        { body: { favorited }, signal },
      )
      return data.post
    },

    async deletePost(id, signal) {
      await request<void>('DELETE', `/api/posts/${encodeURIComponent(id)}`, { signal })
    },

    async getProfile(signal) {
      const data = await request<{ name: string }>('GET', '/api/profile', { signal })
      return data.name
    },

    async setProfile(name, signal) {
      const data = await request<{ name: string }>('PUT', '/api/profile', {
        body: { name },
        signal,
      })
      return data.name
    },
  }
}

/** 默认实例：同源请求，使用全局 fetch。 */
export const api: ApiClient = createApiClient()

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}
