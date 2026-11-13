import { DEFAULT_USER_NAME, MAX_NAME_LENGTH } from './profile'
import { clampText, countChars } from './text'

export const MAX_CONTENT_LENGTH = 200
/** 剩余 20 字时开始提醒 */
export const NEAR_LIMIT_THRESHOLD = 20

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

