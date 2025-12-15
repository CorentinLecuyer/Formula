<script setup>
import { ref, watch } from 'vue'
import { supabase } from '../../supabase'

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: [String, Object] // Can be the ID or null
})

const emit = defineEmits(['update:modelValue'])

const searchQuery = ref('')
const results = ref([])
const isSearching = ref(false)
const selectedLabel = ref('')

// 1. Search Logic
const searchPocs = async () => {
  if (searchQuery.value.length < 2) return
  
  isSearching.value = true
  // Query your existing 'pocs' table
  const { data, error } = await supabase
    .from('pocs')
    .select('id, Name, ABI_SFA_City__c, ABI_SFA_SAPID__c')
    .ilike('Name', `%${searchQuery.value}%`)
    .limit(200)

  if (!error) {
    results.value = data
  }
  isSearching.value = false
}

// 2. Select Logic
const selectPoc = (poc) => {
  // Format how it looks in the box
  selectedLabel.value = `${poc.Name} (${poc.ABI_SFA_City__c})`
  searchQuery.value = '' // Clear search
  results.value = [] // Hide dropdown
  
  // Send the ID back to the form
  emit('update:modelValue', poc.id)
}

// 3. Clear Logic
const clearSelection = () => {
  selectedLabel.value = ''
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="flex flex-col gap-1 relative">
    <label class="text-sm font-medium text-gray-700">
      {{ field.label }} <span v-if="field.required" class="text-red-500">*</span>
    </label>

    <div v-if="!modelValue">
      <input
        type="text"
        v-model="searchQuery"
        @input="searchPocs"
        placeholder="Type to search POCs..."
        class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-black"
      />
      
      <ul v-if="results.length > 0" class="absolute z-10 w-full bg-white border border-gray-200 mt-1 rounded-md shadow-lg max-h-60 overflow-y-auto">
        <li 
          v-for="poc in results" 
          :key="poc.id"
          @click="selectPoc(poc)"
          class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b border-gray-50 last:border-0"
        >
          <span class="font-bold">{{ poc.Name }}</span>
          <br/>
          <span class="text-xs text-gray-500">{{ poc.ABI_SFA_City__c }} // {{ poc.ABI_SFA_SAPID__c }}</span>
        </li>
      </ul>
      <div v-else-if="searchQuery.length > 2 && !isSearching" class="text-sm text-gray-500 mt-1">
        No results found.
      </div>
    </div>

    <div v-else class="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
      <span class="font-medium text-blue-900">{{ selectedLabel || 'POC Selected (ID: ' + modelValue + ')' }}</span>
      <button @click="clearSelection" class="text-blue-500 hover:text-blue-700 font-bold px-2">
        ✕
      </button>
    </div>
  </div>
</template>