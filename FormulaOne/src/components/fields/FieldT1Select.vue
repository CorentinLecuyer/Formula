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

const t1Name = ref('')
const t2Name = ref('')

const isLimitedSource = computed(() => props.field?.sourceFilter?.mode === 'limited')

const allowedT1Names = computed(() =>
  (props.field?.sourceFilter?.allowedOptions || [])
    .map((option) => option.value || option.label)
    .filter(Boolean),
)

const hasLimitedOptions = computed(() => allowedT1Names.value.length > 0)

const syncFromModelValue = (value) => {
  t1Name.value = value?.t1 || ''
  t2Name.value = value?.t2 || ''
}

watch(
  () => props.modelValue,
  (newValue) => {
    syncFromModelValue(newValue)
  },
  { immediate: true },
)

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
    .from('t1_users')
    .select(
      `
      full_name,
      t2_users ( full_name )
    `,
    )
    .ilike('full_name', `%${term}%`)

  if (isLimitedSource.value) {
    query = query.in('full_name', allowedT1Names.value)
  }

  const { data, error } = await query.limit(50)

  if (error) {
    console.error('T1 search failed:', error)
    results.value = []
  } else {
    results.value = data || []
  }

  showResults.value = true
  isSearching.value = false
}

const selectUser = (row) => {
  t1Name.value = row.full_name
  t2Name.value = row.t2_users?.full_name || 'No Manager Linked'

  searchQuery.value = ''
  results.value = []
  showResults.value = false

  emit('update:modelValue', {
    t1: t1Name.value,
    t2: t2Name.value,
  })
}

const clearSelection = () => {
  t1Name.value = ''
  t2Name.value = ''
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
        placeholder="Type T1 name..."
        class="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
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
          No T1 users are allowed for this form.
        </div>

        <div
          v-else-if="results.length === 0"
          class="p-3 text-sm text-gray-500"
        >
          No matching T1 user found.
        </div>

        <template v-else>
          <button
            v-for="item in results"
            :key="item.full_name"
            type="button"
            @mousedown.prevent="selectUser(item)"
            class="block w-full text-left p-2 hover:bg-green-50 cursor-pointer text-sm border-b last:border-b-0"
          >
            <span class="font-bold text-gray-800">{{ item.full_name }}</span>
            <span class="block text-xs text-gray-500">
              Manager: {{ item.t2_users?.full_name || 'No Manager Linked' }}
            </span>
          </button>
        </template>
      </div>
    </div>

    <p v-if="isLimitedSource" class="text-xs text-green-700">
      This list is restricted for this form.
    </p>

    <div class="flex gap-4 p-3 bg-gray-50 rounded border border-gray-200">
      <div class="flex-1">
        <label class="text-[10px] text-gray-400 uppercase">T1 user</label>
        <div class="font-bold text-gray-800">{{ t1Name || '-' }}</div>
      </div>

      <div class="w-1/3 border-l pl-4 border-gray-200 relative">
        <label class="text-[10px] text-gray-400 uppercase">T2 Manager (Auto)</label>
        <div class="font-bold text-gray-500">{{ t2Name || '-' }}</div>

        <button
          v-if="t1Name"
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
