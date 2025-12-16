<script setup>
import { ref, watch } from 'vue'
import { supabase } from '../../supabase'

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: [Object, null], // Expecting an object { name, id, sap_id }
})

const emit = defineEmits(['update:modelValue'])

const searchQuery = ref('')
const results = ref([])
const showResults = ref(false)
const isManualMode = ref(false)
const manualInputName = ref('')

// Safe defaults
const selectedPocName = ref(props.modelValue?.name || '')
const selectedSapId = ref(props.modelValue?.sap_id || '')

const searchPocs = async () => {
  if (searchQuery.value.length < 2) {
    showResults.value = false
    return
  }

  const { data, error } = await supabase
    .from('pocs')
    .select('id, Name, ABI_SFA_City__c, ABI_SFA_SAPID__c')
    .ilike('Name', `%${searchQuery.value}%`)
    .limit(200)

  if (!error) {
    results.value = data || []
    showResults.value = true
  }
}

const selectPoc = (poc) => {
  // Handle Manual Entry
  if (poc.id === 'MANUAL_ENTRY') {
    isManualMode.value = true
    selectedPocName.value = ''
    selectedSapId.value = '00000000' // Default fixed ID
    manualInputName.value = ''
    
    // Reset UI
    searchQuery.value = ''
    showResults.value = false
    return
  }

  // Handle Standard Selection
  isManualMode.value = false
  selectedPocName.value = poc.Name
  selectedSapId.value = poc.ABI_SFA_SAPID__c

  // Reset UI
  searchQuery.value = ''
  showResults.value = false

  emit('update:modelValue', {
    name: poc.Name,
    id: poc.id,
    sap_id: poc.ABI_SFA_SAPID__c,
  })
}

const clearSelection = () => {
  selectedPocName.value = ''
  selectedSapId.value = ''
  isManualMode.value = false
  manualInputName.value = ''
  emit('update:modelValue', null)
}

// Watch manual input to update parent
watch(manualInputName, (newVal) => {
  if (isManualMode.value) {
    selectedPocName.value = newVal
    emit('update:modelValue', {
      name: newVal,
      id: 'MANUAL', // Or generate a UUID if preferred
      sap_id: '00000000'
    })
  }
})

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    // Data loaded! Update the local display variables
    selectedPocName.value = newVal.name || ''
    selectedSapId.value = newVal.sap_id || ''
    
    // If using the manual mode logic we added earlier:
    if (newVal.id === 'MANUAL_ENTRY' || newVal.id === 'MANUAL') {
        isManualMode.value = true
        manualInputName.value = newVal.name
    }
  }
}, { immediate: true })
</script>

<template>
  <div class="space-y-2">
    <div class="relative">

      <input
        v-model="searchQuery"
        @input="searchPocs"
        type="text"
        placeholder="Type to search POC..."
        class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-black"
      />

      <ul
        v-if="showResults"
        class="absolute z-50 bg-white border mt-1 w-full shadow-lg rounded max-h-60 overflow-auto"
      >
        <li
          @click="selectPoc({ id: 'MANUAL_ENTRY' })"
          class="px-3 py-2 hover:bg-yellow-50 cursor-pointer text-sm border-b border-gray-100 bg-gray-50 text-blue-600 font-bold"
        >
          --- Inexistant dans la liste ---
        </li>

        <li
          v-for="poc in results"
          :key="poc.id"
          @click="selectPoc(poc)"
          class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-0"
        >
          <span class="font-bold">{{ poc.Name }}</span>
          <span class="text-xs text-gray-500 block">{{ poc.ABI_SFA_City__c }}</span>
        </li>
      </ul>
    </div>

    <div v-if="isManualMode" class="animate-fade-in-down">
      <input 
        type="text" 
        v-model="manualInputName"
        class="w-full border-2 border-yellow-400 bg-yellow-50 rounded-md p-2 text-gray-900 focus:ring-0 placeholder-gray-500"
        placeholder="Entrer le nom du POC manuellement"
        required
      />
    </div>

    <div class="flex gap-4 p-3 bg-gray-50 rounded border border-gray-200">
      <div class="flex-1">
        <label class="text-[10px] text-gray-400 uppercase">Selected POC</label>
        <div class="font-bold text-gray-800">{{ selectedPocName || '-' }}</div>
      </div>
      <div class="w-1/3 border-l pl-4 border-gray-200 relative">
        <label class="text-[10px] text-gray-400 uppercase">Ship To #</label>
        <div class="font-bold text-gray-500">{{ selectedSapId || '-' }}</div>

        <button
          v-if="selectedPocName"
          @click="clearSelection"
          class="absolute top-0 right-0 text-red-400 hover:text-red-600 font-bold px-1"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>