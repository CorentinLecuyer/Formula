<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'
import FormRenderer from '../components/FormRenderer.vue'
import FormPresentation from '../components/FormPresentation.vue'

const route = useRoute()
const slugFromUrl = route.params.slug
const submissionId = ref(route.query.submissionId || null)

const formTitle = ref('')
const formSchema = ref([])
const formData = ref({})
const formId = ref(null)
const formDescription = ref('')
const formInfoBlocks = ref([])

const loading = ref(true)
const submitting = ref(false)
const submitted = ref(false)
const validationErrors = ref([])

const fetchForm = async () => {
  loading.value = true

  const { data, error } = await supabase.from('forms').select('*').eq('slug', slugFromUrl).single()

  if (error) {
    alert('Form not found!')
    loading.value = false
    return
  }

  formTitle.value = data.title
  formSchema.value = data.schema
  formId.value = data.id
  formDescription.value = data.description
  formInfoBlocks.value = data.info_blocks

  const initialData = {}
  data.schema.forEach((field) => {
    if (['poc_select', 'manager_select'].includes(field.type)) {
      initialData[field.id] = null
    } else if (field.type === 'table') {
      initialData[field.id] = field.rows ? JSON.parse(JSON.stringify(field.rows)) : []
    } else {
      initialData[field.id] = ''
    }
  })

  if (submissionId.value) {
    const { data: subData, error: subError } = await supabase
      .from('submissions')
      .select('response_data')
      .eq('id', submissionId.value)
      .single()

    if (subError) {
      console.error('Error fetching submission:', subError)
      alert('Could not load the submission to edit.')
    } else {
      formData.value = { ...initialData, ...subData.response_data }
    }
  } else {
    formData.value = initialData
  }

  loading.value = false
}

// ---------------------------------------------------------
// 🛡️ UPDATED VALIDATION LOGIC
// ---------------------------------------------------------
const validateForm = () => {
  validationErrors.value = []

  formSchema.value.forEach((field) => {
    const val = formData.value[field.id]
    const rules = field.validation || {}

    // 1. STANDARD REQUIRED CHECK
    if (field.required && !field.is_partner) {
      const isEmpty =
        val === null || val === undefined || val === '' || (Array.isArray(val) && val.length === 0)
      if (isEmpty) {
        validationErrors.value.push(`Field "${field.label}" is required.`)
        return
      }
    }

    if (!val && val !== 0) return

    // 2. TEXT RULES
    if (field.type === 'text') {
      if (rules.minLength && val.length < rules.minLength) {
        validationErrors.value.push(
          `"${field.label}": Minimum ${rules.minLength} characters required.`,
        )
      }
      if (rules.maxLength && val.length > rules.maxLength) {
        validationErrors.value.push(
          `"${field.label}": Maximum ${rules.maxLength} characters allowed.`,
        )
      }
    }

    // 3. NUMBER RULES
    if (field.type === 'number') {
      if (rules.min !== null && Number(val) < rules.min) {
        validationErrors.value.push(`"${field.label}": Value must be at least ${rules.min}.`)
      }
      if (rules.max !== null && Number(val) > rules.max) {
        validationErrors.value.push(`"${field.label}": Value must be at most ${rules.max}.`)
      }
    }

    // 4. MULTI-SELECT RULES
    if (field.type === 'select' && Array.isArray(val)) {
      if (rules.minSelect && val.length < rules.minSelect) {
        validationErrors.value.push(
          `"${field.label}": Please select at least ${rules.minSelect} options.`,
        )
      }
      if (rules.maxSelect && val.length > rules.maxSelect) {
        validationErrors.value.push(
          `"${field.label}": Please select at most ${rules.maxSelect} options.`,
        )
      }
    }

    // 5. TABLE VALIDATION (Improved)
    if (field.type === 'table') {
      const rows = val || []

      // Helper to identify row (First Text Column OR Row Number)
      const getRowLabel = (row, idx) => {
        const textCol = field.columns.find((c) => c.type === 'text')
        return textCol && row[textCol.id] ? `"${row[textCol.id]}"` : `Row ${idx + 1}`
      }

      // A. Check Column Rules
      field.columns.forEach((col) => {
        if (col.locked) return

        rows.forEach((row, rIdx) => {
          let cellVal = row[col.id]
          const colRules = col.validation || {}

          // 🧠 SMART EMPTY HANDLING: Treat Empty Numbers as 0
          if (
            col.type === 'number' &&
            (cellVal === '' || cellVal === null || cellVal === undefined)
          ) {
            cellVal = 0
            // Update the data so it saves as 0
            row[col.id] = 0
          }

          // Column Required Check
          // (If it was empty number, it is now 0, so this passes)
          if (col.required && (cellVal === '' || cellVal === null || cellVal === undefined)) {
            validationErrors.value.push(
              `Table "${field.label}" (${getRowLabel(row, rIdx)}): "${col.label}" is required.`,
            )
          }

          if (cellVal === '' || cellVal === null || cellVal === undefined) return

          // Column Text Rules
          if (col.type === 'text') {
            if (colRules.minLength && cellVal.length < colRules.minLength)
              validationErrors.value.push(
                `Table "${field.label}" (${getRowLabel(row, rIdx)}): "${col.label}" too short.`,
              )
            if (colRules.maxLength && cellVal.length > colRules.maxLength)
              validationErrors.value.push(
                `Table "${field.label}" (${getRowLabel(row, rIdx)}): "${col.label}" too long.`,
              )
          }
          // Column Number Rules
          if (col.type === 'number') {
            if (colRules.min !== null && Number(cellVal) < colRules.min)
              validationErrors.value.push(
                `Table "${field.label}" (${getRowLabel(row, rIdx)}): "${col.label}" must be ≥ ${colRules.min}.`,
              )
            if (colRules.max !== null && Number(cellVal) > colRules.max)
              validationErrors.value.push(
                `Table "${field.label}" (${getRowLabel(row, rIdx)}): "${col.label}" must be ≤ ${colRules.max}.`,
              )
          }
        })
      })

      // B. Check Table Sum
      if (rules.sumColumnId) {
        const targetCol = field.columns.find((c) => c.id === rules.sumColumnId)
        if (targetCol) {
          const total = rows.reduce((sum, row) => sum + (Number(row[rules.sumColumnId]) || 0), 0)

          if (rules.minSum !== null && total < rules.minSum) {
            validationErrors.value.push(
              `"${field.label}": Total ${targetCol.label} is ${total} (Min: ${rules.minSum}).`,
            )
          }
          if (rules.maxSum !== null && total > rules.maxSum) {
            validationErrors.value.push(
              `"${field.label}": Total ${targetCol.label} is ${total} (Max: ${rules.maxSum}).`,
            )
          }
        }
      }
    }
  })

  return validationErrors.value.length === 0
}

const submitForm = async () => {
  if (!validateForm()) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }

  submitting.value = true
  let error = null

  if (submissionId.value) {
    const { error: updateError } = await supabase
      .from('submissions')
      .update({ response_data: formData.value })
      .eq('id', submissionId.value)
    error = updateError
  } else {
    const { error: insertError } = await supabase.from('submissions').insert({
      form_id: formId.value,
      response_data: formData.value,
    })
    error = insertError
  }

  if (error) {
    alert('Error saving form: ' + error.message)
  } else {
    submitted.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  submitting.value = false
}

onMounted(() => {
  fetchForm()
})
</script>

<template>
  <div class="min-h-full bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
    <div v-if="loading" class="text-center text-gray-500 mt-20">
      <div class="flex items-center justify-center">
        <div
          class="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"
        ></div>
      </div>
      {{ submissionId ? 'Loading submission...' : 'Loading form...' }}
    </div>

    <div
      v-else-if="submitted"
      class="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg text-center border border-green-100"
    >
      <div class="text-6xl mb-4">🎉</div>
      <h2 class="text-2xl font-bold text-gray-900 mb-2">
        {{ submissionId ? 'Updated Successfully!' : 'Thank You!' }}
      </h2>
      <p class="text-gray-500">
        {{ submissionId ? 'Your report has been updated.' : 'Your submission has been received.' }}
      </p>

      <div class="mt-6 flex flex-col gap-2">
        <button @click="$router.push('/summary')" class="text-black font-bold hover:underline">
          Back to Dashboard
        </button>
        <button
          v-if="!submissionId"
          @click="$router.go(0)"
          class="text-blue-600 font-bold hover:underline"
        >
          Submit another response
        </button>
      </div>
    </div>

    <div v-else class="mx-auto">
      <div
        v-if="submissionId"
        class="mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-yellow-800 text-sm font-bold text-center"
      >
        ⚠️ You are editing an existing submission
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-2 items-start">
        <div class="lg:col-span-5 lg:sticky lg:top-8">
          <div class="bg-white shadow-sm rounded-2xl p-6 lg:p-8 border border-gray-100">
            <FormPresentation
              :title="formTitle"
              :description="formDescription"
              :blocks="formInfoBlocks"
            />
          </div>
        </div>

        <div class="lg:col-span-7">
          <div class="bg-white shadow-lg rounded-2xl p-6 lg:p-10 border border-gray-100 relative">
            <form @submit.prevent="submitForm" class="space-y-8">
              <FormRenderer :schema="formSchema" v-model="formData" />

              <div
                v-if="validationErrors.length > 0"
                class="bg-red-50 border border-red-200 rounded-lg p-4"
              >
                <div class="flex items-center gap-2 text-red-700 font-bold mb-2">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    ></path>
                  </svg>
                  <span>Please fix the following errors:</span>
                </div>
                <ul class="list-disc list-inside text-sm text-red-600 space-y-1">
                  <li v-for="(err, i) in validationErrors" :key="i">{{ err }}</li>
                </ul>
              </div>

              <div class="pt-6 border-t border-gray-100 flex justify-center">
                <button
                  type="submit"
                  :disabled="submitting"
                  class="bg-black text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition shadow-md w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ submitting ? 'Saving...' : submissionId ? 'Update Report' : 'Submit Report' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
