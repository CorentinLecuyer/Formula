<script setup>
import DynamicField from './DynamicField.vue'
import { supabase } from '../supabase'

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

// --- 1. Reconstruct Objects for Child Components ---
const getFieldValue = (field) => {
  const mainValue = props.modelValue[field.id]

  // CASE 0: TABLE
  if (field.type === 'table') {
    return Array.isArray(mainValue) ? mainValue : []
  }

  // If missing/empty, return empty string for inputs
  if (mainValue === undefined || mainValue === null) return ''

  // CASE 1: DEPOT
  if (field.type === 'depot_select') {
    return {
      name: mainValue,
      number: props.modelValue[`${field.id}_ship_to_number`],
    }
  }

  // CASE 2: POC
  if (field.type === 'poc_select') {
    return {
      name: mainValue,
      sap_id: props.modelValue[`${field.id}_sap_id`],
      id: props.modelValue[`${field.id}_id`] || null,
    }
  }

  // CASE 3: T1 SELECT
  if (field.type === 't1_select') {
    return {
      t1: mainValue,
      t2: props.modelValue[`${field.id}_manager_name`],
    }
  }

  // STANDARD CASE
  return mainValue
}

// --- 2. Saving Logic ---
const handleFieldUpdate = (fieldId, newValue) => {
  const newFormData = { ...props.modelValue }

  // CHECK: Is this a "Smart Object"?
  if (typeof newValue === 'object' && newValue !== null && !Array.isArray(newValue)) {
    if (newValue.name !== undefined && newValue.number !== undefined) {
      newFormData[fieldId] = newValue.name
      newFormData[`${fieldId}_ship_to_number`] = newValue.number
    } else if (newValue.sap_id !== undefined) {
      newFormData[fieldId] = newValue.name
      newFormData[`${fieldId}_sap_id`] = newValue.sap_id
    } else if (newValue.t1 !== undefined) {
      newFormData[fieldId] = newValue.t1
      newFormData[`${fieldId}_manager_name`] = newValue.t2
    } else {
      newFormData[fieldId] = newValue
    }
  } else {
    // Standard
    newFormData[fieldId] = newValue
  }

  emit('update:modelValue', newFormData)
}

// --- 3. Table Image Upload Helper ---
const handleUserImageUpload = async (event, fieldId, rowIndex, colId, fieldValidation) => {
  const file = event.target.files[0]
  if (!file) return

  // 1. Check Max File Size (Default 5MB)
  const maxSizeMB = fieldValidation?.maxFileSize || 5
  if (file.size > maxSizeMB * 1024 * 1024) {
    alert(`File is too large! Maximum size is ${maxSizeMB}MB.`)
    event.target.value = '' // Reset input
    return
  }

  const filePath = `submissions/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
  const { error } = await supabase.storage.from('attachments').upload(filePath, file)

  if (!error) {
    const { data } = supabase.storage.from('attachments').getPublicUrl(filePath)
    const rows = [...(props.modelValue[fieldId] || [])]
    if (rows[rowIndex]) {
      rows[rowIndex] = { ...rows[rowIndex], [colId]: data.publicUrl }
      handleFieldUpdate(fieldId, rows)
    }
  } else {
    alert('Upload failed: ' + error.message)
  }
}
</script>

<template>
  <div class="relative flex justify-center">
    <span
      class="bg-white px-3 text-xl font-semibold text-gray-800 uppercase tracking-widest border-amber-300 border-b-2"
    >
      Start Form
    </span>
  </div>

  <div class="space-y-6 mt-6">
    <div v-for="field in schema" :key="field.id" v-show="!field.is_partner">
      <div v-if="field.type === 'table'" class="overflow-x-auto mt-2 mb-6">
        <label class="block text-sm font-bold text-gray-700 mb-2">{{ field.label }}</label>

        <table
          class="w-full text-sm text-left border-collapse border border-gray-200 rounded-lg overflow-hidden shadow-sm"
        >
          <thead class="bg-gray-100 text-gray-700 font-bold">
            <tr>
              <th
                v-for="col in field.columns"
                :key="col.id"
                class="p-3 border-b border-gray-200 whitespace-nowrap"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rIdx) in modelValue[field.id] || []"
              :key="rIdx"
              class="hover:bg-gray-50 border-b border-gray-100 last:border-0"
            >
              <td
                v-for="col in field.columns"
                :key="col.id"
                class="p-2 border-r border-gray-100 last:border-0 align-middle"
              >
                <template v-if="col.locked">
                  <div v-if="col.type === 'image'" class="flex justify-center items-center">
                    <img
                      v-if="row[col.id]"
                      :src="row[col.id]"
                      class="h-[72px] w-auto object-contain"
                      alt="Item"
                    />
                  </div>

                  <span v-else class="font-medium text-gray-700 block text-left">
                    {{ row[col.id] }}
                  </span>
                </template>

                <template v-else>
                  <input
                    v-if="col.type !== 'image'"
                    v-model="row[col.id]"
                    :type="col.type"
                    class="w-full border border-gray-300 rounded p-1.5 focus:ring-black focus:border-black transition text-sm"
                    :placeholder="col.label"
                  />

                  <div v-else class="flex justify-center">
                    <div v-if="row[col.id]" class="relative inline-block">
                      <img :src="row[col.id]" class="h-10 w-auto object-contain rounded" />
                      <button
                        @click="row[col.id] = ''"
                        class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <input
                      v-else
                      type="file"
                      accept="image/*"
                      class="text-xs w-full"
                      @change="(e) => handleUserImageUpload(e, field.id, rIdx, col.id)"
                    />
                  </div>
                </template>
              </td>
            </tr>
          </tbody>
        </table>

        <div
          v-if="!modelValue[field.id] || modelValue[field.id].length === 0"
          class="text-xs text-gray-400 italic mt-1"
        >
          No data available for this table.
        </div>
      </div>

      <DynamicField
        v-else
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
