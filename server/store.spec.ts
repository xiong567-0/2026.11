// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Post } from '../src/lib/post'
import { DEFAULT_USER_NAME } from '../src/lib/profile'
import { createMemoryStore } from './store'

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p1',
    author: '张三',
    content: '第一条',
    likes: 0,
    liked: false,
    favorites: 0,
    favorited: false,
    createdAt: 1_000,
    ...overrides,
  }
}

describe('createMemoryStore 初始状态', () => {
  it('空 store：没有内容，昵称为默认值', () => {
    const store = createMemoryStore()

    expect(store.listPosts()).toEqual([])
    expect(store.getProfileName()).toBe(DEFAULT_USER_NAME)
  })

  it('支持 seed 注入初始内容与昵称', () => {
    const store = createMemoryStore({
      posts: [makePost({ id: 'a' }), makePost({ id: 'b', createdAt: 2_000 })],
      name: '李四',
    })

    expect(store.listPosts().map((post) => post.id)).toEqual(['b', 'a'])
    expect(store.getProfileName()).toBe('李四')
  })
})

describe('listPosts', () => {
  it('按 createdAt 倒序返回', () => {
    const store = createMemoryStore({
      posts: [
        makePost({ id: 'mid', createdAt: 200 }),
        makePost({ id: 'old', createdAt: 100 }),
        makePost({ id: 'new', createdAt: 300 }),
      ],
    })

    expect(store.listPosts().map((post) => post.id)).toEqual(['new', 'mid', 'old'])
  })

  it('返回数组副本：调用方改动数组不影响内部数据', () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'a' })] })

    const first = store.listPosts()
    first.pop()
    first.push(makePost({ id: 'injected' }))

    expect(store.listPosts().map((post) => post.id)).toEqual(['a'])
  })

  it('返回元素副本：改动元素字段不会污染内部数据', () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'a', likes: 0 })] })

    const [post] = store.listPosts()
    post.likes = 99
    post.content = '被改坏'

    const [fresh] = store.listPosts()
    expect(fresh.likes).toBe(0)
    expect(fresh.content).toBe('第一条')
  })
})

describe('addPost / findPost', () => {
  it('新增后可以查到，并且出现在列表中', () => {
    const store = createMemoryStore()
    store.addPost(makePost({ id: 'a', createdAt: 500 }))

    expect(store.findPost('a')).toEqual(makePost({ id: 'a', createdAt: 500 }))
    expect(store.listPosts()).toHaveLength(1)
  })

  it('findPost 找不到时返回 null', () => {
    const store = createMemoryStore()

    expect(store.findPost('missing')).toBeNull()
  })

  it('findPost 返回副本', () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'a', likes: 2 })] })

    const found = store.findPost('a')
    if (!found) throw new Error('应当找到内容')
    found.likes = 100

    expect(store.findPost('a')?.likes).toBe(2)
  })

  it('addPost 存副本：外部继续改动入参不影响内部数据', () => {
    const store = createMemoryStore()
    const draft = makePost({ id: 'a', likes: 0 })
    store.addPost(draft)

    draft.likes = 88

    expect(store.findPost('a')?.likes).toBe(0)
  })

  it('同 id 再次 addPost 时以新数据覆盖（保持唯一）', () => {
    const store = createMemoryStore()
    store.addPost(makePost({ id: 'a', content: '旧' }))
    store.addPost(makePost({ id: 'a', content: '新' }))

    expect(store.listPosts()).toHaveLength(1)
    expect(store.findPost('a')?.content).toBe('新')
  })
})

describe('setLiked', () => {
  it('点赞时 likes + 1 并置 liked 为 true', () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'a', likes: 3, liked: false })] })

    const updated = store.setLiked('a', true)

    expect(updated).toEqual(makePost({ id: 'a', likes: 4, liked: true }))
    expect(store.findPost('a')?.likes).toBe(4)
  })

  it('重复点赞是幂等的：likes 不再增加', () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'a', likes: 4, liked: true })] })

    store.setLiked('a', true)
    const again = store.setLiked('a', true)

    expect(again?.likes).toBe(4)
    expect(store.findPost('a')?.likes).toBe(4)
  })

  it('取消点赞时 likes - 1 并置 liked 为 false', () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'a', likes: 4, liked: true })] })

    const updated = store.setLiked('a', false)

    expect(updated).toEqual(makePost({ id: 'a', likes: 3, liked: false }))
  })

  it('重复取消点赞是幂等的：likes 不再减少', () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'a', likes: 3, liked: false })] })

    store.setLiked('a', false)
    const again = store.setLiked('a', false)

    expect(again?.likes).toBe(3)
  })

  it('likes 不会被减成负数', () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'a', likes: 1, liked: true })] })

    store.setLiked('a', false)
    const updated = store.setLiked('a', false)

    expect(updated?.likes).toBe(0)
    expect(updated?.liked).toBe(false)
  })

  it('id 不存在时返回 null', () => {
    const store = createMemoryStore()

    expect(store.setLiked('missing', true)).toBeNull()
  })
})

describe('setFavorited', () => {
  it('收藏时 favorites + 1 并置 favorited 为 true', () => {
    const store = createMemoryStore({
      posts: [makePost({ id: 'a', favorites: 2, favorited: false })],
    })

    const updated = store.setFavorited('a', true)

    expect(updated).toEqual(makePost({ id: 'a', favorites: 3, favorited: true }))
    expect(store.findPost('a')?.favorites).toBe(3)
  })

  it('重复收藏是幂等的：favorites 不再增加', () => {
    const store = createMemoryStore({
      posts: [makePost({ id: 'a', favorites: 3, favorited: true })],
    })

    store.setFavorited('a', true)
    const again = store.setFavorited('a', true)

    expect(again?.favorites).toBe(3)
    expect(store.findPost('a')?.favorites).toBe(3)
  })

  it('取消收藏时 favorites - 1 并置 favorited 为 false', () => {
    const store = createMemoryStore({
      posts: [makePost({ id: 'a', favorites: 3, favorited: true })],
    })

    const updated = store.setFavorited('a', false)

    expect(updated).toEqual(makePost({ id: 'a', favorites: 2, favorited: false }))
  })

  it('重复取消收藏是幂等的：favorites 不再减少', () => {
    const store = createMemoryStore({
      posts: [makePost({ id: 'a', favorites: 2, favorited: false })],
    })

    store.setFavorited('a', false)
    const again = store.setFavorited('a', false)

    expect(again?.favorites).toBe(2)
  })

  it('favorites 不会被减成负数', () => {
    const store = createMemoryStore({
      posts: [makePost({ id: 'a', favorites: 1, favorited: true })],
    })

    store.setFavorited('a', false)
    const updated = store.setFavorited('a', false)

    expect(updated?.favorites).toBe(0)
    expect(updated?.favorited).toBe(false)
  })

  it('不影响点赞相关字段', () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'a', likes: 5, liked: true })] })

    store.setFavorited('a', true)

    expect(store.findPost('a')).toEqual(makePost({ id: 'a', likes: 5, liked: true, favorites: 1, favorited: true }))
  })

  it('返回副本：调用方改动返回值不影响内部数据', () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'a' })] })

    const updated = store.setFavorited('a', true)
    if (!updated) throw new Error('应当找到内容')
    updated.favorites = 99

    expect(store.findPost('a')?.favorites).toBe(1)
  })

  it('id 不存在时返回 null', () => {
    const store = createMemoryStore()

    expect(store.setFavorited('missing', true)).toBeNull()
  })

  it('多个实例之间的收藏状态互不影响', () => {
    const first = createMemoryStore({ posts: [makePost({ id: 'a' })] })
    const second = createMemoryStore({ posts: [makePost({ id: 'a' })] })

    first.setFavorited('a', true)

    expect(first.findPost('a')).toMatchObject({ favorited: true, favorites: 1 })
    expect(second.findPost('a')).toMatchObject({ favorited: false, favorites: 0 })
  })
})

describe('removePost', () => {
  it('删除成功返回 true 且列表不再包含', () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'a' })] })

    expect(store.removePost('a')).toBe(true)
    expect(store.findPost('a')).toBeNull()
    expect(store.listPosts()).toEqual([])
  })

  it('删除不存在的 id 返回 false', () => {
    const store = createMemoryStore()

    expect(store.removePost('missing')).toBe(false)
  })
})

describe('profile 与 renameAuthor', () => {
  it('setProfileName / getProfileName 生效', () => {
    const store = createMemoryStore()

    store.setProfileName('王五')

    expect(store.getProfileName()).toBe('王五')
  })

  it('renameAuthor 同步更新昵称与所有历史内容的作者', () => {
    const store = createMemoryStore({
      posts: [
        makePost({ id: 'a', author: '张三' }),
        makePost({ id: 'b', author: '访客', createdAt: 2_000 }),
      ],
      name: '张三',
    })

    store.renameAuthor('新昵称')

    expect(store.getProfileName()).toBe('新昵称')
    expect(store.listPosts().map((post) => post.author)).toEqual(['新昵称', '新昵称'])
  })

  it('renameAuthor 不影响其他字段', () => {
    const store = createMemoryStore({ posts: [makePost({ id: 'a', likes: 5, liked: true })] })

    store.renameAuthor('新昵称')

    expect(store.findPost('a')).toEqual(
      makePost({ id: 'a', author: '新昵称', likes: 5, liked: true }),
    )
  })
})

describe('实例隔离', () => {
  it('两个 store 之间数据完全隔离', () => {
    const first = createMemoryStore({ posts: [makePost({ id: 'a' })], name: '甲' })
    const second = createMemoryStore()

    second.addPost(makePost({ id: 'b' }))
    second.setProfileName('乙')

    expect(first.listPosts().map((post) => post.id)).toEqual(['a'])
    expect(first.getProfileName()).toBe('甲')
    expect(second.listPosts().map((post) => post.id)).toEqual(['b'])
    expect(second.getProfileName()).toBe('乙')
  })

  it('seed 的 posts 数组与 store 内部数据隔离', () => {
    const seed = [makePost({ id: 'a', likes: 0 })]
    const store = createMemoryStore({ posts: seed })

    seed.push(makePost({ id: 'b' }))
    seed[0].likes = 42

    expect(store.listPosts().map((post) => post.id)).toEqual(['a'])
    expect(store.findPost('a')?.likes).toBe(0)
  })
})
