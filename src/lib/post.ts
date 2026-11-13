import { DEFAULT_USER_NAME, MAX_NAME_LENGTH } from './profile'
import { clampText, countChars } from './text'

export const MAX_CONTENT_LENGTH = 200
/** 剩余 20 字时开始提醒 */
export const NEAR_LIMIT_THRESHOLD = 20
/** 历史数据允许的异常上限（正常输入不会超过 MAX_CONTENT_LENGTH） */
const MAX_STORED_CONTENT_LENGTH = MAX_CONTENT_LENGTH * 4

export interface Post {
  id: string
  author: string
  content: string
  likes: number
  liked: boolean
  createdAt: number
}

export interface ContentAnalysis {
  length: number
  isBlank: boolean
  isOverLimit: boolean
  isNearLimit: boolean
  canPublish: boolean
  /** 需要展示给用户的提示，没有提示时为空字符串 */
  hint: string
}

/** 发布框的输入规则：字数统计、上限判断与提示文案。 */
export function analyzeContent(raw: string | null | undefined): ContentAnalysis {
  const text = String(raw ?? '')
  const length = countChars(text)
  const isBlank = text.trim().length === 0
  const isOverLimit = length > MAX_CONTENT_LENGTH
  const isNearLimit = !isOverLimit && length >= MAX_CONTENT_LENGTH - NEAR_LIMIT_THRESHOLD

  return {
    length,
    isBlank,
    isOverLimit,
    isNearLimit,
    canPublish: !isBlank && !isOverLimit,
    hint: isOverLimit ? `内容最多 ${MAX_CONTENT_LENGTH} 字，请精简后再发布` : '',
  }
}

export function createPostId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeAuthor(raw: string | null | undefined): string {
  const author = String(raw ?? '').trim()
  return author ? clampText(author, MAX_NAME_LENGTH) : DEFAULT_USER_NAME
}

export interface CreatePostInput {
  content: string
  author?: string | null
  now?: number
  id?: string
}

/** 创建一条新内容；内容为空或超限时返回 null。 */
export function createPost({
  content,
  author,
  now = Date.now(),
  id = createPostId(),
}: CreatePostInput): Post | null {
  if (!analyzeContent(content).canPublish) return null

  return {
    id,
    author: normalizeAuthor(author),
    content: content.trim(),
    likes: 0,
    liked: false,
    createdAt: now,
  }
}

export interface NormalizePostOptions {
  now?: number
  makeId?: () => string
}

/** 修复单条历史数据；无法修复时返回 null（跳过该条）。 */
export function normalizePost(
  raw: unknown,
  options: NormalizePostOptions = {},
): Post | null {
  if (!raw || typeof raw !== 'object') return null

  const record = raw as Record<string, unknown>
  const content = typeof record.content === 'string' ? record.content : ''
  if (!content.trim()) return null
  if (countChars(content) > MAX_STORED_CONTENT_LENGTH) return null

  const now = options.now ?? Date.now()
  const makeId = options.makeId ?? createPostId
  const author = typeof record.author === 'string' ? record.author.trim() : ''
  const rawLikes = record.likes
  const likes =
    typeof rawLikes === 'number' && Number.isFinite(rawLikes) && rawLikes > 0
      ? Math.floor(rawLikes)
      : 0
  const rawCreatedAt = record.createdAt

  return {
    id: typeof record.id === 'string' && record.id ? record.id : makeId(),
    author: author ? clampText(author, MAX_NAME_LENGTH) : DEFAULT_USER_NAME,
    content,
    likes,
    liked: record.liked === true,
    createdAt:
      typeof rawCreatedAt === 'number' && Number.isFinite(rawCreatedAt)
        ? rawCreatedAt
        : now,
  }
}

export type StoredPostsStatus = 'ok' | 'empty' | 'corrupt'

export interface StoredPostsResult {
  posts: Post[]
  status: StoredPostsStatus
}

/** 解析本地存储中的内容列表：过滤非法记录、按创建时间倒序。 */
export function parseStoredPosts(raw: string | null): StoredPostsResult {
  if (!raw) return { posts: [], status: 'empty' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { posts: [], status: 'corrupt' }
  }

  if (!Array.isArray(parsed)) return { posts: [], status: 'corrupt' }

  const now = Date.now()
  const posts = parsed
    .map((item) => normalizePost(item, { now }))
    .filter((post): post is Post => post !== null)
    .sort((a, b) => b.createdAt - a.createdAt)

  return { posts, status: 'ok' }
}

export function serializePosts(posts: readonly Post[]): string {
  return JSON.stringify(posts)
}
