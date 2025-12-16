<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'

const router = useRouter()
const isSaving = ref(false)

// 1. Form Metadata
const title = ref('')
const slug = ref('')

// 2. The List of Fields (Starts empty)
const fields = ref([])

// Helper: Add a new field to the list
const addField = (type) => {
  fields.value.push({
    id: crypto.randomUUID(), // Generate a unique ID for the field
    type: type,
    label: '', // User will type this
    required: false,
    options: [], // Optional
  })
}

// Helper: Remove a field
const removeField = (index) => {
  fields.value.splice(index, 1)
}

// 3. Save to Database
const saveForm = async () => {
  if (!title.value) return alert('Please provide a Title.')

  isSaving.value = true

  // 1. GENERATE SLUG
  const generatedSlug = title.value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  // 2. PROCESS SCHEMA (The New Logic 🧠)
  // We create a new array where Smart Fields get a "Partner"
  const finalSchema = []

  fields.value.forEach((field) => {
    // A. Push the original field (The Selector)
    finalSchema.push(field)

    // B. Check if it needs a Partner Field
    if (field.type === 'depot_select') {
      finalSchema.push({
        id: field.id + '_ship_to_number', // Link it by ID
        type: 'text', // It's just text
        label: 'Depot ID', // The column header
        required: false,
        readOnly: true, // User can't edit it directly
        is_partner: true, // Flag for UI to maybe hide it later
      })
    } else if (field.type === 'poc_select') {
      finalSchema.push({
        id: field.id + '_sap_id',
        type: 'text',
        label: 'POC ID',
        required: false,
        readOnly: true,
        is_partner: true,
      })
    } else if (field.type === 't1_select') {
      finalSchema.push({
        id: field.id + '_manager_name',
        type: 'text',
        label: 'T2 Manager',
        required: false,
        readOnly: true,
        is_partner: true,
      })
    }
  })

  // 3. SEND TO DB
  const { error } = await supabase.from('forms').insert({
    title: title.value,
    slug: generatedSlug,
    status: 'active',
    schema: finalSchema, // <--- We save the expanded list
  })

  isSaving.value = false

  if (error) {
    if (error.code === '23505') alert('Title already exists.')
    else alert('Error: ' + error.message)
  } else {
    alert('Form created!')
    router.push('/')
  }
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-8">
    <div class="flex justify-between items-end mb-8">
      <h1 class="text-3xl font-bold">Form Builder</h1>
      <button
        @click="saveForm"
        :disabled="isSaving"
        class="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50"
      >
        {{ isSaving ? 'Saving...' : 'Save Form' }}
      </button>
    </div>
    
    <div
      class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-2"
    >
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Form Title</label>
        <input
          v-model="title"
          type="text"
          placeholder="e.g. NAB Commando"
          class="w-full border rounded-md p-2"
        />
      </div>
      
    </div>
    <div
      class=" bg-white  text-white p-2 rounded-xl flex-wrap shadow-sm flex gap-2 mb-8 border border-gray-200 justify-center"
    >
      <button
        @click="addField('text')"
        class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-sm text-sm font-bold shadow-md transition"
      >
        + Text
      </button>
      <button
        @click="addField('number')"
        class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-sm text-sm font-bold shadow-md transition"
      >
        + Number
      </button>
      <button
        @click="addField('select')"
        class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-sm text-sm font-bold shadow-md transition"
      >
        + Dropdown
      </button>
      <button
        @click="addField('poc_select')"
        class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-sm text-sm font-bold shadow-md transition"
      >
        + POC Search
      </button>
      <button
        @click="addField('signature')"
        class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-sm text-sm font-bold shadow-md transition"
      >
        + Signature
      </button>
      <button
        @click="addField('depot_select')"
        class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-sm text-sm font-bold shadow-md transition"
      >
        + Depot
      </button>

      <button
        @click="addField('t1_select')"
        class="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-sm text-sm font-bold shadow-md transition"
      >
        + T1/T2 User
      </button>
    </div>

    <div class="space-y-4 mb-10">
      <div
        v-for="(field, index) in fields"
        :key="field.id"
        class="bg-white p-4 rounded-lg shadow border border-gray-200 flex gap-4 items-start"
      >
        <div class="text-gray-400 mt-3 cursor-move">⋮⋮</div>

        <div class="flex-grow grid grid-cols-12 gap-4">
          <div class="col-span-2">
            <label class="text-xs text-gray-500 uppercase font-bold">Type</label>
            <div class="bg-gray-100 px-2 py-2 rounded text-sm font-mono mt-1">{{ field.type }}</div>
          </div>
          <div
            v-if="field.type === 'select'"
            class="col-span-12 bg-purple-50 p-3 rounded-md border border-purple-100"
          >
            <label class="text-xs text-purple-600 uppercase font-bold"
              >Options (Comma Separated)</label
            >
            <input
              type="text"
              placeholder="e.g. Red, Blue, Green"
              class="w-full border border-purple-200 rounded p-2 mt-1 focus:ring-purple-500 focus:border-purple-500"
              :value="field.options ? field.options.join(', ') : ''"
              @input="(e) => (field.options = e.target.value.split(',').map((s) => s.trim()))"
            />
            <p class="text-xs text-gray-400 mt-1">Users will select one of these.</p>
          </div>
          <div class="col-span-6">
            <label class="text-xs text-gray-500 uppercase font-bold">Question Label</label>
            <input
              v-model="field.label"
              type="text"
              placeholder="What is the question?"
              class="w-full border rounded p-2 mt-1"
            />
          </div>

          <div class="col-span-2 flex flex-col items-center">
            <label class="text-xs text-gray-500 uppercase font-bold">Required?</label>
            <input v-model="field.required" type="checkbox" class="mt-4 h-5 w-5" />
          </div>

          <div class="col-span-2 flex items-center justify-end">
            <button
              @click="removeField(index)"
              class="text-red-500 hover:text-red-700 text-sm font-bold"
            >
              Remove
            </button>
          </div>
        </div>
      </div>

      <div
        v-if="fields.length === 0"
        class="text-center py-10 border-2 border-dashed border-gray-300 rounded-xl text-gray-400"
      >
        Form is empty. Add a field below.
      </div>
    </div>
  </div>
</template>
