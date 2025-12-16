<script setup>
import DynamicField from './DynamicField.vue'

const props = defineProps({
  schema: {
    type: Array,
    required: true,
  },

  modelValue: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])

// When a single field changes, we update the whole form data object
const handleFieldUpdate = (fieldId, newValue) => {
  const newFormData = { ...props.modelValue }

  // CHECK: Is this a "Smart Object" from our custom components?
  if (typeof newValue === 'object' && newValue !== null) {
    // CASE 1: DEPOT
    if (newValue.name && newValue.number) {
      newFormData[fieldId] = newValue.name // Main Field: "Paris"
      newFormData[fieldId + '_ship_to_number'] = newValue.number // Partner Field: "001"
    }
    // CASE 2: POC
    else if (newValue.sap_id) {
      newFormData[fieldId] = newValue.name
      newFormData[fieldId + '_sap_id'] = newValue.sap_id
    }
    // CASE 3: T1 USER
    else if (newValue.t1) {
      newFormData[fieldId] = newValue.t1
      newFormData[fieldId + '_manager_name'] = newValue.t2
    }
    // FALLBACK
    else {
      newFormData[fieldId] = newValue
    }
  } else {
    // Standard Text/Number
    newFormData[fieldId] = newValue
  }

  emit('update:modelValue', newFormData)
}
</script>

<template>

  <div class="relative flex justify-center">
    <span class="bg-white px-3 text-xl font-semibold text-gray-800 uppercase tracking-widest border-amber-300 border-b-2">
      Start Form
    </span>
  </div>
  <div class="space-y-6">
    <div v-for="field in schema" :key="field.id" v-show="!field.is_partner">
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
