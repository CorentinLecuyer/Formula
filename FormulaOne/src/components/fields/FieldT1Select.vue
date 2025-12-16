<script setup>
import { ref, watch } from 'vue'
import { supabase } from '@/supabase'

const props = defineProps(['modelValue', 'field'])
const emit = defineEmits(['update:modelValue'])

const searchQuery = ref('')
const results = ref([])
const showResults = ref(false)

const t1Name = ref(props.modelValue?.t1 || '')
const t2Name = ref(props.modelValue?.t2 || '')

const onSearch = async () => {
  if (searchQuery.value.length < 2) return

  // MAGIC QUERY: Fetch T1 and join the linked T2 table
  const { data, error } = await supabase
    .from('t1_users')
    .select(
      `
      full_name,
      t2_users ( full_name ) 
    `,
    )
    .ilike('full_name', `%${searchQuery.value}%`)
    .limit(5)

  if (error) console.error(error)

  results.value = data || []
  showResults.value = true
}
const clearSelection = () => {
  t1Name.value = ''
  t2Name.value = ''
  emit('update:modelValue', null)
}

const selectUser = (row) => {
  t1Name.value = row.full_name
  // Access the joined data safely
  t2Name.value = row.t2_users?.full_name || 'No Manager Linked'

  showResults.value = false
  searchQuery.value = ''

  emit('update:modelValue', { t1: t1Name.value, t2: t2Name.value })
}

watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    // Update whatever local variables control the text input
    t1Name.value = newVal.t1
    t2Name.value = newVal.t2
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
        placeholder="Type name..."
        class="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
      />

      <ul
        v-if="showResults && results.length"
        class="absolute z-50 bg-white border mt-1 w-full shadow-lg rounded"
      >
        <li
          v-for="item in results"
          :key="item.full_name"
          @click="selectUser(item)"
          class="p-2 hover:bg-green-50 cursor-pointer text-sm border-b"
        >
          {{ item.full_name }}
        </li>
      </ul>
    </div>

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
          @click="clearSelection"
          class="absolute top-0 right-0 text-red-400 hover:text-red-600 font-bold px-1"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>
