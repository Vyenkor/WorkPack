<script setup lang="ts">
import { type Item } from '../../../shared/model'
import UiIcon from './UiIcon.vue'
import ActionMenu from './ActionMenu.vue'
defineProps<{ items: Item[]; busy: boolean }>()
const emit = defineEmits<{
  task: [id: string, done: boolean, control: HTMLElement]
  addTask: [item: Item]
  removeTask: [id: string]
  edit: [item: Item]
  remove: [item: Item]
  upload: [id: string]
  open: [id: string]
  relocate: [id: string]
  detach: [id: string]
}>()
</script>
<template>
  <div class="document-list">
    <article v-for="item in items" :key="item.id" class="document-card" :data-testid="`item-${item.id}`">
      <div class="document-card-heading"><div><h4>{{ item.name }}</h4><p v-if="item.note">{{ item.note }}</p></div><div class="inline-actions"><button class="button secondary small" :disabled="busy" @click="emit('edit', item)"><UiIcon name="edit" />编辑</button><ActionMenu :label="`${item.name}操作`" :disabled="busy"><button @click="emit('upload', item.id)"><UiIcon name="upload" />上传文件</button><button class="danger" @click="emit('remove', item)">删除文件项</button></ActionMenu></div></div>
      <div class="document-tasks"><label v-for="task in item.tasks" :key="task.id" class="document-task"><input type="checkbox" :checked="task.done && (task.position !== 0 || item.attachments.some(file => file.exists))" :disabled="busy || (task.position === 0 && !task.done && !item.attachments.some(file => file.exists))" @change="emit('task', task.id, ($event.target as HTMLInputElement).checked, $event.target as HTMLElement)"><span>{{ task.name }}</span><button v-if="task.position !== 0" class="task-remove" :disabled="busy" :aria-label="`删除${task.name}`" @click.prevent="emit('removeTask', task.id)">×</button></label><button class="link" :disabled="busy" @click="emit('addTask', item)">＋ 添加待办</button></div>
      <div class="document-attachments"><div v-for="file in item.attachments" :key="file.id" class="document-attachment"><UiIcon name="file" /><button class="attachment-name" :title="file.path" :disabled="busy || !file.exists" @click="emit('open', file.id)">{{ file.name }}</button><span v-if="!file.exists" class="file-warning">文件失效</span><button v-if="!file.exists" class="link" :disabled="busy" @click="emit('relocate', file.id)">重新定位</button><button v-else class="button secondary small" :disabled="busy" @click="emit('open', file.id)">打开</button><ActionMenu :label="`${file.name}附件操作`" :disabled="busy"><button @click="emit('relocate', file.id)">重新定位</button><button class="danger" @click="emit('detach', file.id)">移除附件</button></ActionMenu></div><div class="document-attachment"><UiIcon name="file" /><span class="attachment-name muted">{{ item.attachments.length ? `${item.attachments.length} 个附件` : '未上传' }}</span><button class="button secondary small" :disabled="busy" @click="emit('upload', item.id)"><UiIcon name="upload" />上传</button></div></div>
    </article>
    <div v-if="!items.length" class="empty compact">暂无文件项</div>
  </div>
</template>
