import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createPost,
  parseStoredPosts,
  serializePosts,
  type Post,
  type StoredPostsStatus,
} from '../lib/post'
import { STORAGE_KEYS, createStorageAdapter, resolveLocalStorage } from '../lib/storage'

export interface LoadPostsResult {
  /** ok：读取到数据；empty：没有历史数据；corrupt：数据损坏（保留原始值不覆盖） */
  status: StoredPostsStatus
  storageAvailable: boolean
}

/**
 * 内容集合：唯一数据源，所有写操作先改状态再尽力持久化。
 * 存储不可用时退化为纯内存运行，并通过 writeFailed 暴露写入失败。
 */
export const usePostsStore = defineStore('posts', () => {
  const adapter = createStorageAdapter(resolveLocalStorage())
  const storageAvailable = adapter.available

  const posts = ref<Post[]>([])
  const writeFailed = ref(false)

  const count = computed(() => posts.value.length)

  function persist(): boolean {
    const ok = adapter.write(STORAGE_KEYS.posts, serializePosts(posts.value))
    writeFailed.value = !ok
    return ok
  }

  function load(): LoadPostsResult {
    const result = parseStoredPosts(adapter.read(STORAGE_KEYS.posts))
    posts.value = result.posts
    return { status: result.status, storageAvailable }
  }

  function add(content: string, author: string): Post | null {
    const post = createPost({ content, author })
    if (!post) return null

    posts.value = [post, ...posts.value]
    persist()
    return post
  }

  function toggleLike(id: string): boolean {
    const index = posts.value.findIndex((post) => post.id === id)
    if (index === -1) return false

    const post = posts.value[index]!
    const liked = !post.liked
    posts.value[index] = {
      ...post,
      liked,
      likes: Math.max(0, post.likes + (liked ? 1 : -1)),
    }
    persist()
    return true
  }

  function remove(id: string): boolean {
    const next = posts.value.filter((post) => post.id !== id)
    if (next.length === posts.value.length) return false

    posts.value = next
    persist()
    return true
  }

  /** 昵称修改后同步历史内容的作者名（与旧版本行为保持一致）。 */
  function renameAuthor(name: string): void {
    if (!posts.value.length) return

    posts.value = posts.value.map((post) => ({ ...post, author: name }))
    persist()
  }

  return {
    posts,
    count,
    storageAvailable,
    writeFailed,
    load,
    add,
    toggleLike,
    remove,
    renameAuthor,
  }
})
