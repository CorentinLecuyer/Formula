<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router' // Import Router
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'

const router = useRouter() // Initialize Router

// State
const forms = ref([])
const selectedFormId = ref('')
const selectedT1Name = ref('')
const currentSchema = ref([])

// Data Handling
const allSubmissions = ref([])
const loading = ref(false)

// 1. Computed: Get unique T1s from the loaded data
const availableT1s = computed(() => {
  const t1Field = currentSchema.value.find((f) => f.type === 't1_select')
  if (!t1Field) return []

  const names = allSubmissions.value.map((sub) => sub.response_data[t1Field.id])
  return [...new Set(names)].filter((n) => n).sort()
})

// 2. Computed: Filter the table based on selection
const displayedSubmissions = computed(() => {
  if (!selectedT1Name.value) return allSubmissions.value

  const t1Field = currentSchema.value.find((f) => f.type === 't1_select')
  if (!t1Field) return allSubmissions.value

  return allSubmissions.value.filter(
    (sub) => sub.response_data[t1Field.id] === selectedT1Name.value,
  )
})

onMounted(async () => {
  const { data } = await supabase.from('forms').select('id, title, slug').order('created_at') // Added 'slug' to select
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

  const { data: subData } = await supabase
    .from('submissions')
    .select('*')
    .eq('form_id', formId)
    .order('created_at', { ascending: false })

  allSubmissions.value = subData || []
  loading.value = false
}

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString() +
  ' ' +
  new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// --- NEW ACTIONS ---

const deleteSubmission = async (id) => {
  if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) return

  const { error } = await supabase.from('submissions').delete().eq('id', id)

  if (error) {
    alert('Error deleting: ' + error.message)
  } else {
    // Remove from local list immediately
    allSubmissions.value = allSubmissions.value.filter((s) => s.id !== id)
  }
}

const editSubmission = (submission) => {
  // Find the slug for the current form to build the URL
  const currentForm = forms.value.find((f) => f.id === selectedFormId.value)

  if (currentForm) {
    // Navigate to the form page with the submission ID in the query
    router.push({
      path: `/form/${currentForm.slug}`,
      query: { submissionId: submission.id },
    })
  }
}

const exportToExcel = () => {
  // 1. Prepare the Data
  // We map over 'displayedSubmissions' so we ONLY get the filtered rows
  const dataToExport = displayedSubmissions.value.map((sub) => {
    const row = {
      Date: formatDate(sub.created_at),
    }

    // Loop through schema to get columns in order
    // We include partner fields here if you want them in Excel (usually yes)
    currentSchema.value.forEach((field) => {
      // Check if it's an image
      const cellValue = sub.response_data[field.id]

      if (cellValue && cellValue.toString().startsWith('data:image')) {
        row[field.label] = '[Image - Cannot Export]'
      } else {
        // Use the label as the header
        row[field.label] = cellValue || ''
      }
    })

    return row
  })

  // 2. Create Workbook
  const worksheet = XLSX.utils.json_to_sheet(dataToExport)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Submissions')

  // 3. Generate Filename (Form Title + Timestamp)
  const currentFormTitle = forms.value.find((f) => f.id === selectedFormId.value)?.title || 'Report'
  const fileName = `${currentFormTitle}_${new Date().toISOString().slice(0, 10)}.xlsx`

  // 4. Download
  XLSX.writeFile(workbook, fileName)
}
</script>

<template>
  <div class="mx-4 md:mx-8 lg:mx-16 py-8">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
      <h1 class="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>

      <div class="flex flex-wrap items-center gap-3">
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
        <div class="relative group">
          <div
            class="absolute -top-2.5 left-2 bg-white px-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider"
          >
            Report
          </div>
          <select
            v-model="selectedFormId"
            class="bg-white border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-black focus:border-black block w-full pl-3 pr-8 py-2.5 shadow-sm hover:border-gray-400 transition-colors cursor-pointer appearance-none min-w-[200px]"
          >
            <option v-for="form in forms" :key="form.id" :value="form.id">{{ form.title }}</option>
          </select>
          <div
            class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </div>
        </div>

        <div v-if="availableT1s.length > 0" class="relative group">
          <div
            class="absolute -top-2.5 left-2 bg-white px-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider"
          >
            Sales Rep
          </div>
          <select
            v-model="selectedT1Name"
            class="bg-white border border-gray-300 text-gray-900 text-sm rounded-md focus:ring-black focus:border-black block w-full pl-3 pr-8 py-2.5 shadow-sm hover:border-gray-400 transition-colors cursor-pointer appearance-none min-w-[180px]"
          >
            <option value="">All Reps ({{ availableT1s.length }})</option>
            <option v-for="name in availableT1s" :key="name" :value="name">{{ name }}</option>
          </select>
          <div
            class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500"
          >
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              ></path>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <div v-if="displayedSubmissions.length > 0" class="overflow-x-auto bg-white shadow rounded-lg">
      <table class="w-full text-left border-collapse">
        <thead class="bg-black text-white">
          <tr>
            <th class="p-4 whitespace-nowrap w-24 text-center">Actions</th>

            <th class="p-4 whitespace-nowrap">Date</th>
            <th
              v-for="field in currentSchema.filter((f) => !f.is_partner)"
              :key="field.id"
              class="p-4 whitespace-nowrap"
            >
              {{ field.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="sub in displayedSubmissions" :key="sub.id" class="border-b hover:bg-gray-50">
            <td class="p-4 flex justify-center gap-4">
              <button
                @click="editSubmission(sub)"
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
                @click="deleteSubmission(sub.id)"
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
            </td>

            <td class="p-4 text-gray-500 text-sm whitespace-nowrap">
              {{ formatDate(sub.created_at) }}
            </td>

            <td
              v-for="field in currentSchema.filter((f) => !f.is_partner)"
              :key="field.id"
              class="p-4"
            >
              <div v-if="sub.response_data[field.id]?.toString().startsWith('data:image')">
                <img :src="sub.response_data[field.id]" class="h-10 border rounded bg-white" />
              </div>
              <div v-else class="text-sm">
                {{ sub.response_data[field.id] || '-' }}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="loading" class="text-center py-20 text-gray-500">Loading data...</div>
    <div v-else class="text-center py-20 text-gray-400">No data found.</div>
  </div>
</template>
