<script setup>
import { defineProps, defineEmits } from 'vue'
// Import your custom field components
import FieldPocSelect from '@/components/fields/FieldPocSelect.vue'
import FieldSignature from '@/components/fields/FieldSignature.vue'
import FieldT1Select from '@/components/fields/FieldT1Select.vue'
import FieldDepotSelect from '@/components/fields/FieldDepotSelect.vue'

const props = defineProps({
  field: {
    type: Object,
    required: true,
  },
  modelValue: {
    type: [String, Number, Object, null],
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex flex-col">
    <label :for="field.id" class="mb-2 font-bold text-gray-700 text-sm uppercase tracking-wide">
      {{ field.label }}
      <span v-if="field.required" class="text-red-500">*</span>
    </label>

    <input
      v-if="field.type === 'text'"
      :id="field.id"
      type="text"
      :placeholder="field.placeholder"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      class="border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
    />

    <input
      v-else-if="field.type === 'number'"
      :id="field.id"
      type="number"
      placeholder="0"
      :value="modelValue"
      @input="
        $emit('update:modelValue', $event.target.value === '' ? '' : Number($event.target.value))
      "
      class="border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-black focus:border-black outline-none transition"
    />

    <select
      v-else-if="field.type === 'select'"
      :id="field.id"
      :value="modelValue"
      @change="$emit('update:modelValue', $event.target.value)"
      class="border border-gray-300 rounded-lg p-3 bg-white focus:ring-2 focus:ring-black focus:border-black outline-none transition"
    >
      <option value="" disabled selected>Select an option...</option>
      <option v-for="opt in field.options" :key="opt" :value="opt">
        {{ opt }}
      </option>
    </select>

    <FieldPocSelect
      v-else-if="field.type === 'poc_select'"
      :modelValue="modelValue"
      :field="field"
      @update:modelValue="$emit('update:modelValue', $event)"
    />

    <FieldSignature
      v-else-if="field.type === 'signature'"
      :modelValue="modelValue"
      :field="field"
      @update:modelValue="$emit('update:modelValue', $event)"
    />

    <FieldDepotSelect
      v-else-if="field.type === 'depot_select'"
      :modelValue="modelValue"
      :field="field"
      @update:modelValue="$emit('update:modelValue', $event)"
    />

    <FieldT1Select
      v-else-if="field.type === 't1_select'"
      :modelValue="modelValue"
      :field="field"
      @update:modelValue="$emit('update:modelValue', $event)"
    />

    <div v-else class="text-red-500 text-sm">Unknown field type: {{ field.type }}</div>
  </div>
</template>
