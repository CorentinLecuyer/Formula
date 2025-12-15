<script setup>
defineProps({
  field: {
    type: Object,
    required: true
  },
  modelValue: [String, Number]
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex flex-col gap-1">
    <label :for="field.id" class="text-sm font-medium text-gray-700">
      {{ field.label }} <span v-if="field.required" class="text-red-500">*</span>
    </label>
    <input
      :id="field.id"
      type="text"
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      class="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
      :placeholder="field.placeholder"
      :required="field.required"
    />
  </div>
</template>