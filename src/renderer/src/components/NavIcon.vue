<script setup lang="ts">
import UiIcon from './UiIcon.vue'

defineProps<{ name: 'home' | 'projects' | 'pending' }>()
const icons = { home: 'inbox', projects: 'cube', pending: 'clock' } as const
</script>

<template>
  <UiIcon :name="icons[name]" />
</template>
