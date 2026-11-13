<script setup lang="ts">
import { onMounted, onUnmounted, shallowRef, useTemplateRef } from 'vue'
import { DEFAULT_USER_NAME, inspectName } from '../lib/profile'

const props = defineProps<{ currentName: string }>()

const emit = defineEmits<{
  save: [name: string]
  close: []
}>()

const draft = shallowRef(props.currentName === DEFAULT_USER_NAME ? '' : props.currentName)
const error = shallowRef('')

const input = useTemplateRef<HTMLInputElement>('input')
const dialog = useTemplateRef<HTMLDivElement>('dialog')

let previouslyFocused: HTMLElement | null = null

onMounted(() => {
  previouslyFocused = document.activeElement as HTMLElement | null
  document.body.style.overflow = 'hidden'

  input.value?.focus()
  input.value?.select()
})

onUnmounted(() => {
  document.body.style.overflow = ''
  if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
    previouslyFocused.focus()
  }
  previouslyFocused = null
})

function save(): void {
  const result = inspectName(draft.value)
  if (!result.isValid) {
    error.value = result.error ?? ''
    input.value?.focus()
    return
  }

  emit('save', result.name)
}

function close(): void {
  emit('close')
}

function clearError(): void {
  error.value = ''
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }

  if (event.key !== 'Tab') return

  const focusables = Array.from(
    dialog.value?.querySelectorAll<HTMLElement>('button, input') ?? [],
  )
  if (!focusables.length) return

  const first = focusables[0]!
  const last = focusables[focusables.length - 1]!
  const active = document.activeElement

  if (event.shiftKey && active === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}
</script>

<template>
  <div class="modal">
    <div class="modal-backdrop" data-testid="nickname-backdrop" @click="close"></div>

    <div
      ref="dialog"
      class="modal-card"
      data-testid="nickname-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nickname-title"
      @keydown="handleKeydown"
    >
      <h2 id="nickname-title" class="modal-title">设置昵称</h2>
      <p class="modal-desc">昵称只保存在这台设备的浏览器里。</p>

      <label class="visually-hidden" for="nickname-input">昵称</label>
      <input
        id="nickname-input"
        ref="input"
        v-model="draft"
        type="text"
        class="modal-input"
        data-testid="nickname-input"
        placeholder="输入你的昵称"
        autocomplete="off"
        @input="clearError"
        @keydown.enter.prevent="save"
      />

      <p class="modal-error" data-testid="nickname-error" aria-live="polite">{{ error }}</p>

      <div class="modal-actions">
        <button
          type="button"
          class="btn btn-ghost"
          data-testid="nickname-cancel"
          @click="close"
        >
          取消
        </button>
        <button
          type="button"
          class="btn btn-primary"
          data-testid="nickname-save"
          @click="save"
        >
          保存
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 20px;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  animation: fade-in 160ms var(--ease) both;
}

.modal-card {
  position: relative;
  width: 100%;
  max-width: 360px;
  padding: 22px;
  border-radius: var(--r-lg);
  background: var(--c-surface);
  box-shadow: 0 24px 64px -16px rgba(17, 24, 39, 0.4);
  animation: modal-in 180ms var(--ease) both;
}

.modal-title {
  font-size: 17px;
  font-weight: 700;
}

.modal-desc {
  margin-top: 4px;
  font-size: 12.5px;
  color: var(--c-text-dim);
}

.modal-input {
  width: 100%;
  height: 44px;
  margin-top: 16px;
  padding: 0 14px;
  border: 1px solid var(--c-line);
  border-radius: var(--r-md);
  background: var(--c-bg);
  font-size: 14.5px;
  transition:
    border-color var(--t-fast) var(--ease),
    box-shadow var(--t-fast) var(--ease),
    background-color var(--t-fast) var(--ease);
}

.modal-input:focus,
.modal-input:focus-visible {
  outline: none;
  border-color: var(--c-primary-soft);
  background: #fff;
  box-shadow: var(--ring);
}

.modal-error {
  min-height: 18px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--c-danger);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 10px;
}

@media (max-width: 560px) {
  .modal-card {
    padding: 20px;
  }
}
</style>
