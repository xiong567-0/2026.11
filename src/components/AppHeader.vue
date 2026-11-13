<script setup lang="ts">
import { computed } from 'vue'
import { initialOf } from '../lib/text'

const props = defineProps<{ userName: string }>()

const emit = defineEmits<{
  edit: []
}>()

const initial = computed(() => initialOf(props.userName))
const chipTitle = computed(() => `当前昵称：${props.userName}，点击修改`)
</script>

<template>
  <header class="app-header">
    <div class="header-inner">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" width="20" height="20" fill="none">
            <path
              d="M15.6 7.6c.7 4 2.9 6.2 6.8 6.9-3.9.7-6.1 2.9-6.8 6.9-.7-4-2.9-6.2-6.8-6.9 3.9-.7 6.1-2.9 6.8-6.9Z"
              fill="currentColor"
            />
            <circle cx="23.6" cy="9.4" r="1.5" fill="currentColor" opacity="0.85" />
          </svg>
        </span>
        <span class="brand-text">
          <span class="brand-name">微语</span>
          <span class="brand-sub">Micro Posts</span>
        </span>
      </div>

      <button
        type="button"
        class="user-chip"
        data-testid="user-chip"
        aria-haspopup="dialog"
        :title="chipTitle"
        @click="emit('edit')"
      >
        <span class="avatar avatar-sm" data-testid="user-avatar" aria-hidden="true">
          {{ initial }}
        </span>
        <span class="user-name" data-testid="user-name">{{ userName }}</span>
        <svg class="user-chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path
            d="M4 6.5 8 10.5l4-4"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: sticky;
  top: 0;
  z-index: 30;
  background: rgba(255, 255, 255, 0.72);
  border-bottom: 1px solid rgba(17, 24, 39, 0.06);
  -webkit-backdrop-filter: blur(14px) saturate(160%);
  backdrop-filter: blur(14px) saturate(160%);
}

.header-inner {
  max-width: var(--shell);
  height: var(--header-h);
  margin: 0 auto;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 11px;
  background: var(--c-gradient);
  color: #fff;
  box-shadow: 0 6px 16px -6px rgba(99, 102, 241, 0.75);
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.brand-name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.brand-sub {
  font-size: 10.5px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--c-text-dim);
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px 0 6px;
  border-radius: var(--r-full);
  border: 1px solid var(--c-line);
  background: rgba(255, 255, 255, 0.9);
  color: var(--c-text-mid);
  transition:
    border-color var(--t-fast) var(--ease),
    box-shadow var(--t-fast) var(--ease),
    transform var(--t-fast) var(--ease),
    color var(--t-fast) var(--ease);
}

.user-chip:hover {
  border-color: rgba(99, 102, 241, 0.45);
  color: var(--c-text);
  box-shadow: var(--shadow-sm);
  transform: translateY(-1px);
}

.user-name {
  max-width: 120px;
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--c-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-chevron {
  color: var(--c-text-dim);
}

@media (max-width: 768px) {
  .header-inner {
    padding: 0 16px;
  }

  .app-header {
    background: rgba(255, 255, 255, 0.82);
  }
}

@media (max-width: 560px) {
  .brand-name {
    font-size: 16.5px;
  }

  .brand-sub {
    display: none;
  }

  .user-name {
    display: none;
  }

  .user-chip {
    height: 38px;
    padding: 0 8px 0 5px;
    gap: 2px;
  }

  .user-chevron {
    display: none;
  }
}
</style>
