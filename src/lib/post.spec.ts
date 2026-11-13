import { describe, expect, it } from 'vitest'
import { MAX_CONTENT_LENGTH, analyzeContent, createPost } from './post'
import { DEFAULT_USER_NAME, MAX_NAME_LENGTH } from './profile'

const NOW = new Date(2026, 10, 13, 9, 5, 0).getTime()

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
      favorites: 0,
      favorited: false,
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


