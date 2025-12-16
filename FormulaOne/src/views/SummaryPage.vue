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
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
      <h1 class="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
      
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
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
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
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
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