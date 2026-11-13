import { describe, expect, it } from 'vitest'
import {
  MAX_CONTENT_LENGTH,
  analyzeContent,
  createPost,
  normalizePost,
  parseStoredPosts,
  serializePosts,
  type Post,
} from './post'
import { DEFAULT_USER_NAME, MAX_NAME_LENGTH } from './profile'

const NOW = new Date(2026, 10, 13, 9, 5, 0).getTime()

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: '访客',
    content: '此刻的想法',
    likes: 0,
    liked: false,
    createdAt: NOW,
    ...overrides,
  }
}

describe('analyzeContent', () => {
  it('空内容不可发布且不计长度', () => {
    const result = analyzeContent('')
    expect(result.length).toBe(0)
    expect(result.isBlank).toBe(true)
    expect(result.canPublish).toBe(false)
  })

  it('只有空白字符视为空', () => {
    const result = analyzeContent('   \n\t ')
    expect(result.isBlank).toBe(true)
    expect(result.canPublish).toBe(false)
  })

  it('普通内容可发布', () => {
    const result = analyzeContent('今天也要好好写代码')
    expect(result.length).toBe(9)
    expect(result.canPublish).toBe(true)
    expect(result.hint).toBe('')
  })

  it('到达上限仍可发布', () => {
    const result = analyzeContent('字'.repeat(MAX_CONTENT_LENGTH))
    expect(result.length).toBe(MAX_CONTENT_LENGTH)
    expect(result.isOverLimit).toBe(false)
    expect(result.canPublish).toBe(true)
  })

  it('接近上限时给出提醒样式标记', () => {
    expect(analyzeContent('字'.repeat(MAX_CONTENT_LENGTH - 20)).isNearLimit).toBe(true)
    expect(analyzeContent('字'.repeat(10)).isNearLimit).toBe(false)
  })

  it('超出上限时给出可读提示且不可发布', () => {
    const result = analyzeContent('字'.repeat(MAX_CONTENT_LENGTH + 1))
    expect(result.isOverLimit).toBe(true)
    expect(result.canPublish).toBe(false)
    expect(result.hint).toBe(`内容最多 ${MAX_CONTENT_LENGTH} 字，请精简后再发布`)
  })

  it('emoji 按一个字符计入长度', () => {
    expect(analyzeContent('👍'.repeat(MAX_CONTENT_LENGTH)).isOverLimit).toBe(false)
    expect(analyzeContent('👍'.repeat(MAX_CONTENT_LENGTH + 1)).isOverLimit).toBe(true)
  })
})

describe('createPost', () => {
  it('创建后置零点赞、去空白并记录创建时间', () => {
    const post = createPost({
      content: '  你好，微语  ',
      author: '  张三  ',
      now: NOW,
      id: 'p-new',
    })

    expect(post).toEqual({
      id: 'p-new',
      author: '张三',
      content: '你好，微语',
      likes: 0,
      liked: false,
      createdAt: NOW,
    })
  })

  it('作者为空时回退到默认昵称', () => {
    const post = createPost({ content: '内容', author: '   ', now: NOW })
    expect(post?.author).toBe(DEFAULT_USER_NAME)
  })

  it('作者超长时截断', () => {
    const post = createPost({ content: '内容', author: '名'.repeat(40), now: NOW })
    expect(Array.from(post?.author ?? '')).toHaveLength(MAX_NAME_LENGTH)
  })

  it('内容为空或超限时返回 null', () => {
    expect(createPost({ content: '   ', author: '访客', now: NOW })).toBeNull()
    expect(
      createPost({ content: '字'.repeat(MAX_CONTENT_LENGTH + 1), author: '访客', now: NOW }),
    ).toBeNull()
  })

  it('未显式提供 id 时自动生成唯一标识', () => {
    const first = createPost({ content: 'a', author: '访客', now: NOW })
    const second = createPost({ content: 'b', author: '访客', now: NOW })

    expect(first?.id).toBeTruthy()
    expect(first?.id).not.toBe(second?.id)
  })
})

describe('normalizePost', () => {
  it('保留合法字段', () => {
    const post = normalizePost(makePost({ likes: 3, liked: true }))
    expect(post).toEqual(makePost({ likes: 3, liked: true }))
  })

  it('拒绝非对象与无内容记录', () => {
    expect(normalizePost(null)).toBeNull()
    expect(normalizePost('text')).toBeNull()
    expect(normalizePost({ content: '   ' })).toBeNull()
    expect(normalizePost({ content: 42 })).toBeNull()
  })

  it('拒绝异常超长的历史数据', () => {
    expect(normalizePost({ content: '字'.repeat(MAX_CONTENT_LENGTH * 4 + 1) })).toBeNull()
  })

  it('补全缺省值并纠正非法字段', () => {
    const post = normalizePost({ content: '只有内容' }, { now: NOW, makeId: () => 'generated' })

    expect(post).toEqual({
      id: 'generated',
      author: DEFAULT_USER_NAME,
      content: '只有内容',
      likes: 0,
      liked: false,
      createdAt: NOW,
    })
  })

  it('点赞数取整且不接受负数', () => {
    expect(normalizePost({ content: 'a', likes: 2.7 })?.likes).toBe(2)
    expect(normalizePost({ content: 'a', likes: -5 })?.likes).toBe(0)
    expect(normalizePost({ content: 'a', likes: '3' })?.likes).toBe(0)
  })

  it('liked 只接受严格 true', () => {
    expect(normalizePost({ content: 'a', liked: true })?.liked).toBe(true)
    expect(normalizePost({ content: 'a', liked: 'true' })?.liked).toBe(false)
    expect(normalizePost({ content: 'a', liked: 1 })?.liked).toBe(false)
  })

  it('作者超长时按字符截断', () => {
    const post = normalizePost({ content: 'a', author: '名'.repeat(30) })
    expect(Array.from(post?.author ?? '')).toHaveLength(MAX_NAME_LENGTH)
  })
})

describe('parseStoredPosts', () => {
  it('空数据视为空列表', () => {
    expect(parseStoredPosts(null)).toEqual({ posts: [], status: 'empty' })
    expect(parseStoredPosts('')).toEqual({ posts: [], status: 'empty' })
  })

  it('JSON 损坏时报告 corrupt 且不抛异常', () => {
    expect(parseStoredPosts('{not json')).toEqual({ posts: [], status: 'corrupt' })
  })

  it('非数组报告 corrupt', () => {
    expect(parseStoredPosts('{"a":1}')).toEqual({ posts: [], status: 'corrupt' })
  })

  it('过滤非法记录并按时间倒序', () => {
    const raw = JSON.stringify([
      { id: 'old', content: '旧', createdAt: NOW - 1000 },
      { id: 'bad', content: '  ' },
      { id: 'new', content: '新', createdAt: NOW },
    ])

    const result = parseStoredPosts(raw)
    expect(result.status).toBe('ok')
    expect(result.posts.map((post) => post.id)).toEqual(['new', 'old'])
  })

  it('全部记录非法时返回空列表但状态为 ok', () => {
    const result = parseStoredPosts(JSON.stringify([{ content: '' }, null]))
    expect(result).toEqual({ posts: [], status: 'ok' })
  })
})

describe('serializePosts', () => {
  it('序列化后可被 parseStoredPosts 还原', () => {
    const posts = [makePost({ id: 'b', createdAt: NOW }), makePost({ id: 'a', createdAt: NOW - 1 })]
    const parsed = parseStoredPosts(serializePosts(posts))
    expect(parsed.posts).toEqual(posts)
  })
})
