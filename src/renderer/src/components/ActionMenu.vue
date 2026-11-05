<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import UiIcon from './UiIcon.vue'
withDefaults(defineProps<{ label?: string; disabled?: boolean }>(), { label: '更多操作' })
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const position = ref({ top: '0px', left: '0px' })
function close(restore = false) { open.value = false; if (restore) trigger.value?.focus() }
async function toggle() {
  if (open.value) { close(); return }
  const box = trigger.value!.getBoundingClientRect()
  position.value = { top: `${box.bottom + 6}px`, left: `${Math.max(8, Math.min(box.right - 224, innerWidth - 232))}px` }
  open.value = true
  await nextTick()
  const height = panel.value!.getBoundingClientRect().height
  if (box.bottom + height + 14 > innerHeight) position.value.top = `${Math.max(8, box.top - height - 6)}px`
  panel.value?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus()
}
function keys(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.stopPropagation(); event.preventDefault(); close(true); return }
  const buttons = Array.from(panel.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])
  if (!buttons.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault(); event.stopPropagation()
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length
  buttons[next]?.focus()
}
function outside(event: Event) { if (!root.value?.contains(event.target as Node)) close() }
// focusout runs before the next control receives focus. activeElement may still
// be body here; relatedTarget identifies the actual destination reliably.
function focusOut(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null)) close()
}
function select(event: MouseEvent) {
  if (!(event.target as Element).closest('button') || (event.target as Element).closest('button')?.hasAttribute('disabled')) return
  close(true)
}
function dismiss() { close() }
onMounted(() => { document.addEventListener('pointerdown', outside); window.addEventListener('resize', dismiss); document.addEventListener('scroll', dismiss, true) })
onBeforeUnmount(() => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', dismiss); document.removeEventListener('scroll', dismiss, true) })
</script>
<template>
  <div ref="root" class="action-menu" @keydown="keys" @focusout="focusOut" @click.stop>
    <button ref="trigger" type="button" class="icon-button menu-trigger" :aria-label="label" :aria-expanded="open" :disabled="disabled" @click="toggle"><UiIcon name="more" /></button>
    <div v-if="open" ref="panel" class="action-menu-panel" :style="position" role="group" :aria-label="label" @click="select"><slot /></div>
  </div>
</template>
