<script setup lang="ts">
defineProps<{ name: 'project' | 'clock' | 'event' | 'back' | 'forward' | 'sidebar' | 'check' | 'plus' | 'search' | 'file' | 'info' | 'warning' | 'error' | 'close' | 'settings' | 'chevron-down' | 'more' | 'copy' | 'edit' | 'arrow' | 'upload' }>()
</script>

<template>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
    <template v-if="name === 'more'"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></template>
    <template v-else-if="name === 'copy'"><rect x="4" y="7" width="12" height="14" rx="2" /><path d="M8 7V3h12v14h-4" /></template>
    <template v-else-if="name === 'edit'"><path d="m15 4 5 5-11 11-6 1 1-6zM13 6l5 5" /></template>
    <template v-else-if="name === 'arrow'"><path d="M4 12h16m-6-6 6 6-6 6" /></template>
    <template v-else-if="name === 'upload'"><path d="M12 16V3m-5 5 5-5 5 5M4 14v6h16v-6" /></template>
    <template v-else-if="name === 'project'">
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
    <template v-else-if="name === 'back'">
      <path d="m14.5 5.5-6.5 6.5 6.5 6.5" />
    </template>
    <template v-else-if="name === 'forward'">
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </template>
    <template v-else-if="name === 'sidebar'">
      <rect x="3" y="4.5" width="18" height="15" rx="3" /><path d="M9 4.5v15" />
    </template>
    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" /><path d="M12 2.8v2M12 19.2v2M4.04 4.04l1.42 1.42m13.08 13.08 1.42 1.42M2.8 12h2m14.4 0h2M4.04 19.96l1.42-1.42M18.54 5.46l1.42-1.42" />
    </template>
    <template v-else-if="name === 'chevron-down'">
      <path d="m6 9 6 6 6-6" />
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
    <template v-else-if="name === 'close'">
      <path d="M5 5l14 14M19 5 5 19" />
    </template>
    <template v-else>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.5v6M12 17h.01" />
    </template>
  </svg>
</template>
