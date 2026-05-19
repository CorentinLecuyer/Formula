<script setup>
import { ref, watch, computed } from 'vue'
import { supabase } from '@/supabase'

const props = defineProps({
  modelValue: {
    type: Object,
    default: null,
  },
  field: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['update:modelValue'])

const searchQuery = ref('')
const results = ref([])
const showResults = ref(false)
const isSearching = ref(false)
const isManualMode = ref(false)
const manualInputName = ref('')

const depotName = ref('')
const shipToNumber = ref('')

const isLimitedSource = computed(() => props.field?.sourceFilter?.mode === 'limited')

const allowedShipToNumbers = computed(() =>
  (props.field?.sourceFilter?.allowedOptions || [])
    .map((option) => option.value || option.meta)
    .filter(Boolean),
)

const hasLimitedOptions = computed(() => allowedShipToNumbers.value.length > 0)

const syncFromModelValue = (value) => {
  depotName.value = value?.name || ''
  shipToNumber.value = value?.number || ''

  const isManualValue = value?.id === 'MANUAL_ENTRY' || value?.id === 'MANUAL'
  isManualMode.value = isManualValue
  manualInputName.value = isManualValue ? value?.name || '' : ''
}

watch(
  () => props.modelValue,
  (newValue) => {
    syncFromModelValue(newValue)
  },
  { immediate: true },
)

watch(manualInputName, (newValue) => {
  if (!isManualMode.value) return

  depotName.value = newValue

  emit('update:modelValue', {
    name: newValue,
    number: '00000000',
    id: 'MANUAL',
  })
})

const onSearch = async () => {
  const term = searchQuery.value.trim()

  if (term.length < 2) {
    results.value = []
    showResults.value = false
    return
  }

  if (isLimitedSource.value && !hasLimitedOptions.value) {
    results.value = []
    showResults.value = true
    return
  }

  isSearching.value = true

  let query = supabase
    .from('depots')
    .select('id, "Ship to Name", "Ship to number"')
    .ilike('"Ship to Name"', `%${term}%`)

  if (isLimitedSource.value) {
    query = query.in('"Ship to number"', allowedShipToNumbers.value)
  }

  const { data, error } = await query.limit(50)

  if (error) {
    console.error('Depot search failed:', error)
    results.value = []
  } else {
    results.value = data || []
  }

  showResults.value = true
  isSearching.value = false
}

const selectItem = (row) => {
  if (row.id === 'MANUAL_ENTRY') {
    if (isLimitedSource.value) return

    isManualMode.value = true
    depotName.value = ''
    shipToNumber.value = '00000000'
    manualInputName.value = ''
    searchQuery.value = ''
    results.value = []
    showResults.value = false
    return
  }

  isManualMode.value = false
  manualInputName.value = ''

  depotName.value = row['Ship to Name']
  shipToNumber.value = row['Ship to number']

  searchQuery.value = ''
  results.value = []
  showResults.value = false

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
  searchQuery.value = ''
  results.value = []
  showResults.value = false
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="space-y-2">
    <div class="relative">
      <input
        v-model="searchQuery"
        @input="onSearch"
        @focus="searchQuery.trim().length >= 2 && (showResults = true)"
        type="text"
        placeholder="Start typing depot name..."
        class="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
      />

      <div
        v-if="showResults"
        class="absolute z-50 bg-white border mt-1 w-full shadow-lg rounded max-h-60 overflow-auto"
      >
        <div v-if="isSearching" class="p-3 text-sm text-gray-500">Searching...</div>

        <div
          v-else-if="isLimitedSource && !hasLimitedOptions"
          class="p-3 text-sm text-orange-700 bg-orange-50"
        >
          No depots are allowed for this form.
        </div>

        <template v-else>
          <button
            v-if="!isLimitedSource"
            type="button"
            @mousedown.prevent="selectItem({ id: 'MANUAL_ENTRY' })"
            class="block w-full text-left p-2 hover:bg-yellow-50 cursor-pointer text-sm border-b border-gray-100 bg-gray-50 text-blue-600 font-bold"
          >
            --- Inexistant dans la liste ---
          </button>

          <div
            v-if="results.length === 0"
            class="p-3 text-sm text-gray-500"
          >
            No matching depot found.
          </div>

          <template v-else>
            <button
              v-for="item in results"
              :key="item.id || item['Ship to number']"
              type="button"
              @mousedown.prevent="selectItem(item)"
              class="block w-full text-left p-2 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-b-0"
            >
              <span class="font-bold text-gray-800">{{ item['Ship to Name'] }}</span>
              <span class="text-gray-400 text-xs ml-2">#{{ item['Ship to number'] }}</span>
            </button>
          </template>
        </template>
      </div>
    </div>

    <p v-if="isLimitedSource" class="text-xs text-green-700">
      This list is restricted for this form.
    </p>

    <div v-if="isManualMode" class="animate-fade-in-down">
      <input
        v-model="manualInputName"
        type="text"
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
          type="button"
          @click="clearSelection"
          class="absolute top-0 right-0 text-red-400 hover:text-red-600 font-bold px-1"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>
