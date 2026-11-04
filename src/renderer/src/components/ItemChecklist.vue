<script setup lang="ts">
import { gaps, type Item } from '../../../shared/model'
import UiIcon from './UiIcon.vue'
defineProps<{ items: Item[]; busy: boolean; savedItemId?: string }>()
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
      <div class="document-card-heading"><div><h4>{{ item.name }}</h4><p v-if="item.note">{{ item.note }}</p></div><div class="inline-actions"><button class="link" :disabled="busy" @click="emit('edit', item)">编辑</button><button class="link danger" :disabled="busy" @click="emit('remove', item)">删除</button></div></div>
      <div class="document-attachments"><div v-for="file in item.attachments" :key="file.id" class="document-attachment"><span class="file-icon"><UiIcon name="file" /></span><button class="link" :disabled="busy || !file.exists" @click="emit('open', file.id)">{{ file.name }}</button><span v-if="!file.exists" class="file-warning">文件失效</span><button class="link secondary" :disabled="busy" @click="emit('relocate', file.id)">重新定位</button><button class="link danger" :disabled="busy" @click="emit('detach', file.id)">移除</button></div><button class="button secondary small" :disabled="busy" @click="emit('upload', item.id)">添加文件</button></div>
      <div class="document-tasks"><label v-for="task in item.tasks ?? []" :key="task.id" class="document-task"><input type="checkbox" :checked="task.done && (task.name !== '准备文件' || item.attachments.some(file => file.exists))" :disabled="busy || (task.name === '准备文件' && !task.done && !item.attachments.some(file => file.exists))" @change="emit('task', task.id, ($event.target as HTMLInputElement).checked, $event.target as HTMLElement)"><span>{{ task.name }}</span><button v-if="task.name !== '准备文件'" class="task-remove" :disabled="busy" :aria-label="`删除${task.name}`" @click.prevent="emit('removeTask', task.id)">×</button></label><button class="link" :disabled="busy" @click="emit('addTask', item)">＋ 添加待办</button></div>
      <span v-if="gaps(item).length" class="tag orange">{{ gaps(item).length }} 项待完成</span><span v-else class="tag green">已完成</span><span v-if="savedItemId === item.id" class="inline-saved">已保存</span>
    </article>
    <div v-if="!items.length" class="empty compact">暂无文件项</div>
  </div>
</template>
