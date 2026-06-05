<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'

const router = useRouter()

// State
const forms = ref([])
const selectedFormId = ref('')
const selectedT1Name = ref('')
const currentSchema = ref([])
const allSubmissions = ref([])
const loading = ref(false)
const expandedSubmissionId = ref(null)

// Computed: Check if current form has any table fields (to show the View button)
const hasTableField = computed(() => currentSchema.value.some((field) => field.type === 'table'))

const availableT1s = computed(() => {
  const t1Field = currentSchema.value.find((field) => field.type === 't1_select')
  if (!t1Field) return []

  const names = allSubmissions.value.map((sub) => sub.response_data?.[t1Field.id])
  return [...new Set(names)].filter((name) => name).sort()
})

const displayedSubmissions = computed(() => {
  if (!selectedT1Name.value) return allSubmissions.value

  const t1Field = currentSchema.value.find((field) => field.type === 't1_select')
  if (!t1Field) return allSubmissions.value

  return allSubmissions.value.filter(
    (sub) => sub.response_data?.[t1Field.id] === selectedT1Name.value,
  )
})

// ACTIONS
const toggleDetails = (submissionId) => {
  expandedSubmissionId.value = expandedSubmissionId.value === submissionId ? null : submissionId
}

const deleteSubmission = async (id) => {
  if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) return

  const { error } = await supabase.from('submissions').delete().eq('id', id)
  if (error) {
    alert('Error deleting: ' + error.message)
  } else {
    allSubmissions.value = allSubmissions.value.filter((submission) => submission.id !== id)
  }
}

const editSubmission = (submission) => {
  const currentForm = forms.value.find((form) => form.id === selectedFormId.value)
  if (!currentForm) return

  router.push({
    path: `/form/${currentForm.slug}`,
    query: { submissionId: submission.id },
  })
}

// ---------------------------------------------------------
// EXPORT HELPERS
// ---------------------------------------------------------
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)

const isImageData = (value) => typeof value === 'string' && value.startsWith('data:image')

const formatExportValue = (value) => {
  if (value === null || value === undefined || value === '') return ''

  if (isImageData(value)) return '[Image - Cannot Export]'

  if (Array.isArray(value)) {
    return value.map(formatExportValue).filter((item) => item !== '').join(', ')
  }

  if (isPlainObject(value)) {
    if ('parent' in value || 'child' in value) {
      return [value.parent, value.child].filter(Boolean).join(' / ')
    }

    return JSON.stringify(value)
  }

  return value
}

const flattenObjectForExport = (row, prefix, value) => {
  if (!isPlainObject(value)) {
    row[prefix] = formatExportValue(value)
    return
  }

  Object.entries(value).forEach(([key, nestedValue]) => {
    const header = `${prefix} - ${key}`

    if (isPlainObject(nestedValue)) {
      if ('parent' in nestedValue || 'child' in nestedValue) {
        row[`${header} - Parent`] = formatExportValue(nestedValue.parent)
        row[`${header} - Child`] = formatExportValue(nestedValue.child)
        row[header] = formatExportValue(nestedValue)
      } else {
        flattenObjectForExport(row, header, nestedValue)
      }
    } else {
      row[header] = formatExportValue(nestedValue)
    }
  })
}

const getSourcePocFieldForMavenField = (mavenPartnerField) => {
  const pocFieldId = mavenPartnerField.id.replace(/_maven_account$/, '')
  return currentSchema.value.find((field) => field.id === pocFieldId && field.type === 'poc_select')
}

const flattenMavenAccountForExport = (row, mavenPartnerField, mavenData) => {
  const sourcePocField = getSourcePocFieldForMavenField(mavenPartnerField)
  const mavenFields = Array.isArray(sourcePocField?.mavenAccountFields)
    ? sourcePocField.mavenAccountFields
    : []

  const data = isPlainObject(mavenData) ? mavenData : {}
  const baseLabel = sourcePocField?.label
    ? `${sourcePocField.label} - Maven`
    : mavenPartnerField.label || 'Maven Account Creation Data'

  // Add columns in the same order as the form creator configured them.
  mavenFields.forEach((mavenField) => {
    const value = data[mavenField.key]
    const fieldLabel = mavenField.label || mavenField.key

    if (mavenField.type === 'dependent_select') {
      const parentLabel = mavenField.parentLabel || 'Segment'
      const childLabel = mavenField.childLabel || 'Sous-Segment'
      const parentValue = isPlainObject(value) ? value.parent : ''
      const childValue = isPlainObject(value) ? value.child : ''

      row[`${baseLabel} - ${fieldLabel}`] = formatExportValue(value)
      row[`${baseLabel} - ${parentLabel}`] = formatExportValue(parentValue)
      row[`${baseLabel} - ${childLabel}`] = formatExportValue(childValue)
    } else {
      row[`${baseLabel} - ${fieldLabel}`] = formatExportValue(value)
    }
  })

  // Also export any extra keys that may have been submitted but are not in the current schema.
  Object.entries(data).forEach(([key, value]) => {
    const alreadyExported = mavenFields.some((mavenField) => mavenField.key === key)
    if (alreadyExported) return

    if (isPlainObject(value)) {
      flattenObjectForExport(row, `${baseLabel} - ${key}`, value)
    } else {
      row[`${baseLabel} - ${key}`] = formatExportValue(value)
    }
  })
}

const writeFieldToExportRow = (row, field, responseData) => {
  // A. HANDLE TABLES
  if (field.type === 'table') {
    const tableRows = responseData[field.id] || []
    const labelCol = field.columns?.find((column) => column.type === 'text')

    tableRows.forEach((tableRow, rowIndex) => {
      field.columns.forEach((column) => {
        if (column.locked) return

        const rowName =
          labelCol && tableRow[labelCol.id] ? tableRow[labelCol.id] : `#${rowIndex + 1}`
        const headerName = `${field.label} (${rowName}) - ${column.label}`

        row[headerName] =
          column.type === 'image' && tableRow[column.id]
            ? '[Image Link]'
            : formatExportValue(tableRow[column.id])
      })
    })

    return
  }

  const cellValue = responseData[field.id]

  // B. HANDLE MAVEN JSON PARTNER FIELD
  if (field.id?.endsWith('_maven_account')) {
    flattenMavenAccountForExport(row, field, cellValue)
    return
  }

  // C. HANDLE ANY OTHER JSON / OBJECT FIELD
  if (isPlainObject(cellValue)) {
    flattenObjectForExport(row, field.label || field.id, cellValue)
    return
  }

  // D. HANDLE STANDARD FIELDS
  row[field.label || field.id] = formatExportValue(cellValue)
}

// ---------------------------------------------------------
// EXPORT LOGIC
// ---------------------------------------------------------
const exportToExcel = () => {
  const dataToExport = displayedSubmissions.value.map((submission) => {
    const responseData = submission.response_data || {}
    const row = {
      Date: formatDate(submission.created_at),
    }

    currentSchema.value.forEach((field) => {
      writeFieldToExportRow(row, field, responseData)
    })

    return row
  })

  const worksheet = XLSX.utils.json_to_sheet(dataToExport)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions')

  const currentFormTitle = forms.value.find((form) => form.id === selectedFormId.value)?.title || 'Report'
  const fileName = `${currentFormTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`
  XLSX.writeFile(workbook, fileName)
}

onMounted(async () => {
  const { data } = await supabase.from('forms').select('id, title, slug').order('created_at')
  forms.value = data || []
  if (forms.value.length > 0) selectedFormId.value = forms.value[0].id
})

watch(selectedFormId, async (newId) => {
  if (newId) {
    selectedT1Name.value = ''
    await loadReportData(newId)
  }
})

const loadReportData = async (formId) => {
  loading.value = true
  allSubmissions.value = []

  const { data: formData } = await supabase.from('forms').select('schema').eq('id', formId).single()
  currentSchema.value = formData?.schema || []

  const { data: submissionData } = await supabase
    .from('submissions')
    .select('*')
    .eq('form_id', formId)
    .order('created_at', { ascending: false })

  allSubmissions.value = submissionData || []
  loading.value = false
}

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString() +
  ' ' +
  new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="mx-4 md:mx-8 lg:mx-16 py-8">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
      <h1 class="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>

      <div class="flex flex-wrap items-center gap-3 bg-yellow-100 border border-yellow-200 rounded-md p-2">
        Metric section
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <div class="relative group">
          <div class="absolute -top-2.5 left-2 bg-white px-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Report
          </div>
          <select
            v-model="selectedFormId"
            class="bg-white border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-black focus:border-black block w-full pl-3 pr-8 py-2.5 shadow-sm hover:border-gray-400 transition-colors cursor-pointer appearance-none min-w-[200px]"
          >
            <option v-for="form in forms" :key="form.id" :value="form.id">{{ form.title }}</option>
          </select>
        </div>

        <div v-if="availableT1s.length > 0" class="relative group">
          <div class="absolute -top-2.5 left-2 bg-white px-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            Sales Rep
          </div>
          <select
            v-model="selectedT1Name"
            class="bg-white border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-black focus:border-black block w-full pl-3 pr-8 py-2.5 shadow-sm hover:border-gray-400 transition-colors cursor-pointer appearance-none min-w-[180px]"
          >
            <option value="">All Reps ({{ availableT1s.length }})</option>
            <option v-for="name in availableT1s" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>

        <button
          v-if="displayedSubmissions.length > 0"
          @click="exportToExcel"
          class="flex items-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-md text-sm font-bold hover:bg-green-700 transition shadow-sm"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            ></path>
          </svg>
          Export XLSX
        </button>
      </div>
    </div>

    <div v-if="displayedSubmissions.length > 0" class="overflow-x-auto bg-white shadow rounded-lg">
      <table class="w-full text-left border-collapse">
        <thead class="bg-black text-white">
          <tr>
            <th class="p-4 whitespace-nowrap w-32 text-center">Actions</th>
            <th class="p-4 whitespace-nowrap">Date</th>
            <th
              v-for="field in currentSchema.filter((schemaField) => !schemaField.is_partner && schemaField.type !== 'table')"
              :key="field.id"
              class="p-4 whitespace-nowrap"
            >
              {{ field.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <template v-for="submission in displayedSubmissions" :key="submission.id">
            <tr class="border-b hover:bg-gray-50 transition-colors">
              <td class="p-4 flex justify-center gap-3">
                <button
                  @click="editSubmission(submission)"
                  title="Edit Report"
                  class="text-blue-500 hover:text-blue-700 transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                  </svg>
                </button>

                <button
                  @click="deleteSubmission(submission.id)"
                  title="Delete Report"
                  class="text-red-400 hover:text-red-600 transition"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path
                      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    ></path>
                  </svg>
                </button>

                <button
                  v-if="hasTableField"
                  @click="toggleDetails(submission.id)"
                  title="View Details"
                  class="transition"
                  :class="expandedSubmissionId === submission.id ? 'text-black font-bold' : 'text-gray-400 hover:text-black'"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                </button>
              </td>

              <td class="p-4 text-gray-500 text-sm whitespace-nowrap">
                {{ formatDate(submission.created_at) }}
              </td>

              <td
                v-for="field in currentSchema.filter((schemaField) => !schemaField.is_partner && schemaField.type !== 'table')"
                :key="field.id"
                class="p-4"
              >
                <div v-if="submission.response_data?.[field.id]?.toString().startsWith('data:image')">
                  <img :src="submission.response_data[field.id]" class="h-10 border rounded bg-white" />
                </div>
                <div v-else class="text-sm text-gray-700">
                  {{ submission.response_data?.[field.id] || '-' }}
                </div>
              </td>
            </tr>

            <tr v-if="expandedSubmissionId === submission.id" class="bg-gray-50 shadow-inner">
              <td :colspan="100" class="p-6">
                <div class="max-w-4xl mx-auto">
                  <div
                    v-for="field in currentSchema.filter((schemaField) => schemaField.type === 'table')"
                    :key="field.id"
                    class="mb-6 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm"
                  >
                    <div class="bg-gray-100 px-4 py-2 border-b border-gray-200 font-bold text-gray-700 text-sm">
                      {{ field.label }}
                    </div>

                    <div class="overflow-x-auto">
                      <table class="w-full text-sm text-left">
                        <thead>
                          <tr class="bg-gray-50 text-gray-500 border-b border-gray-200">
                            <th v-for="col in field.columns" :key="col.id" class="p-3 font-medium">
                              {{ col.label }}
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="(row, rowIndex) in submission.response_data?.[field.id] || []"
                            :key="rowIndex"
                            class="border-b border-gray-200 last:border-0"
                          >
                            <td
                              v-for="col in field.columns"
                              :key="col.id"
                              class="p-3 border-r border-gray-200 last:border-0 align-middle"
                            >
                              <div v-if="col.type === 'image'" class="flex justify-center">
                                <img
                                  v-if="row[col.id]"
                                  :src="row[col.id]"
                                  class="h-[52px] w-auto object-contain"
                                />
                                <span v-else class="text-gray-300 text-xs">-</span>
                              </div>

                              <span v-else class="text-gray-800">{{ row[col.id] || '-' }}</span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <div v-else-if="loading" class="text-center py-20 text-gray-500">Loading data...</div>
    <div v-else class="text-center py-20 text-gray-400">No data found.</div>
  </div>
</template>
