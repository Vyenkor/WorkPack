<script setup lang="ts">
defineProps<{ name: 'project' | 'clock' | 'event' | 'workflow' | 'check' | 'plus' | 'search' | 'file' | 'info' | 'warning' | 'shipping' | 'receiving' | 'training' | 'custom' | 'error' | 'close' }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <template v-if="name === 'project'">
      <path d="M3.5 7a2 2 0 0 1 2-2h4.2l1.8 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <path d="M3.5 10h17" />
    </template>
    <template v-else-if="name === 'clock'">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5v5l3.25 2" />
    </template>
    <template v-else-if="name === 'event'">
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M4 9.5h16M8 14h3M8 17h6" />
    </template>
    <template v-else-if="name === 'workflow'">
      <rect x="3.5" y="4" width="5" height="5" rx="1.25" />
      <rect x="15.5" y="4" width="5" height="5" rx="1.25" />
      <rect x="15.5" y="15" width="5" height="5" rx="1.25" />
      <path d="M8.5 6.5h7M6 9v8.5h9.5" />
    </template>
    <template v-else-if="name === 'check'">
      <path d="m4.5 12 5 5 10-10" />
    </template>
    <template v-else-if="name === 'plus'">
      <path d="M12 5v14M5 12h14" />
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="10.75" cy="10.75" r="6.75" />
      <path d="m16 16 4.25 4.25" />
    </template>
    <template v-else-if="name === 'file'">
      <path d="M6 3.5h8l4 4V20H6zM14 3.5V8h4M9 12h6M9 15.5h6" />
    </template>
    <template v-else-if="name === 'info'">
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 11v5M12 8h.01" />
    </template>
    <template v-else-if="name === 'warning'">
      <path d="M10.4 4.6a1.8 1.8 0 0 1 3.2 0l7 13.1a1.7 1.7 0 0 1-1.5 2.5H4.9a1.7 1.7 0 0 1-1.5-2.5zM12 9v5M12 17h.01" />
    </template>
    <template v-else-if="name === 'shipping'">
      <rect x="3.5" y="8" width="11" height="11" rx="1.5" />
      <path d="M7 12h4M9 8v11M15.5 4h5v5M20.5 4l-7 7" />
    </template>
    <template v-else-if="name === 'receiving'">
      <rect x="9.5" y="8" width="11" height="11" rx="1.5" />
      <path d="M13 12h4M15 8v11M3.5 4v5h5M3.5 4l7 7" />
    </template>
    <template v-else-if="name === 'training'">
      <path d="M4.5 5.5c2.7-1.1 5.3-.8 7.5.5 2.2-1.3 4.8-1.6 7.5-.5v13c-2.7-1.1-5.3-.8-7.5.5-2.2-1.3-4.8-1.6-7.5-.5zM12 6v13" />
    </template>
    <template v-else-if="name === 'custom'">
      <path d="m12 3 8.5 5-8.5 5-8.5-5zM3.5 12l8.5 5 8.5-5M3.5 16l8.5 5 8.5-5" />
    </template>
    <template v-else-if="name === 'close'">
      <path d="M5 5l14 14M19 5 5 19" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5v6M12 17h.01" />
    </template>
  </svg>
</template>
