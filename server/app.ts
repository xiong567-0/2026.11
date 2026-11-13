import { Hono } from 'hono'
import type { Context } from 'hono'
import { cors } from 'hono/cors'
import { MAX_CONTENT_LENGTH, createPost } from '../src/lib/post'
import type { Post } from '../src/lib/post'
import { inspectName } from '../src/lib/profile'
import { createMemoryStore } from './store'
import type { MemoryStore } from './store'

export type ApiErrorCode =
  | 'invalid_content'
  | 'invalid_body'
  | 'invalid_json'
  | 'invalid_name'
  | 'not_found'
  | 'internal_error'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
  }
}

export interface CreateAppOptions {
  store?: MemoryStore
}

function errorBody(code: ApiErrorCode, message: string): ApiErrorBody {
  return { error: { code, message } }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

type JsonReadResult = { ok: true; value: unknown } | { ok: false }

async function readJsonBody(c: Context): Promise<JsonReadResult> {
  try {
    return { ok: true, value: await c.req.json() }
  } catch {
    return { ok: false }
  }
}

const INVALID_JSON_MESSAGE = '请求体不是合法的 JSON'

/** 只创建路由，不监听端口，方便测试里用 app.request()。 */
export function createApp(options: CreateAppOptions = {}): Hono {
  const store = options.store ?? createMemoryStore()
  const app = new Hono()

  app.use('/api/*', cors())

  app.get('/api/health', (c) => c.json({ status: 'ok' }))

  app.get('/api/posts', (c) => c.json({ posts: store.listPosts() }))

  app.post('/api/posts', async (c) => {
    const parsed = await readJsonBody(c)
    if (!parsed.ok) return c.json(errorBody('invalid_json', INVALID_JSON_MESSAGE), 400)

    const body = asRecord(parsed.value)
    const content = typeof body.content === 'string' ? body.content : ''
    const author = typeof body.author === 'string' ? body.author : undefined

    const post = createPost({ content, author })
    if (!post) {
      return c.json(
        errorBody('invalid_content', `内容不能为空，且最多 ${MAX_CONTENT_LENGTH} 字`),
        400,
      )
    }

    store.addPost(post)
    c.header('Location', `/api/posts/${post.id}`)
    return c.json({ post }, 201)
  })

  app.patch('/api/posts/:id', async (c) => {
    const parsed = await readJsonBody(c)
    if (!parsed.ok) return c.json(errorBody('invalid_json', INVALID_JSON_MESSAGE), 400)

    const body = asRecord(parsed.value)
    const hasLiked = Object.prototype.hasOwnProperty.call(body, 'liked')
    const hasFavorited = Object.prototype.hasOwnProperty.call(body, 'favorited')

    if (!hasLiked && !hasFavorited) {
      return c.json(errorBody('invalid_body', 'liked 或 favorited 至少需要一个布尔值'), 400)
    }

    const { liked, favorited } = body
    if (
      (hasLiked && typeof liked !== 'boolean') ||
      (hasFavorited && typeof favorited !== 'boolean')
    ) {
      return c.json(errorBody('invalid_body', 'liked 与 favorited 必须是布尔值'), 400)
    }

    const id = c.req.param('id')
    let post: Post | null = null
    if (hasLiked) post = store.setLiked(id, liked as boolean)
    if (hasFavorited) post = store.setFavorited(id, favorited as boolean)

    if (!post) return c.json(errorBody('not_found', '内容不存在或已被删除'), 404)

    return c.json({ post })
  })

  app.delete('/api/posts/:id', (c) => {
    if (!store.removePost(c.req.param('id'))) {
      return c.json(errorBody('not_found', '内容不存在或已被删除'), 404)
    }
    return c.body(null, 204)
  })

  app.get('/api/profile', (c) => c.json({ name: store.getProfileName() }))

  app.put('/api/profile', async (c) => {
    const parsed = await readJsonBody(c)
    if (!parsed.ok) return c.json(errorBody('invalid_json', INVALID_JSON_MESSAGE), 400)

    const { name } = asRecord(parsed.value)
    const inspection = inspectName(typeof name === 'string' ? name : '')
    if (!inspection.isValid) {
      return c.json(errorBody('invalid_name', inspection.error ?? '昵称不合法'), 400)
    }

    store.renameAuthor(inspection.name)
    return c.json({ name: inspection.name })
  })

  app.notFound((c) =>
    c.json(errorBody('not_found', `未找到 ${c.req.method} ${c.req.path}`), 404),
  )

  app.onError((error, c) => {
    console.error('[api] 未捕获异常', error)
    return c.json(errorBody('internal_error', '服务器内部错误'), 500)
  })

  return app
}
