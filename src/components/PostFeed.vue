<script setup lang="ts">
import { computed, ref } from 'vue'
import { useNow } from '../composables/useNow'
import type { Post } from '../lib/post'
import PostCard from './PostCard.vue'

const props = withDefaults(
  defineProps<{
    posts: Post[]
    /** 首次加载中：列表为空时展示加载态而不是空状态 */
    loading?: boolean
  }>(),
  { loading: false },
)

const emit = defineEmits<{
  like: [id: string]
  favorite: [id: string]
  delete: [id: string]
}>()

type FeedFilter = 'all' | 'favorites'

const { now } = useNow()

/** 筛选只影响展示，不改动传入的 posts。 */
const filter = ref<FeedFilter>('all')
const showingFavorites = computed(() => filter.value === 'favorites')
const visiblePosts = computed(() =>
  showingFavorites.value ? props.posts.filter((post) => post.favorited) : props.posts,
)
const countLabel = computed(() => `${visiblePosts.value.length} 条`)
const emptyTitle = computed(() => (showingFavorites.value ? '还没有收藏的内容' : '还没有内容'))
const emptyDesc = computed(() =>
  showingFavorites.value ? '点击卡片上的书签即可收藏' : '在顶部写下第一条想法吧',
)
</script>

<template>
  <section id="feed" class="feed-section" aria-labelledby="feed-title">
    <div class="feed-head">
      <h2 id="feed-title" class="feed-title">最新动态</h2>

      <div class="feed-head-side">
        <div class="feed-filter" role="group" aria-label="筛选内容">
          <button
            type="button"
            class="filter-btn"
            data-testid="feed-filter-all"
            :class="{ 'is-active': filter === 'all' }"
            :aria-pressed="filter === 'all'"
            @click="filter = 'all'"
          >
            全部
          </button>
          <button
            type="button"
            class="filter-btn"
            data-testid="feed-filter-favorites"
            :class="{ 'is-active': showingFavorites }"
            :aria-pressed="showingFavorites"
            @click="filter = 'favorites'"
          >
            收藏
          </button>
        </div>

        <span class="feed-count" data-testid="feed-count">{{ countLabel }}</span>
      </div>
    </div>

    <TransitionGroup v-if="visiblePosts.length" name="post" tag="div" class="feed">
      <PostCard
        v-for="post in visiblePosts"
        :key="post.id"
        :post="post"
        :now="now"
        @like="emit('like', $event)"
        @favorite="emit('favorite', $event)"
        @delete="emit('delete', $event)"
      />
    </TransitionGroup>

    <div v-else-if="loading" class="feed-loading" data-testid="feed-loading" role="status">
      <span class="loading-dot" aria-hidden="true"></span>
      <p class="loading-text">正在加载内容…</p>
    </div>

    <div v-else class="feed-empty" data-testid="feed-empty">
      <svg class="empty-icon" viewBox="0 0 64 64" width="64" height="64" fill="none" aria-hidden="true">
        <rect x="10" y="14" width="44" height="32" rx="10" stroke="currentColor" stroke-width="2.4" />
        <path d="M20 26h20M20 34h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        <circle cx="46" cy="46" r="7" fill="#EEF0F8" stroke="currentColor" stroke-width="2.4" />
      </svg>
      <p class="empty-title">{{ emptyTitle }}</p>
      <p class="empty-desc">{{ emptyDesc }}</p>
    </div>
  </section>
</template>

<style scoped>
.feed-section {
  margin-top: 26px;
}

.feed-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px 12px;
  padding: 0 4px 12px;
}

.feed-head-side {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: auto;
}

.feed-filter {
  display: inline-flex;
  flex: none;
  gap: 2px;
  padding: 2px;
  border-radius: var(--r-full);
  background: var(--c-surface-soft);
}

.filter-btn {
  height: 26px;
  padding: 0 11px;
  border-radius: var(--r-full);
  font-size: 12.5px;
  font-weight: 500;
  color: var(--c-text-dim);
  white-space: nowrap;
  transition:
    color var(--t-fast) var(--ease),
    background-color var(--t-fast) var(--ease),
    box-shadow var(--t-fast) var(--ease);
}

.filter-btn:hover {
  color: var(--c-text-mid);
}

.filter-btn.is-active {
  color: var(--c-text);
  font-weight: 600;
  background: var(--c-surface);
  box-shadow: var(--shadow-sm);
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

.feed-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 52px 16px 60px;
  color: var(--c-text-dim);
}

.loading-dot {
  width: 22px;
  height: 22px;
  border: 2.4px solid var(--c-line);
  border-top-color: var(--c-primary-soft);
  border-radius: 50%;
  animation: feed-spin 760ms linear infinite;
}

.loading-text {
  font-size: 13px;
}

@keyframes feed-spin {
  to {
    transform: rotate(360deg);
  }
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

  .feed-head {
    gap: 8px;
  }

  .feed-head-side {
    gap: 8px;
  }

  .filter-btn {
    height: 30px;
    padding: 0 12px;
  }
}
</style>
