<script setup>
import DynamicField from './DynamicField.vue'

const props = defineProps({
  schema: {
    type: Array,
    required: true,
  },
  modelValue: {
    type: Object, // This is the "Flat" data from the database
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])

// --- 1. NEW: Reconstruct Objects for Child Components ---
// We call this function in the template to pass the correct data structure
const getFieldValue = (field) => {
  const mainValue = props.modelValue[field.id]

  // If the value is missing/empty, return null/empty to avoid errors
  if (mainValue === undefined || mainValue === null) return ''

  // CASE 1: DEPOT (Needs { name, number })
  if (field.type === 'depot_select') {
    return {
      name: mainValue,
      number: props.modelValue[`${field.id}_ship_to_number`]
    }
  }

  // CASE 2: POC (Needs { name, sap_id })
  if (field.type === 'poc_select') {
    return {
      name: mainValue,
      sap_id: props.modelValue[`${field.id}_sap_id`],
      id: props.modelValue[`${field.id}_id`] || null // Optional if you store the UUID
    }
  }

  // CASE 3: T1 SELECT (Needs { t1, t2 })
  if (field.type === 't1_select') {
    return {
      t1: mainValue,
      t2: props.modelValue[`${field.id}_manager_name`]
    }
  }

  // STANDARD CASE (Text, Number, Signature, File)
  // These are stored as simple strings, so we pass them directly.
  return mainValue
}


// --- 2. Saving Logic (Kept mostly the same, ensuring flatness) ---
const handleFieldUpdate = (fieldId, newValue) => {
  const newFormData = { ...props.modelValue }

  // CHECK: Is this a "Smart Object" from our custom components?
  if (typeof newValue === 'object' && newValue !== null) {
    // CASE 1: DEPOT
    if (newValue.name !== undefined && newValue.number !== undefined) {
      newFormData[fieldId] = newValue.name
      newFormData[`${fieldId}_ship_to_number`] = newValue.number
    }
    // CASE 2: POC
    else if (newValue.sap_id !== undefined) {
      newFormData[fieldId] = newValue.name
      newFormData[`${fieldId}_sap_id`] = newValue.sap_id
    }
    // CASE 3: T1 USER
    else if (newValue.t1 !== undefined) {
      newFormData[fieldId] = newValue.t1
      newFormData[`${fieldId}_manager_name`] = newValue.t2
    }
    // FALLBACK for unknown objects
    else {
      newFormData[fieldId] = newValue
    }
  } else {
    // Standard Text/Number/Signature/File
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
  
  <div class="space-y-6 mt-6">
    <div v-for="field in schema" :key="field.id" v-show="!field.is_partner">
      
      <DynamicField
        :field="field"
        :model-value="getFieldValue(field)"
        @update:model-value="(val) => handleFieldUpdate(field.id, val)"
      />

    </div>

    <div v-if="schema.length === 0" class="text-gray-500 italic text-center">
      No fields defined in this form.
    </div>
  </div>
</template>