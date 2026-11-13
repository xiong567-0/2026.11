<script setup lang="ts">
import { computed } from 'vue'
import type { Post } from '../lib/post'
import { initialOf } from '../lib/text'
import { formatFullTime, formatRelativeTime } from '../lib/time'

const props = defineProps<{
  post: Post
  /** 当前时间戳，由列表统一提供，便于测试与定时刷新 */
  now: number
}>()

const emit = defineEmits<{
  like: [id: string]
  favorite: [id: string]
  delete: [id: string]
}>()

const initial = computed(() => initialOf(props.post.author))
const relativeTime = computed(() => formatRelativeTime(props.post.createdAt, props.now))
const fullTime = computed(() => formatFullTime(props.post.createdAt))
const isoTime = computed(() => new Date(props.post.createdAt).toISOString())
const likeLabel = computed(() => (props.post.liked ? '取消点赞' : '点赞'))
const favoriteLabel = computed(() => (props.post.favorited ? '取消收藏' : '收藏'))
</script>

<template>
  <article class="post" data-testid="post">
    <div class="avatar" data-testid="post-avatar" aria-hidden="true">{{ initial }}</div>

    <div class="post-body">
      <header class="post-head">
        <span class="post-author" data-testid="post-author">{{ post.author }}</span>
        <time class="post-time" :datetime="isoTime" :title="fullTime">{{ relativeTime }}</time>
      </header>

      <p class="post-content" data-testid="post-content">{{ post.content }}</p>

      <footer class="post-actions">
        <button
          type="button"
          class="action action-favorite"
          data-testid="post-favorite"
          :class="{ 'is-favorited': post.favorited }"
          :aria-pressed="post.favorited ? 'true' : 'false'"
          :aria-label="favoriteLabel"
          @click="emit('favorite', post.id)"
        >
          <svg
            class="icon-bookmark"
            viewBox="0 0 20 20"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
          >
            <path
              d="M5.6 3.4h8.8a1 1 0 0 1 1 1v12.1l-5.4-3.6-5.4 3.6V4.4a1 1 0 0 1 1-1Z"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="favorite-count" data-testid="favorite-count">{{ post.favorites }}</span>
        </button>

        <button
          type="button"
          class="action action-like"
          data-testid="post-like"
          :class="{ 'is-liked': post.liked }"
          :aria-pressed="post.liked ? 'true' : 'false'"
          :aria-label="likeLabel"
          @click="emit('like', post.id)"
        >
          <svg
            class="icon-heart"
            viewBox="0 0 20 20"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            aria-hidden="true"
          >
            <path
              d="M10 16.2S3.4 12.5 3.4 8.1a3.7 3.7 0 0 1 6.6-2.3 3.7 3.7 0 0 1 6.6 2.3c0 4.4-6.6 8.1-6.6 8.1Z"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="like-count" data-testid="like-count">{{ post.likes }}</span>
        </button>

        <button
          type="button"
          class="action action-delete"
          data-testid="post-delete"
          aria-label="删除这条内容"
          @click="emit('delete', post.id)"
        >
          删除
        </button>
      </footer>
    </div>
  </article>
</template>

<style scoped>
.post {
  display: flex;
  gap: 12px;
  padding: 18px;
  border: 1px solid rgba(17, 24, 39, 0.05);
  border-radius: var(--r-lg);
  background: var(--c-surface);
  box-shadow: var(--shadow-sm);
  transition:
    box-shadow var(--t-fast) var(--ease),
    transform var(--t-fast) var(--ease),
    border-color var(--t-fast) var(--ease);
}

.post:hover {
  border-color: rgba(99, 102, 241, 0.2);
  box-shadow: var(--shadow-md);
}

.post-body {
  flex: 1;
  min-width: 0;
}

.post-head {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.post-author {
  font-size: 14.5px;
  font-weight: 600;
  color: var(--c-text);
  overflow-wrap: anywhere;
}

.post-time {
  font-size: 12.5px;
  color: var(--c-text-dim);
  font-variant-numeric: tabular-nums;
}

.post-content {
  font-size: 15px;
  line-height: 1.72;
  color: var(--c-text);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.post-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(17, 24, 39, 0.055);
}

.action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 9px;
  border-radius: var(--r-full);
  font-size: 12.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  color: var(--c-text-dim);
  transition:
    color var(--t-fast) var(--ease),
    background-color var(--t-fast) var(--ease);
}

.action:hover {
  background: var(--c-surface-soft);
  color: var(--c-text-mid);
}

.action-like:hover {
  color: var(--c-like);
}

.action-like.is-liked {
  color: var(--c-like);
}

.action-like.is-liked .icon-heart {
  fill: currentColor;
  stroke: currentColor;
  animation: heart-pop 320ms var(--ease);
}

.action-favorite:hover {
  color: var(--c-favorite);
}

.action-favorite.is-favorited {
  color: var(--c-favorite);
}

.action-favorite.is-favorited .icon-bookmark {
  fill: currentColor;
  stroke: currentColor;
  animation: bookmark-pop 320ms var(--ease);
}

@keyframes bookmark-pop {
  0% {
    transform: scale(1);
  }
  45% {
    transform: scale(1.28);
  }
  100% {
    transform: scale(1);
  }
}

.action-delete:hover {
  color: var(--c-danger);
  background: rgba(239, 68, 68, 0.08);
}

@media (max-width: 560px) {
  .post {
    padding: 14px;
    gap: 10px;
  }

  .post-content {
    font-size: 14.5px;
  }

  .action {
    height: 36px;
  }
}
</style>
