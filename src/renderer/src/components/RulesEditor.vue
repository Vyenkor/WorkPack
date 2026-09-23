<script setup lang="ts">
import { steps, stepLabels, type Asset, type Rule } from '../../../shared/model'
const rules = defineModel<Rule[]>({ required: true })
defineProps<{ assets?: Asset[] }>()
function add() { rules.value.push({ id: crypto.randomUUID(), name: '', note: '', required: [...steps] }) }
function move(index: number, delta: number) {
  const [rule] = rules.value.splice(index, 1)
  rules.value.splice(index + delta, 0, rule)
}
function setAsset(rule: Rule, event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value) rule.assetId = value
  else delete rule.assetId
}
</script>

<template>
  <div class="section-bar"><h3>文件清单规则</h3><button class="button small" type="button" @click="add">＋ 添加文件项</button></div>
  <p class="help">勾选本文件需要完成的步骤。取消勾选的步骤为“不适用”，不计入完成率。</p>
  <div v-for="(rule, index) in rules" :key="rule.id" class="rule-editor">
    <div class="rule-title"><span class="rule-number">{{ index + 1 }}</span><input v-model="rule.name" :aria-label="`第 ${index + 1} 项文件名称`" placeholder="文件名称" maxlength="100" required><button class="button icon" type="button" :disabled="index === 0" title="上移" @click="move(index, -1)">↑</button><button class="button icon" type="button" :disabled="index === rules.length - 1" title="下移" @click="move(index, 1)">↓</button><button class="button danger small" type="button" @click="rules.splice(index, 1)">移除</button></div>
    <input v-model="rule.note" :aria-label="`第 ${index + 1} 项说明`" placeholder="文件说明（选填）" maxlength="4000">
    <div class="check-row"><label v-for="step in steps" :key="step"><input v-model="rule.required" type="checkbox" :value="step">需要{{ stepLabels[step] }}</label></div>
    <label v-if="assets?.length" class="asset-select">对应模板文件<select :value="rule.assetId ?? ''" @change="setAsset(rule, $event)"><option value="">自动按文件名称匹配</option><option v-for="asset in assets" :key="asset.id" :value="asset.id">{{ asset.name }}{{ asset.exists ? '' : '（文件失效）' }}</option></select></label>
  </div>
  <div v-if="!rules.length" class="empty compact">还没有文件项，添加后即可为新事项生成清单。</div>
</template>
