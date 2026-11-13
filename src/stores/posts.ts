import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, api, isNotFound } from '../lib/api'
import type { Post } from '../lib/post'

/** 展示顺序： createdAt 倒序（服务端已排序，这里做一次防御性归一）。 */
function sortByCreatedAtDesc(posts: readonly Post[]): Post[] {
  return [...posts].sort((a, b) => b.createdAt - a.createdAt)
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}

/**
 * 内容集合：唯一的服务端数据镜像。
 * 所有写操作都以服务端返回的数据为准；失败时不抛异常，只写 error 并返回失败值。
 */
export const usePostsStore = defineStore('posts', () => {
  const posts = ref<Post[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const count = computed(() => posts.value.length)

  async function load(signal?: AbortSignal): Promise<boolean> {
    loading.value = true
    try {
      posts.value = sortByCreatedAtDesc(await api.listPosts(signal))
      error.value = null
      return true
    } catch (err) {
      error.value = messageOf(err, '内容加载失败')
      return false
    } finally {
      loading.value = false
    }
  }

  /** 发布内容；id / createdAt / 作者归一化由服务端负责，这里只合并返回值。 */
  async function add(content: string, author: string): Promise<Post | null> {
    loading.value = true
    try {
      const created = await api.createPost({ content, author })
      posts.value = sortByCreatedAtDesc([created, ...posts.value])
      error.value = null
      return created
    } catch (err) {
      error.value = messageOf(err, '发布失败')
      return null
    } finally {
      loading.value = false
    }
  }

  /** 点赞/取消点赞：先把目标状态发给服务端，成功后用返回值替换本地项。 */
  async function toggleLike(id: string): Promise<boolean> {
    const current = posts.value.find((post) => post.id === id)
    if (!current) return false

    loading.value = true
    try {
      const updated = await api.setLike(id, !current.liked)
      posts.value = posts.value.map((post) => (post.id === id ? updated : post))
      error.value = null
      return true
    } catch (err) {
      error.value = messageOf(err, '点赞失败')
      return false
    } finally {
      loading.value = false
    }
  }

  /** 收藏/取消收藏：与点赞对称，成功后用服务端返回值替换本地项。 */
  async function toggleFavorite(id: string): Promise<boolean> {
    const current = posts.value.find((post) => post.id === id)
    if (!current) return false

    loading.value = true
    try {
      const updated = await api.setFavorite(id, !current.favorited)
      posts.value = posts.value.map((post) => (post.id === id ? updated : post))
      error.value = null
      return true
    } catch (err) {
      error.value = messageOf(err, '收藏失败')
      return false
    } finally {
      loading.value = false
    }
  }

  /** 删除内容；服务端返回 404 说明已被删除，视为成功。 */
  async function remove(id: string): Promise<boolean> {
    loading.value = true
    try {
      await api.deletePost(id)
      posts.value = posts.value.filter((post) => post.id !== id)
      error.value = null
      return true
    } catch (err) {
      if (isNotFound(err)) {
        posts.value = posts.value.filter((post) => post.id !== id)
        error.value = null
        return true
      }

      error.value = messageOf(err, '删除失败')
      return false
    } finally {
      loading.value = false
    }
  }

  return { posts, count, loading, error, load, add, toggleLike, toggleFavorite, remove }
})
