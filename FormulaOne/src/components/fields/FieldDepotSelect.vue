<script setup>
import { ref, watch } from 'vue'
import { supabase } from '@/supabase'

const props = defineProps(['modelValue', 'field'])
const emit = defineEmits(['update:modelValue'])

const searchQuery = ref('')
const results = ref([])
const showResults = ref(false)
const isManualMode = ref(false)
const manualInputName = ref('')

// Initialize with existing data if available
const depotName = ref(props.modelValue?.name || '')
const shipToNumber = ref(props.modelValue?.number || '')

// 1. Search Logic
const onSearch = async () => {
  if (searchQuery.value.length < 2) {
    showResults.value = false
    return
  }

  const { data } = await supabase
    .from('depots')
    .select('id, "Ship to Name", "Ship to number"')
    .ilike('"Ship to Name"', `%${searchQuery.value}%`)
    .limit(50)

  results.value = data || []
  showResults.value = true
}

// 2. Select Selection
const selectItem = (row) => {
  // Handle Manual Entry selection
  if (row.id === 'MANUAL_ENTRY') {
    isManualMode.value = true
    depotName.value = '' // Clear display name until they type
    shipToNumber.value = '00000000' // Default fixed ID
    manualInputName.value = '' // Reset manual input
    showResults.value = false
    searchQuery.value = '' // Clear search bar
    return
  }

  // Handle Standard Selection
  isManualMode.value = false
  depotName.value = row['Ship to Name']
  shipToNumber.value = row['Ship to number']

  showResults.value = false
  searchQuery.value = ''

  emit('update:modelValue', {
    name: depotName.value,
    number: shipToNumber.value,
  })
}

const clearSelection = () => {
  depotName.value = ''
  shipToNumber.value = ''
  isManualMode.value = false
  manualInputName.value = ''
  emit('update:modelValue', null)
}

// 3. Watch Manual Input
watch(manualInputName, (newVal) => {
  if (isManualMode.value) {
    depotName.value = newVal
    emit('update:modelValue', {
      name: newVal,
      number: '00000000'
    })
  }
})

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    depotName.value = newVal.name || ''
    shipToNumber.value = newVal.number || ''

    // If using manual mode logic
    if (newVal.id === 'MANUAL_ENTRY') {
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
        @input="onSearch"
        type="text"
        placeholder="Start typing depot name..."
        class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
      />

      <ul
        v-if="showResults"
        class="absolute z-50 bg-white border mt-1 w-full shadow-lg rounded max-h-48 overflow-auto"
      >
        <li
          @click="selectItem({ id: 'MANUAL_ENTRY' })"
          class="p-2 hover:bg-yellow-50 cursor-pointer text-sm border-b border-gray-100 bg-gray-50 text-blue-600 font-bold"
        >
          --- Inexistant dans la liste ---
        </li>

        <li
          v-for="item in results"
          :key="item.id"
          @click="selectItem(item)"
          class="p-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0"
        >
          <span class="font-bold">{{ item['Ship to Name'] }}</span>
          <span class="text-gray-400 text-xs ml-2">#{{ item['Ship to number'] }}</span>
        </li>
      </ul>
    </div>

    <div v-if="isManualMode" class="animate-fade-in-down">
      <input 
        type="text" 
        v-model="manualInputName"
        class="w-full border-2 border-yellow-400 bg-yellow-50 rounded-md p-2 text-gray-900 focus:ring-0 placeholder-gray-500"
        placeholder="Entrer le nom du DEPOT manuellement"
        required
      />
    </div>

    <div class="flex gap-4 p-3 bg-gray-50 rounded border border-gray-200">
      <div class="flex-1">
        <label class="text-[10px] text-gray-400 uppercase">Selected Depot</label>
        <div class="font-bold text-gray-800">{{ depotName || '-' }}</div>
      </div>
      <div class="w-1/3 border-l pl-4 border-gray-200 relative">
        <label class="text-[10px] text-gray-400 uppercase">Ship To #</label>
        <div class="font-bold text-gray-500">{{ shipToNumber || '-' }}</div>
                <button
          v-if="depotName"
          @click="clearSelection"
          class="absolute top-0 right-0 text-red-400 hover:text-red-600 font-bold px-1"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>