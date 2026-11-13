import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPost, serializePosts, type Post } from '../lib/post'
import { STORAGE_KEYS } from '../lib/storage'
import { createFakeStorage } from '../test-utils/fakeStorage'
import { usePostsStore } from './posts'

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

function seed(posts: Post[]): void {
  localStorage.setItem(STORAGE_KEYS.posts, serializePosts(posts))
}

function readStoredPosts(): Post[] {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.posts) ?? '[]') as Post[]
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('初始化与读取', () => {
  it('没有本地数据时是空列表', () => {
    const store = usePostsStore()
    expect(store.load()).toEqual({ status: 'empty', storageAvailable: true })
    expect(store.posts).toEqual([])
    expect(store.count).toBe(0)
  })

  it('从本地存储恢复内容并按时间倒序', () => {
    seed([
      makePost({ id: 'older', createdAt: NOW - 5000 }),
      makePost({ id: 'newer', createdAt: NOW }),
    ])

    const store = usePostsStore()
    store.load()

    expect(store.posts.map((post) => post.id)).toEqual(['newer', 'older'])
    expect(store.count).toBe(2)
  })

  it('本地数据损坏时返回 corrupt 且不覆盖原始数据', () => {
    localStorage.setItem(STORAGE_KEYS.posts, '{broken json')

    const store = usePostsStore()
    const result = store.load()

    expect(result.status).toBe('corrupt')
    expect(store.posts).toEqual([])
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBe('{broken json')
  })

  it('跳过非法记录但保留合法记录', () => {
    localStorage.setItem(
      STORAGE_KEYS.posts,
      JSON.stringify([{ id: 'ok', content: '合法', createdAt: NOW }, { content: '   ' }, null]),
    )

    const store = usePostsStore()
    store.load()

    expect(store.posts.map((post) => post.id)).toEqual(['ok'])
  })
})

describe('add', () => {
  it('新内容排在最前并写入本地存储', () => {
    seed([makePost({ id: 'old', createdAt: NOW - 1000 })])

    const store = usePostsStore()
    store.load()

    const created = store.add('  第一条新内容  ', '张三')

    expect(created).not.toBeNull()
    expect(store.posts[0]).toMatchObject({
      author: '张三',
      content: '第一条新内容',
      likes: 0,
      liked: false,
    })
    expect(store.posts.map((post) => post.id)).toEqual([created!.id, 'old'])
    expect(readStoredPosts()[0]).toEqual(created)
  })

  it('空内容被拒绝且不写入存储', () => {
    const store = usePostsStore()
    store.load()

    expect(store.add('   ', '张三')).toBeNull()
    expect(store.posts).toEqual([])
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBeNull()
  })

  it('超出字数上限的内容被拒绝', () => {
    const store = usePostsStore()
    store.load()

    expect(store.add('字'.repeat(201), '张三')).toBeNull()
    expect(store.count).toBe(0)
  })

  it('作者为空时使用默认昵称', () => {
    const store = usePostsStore()
    store.load()

    expect(store.add('内容', '  ')?.author).toBe('访客')
  })
})

describe('toggleLike', () => {
  it('点赞后计数加一并持久化', () => {
    seed([makePost({ id: 'p1', likes: 2, liked: false })])

    const store = usePostsStore()
    store.load()

    expect(store.toggleLike('p1')).toBe(true)
    expect(store.posts[0]).toMatchObject({ likes: 3, liked: true })
    expect(readStoredPosts()[0]).toMatchObject({ likes: 3, liked: true })
  })

  it('再次点击取消点赞并回退计数', () => {
    seed([makePost({ id: 'p1', likes: 1, liked: true })])

    const store = usePostsStore()
    store.load()

    store.toggleLike('p1')
    expect(store.posts[0]).toMatchObject({ likes: 0, liked: false })
    expect(readStoredPosts()[0]).toMatchObject({ likes: 0, liked: false })
  })

  it('未知 id 时不产生变化', () => {
    seed([makePost({ id: 'p1' })])

    const store = usePostsStore()
    store.load()

    expect(store.toggleLike('missing')).toBe(false)
    expect(store.posts[0]).toMatchObject({ likes: 0, liked: false })
  })
})

describe('remove', () => {
  it('按 id 删除并持久化', () => {
    seed([makePost({ id: 'a', createdAt: NOW }), makePost({ id: 'b', createdAt: NOW - 1 })])

    const store = usePostsStore()
    store.load()

    expect(store.remove('a')).toBe(true)
    expect(store.posts.map((post) => post.id)).toEqual(['b'])
    expect(readStoredPosts().map((post) => post.id)).toEqual(['b'])
  })

  it('删除不存在的 id 返回 false', () => {
    const store = usePostsStore()
    store.load()

    expect(store.remove('missing')).toBe(false)
  })
})

describe('renameAuthor', () => {
  it('同步更新所有历史内容的作者名并持久化', () => {
    seed([
      makePost({ id: 'a', author: '访客', createdAt: NOW }),
      makePost({ id: 'b', author: '访客', createdAt: NOW - 1 }),
    ])

    const store = usePostsStore()
    store.load()

    store.renameAuthor('李四')

    expect(store.posts.every((post) => post.author === '李四')).toBe(true)
    expect(readStoredPosts().every((post) => post.author === '李四')).toBe(true)
  })

  it('没有内容时不写存储', () => {
    const store = usePostsStore()
    store.load()

    store.renameAuthor('李四')
    expect(localStorage.getItem(STORAGE_KEYS.posts)).toBeNull()
  })
})

describe('存储异常', () => {
  it('存储被禁用时仍可在内存中读写，并标记写入失败', () => {
    const { storage, state } = createFakeStorage()
    state.failWrites = true
    vi.stubGlobal('localStorage', storage)

    const store = usePostsStore()
    const result = store.load()

    expect(result.storageAvailable).toBe(false)
    expect(store.add('内存中的内容', '张三')).not.toBeNull()
    expect(store.count).toBe(1)
    expect(store.writeFailed).toBe(true)
  })

  it('写入超限时保留内存数据并标记写入失败', () => {
    const { storage, state } = createFakeStorage()
    vi.stubGlobal('localStorage', storage)

    const store = usePostsStore()
    store.load()
    state.failWrites = true

    expect(store.add('写不进存储的内容', '张三')).not.toBeNull()
    expect(store.count).toBe(1)
    expect(store.writeFailed).toBe(true)
  })

  it('恢复正常写入后清除失败标记', () => {
    const { storage, state } = createFakeStorage()
    vi.stubGlobal('localStorage', storage)

    const store = usePostsStore()
    store.load()

    state.failWrites = true
    store.add('失败一次', '张三')
    expect(store.writeFailed).toBe(true)

    state.failWrites = false
    store.add('第二次成功', '张三')
    expect(store.writeFailed).toBe(false)

    const saved = JSON.parse(storage.snapshot()[STORAGE_KEYS.posts] ?? '[]') as Post[]
    expect(saved[0]?.content).toBe('第二次成功')
  })
})

describe('与领域模型的配合', () => {
  it('add 使用与 createPost 一致的规则', () => {
    const store = usePostsStore()
    store.load()

    const fromStore = store.add('同一条内容', '张三')
    const fromDomain = createPost({ content: '同一条内容', author: '张三' })

    expect(fromStore).toMatchObject({
      author: fromDomain?.author,
      content: fromDomain?.content,
      likes: 0,
      liked: false,
    })
  })
})
