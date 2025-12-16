<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { supabase } from '../supabase'

// State
const forms = ref([])
const selectedFormId = ref('')
const selectedT1Name = ref('')
const currentSchema = ref([])

// Data Handling
const allSubmissions = ref([]) // <--- Holds ALL data for the form
const loading = ref(false)

// 1. Computed: Get unique T1s from the loaded data
const availableT1s = computed(() => {
  // Find which field is the "T1 Select" field
  const t1Field = currentSchema.value.find(f => f.type === 't1_select')
  if (!t1Field) return []

  // Extract all answers for that field
  const names = allSubmissions.value.map(sub => sub.response_data[t1Field.id])
  
  // Return unique, non-empty names sorted alphabetically
  return [...new Set(names)].filter(n => n).sort()
})

// 2. Computed: Filter the table based on selection
const displayedSubmissions = computed(() => {
  if (!selectedT1Name.value) return allSubmissions.value
  
  // Find the T1 field again
  const t1Field = currentSchema.value.find(f => f.type === 't1_select')
  if (!t1Field) return allSubmissions.value

  // Return only rows where the T1 name matches
  return allSubmissions.value.filter(sub => sub.response_data[t1Field.id] === selectedT1Name.value)
})

onMounted(async () => {
  const { data } = await supabase.from('forms').select('id, title').order('created_at')
  forms.value = data || []
  if (forms.value.length > 0) selectedFormId.value = forms.value[0].id
})

watch(selectedFormId, async (newId) => {
  if (newId) {
    selectedT1Name.value = '' // Reset filter when switching forms
    await loadReportData(newId)
  }
})

const loadReportData = async (formId) => {
  loading.value = true
  allSubmissions.value = []

  // A. Get Schema
  const { data: formData } = await supabase.from('forms').select('schema').eq('id', formId).single()
  currentSchema.value = formData?.schema || []

  // B. Get ALL Data for this form
  const { data: subData } = await supabase
    .from('submissions')
    .select('*')
    .eq('form_id', formId)
    .order('created_at', { ascending: false })

  allSubmissions.value = subData || []
  loading.value = false
}

const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString() + ' ' + new Date(dateStr).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
</script>

<template>
  <div class="max-w-7xl mx-auto p-8">
    <div class="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
      <h1 class="text-3xl font-bold">Dashboard</h1>
      
      <div class="flex items-center gap-6 bg-gray-50 p-2 rounded-lg border border-gray-200">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-gray-400 uppercase">Form:</span>
          <select v-model="selectedFormId" class="bg-white border rounded px-3 py-1 text-sm font-medium focus:ring-black focus:border-black">
            <option v-for="form in forms" :key="form.id" :value="form.id">{{ form.title }}</option>
          </select>
        </div>

        <div v-if="availableT1s.length > 0" class="flex items-center gap-2 border-l pl-6 border-gray-300">
          <span class="text-xs font-bold text-gray-400 uppercase">Filter Rep:</span>
          <select v-model="selectedT1Name" class="bg-white border rounded px-3 py-1 text-sm font-medium focus:ring-black focus:border-black min-w-[150px]">
            <option value="">All Reps ({{ availableT1s.length }})</option>
            <option v-for="name in availableT1s" :key="name" :value="name">{{ name }}</option>
          </select>
        </div>
      </div>
    </div>

    <div v-if="displayedSubmissions.length > 0" class="overflow-x-auto bg-white shadow rounded-lg">
      <table class="w-full text-left border-collapse">
        <thead class="bg-black text-white">
          <tr>
            <th class="p-4 whitespace-nowrap">Date</th>
            <th v-for="field in currentSchema.filter(f => !f.is_partner)" :key="field.id" class="p-4 whitespace-nowrap">
              {{ field.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="sub in displayedSubmissions" :key="sub.id" class="border-b hover:bg-gray-50">
            <td class="p-4 text-gray-500">{{ formatDate(sub.created_at) }}</td>
            
            <td v-for="field in currentSchema.filter(f => !f.is_partner)" :key="field.id" class="p-4">
              <div v-if="sub.response_data[field.id]?.toString().startsWith('data:image')">
                <img :src="sub.response_data[field.id]" class="h-10 border rounded bg-white" />
              </div>
              <div v-else>
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