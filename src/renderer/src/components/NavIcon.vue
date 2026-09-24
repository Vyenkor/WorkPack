<script setup lang="ts">
defineProps<{ name: 'home' | 'projects' | 'pending' | 'templates' }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <template v-if="name === 'home'">
      <rect x="3.75" y="3.75" width="6.5" height="6.5" rx="1.35" />
      <rect x="13.75" y="3.75" width="6.5" height="6.5" rx="1.35" />
      <rect x="3.75" y="13.75" width="6.5" height="6.5" rx="1.35" />
      <rect x="13.75" y="13.75" width="6.5" height="6.5" rx="1.35" />
    </template>
    <template v-else-if="name === 'projects'">
      <path d="M3.5 7a2 2 0 0 1 2-2h4.2l1.8 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M3.5 10h17" />
    </template>
    <template v-else-if="name === 'pending'">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5v5l3.25 2" />
    </template>
    <template v-else>
      <rect x="3.5" y="4" width="5" height="5" rx="1.25" />
      <rect x="15.5" y="4" width="5" height="5" rx="1.25" />
      <rect x="15.5" y="15" width="5" height="5" rx="1.25" />
      <path d="M8.5 6.5h7M6 9v8.5h9.5" />
    </template>
  </svg>
</template>
