<script setup lang="ts">
import { onMounted, shallowRef } from 'vue'
import AppHeader from './components/AppHeader.vue'
import AppToast from './components/AppToast.vue'
import NicknameDialog from './components/NicknameDialog.vue'
import PostComposer from './components/PostComposer.vue'
import PostFeed from './components/PostFeed.vue'
import { usePostsStore } from './stores/posts'
import { useToastStore } from './stores/toast'
import { useUserStore } from './stores/user'

const posts = usePostsStore()
const user = useUserStore()
const toast = useToastStore()

const nicknameOpen = shallowRef(false)

/**
 * 装配层只负责初始化与跨功能协调：数据以服务端为准。
 * 初始化失败时只提示一条可读文案（列表失败优先，避免两条相同错误重复弹出）。
 */
onMounted(async () => {
  const [postsLoaded, userLoaded] = await Promise.all([posts.load(), user.load()])

  if (!postsLoaded) {
    toast.notify(posts.error ?? '内容加载失败，请确认后端服务已启动')
    return
  }

  if (!userLoaded) toast.notify(user.error ?? '昵称加载失败')
})

async function publish(content: string): Promise<void> {
  const created = await posts.add(content, user.name)
  if (!created) toast.notify(posts.error ?? '发布失败，请重试')
}

async function deletePost(id: string): Promise<void> {
  if (!window.confirm('确定删除这条内容吗？删除后无法恢复。')) return

  if (await posts.remove(id)) {
    toast.notify('已删除')
    return
  }

  toast.notify(posts.error ?? '删除失败，请重试')
}

async function likePost(id: string): Promise<void> {
  if (!(await posts.toggleLike(id))) toast.notify(posts.error ?? '点赞失败，请重试')
}

async function favoritePost(id: string): Promise<void> {
  if (!(await posts.toggleFavorite(id))) {
    toast.notify(posts.error ?? '收藏失败，请重试')
    return
  }

  // 提示语取决于操作后的服务端状态
  const favorited = posts.posts.find((post) => post.id === id)?.favorited
  toast.notify(favorited ? '已收藏' : '已取消收藏')
}

function openNickname(): void {
  nicknameOpen.value = true
}

function closeNickname(): void {
  nicknameOpen.value = false
}

async function rename(name: string): Promise<void> {
  const previous = user.name
  const result = await user.rename(name)

  if (!result.ok) {
    toast.notify(result.error ?? '昵称保存失败')
    return
  }

  nicknameOpen.value = false

  if (result.name === previous) {
    toast.notify('昵称未变化')
    return
  }

  // 服务端会同步改写全部历史内容的作者，这里重新拉取以保证前端与服务端一致
  const synced = await posts.load()
  toast.notify(synced ? '昵称已更新' : (posts.error ?? '内容同步失败，请刷新页面重试'))
}
</script>

<template>
  <a class="skip-link" href="#feed">跳到内容</a>

  <AppHeader :user-name="user.name" @edit="openNickname" />

  <main class="shell">
    <PostComposer
      :author-name="user.name"
      :publishing="posts.loading"
      @publish="publish"
    />
    <PostFeed
      :posts="posts.posts"
      :loading="posts.loading"
      @like="likePost"
      @favorite="favoritePost"
      @delete="deletePost"
    />
  </main>

  <footer class="app-footer">
    <p>内容保存在服务端内存中 · 微语</p>
  </footer>

  <NicknameDialog
    v-if="nicknameOpen"
    :current-name="user.name"
    @save="rename"
    @close="closeNickname"
  />

  <AppToast />
</template>

<style scoped>
.shell {
  width: 100%;
  max-width: var(--shell);
  margin: 0 auto;
  padding: 22px 4px 8px;
  flex: 1 0 auto;
}

.app-footer {
  padding: 20px 16px 28px;
  text-align: center;
  font-size: 12px;
  color: var(--c-text-dim);
}

@media (max-width: 768px) {
  .shell {
    padding: 18px 16px 8px;
  }
}
</style>
