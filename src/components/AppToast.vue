<script setup lang="ts">
import { useToastStore } from '../stores/toast'

const toast = useToastStore()
</script>

<template>
  <div
    class="toast"
    data-testid="toast"
    role="status"
    aria-live="polite"
    :class="{ 'is-visible': toast.visible }"
  >
    {{ toast.message }}
  </div>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  z-index: 60;
  max-width: calc(100vw - 32px);
  padding: 10px 18px;
  border-radius: var(--r-full);
  background: rgba(17, 24, 39, 0.9);
  color: #fff;
  font-size: 13px;
  box-shadow: 0 12px 32px -12px rgba(17, 24, 39, 0.7);
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 12px);
  transition:
    opacity 200ms var(--ease),
    transform 200ms var(--ease);
}

.toast.is-visible {
  opacity: 1;
  transform: translate(-50%, 0);
}
</style>
