<script setup>
import DynamicField from './DynamicField.vue'

const props = defineProps({
  // The blueprint (Array of field definitions)
  schema: { 
    type: Array, 
    required: true 
  },
  // The actual answers (Object like { "f_1": "John", "f_2": 50 })
  modelValue: { 
    type: Object, 
    required: true 
  }
})

const emit = defineEmits(['update:modelValue'])

// When a single field changes, we update the whole form data object
const handleFieldUpdate = (fieldId, newValue) => {
  // 1. Create a copy of the existing data
  const newFormData = { ...props.modelValue }
  
  // 2. Update the specific field
  newFormData[fieldId] = newValue
  
  // 3. Send the updated object back up to the parent
  emit('update:modelValue', newFormData)
}
</script>

<template>
  <div class="space-y-6">
    <div v-for="field in schema" :key="field.id">
      
      <DynamicField
        :field="field"
        :model-value="modelValue[field.id]"
        @update:model-value="(val) => handleFieldUpdate(field.id, val)"
      />
      
    </div>
    
    <div v-if="schema.length === 0" class="text-gray-500 italic text-center">
      No fields defined in this form.
    </div>
  </div>
</template>