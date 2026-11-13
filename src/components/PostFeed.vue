<script setup lang="ts">
import { computed } from 'vue'
import { useNow } from '../composables/useNow'
import type { Post } from '../lib/post'
import PostCard from './PostCard.vue'

const props = defineProps<{ posts: Post[] }>()

const emit = defineEmits<{
  like: [id: string]
  delete: [id: string]
}>()

const { now } = useNow()
const countLabel = computed(() => `${props.posts.length} 条`)
</script>

<template>
  <section id="feed" class="feed-section" aria-labelledby="feed-title">
    <div class="feed-head">
      <h2 id="feed-title" class="feed-title">最新动态</h2>
      <span class="feed-count" data-testid="feed-count">{{ countLabel }}</span>
    </div>

    <TransitionGroup v-if="posts.length" name="post" tag="div" class="feed">
      <PostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
        :now="now"
        @like="emit('like', $event)"
        @delete="emit('delete', $event)"
      />
    </TransitionGroup>

    <div v-else class="feed-empty" data-testid="feed-empty">
      <svg class="empty-icon" viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
        <rect x="10" y="14" width="44" height="32" rx="10" stroke="currentColor" stroke-width="2.4" />
        <path d="M20 26h20M20 34h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        <circle cx="46" cy="46" r="7" fill="#EEF0F8" stroke="currentColor" stroke-width="2.4" />
      </svg>
      <p class="empty-title">还没有内容</p>
      <p class="empty-desc">在顶部写下第一条想法吧</p>
    </div>
  </section>
</template>

<style scoped>
.feed-section {
  margin-top: 26px;
}

.feed-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 0 4px 12px;
}

.feed-title {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--c-text);
}

.feed-title::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 8px;
  border-radius: 50%;
  background: var(--c-gradient);
  vertical-align: 2px;
}

.feed-count {
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  color: var(--c-text-dim);
}

.feed {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feed-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 16px 56px;
  text-align: center;
  color: var(--c-text-dim);
}

.empty-icon {
  color: #c7cadb;
  margin-bottom: 14px;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--c-text-mid);
}

.empty-desc {
  margin-top: 4px;
  font-size: 13px;
  color: var(--c-text-dim);
}

@media (max-width: 560px) {
  .feed-section {
    margin-top: 22px;
  }
}
</style>
