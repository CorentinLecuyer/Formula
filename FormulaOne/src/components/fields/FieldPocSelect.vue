<script setup>
import { ref } from 'vue'
import { supabase } from '../../supabase'

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: [Object, null], // Expecting an object { name, id, sap_id }
})

const emit = defineEmits(['update:modelValue'])

const searchQuery = ref('')
const results = ref([])
const showResults = ref(false)

// Safe defaults using optional chaining
const selectedPocName = ref(props.modelValue?.name || '')
const selectedSapId = ref(props.modelValue?.sap_id || '')

const searchPocs = async () => {
  if (searchQuery.value.length < 2) return

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
  emit('update:modelValue', null)
}
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
        v-if="showResults && results.length"
        class="absolute z-50 bg-white border mt-1 w-full shadow-lg rounded max-h-60 overflow-auto"
      >
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
