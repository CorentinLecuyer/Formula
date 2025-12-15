<script setup>
import FieldText from './fields/FieldText.vue'
import FieldSignature from './fields/FieldSignature.vue' 
import FieldPocSelect from './fields/FieldPocSelect.vue'

defineProps({
  field: { type: Object, required: true },
  modelValue: [String, Number, Object],
})

defineEmits(['update:modelValue'])
</script>

<template>
  <FieldText
    v-if="field.type === 'text' || field.type === 'number'"
    :field="field"
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
  />

  <FieldSignature
    v-else-if="field.type === 'signature'"
    :field="field"
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
  />

  <FieldPocSelect
    v-else-if="field.type === 'poc_select'"
    :field="field"
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
  />

  <div v-else class="text-red-500 border border-red-500 p-2 rounded">
    Unknown field type: {{ field.type }}
  </div>
</template>
