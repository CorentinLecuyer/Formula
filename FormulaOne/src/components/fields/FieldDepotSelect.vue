<script setup>
import { ref } from 'vue'
import { supabase } from '@/supabase'

const props = defineProps(['modelValue', 'field'])
const emit = defineEmits(['update:modelValue'])

const searchQuery = ref('')
const results = ref([])
const showResults = ref(false)

// Initialize with existing data if available
const depotName = ref(props.modelValue?.name || '')
const shipToNumber = ref(props.modelValue?.number || '')

// 1. Search Logic
const onSearch = async () => {
  if (searchQuery.value.length < 2) return

  const { data } = await supabase
    .from('depots')
    .select('id, "Ship to Name", "Ship to number"')
    .ilike('"Ship to Name"', `%${searchQuery.value}%`) // Case-insensitive search
    .limit(50)

  results.value = data || []
  showResults.value = true
}

// 2. Select & Auto-fill
const selectItem = (row) => {
  depotName.value = row['Ship to Name']
  shipToNumber.value = row['Ship to number']

  // Reset search
  showResults.value = false
  searchQuery.value = ''

  // Save composite object
  emit('update:modelValue', {
    name: depotName.value,
    number: shipToNumber.value,
  })
}
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
        v-if="showResults && results.length"
        class="absolute z-50 bg-white border mt-1 w-full shadow-lg rounded max-h-48 overflow-auto"
      >
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

    <div class="flex gap-4 p-3 bg-gray-50 rounded border border-gray-200">
      <div class="flex-1">
        <label class="text-[10px] text-gray-400 uppercase">Selected Depot</label>
        <div class="font-bold text-gray-800">{{ depotName || '-' }}</div>
      </div>
      <div class="w-1/3 border-l pl-4 border-gray-200">
        <label class="text-[10px] text-gray-400 uppercase">Ship To #</label>
        <div class="font-bold text-gray-500">{{ shipToNumber || '-' }}</div>
      </div>
    </div>
  </div>
</template>
