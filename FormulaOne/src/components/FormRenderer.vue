<script setup>
import { computed, onMounted } from 'vue'
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

const visibleSchema = computed(() => props.schema.filter((field) => !field.is_partner))

const getEmailPrefillConfig = (field) => {
  const rawConfig = field.emailPrefillConfig || {}
  const merged = {
    enabled: false,
    sourceSchema: 'public',
    sourceTable: '',
    sourceColumn: '',
    strategy: 'single_row',
    lookupFieldId: '',
    lookupColumn: '',
    fixedEmailAddress: '',
    allowEdit: true,
    ...rawConfig,
  }

  // Backward compatibility for forms created before the explicit strategy existed.
  if (!rawConfig.strategy && rawConfig.lookupFieldId) {
    merged.strategy = 'lookup'
  }

  if (!['single_row', 'lookup', 'fixed'].includes(merged.strategy)) {
    merged.strategy = 'single_row'
  }

  if (!merged.sourceSchema) {
    merged.sourceSchema = 'public'
  }

  merged.fixedEmailAddress = String(merged.fixedEmailAddress || '').trim()

  return merged
}

const isEmailPrefillLocked = (field) => {
  const config = getEmailPrefillConfig(field)
  return field.type === 'email' && config.enabled && config.allowEdit === false
}

const findLookupFieldForEmail = (emailField) => {
  const config = getEmailPrefillConfig(emailField)
  if (config.strategy !== 'lookup') return null

  if (config.lookupFieldId) {
    const explicitField = props.schema.find((field) => field.id === config.lookupFieldId)
    if (explicitField) return explicitField
  }

  return null
}

const normalizeColumnName = (columnName) =>
  String(columnName || '')
    .replaceAll('"', '')
    .trim()
    .toLowerCase()

const getLookupValue = (lookupField, formData, lookupColumn) => {
  if (!lookupField) return null

  const normalizedLookupColumn = normalizeColumnName(lookupColumn)

  if (lookupField.type === 'depot_select') {
    if (normalizedLookupColumn === 'ship to number') {
      return formData[`${lookupField.id}_ship_to_number`] || formData[lookupField.id] || null
    }
  }

  if (lookupField.type === 'poc_select') {
    if (['abi_sfa_sapid__c', 'sap id', 'sap_id', 'poc id'].includes(normalizedLookupColumn)) {
      return formData[`${lookupField.id}_sap_id`] || formData[lookupField.id] || null
    }
  }

  if (lookupField.type === 't1_select') {
    if (normalizedLookupColumn === 'full_name' || normalizedLookupColumn === 'full name') {
      return formData[lookupField.id] || null
    }
  }

  const rawValue = formData[lookupField.id]

  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
    return (
      rawValue.value ||
      rawValue.name ||
      rawValue.t1 ||
      rawValue.child ||
      rawValue.parent ||
      JSON.stringify(rawValue)
    )
  }

  return rawValue ?? null
}

const fetchEmailPrefillValue = async (emailField, formData) => {
  const config = getEmailPrefillConfig(emailField)

  if (!config.enabled) {
    return { shouldSet: false, value: '' }
  }

  if (config.strategy === 'fixed') {
    return { shouldSet: true, value: config.fixedEmailAddress || '' }
  }

  if (!config.sourceTable || !config.sourceColumn) {
    return { shouldSet: false, value: '' }
  }

  let lookupValue = null

  if (config.strategy === 'lookup') {
    const lookupField = findLookupFieldForEmail(emailField)
    if (!lookupField || !config.lookupColumn) {
      return { shouldSet: false, value: '' }
    }

    lookupValue = getLookupValue(lookupField, formData, config.lookupColumn)
    if (!lookupValue) {
      return { shouldSet: true, value: '' }
    }
  }

  const { data, error } = await supabase.rpc('resolve_email_prefill_value', {
    p_table_schema: config.sourceSchema || 'public',
    p_table_name: config.sourceTable,
    p_email_column: config.sourceColumn,
    p_strategy: config.strategy,
    p_lookup_column: config.strategy === 'lookup' ? config.lookupColumn : null,
    p_lookup_value: config.strategy === 'lookup' ? String(lookupValue) : null,
  })

  if (error) {
    console.error('Email prefill failed:', error)
    return { shouldSet: false, value: '' }
  }

  return { shouldSet: true, value: data || '' }
}

const applyEmailPrefills = async (formData, changedFieldId) => {
  const nextFormData = { ...formData }

  for (const emailField of props.schema.filter((field) => field.type === 'email')) {
    const config = getEmailPrefillConfig(emailField)
    if (!config.enabled) continue

    // Do not overwrite a manually edited fixed email when edits are allowed.
    if (config.strategy === 'fixed' && changedFieldId === emailField.id && config.allowEdit) {
      continue
    }

    if (config.strategy === 'lookup') {
      const lookupField = findLookupFieldForEmail(emailField)
      if (!lookupField) continue
      if (changedFieldId && lookupField.id !== changedFieldId) continue
    }

    const { shouldSet, value } = await fetchEmailPrefillValue(emailField, nextFormData)
    if (shouldSet) {
      nextFormData[emailField.id] = value
    }
  }

  return nextFormData
}

const hasFormDataChanged = (left, right) => JSON.stringify(left) !== JSON.stringify(right)

onMounted(async () => {
  const enrichedFormData = await applyEmailPrefills(props.modelValue)
  if (hasFormDataChanged(enrichedFormData, props.modelValue)) {
    emit('update:modelValue', enrichedFormData)
  }
})

const handleEmailInput = (field, value) => {
  if (isEmailPrefillLocked(field)) return
  emit('update:modelValue', { ...props.modelValue, [field.id]: value })
}

// --- 1. Reconstruct Objects for Child Components ---
const getFieldValue = (field) => {
  const mainValue = props.modelValue[field.id]

  // 1. Table
  if (field.type === 'table') {
    return Array.isArray(mainValue) ? mainValue : []
  }

  // 2. Complex Fields
  if (field.type === 'poc_select') {
    const isManual = !!props.modelValue[`${field.id}_is_manual`]

    if ((mainValue === undefined || mainValue === null || mainValue === '') && !isManual) {
      return null
    }

    const manualMode =
      props.modelValue[`${field.id}_manual_mode`] ||
      (isManual ? field.manualPocMode || 'name_only' : null)
    const mavenAccount = props.modelValue[`${field.id}_maven_account`] || {}
    const mavenEstablishmentName = String(mavenAccount.establishment_name || '').trim()

    return {
      name: isManual && manualMode === 'maven_account'
        ? mavenEstablishmentName || mainValue || 'to be created in maven'
        : mainValue || '',
      sap_id: props.modelValue[`${field.id}_sap_id`] || '',
      id: props.modelValue[`${field.id}_id`] || null,
      is_manual: isManual,
      manual_mode: manualMode,
      maven_account: mavenAccount,
    }
  }

  if (['depot_select', 't1_select'].includes(field.type)) {
    if (mainValue === undefined || mainValue === null || mainValue === '') return null
  }

  // 3. Dependent Select
  if (field.type === 'dependent_select') {
    if (mainValue === undefined || mainValue === null) return { parent: '', child: '' }
    return mainValue
  }

  // 4. Simple Fields
  if (mainValue === undefined || mainValue === null) return ''

  // 5. Construct Complex Objects
  if (field.type === 'depot_select') {
    return {
      name: mainValue,
      number: props.modelValue[`${field.id}_ship_to_number`],
    }
  }

  if (field.type === 't1_select') {
    return {
      t1: mainValue,
      t2: props.modelValue[`${field.id}_manager_name`],
    }
  }

  return mainValue
}

// --- 2. Saving Logic ---
const handleFieldUpdate = async (fieldId, newValue) => {
  const newFormData = { ...props.modelValue }
  const field = props.schema.find((schemaField) => schemaField.id === fieldId)

  if (newValue === null) {
    newFormData[fieldId] = null
    delete newFormData[`${fieldId}_ship_to_number`]
    delete newFormData[`${fieldId}_sap_id`]
    delete newFormData[`${fieldId}_id`]
    delete newFormData[`${fieldId}_is_manual`]
    delete newFormData[`${fieldId}_manual_mode`]
    delete newFormData[`${fieldId}_maven_account`]
    delete newFormData[`${fieldId}_manager_name`]

    const enrichedFormData = await applyEmailPrefills(newFormData, fieldId)
    emit('update:modelValue', enrichedFormData)
    return
  }

  if (field?.type === 'poc_select') {
    const isManual = !!newValue?.is_manual
    const manualMode = newValue?.manual_mode || (isManual ? field.manualPocMode || 'name_only' : null)

    const mavenAccount = newValue?.maven_account || {}
    const mavenEstablishmentName = String(mavenAccount.establishment_name || '').trim()

    newFormData[fieldId] =
      isManual && manualMode === 'maven_account'
        ? mavenEstablishmentName || newValue?.name || 'to be created in maven'
        : newValue?.name || ''
    newFormData[`${fieldId}_sap_id`] = newValue?.sap_id || (isManual ? '00000000' : '')
    newFormData[`${fieldId}_id`] = newValue?.id || (isManual ? 'MANUAL' : null)
    newFormData[`${fieldId}_is_manual`] = isManual
    newFormData[`${fieldId}_manual_mode`] = manualMode
    newFormData[`${fieldId}_maven_account`] =
      manualMode === 'maven_account' ? mavenAccount : null

    const enrichedFormData = await applyEmailPrefills(newFormData, fieldId)
    emit('update:modelValue', enrichedFormData)
    return
  }

  if (field?.type === 'depot_select') {
    newFormData[fieldId] = newValue?.name || ''
    newFormData[`${fieldId}_ship_to_number`] = newValue?.number || ''

    const enrichedFormData = await applyEmailPrefills(newFormData, fieldId)
    emit('update:modelValue', enrichedFormData)
    return
  }

  if (field?.type === 't1_select') {
    newFormData[fieldId] = newValue?.t1 || ''
    newFormData[`${fieldId}_manager_name`] = newValue?.t2 || ''

    const enrichedFormData = await applyEmailPrefills(newFormData, fieldId)
    emit('update:modelValue', enrichedFormData)
    return
  }

  newFormData[fieldId] = newValue

  const enrichedFormData = await applyEmailPrefills(newFormData, fieldId)
  emit('update:modelValue', enrichedFormData)
}

const handleDependentUpdate = async (fieldId, level, value) => {
  const newFormData = { ...props.modelValue }
  const currentValue = newFormData[fieldId] || { parent: '', child: '' }

  if (level === 'parent') {
    newFormData[fieldId] = { parent: value, child: '' }
  } else {
    newFormData[fieldId] = { ...currentValue, child: value }
  }

  const enrichedFormData = await applyEmailPrefills(newFormData, fieldId)
  emit('update:modelValue', enrichedFormData)
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
    <div v-for="field in visibleSchema" :key="field.id">
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
                        type="button"
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
                      @change="(event) => handleUserImageUpload(event, field.id, rIdx, col.id)"
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

      <div v-else-if="field.type === 'email'" class="mb-6">
        <label class="block text-sm font-bold text-gray-700 mb-2">
          {{ field.label }} <span v-if="field.required" class="text-red-500">*</span>
        </label>
        <input
          type="email"
          :value="modelValue[field.id]"
          :readonly="isEmailPrefillLocked(field)"
          @input="handleEmailInput(field, $event.target.value)"
          class="w-full border border-gray-300 rounded-lg p-3 focus:ring-black focus:border-black transition"
          :class="isEmailPrefillLocked(field) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''"
          placeholder="name@company.com"
        />
        <p v-if="field.validation?.autoFillUser" class="text-xs text-gray-400 mt-1">
          Auto-filled with your account email.
        </p>
        <p v-if="field.emailPrefillConfig?.enabled" class="text-xs text-blue-500 mt-1">
          <span v-if="field.emailPrefillConfig.strategy === 'fixed'">
            Fixed email for this form.
          </span>
          <span v-else>
            Pre-filled from {{ field.emailPrefillConfig.sourceTable }}.{{ field.emailPrefillConfig.sourceColumn }}.
          </span>
          <span v-if="isEmailPrefillLocked(field)">The respondent cannot edit this value.</span>
          <span v-else>The respondent can edit this value.</span>
        </p>
      </div>

      <div
        v-else-if="field.type === 'description'"
        class="mb-6 p-5 bg-gray-50 border border-gray-200 rounded-lg shadow-sm"
      >
        <h3 v-if="field.label" class="text-lg font-bold text-gray-900 mb-2">
          {{ field.label }}
        </h3>

        <p v-if="field.content" class="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
          {{ field.content }}
        </p>

        <div v-if="field.imageUrl" class="mt-4 flex justify-center">
          <img
            :src="field.imageUrl"
            alt="Descriptive attachment"
            class="max-w-full max-h-[400px] object-contain rounded border border-gray-200 shadow-sm"
          />
        </div>
      </div>

      <div
        v-else-if="field.type === 'dependent_select'"
        class="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200"
      >
        <label class="block text-sm font-bold text-gray-900 mb-3">
          {{ field.label }} <span v-if="field.required" class="text-red-500">*</span>
        </label>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">{{
              field.parentLabel
            }}</label>
            <select
              :value="getFieldValue(field)?.parent || ''"
              @change="(event) => handleDependentUpdate(field.id, 'parent', event.target.value)"
              class="w-full border-gray-300 rounded-lg shadow-sm focus:border-black focus:ring-black"
              :required="field.required"
            >
              <option value="" disabled selected>Select {{ field.parentLabel }}...</option>
              <option
                v-for="parentOpt in Object.keys(field.mappingData || {})"
                :key="parentOpt"
                :value="parentOpt"
              >
                {{ parentOpt }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">{{
              field.childLabel
            }}</label>
            <select
              :value="getFieldValue(field)?.child || ''"
              @change="(event) => handleDependentUpdate(field.id, 'child', event.target.value)"
              class="w-full border-gray-300 rounded-lg shadow-sm focus:border-black focus:ring-black disabled:bg-gray-100 disabled:cursor-not-allowed"
              :required="field.required"
              :disabled="!getFieldValue(field)?.parent"
            >
              <option value="" disabled selected>Select {{ field.childLabel }}...</option>
              <template
                v-if="
                  getFieldValue(field)?.parent && field.mappingData[getFieldValue(field).parent]
                "
              >
                <option
                  v-for="childOpt in field.mappingData[getFieldValue(field).parent]"
                  :key="childOpt"
                  :value="childOpt"
                >
                  {{ childOpt }}
                </option>
              </template>
            </select>
          </div>
        </div>
      </div>

      <DynamicField
        v-else
        :field="field"
        :model-value="getFieldValue(field)"
        @update:model-value="(val) => handleFieldUpdate(field.id, val)"
      />
    </div>

    <div v-if="visibleSchema.length === 0" class="text-gray-500 italic text-center">
      No fields defined in this form.
    </div>
  </div>
</template>
