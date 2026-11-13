import type { Post } from '../src/lib/post'
import { DEFAULT_USER_NAME } from '../src/lib/profile'

export interface MemoryStoreSeed {
  posts?: Post[]
  name?: string
}

export interface MemoryStore {
  /** 按 createdAt 倒序返回副本，外部改动不会污染内部数据 */
  listPosts(): Post[]
  findPost(id: string): Post | null
  addPost(post: Post): void
  /** 幂等切换点赞状态；id 不存在时返回 null */
  setLiked(id: string, liked: boolean): Post | null
  removePost(id: string): boolean
  /** 同时更新昵称与所有历史内容的作者 */
  renameAuthor(name: string): void
  getProfileName(): string
  setProfileName(name: string): void
}

function copyPost(post: Post): Post {
  return { ...post }
}

/** 进程内存储；多个实例之间完全隔离，重启即清空。 */
export function createMemoryStore(seed: MemoryStoreSeed = {}): MemoryStore {
  const posts = new Map<string, Post>()
  let profileName = seed.name ?? DEFAULT_USER_NAME

  for (const post of seed.posts ?? []) {
    posts.set(post.id, copyPost(post))
  }

  return {
    listPosts() {
      return Array.from(posts.values())
        .map(copyPost)
        .sort((a, b) => b.createdAt - a.createdAt)
    },

    findPost(id) {
      const post = posts.get(id)
      return post ? copyPost(post) : null
    },

    addPost(post) {
      posts.set(post.id, copyPost(post))
    },

    setLiked(id, liked) {
      const current = posts.get(id)
      if (!current) return null

      if (current.liked === liked) return copyPost(current)

      const next: Post = {
        ...current,
        liked,
        likes: liked ? current.likes + 1 : Math.max(0, current.likes - 1),
      }
      posts.set(id, next)
      return copyPost(next)
    },

    removePost(id) {
      return posts.delete(id)
    },

    renameAuthor(name) {
      profileName = name
      for (const [id, post] of posts) {
        if (post.author === name) continue
        posts.set(id, { ...post, author: name })
      }
    },

    getProfileName() {
      return profileName
    },

    setProfileName(name) {
      profileName = name
    },
  }
}
