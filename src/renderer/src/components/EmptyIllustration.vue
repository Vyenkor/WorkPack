<script setup lang="ts">
import { useId } from 'vue'
const textureId = useId()
defineProps<{ kind: 'folder' | 'checklist' | 'inbox' }>()
</script>
<template>
  <svg class="empty-illustration" :class="kind" :style="{ '--illustration-texture': `url(#${textureId})` }" viewBox="0 0 320 200" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <filter :id="textureId" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" seed="7" result="noise" />
        <feColorMatrix in="noise" type="saturate" values="0" />
        <feComponentTransfer><feFuncA type="linear" slope=".16" /></feComponentTransfer>
        <feComposite in2="SourceGraphic" operator="in" result="grain" />
        <feBlend in="SourceGraphic" in2="grain" mode="multiply" />
      </filter>
    </defs>
    <ellipse cx="163" cy="178" rx="132" ry="10" class="illustration-shadow" />
    <g stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
      <template v-if="kind === 'folder'">
        <path d="M74 151 65 65 139 57 151 155Z" class="illustration-paper" />
        <path d="m170 146 18-121 98 15-21 130Z" class="illustration-paper" />
        <path d="m84 80 43-5m-41 16 43-5m-41 16 30-4m117-43 30 4m-33 14 31 4m-34 14 30 4M203 58l4 5 9-9m-16 22 4 5 9-9m-15 22 4 5 9-9" />
        <path d="M55 92h51l16 16h87l-3 69H70Z" class="illustration-fill" />
        <path d="M55 111q0-6 6-6h135q7 0 8 7l10 66H72q-7 0-8-7Z" class="illustration-fill" />
        <path d="m32 67 12 3m1-22 10 7m4-28 5 14" />
      </template>
      <template v-else-if="kind === 'checklist'">
        <path d="m104 53 108 12q6 0 5 7l-14 107-118-13 13-107q0-7 6-6Z" class="illustration-paper" />
        <path d="m146 43 29 3-1 10 11 1-2 18-50-6 2-18 10 1Z" class="illustration-fill" />
        <path d="m111 94 5 6 10-11m-17 33 5 6 10-11m-17 33 5 6 10-11m19-46 47 5m-49 20 46 5m-49 20 36 4M58 57l15 2m-3-22 11 9m10-28 4 14" />
      </template>
      <template v-else>
        <path d="m76 103 24-36h122l25 36v72H76Z" class="illustration-fill" />
        <path d="m110 28 111 1-22 111H89Z" class="illustration-paper" />
        <path d="m124 56 64 1m-69 22 64 1m-68 21 54 1" />
        <path d="M76 104h44l10 18h60l11-18h46v71H76Z" class="illustration-fill" />
        <path d="m58 44 14 2m-2-23 10 10m10-27 4 14" />
      </template>
    </g>
  </svg>
</template>
