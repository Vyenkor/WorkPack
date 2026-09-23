<script setup lang="ts">
import { steps, stepLabels, gaps, type Item, type Step, type Status } from '../../../shared/model'
const props = defineProps<{ items: Item[]; busy: boolean; savedItemId?: string }>()
const emit = defineEmits<{
  status: [id: string, step: Step, status: Status]
  complete: [id: string]
  edit: [item: Item]
  remove: [item: Item]
  upload: [id: string]
  open: [id: string]
  relocate: [id: string]
  detach: [id: string]
}>()
function change(event: Event, id: string, step: Step) { emit('status', id, step, (event.target as HTMLSelectElement).value as Status) }
</script>

<template>
  <div class="table-wrap">
    <table class="checklist" aria-label="事项文件清单">
      <thead><tr><th>文件及附件</th><th v-for="step in steps" :key="step">{{ stepLabels[step] }}状态</th><th>清单操作</th></tr></thead>
      <tbody><tr v-for="item in items" :key="item.id" :data-testid="`item-${item.id}`">
        <td class="document-cell"><strong>{{ item.name }}</strong><p v-if="item.note" class="help">{{ item.note }}</p>
          <div class="tags"><span v-if="gaps(item).length" class="tag orange">{{ gaps(item)[0] }}</span><span v-if="gaps(item).length > 1" class="tag muted">+{{ gaps(item).length - 1 }} 项</span><span v-if="!gaps(item).length" class="tag green">已完成</span><span v-if="props.savedItemId === item.id" class="inline-saved">已保存</span></div>
          <ul class="attachment-list"><li v-for="file in item.attachments" :key="file.id"><div><button class="link" :disabled="!file.exists || busy" :title="file.path" @click="emit('open', file.id)">{{ file.name }}</button><span v-if="!file.exists" class="file-warning">文件失效</span></div><div class="inline-actions"><button class="link secondary" :disabled="busy" @click="emit('relocate', file.id)">重新定位</button><button class="link danger" :disabled="busy" @click="emit('detach', file.id)">移除记录</button></div></li></ul>
          <button class="button small" :disabled="busy" @click="emit('upload', item.id)">＋ 添加附件</button>
        </td>
        <td v-for="step in steps" :key="step"><select :value="item.states[step]" :class="['status-select', item.states[step]]" :aria-label="`${item.name}的${stepLabels[step]}状态`" :disabled="busy" @change="change($event, item.id, step)"><option value="pending">待{{ stepLabels[step] }}</option><option value="done">已{{ stepLabels[step] }}</option><option value="na">不适用</option></select></td>
        <td><div class="stack-actions"><button class="link" :disabled="busy || !gaps(item).length" @click="emit('complete', item.id)">完成可用步骤</button><button class="link" :disabled="busy" @click="emit('edit', item)">编辑要求</button><button class="link danger" :disabled="busy" @click="emit('remove', item)">删除清单项</button></div></td>
      </tr></tbody>
    </table>
    <div v-if="!items.length" class="empty compact">本事项暂无文件项，请添加需要跟踪的文件。</div>
  </div>
</template>
