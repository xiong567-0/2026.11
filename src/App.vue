<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef, watch } from 'vue'
import AppHeader from './components/AppHeader.vue'
import AppToast from './components/AppToast.vue'
import NicknameDialog from './components/NicknameDialog.vue'
import PostComposer from './components/PostComposer.vue'
import PostFeed from './components/PostFeed.vue'
import { STORAGE_KEYS } from './lib/storage'
import { usePostsStore } from './stores/posts'
import { useToastStore } from './stores/toast'
import { useUserStore } from './stores/user'

const posts = usePostsStore()
const user = useUserStore()
const toast = useToastStore()

const nicknameOpen = shallowRef(false)

// 页面装配层负责两个数据源的初始化与跨功能协调
const loadResult = posts.load()
user.load()

if (!loadResult.storageAvailable) {
  toast.notify('浏览器已禁用本地存储，本次内容不会保留')
} else if (loadResult.status === 'corrupt') {
  toast.notify('本地数据读取失败，已临时使用空列表')
}

function publish(content: string): void {
  posts.add(content, user.name)
}

function deletePost(id: string): void {
  if (!window.confirm('确定删除这条内容吗？删除后无法恢复。')) return
  if (posts.remove(id)) toast.notify('已删除')
}

function openNickname(): void {
  nicknameOpen.value = true
}

function closeNickname(): void {
  nicknameOpen.value = false
}

function rename(name: string): void {
  const previous = user.name
  const result = user.rename(name)

  if (!result.ok) {
    toast.notify(result.error ?? '昵称保存失败')
    return
  }

  const changed = result.name !== previous
  if (changed) posts.renameAuthor(result.name)

  nicknameOpen.value = false
  toast.notify(changed ? '昵称已更新' : '昵称未变化')
}

watch(
  () => posts.writeFailed,
  (failed) => {
    if (failed) toast.notify('本地存储写入失败，内容可能无法保留')
  },
)

watch(
  () => user.writeFailed,
  (failed) => {
    if (failed) toast.notify('昵称保存失败，请检查浏览器存储权限')
  },
)

function syncFromOtherTabs(event: StorageEvent): void {
  if (event.key === STORAGE_KEYS.posts) {
    posts.load()
  } else if (event.key === STORAGE_KEYS.user) {
    user.load()
  }
}

onMounted(() => {
  window.addEventListener('storage', syncFromOtherTabs)
})

onUnmounted(() => {
  window.removeEventListener('storage', syncFromOtherTabs)
})
</script>

<template>
  <a class="skip-link" href="#feed">跳到内容</a>

  <AppHeader :user-name="user.name" @edit="openNickname" />

  <main class="shell">
    <PostComposer :author-name="user.name" @publish="publish" />
    <PostFeed :posts="posts.posts" @like="posts.toggleLike" @delete="deletePost" />
  </main>

  <footer class="app-footer">
    <p>内容仅保存在本机浏览器 · 微语</p>
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
