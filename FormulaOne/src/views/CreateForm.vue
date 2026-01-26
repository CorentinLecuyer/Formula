<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { supabase } from '../supabase'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'

const router = useRouter()
const route = useRoute()
const toast = useToast()

// STATE
const isSaving = ref(false)
const isLoading = ref(false)
const isEditing = ref(false)
const formId = ref(null)
const currentUser = ref(null)

// 1. Form Metadata
const status = ref('draft') // Default is draft
const title = ref('')
const description = ref('')
const infoBlocks = ref([])

// 2. Fields List
const fields = ref([])

// STATE FOR ICON PICKER
const showIconPicker = ref(false)
const activeBlockIndex = ref(null)

const iconLibrary = [
  { category: 'Status', icons: ['ℹ️', '⚠️', '✅', '❌', '❓', '❗', '🎨', '🆗'] },
  { category: 'Safety', icons: ['⛑️', '🦺', '👓', '🧤', '🔥', '⚡', '🚧', '🚑'] },
  { category: 'Business', icons: ['📊', '📈', '📉', '📅', '📎', '💼', '📁', '🤝'] },
  { category: 'Logistics', icons: ['📦', '🚛', '🏭', '📍', '🗺️', '⏱️', '🧱', '🏗️'] },
  { category: 'Action', icons: ['🎯', '🚀', '🔍', '✏️', '📸', '📞', '💾', '🗑️'] },
  { category: 'Fun/Other', icons: ['🍺', '🍻', '⭐', '💡', '🎉', '🏆', '🍔', '👍'] },
  { category: 'Tools', icons: ['🧰', '⛏️', '🔨', '🔧', '⚒️', '🛠️', '🔩'] },
]

onMounted(async () => {
  const { data } = await supabase.auth.getUser()
  currentUser.value = data.user

  if (route.params.slug) {
    isEditing.value = true
    await loadFormForEdit(route.params.slug)
  }
})

const loadFormForEdit = async (slug) => {
  isLoading.value = true
  const { data, error } = await supabase.from('forms').select('*').eq('slug', slug).single()

  if (error) {
    toast.error('Error loading form: ' + error.message)
    router.push('/')
    return
  }

  formId.value = data.id
  title.value = data.title
  description.value = data.description
  status.value = data.status
  infoBlocks.value = data.info_blocks || []
  fields.value = (data.schema || []).filter((field) => !field.is_partner)

  isLoading.value = false
}

// --- HELPER FUNCTIONS ---
const openIconPicker = (index) => {
  activeBlockIndex.value = index
  showIconPicker.value = true
}

const selectIcon = (icon) => {
  if (activeBlockIndex.value !== null) {
    infoBlocks.value[activeBlockIndex.value].icon = icon
  }
  showIconPicker.value = false
  activeBlockIndex.value = null
}

const addInfoBlock = () => {
  infoBlocks.value.push({ icon: 'ℹ️', title: '', content: '' })
}

const addField = (type) => {
  const newField = {
    id: crypto.randomUUID(),
    type: type,
    label: '',
    required: false,
    options: [],
    // Validation Object
    validation: {
      minLength: null,
      maxLength: null,
      min: null,
      max: null,
      multiSelect: false,
      minSelect: null,
      maxSelect: null,
      maxFileSize: 5,
      // Table Specific
      sumColumnId: '',
      minSum: null,
      maxSum: null,
    },
  }

  // Initial Setup for Table Type
  if (type === 'table') {
    newField.columns = [
      {
        id: crypto.randomUUID(),
        label: 'Item',
        type: 'text',
        locked: true,
        required: false, // New: Column Level Required
        validation: { minLength: null, maxLength: null },
      },
      {
        id: crypto.randomUUID(),
        label: 'Quantity',
        type: 'number',
        locked: false,
        required: true, // Example: Quantity usually required
        validation: { min: null, max: null },
      },
    ]
    newField.rows = [{ [newField.columns[0].id]: '', [newField.columns[1].id]: '' }]
  }

  fields.value.push(newField)
}

// --- TABLE SPECIFIC LOGIC ---
const addTableColumn = (fieldIndex) => {
  const field = fields.value[fieldIndex]
  if (field.columns.length >= 6) {
    toast.warning('Max 6 columns allowed')
    return
  }
  const newColId = crypto.randomUUID()
  field.columns.push({
    id: newColId,
    label: 'New Col',
    type: 'text',
    locked: false,
    required: false, // New col default
    validation: {},
  })

  // Update existing rows
  field.rows.forEach((row) => {
    row[newColId] = ''
  })
}

const removeTableColumn = (fieldIndex, colIndex) => {
  const field = fields.value[fieldIndex]
  if (field.columns.length <= 2) {
    toast.warning('Min 2 columns required')
    return
  }
  const colIdToRemove = field.columns[colIndex].id
  field.columns.splice(colIndex, 1)

  field.rows.forEach((row) => {
    delete row[colIdToRemove]
  })
}

const addTableRow = (fieldIndex) => {
  const field = fields.value[fieldIndex]
  const newRow = {}
  field.columns.forEach((col) => {
    newRow[col.id] = ''
  })
  field.rows.push(newRow)
}

const removeTableRow = (fieldIndex, rowIndex) => {
  fields.value[fieldIndex].rows.splice(rowIndex, 1)
}

const removeField = (index) => {
  fields.value.splice(index, 1)
}

// ... (Standard Helpers) ...
const handleContentKeydown = async (event, index) => {
  /* ... */
}
const handleDescriptionKeydown = async (event) => {
  /* ... */
}
const applyTagToSelection = async (textarea, openTag, closeTag, updateFn) => {
  /* ... */
}
const onDragStart = (event, index) => {
  /* ... */
}
const onDragEnter = (index) => {
  /* ... */
}
const onDragEnd = () => {
  /* ... */
}
const dragIndex = ref(null)
const isDragHandleHovered = ref(false)

// ... (Save/Delete/Upload Logic) ...
const saveForm = async () => {
  if (!title.value) return toast.warning('Please provide a Title.')
  isSaving.value = true

  let finalSlug = route.params.slug
  if (!isEditing.value) {
    finalSlug = title.value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const finalSchema = []
  fields.value.forEach((field) => {
    if (field.type === 'select' && Array.isArray(field.options)) {
      field.options = field.options.filter((opt) => opt.trim().length > 0)
    }
    finalSchema.push(field)

    // Partner fields
    if (field.type === 'depot_select') {
      finalSchema.push({
        id: field.id + '_ship_to_number',
        type: 'text',
        label: 'Depot ID',
        required: false,
        readOnly: true,
        is_partner: true,
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

  const payload = {
    title: title.value,
    slug: finalSlug,
    description: description.value,
    info_blocks: infoBlocks.value,
    schema: finalSchema,
    status: status.value,
    created_by: currentUser.value?.id,
  }

  let dbError = null
  if (isEditing.value) {
    const res = await supabase.from('forms').update(payload).eq('id', formId.value)
    dbError = res.error
  } else {
    const res = await supabase.from('forms').insert(payload)
    dbError = res.error
  }

  isSaving.value = false
  if (dbError) {
    toast.error('Error saving: ' + dbError.message)
  } else {
    toast.success(isEditing.value ? 'Form updated!' : 'Form created!')
    router.push('/')
  }
}

const deleteForm = async () => {
  if (!confirm('Are you sure?')) return
  isSaving.value = true
  await supabase.from('submissions').delete().eq('form_id', formId.value)
  const { error } = await supabase.from('forms').delete().eq('id', formId.value)
  if (error) {
    toast.error('Error deleting!')
  } else {
    router.push('/')
  }
}

const compressImage = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1000
        const scaleSize = MAX_WIDTH / img.width
        if (img.width > MAX_WIDTH) {
          canvas.width = MAX_WIDTH
          canvas.height = img.height * scaleSize
        } else {
          canvas.width = img.width
          canvas.height = img.height
        }
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }))
          },
          'image/jpeg',
          0.8,
        )
      }
    }
  })
}

const uploadFile = async (file) => {
  let fileToUpload = file
  if (file.type.startsWith('image/')) {
    try {
      fileToUpload = await compressImage(file)
    } catch (e) {
      console.warn(e)
    }
  }
  const filePath = `builder_assets/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
  const { error } = await supabase.storage.from('attachments').upload(filePath, fileToUpload)
  if (error) throw error
  const { data } = supabase.storage.from('attachments').getPublicUrl(filePath)
  return data.publicUrl
}

const handleBlockImageUpload = async (event, index) => {
  const file = event.target.files[0]
  if (!file) return
  try {
    const url = await uploadFile(file)
    infoBlocks.value[index].image = url
  } catch (e) {
    alert('Upload failed: ' + e.message)
  }
}

const handleTableCellImageUpload = async (event, fieldIndex, rowIndex, colId) => {
  const file = event.target.files[0]
  if (!file) return
  try {
    const url = await uploadFile(file)
    fields.value[fieldIndex].rows[rowIndex][colId] = url
  } catch (e) {
    alert('Upload failed: ' + e.message)
  }
}
</script>

<template>
  <div class="max-w-7xl mx-auto p-8">
    <div v-if="isLoading" class="text-center py-20 text-gray-500">
      <div class="animate-spin text-4xl mb-4">⌛</div>
      Loading...
    </div>

    <div v-else>
      <div class="flex justify-between items-end mb-8">
        <div>
          <h1 class="text-3xl font-bold">{{ isEditing ? 'Edit Form' : 'Build New Form' }}</h1>
          <p v-if="isEditing" class="text-sm text-gray-400 mt-1">Editing: {{ title }}</p>
        </div>
        <div class="flex gap-3">
          <button
            v-if="isEditing"
            @click="deleteForm"
            :disabled="isSaving"
            class="bg-red-50 text-red-600 border border-red-200 px-6 py-2 rounded-lg font-bold hover:bg-red-100 disabled:opacity-50"
          >
            Delete
          </button>
          <button
            @click="saveForm"
            :disabled="isSaving"
            class="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 shadow-sm"
          >
            {{ isSaving ? 'Saving...' : 'Save Form' }}
          </button>
        </div>
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Form Title</label>
          <input
            v-model="title"
            type="text"
            class="w-full border border-gray-300 rounded-md p-2 focus:ring-black focus:border-black"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select v-model="status" class="w-full border border-gray-300 rounded-md p-2 bg-white">
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Inactive</option>
          </select>
        </div>
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 space-y-6">
        <h2 class="text-xl font-bold border-b pb-2">Presentation & Context</h2>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Introductory Summary</label>
          <textarea
            v-model="description"
            rows="3"
            class="w-full border border-gray-300 rounded-md p-2 font-mono text-sm"
          ></textarea>
        </div>
        <div class="space-y-4">
          <button
            @click="addInfoBlock"
            class="flex items-center gap-2 text-sm text-black font-bold hover:opacity-70 mt-2"
          >
            <span
              class="bg-black text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
              >+</span
            >
            Add Info Block
          </button>
        </div>
      </div>

      <div
        class="bg-white p-3 rounded-xl shadow-sm flex flex-wrap gap-2 mb-8 border border-gray-200 justify-center sticky top-4 z-10"
      >
        <button
          @click="addField('text')"
          class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm font-bold shadow transition"
        >
          + Text
        </button>
        <button
          @click="addField('number')"
          class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm font-bold shadow transition"
        >
          + Number
        </button>

        <button
          @click="addField('signature')"
          class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm font-bold shadow transition"
        >
          + Signature
        </button>
        <button
          @click="addField('file')"
          class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm font-bold shadow transition"
        >
          + Attachment
        </button>
        <button
          @click="addField('select')"
          class="px-4 py-2 hover:bg-orange-800 bg-orange-700 text-white rounded-md text-sm font-bold shadow transition"
        >
          + Dropdown
        </button>
        <button
          @click="addField('table')"
          class="px-4 py-2 hover:bg-orange-800 bg-orange-700 text-white rounded-md text-sm font-bold shadow transition"
        >
          + Custom Table
        </button>
        <div class="w-px h-8 bg-gray-300 mx-2"></div>
        <button
          @click="addField('poc_select')"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-bold shadow transition"
        >
          + POC Search
        </button>
        <button
          @click="addField('depot_select')"
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-bold shadow transition"
        >
          + Depot
        </button>
        <button
          @click="addField('t1_select')"
          class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-bold shadow transition"
        >
          + T1 User
        </button>
      </div>

      <TransitionGroup name="list" tag="div" class="space-y-4 mb-20">
        <div
          v-for="(field, index) in fields"
          :key="field.id"
          class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex gap-4 items-start group transition-all duration-300"
        >
          <div class="flex-grow grid grid-cols-12 gap-6">
            <div class="col-span-2">
              <label class="text-xs text-gray-500 uppercase font-bold">Type</label>
              <div
                class="bg-gray-100 px-3 py-2 rounded text-sm font-mono mt-1 text-gray-600 border border-gray-200"
              >
                {{ field.type }}
              </div>
            </div>

            <div class="col-span-8">
              <label class="text-xs text-gray-500 uppercase font-bold">Question Label</label>
              <input
                v-model="field.label"
                type="text"
                class="w-full border border-gray-300 rounded p-2 mt-1 focus:ring-black focus:border-black"
              />
            </div>

            <div class="col-span-2 flex flex-col items-center">
              <label class="text-xs text-gray-500 uppercase font-bold">Required?</label>
              <input
                v-model="field.required"
                type="checkbox"
                class="mt-3 h-5 w-5 text-black focus:ring-black border-gray-300 rounded"
              />
            </div>

            <div
              v-if="field.required"
              class="col-span-12 bg-blue-50 p-3 rounded border border-blue-100 flex flex-wrap gap-4 items-center"
            >
              <span class="text-xs font-bold text-blue-800 uppercase flex items-center gap-1">
                🛡️ Validation Rules
              </span>

              <template v-if="field.type === 'text'">
                <div class="flex items-center gap-2">
                  <label class="text-xs text-blue-600">Min Chars</label>
                  <input
                    v-model="field.validation.minLength"
                    type="number"
                    class="w-16 p-1 text-xs border rounded"
                    placeholder="0"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <label class="text-xs text-blue-600">Max Chars</label>
                  <input
                    v-model="field.validation.maxLength"
                    type="number"
                    class="w-16 p-1 text-xs border rounded"
                    placeholder="∞"
                  />
                </div>
              </template>

              <template v-if="field.type === 'number'">
                <div class="flex items-center gap-2">
                  <label class="text-xs text-blue-600">Min Value</label>
                  <input
                    v-model="field.validation.min"
                    type="number"
                    class="w-16 p-1 text-xs border rounded"
                    placeholder="0"
                  />
                </div>
                <div class="flex items-center gap-2">
                  <label class="text-xs text-blue-600">Max Value</label>
                  <input
                    v-model="field.validation.max"
                    type="number"
                    class="w-16 p-1 text-xs border rounded"
                    placeholder="∞"
                  />
                </div>
              </template>

              <template v-if="field.type === 'select'">
                <label
                  class="flex items-center gap-1 text-xs text-blue-700 cursor-pointer select-none bg-white px-2 py-1 rounded border border-blue-200"
                >
                  <input type="checkbox" v-model="field.validation.multiSelect" />
                  Allow Multiple?
                </label>
                <template v-if="field.validation.multiSelect">
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-blue-600">Min Select</label>
                    <input
                      v-model="field.validation.minSelect"
                      type="number"
                      class="w-14 p-1 text-xs border rounded"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-blue-600">Max Select</label>
                    <input
                      v-model="field.validation.maxSelect"
                      type="number"
                      class="w-14 p-1 text-xs border rounded"
                    />
                  </div>
                </template>
              </template>

              <template v-if="['file', 'signature'].includes(field.type)">
                <div class="flex items-center gap-2">
                  <label class="text-xs text-blue-600">Max File Size (MB)</label>
                  <input
                    v-model="field.validation.maxFileSize"
                    type="number"
                    class="w-16 p-1 text-xs border rounded"
                    placeholder="5"
                  />
                </div>
              </template>

              <template v-if="field.type === 'table'">
                <div class="flex items-center gap-2">
                  <label class="text-xs text-blue-600">Sum Check on:</label>
                  <select
                    v-model="field.validation.sumColumnId"
                    class="text-xs p-1 border rounded w-24"
                  >
                    <option value="">(None)</option>
                    <option
                      v-for="col in field.columns.filter((c) => c.type === 'number' && !c.locked)"
                      :key="col.id"
                      :value="col.id"
                    >
                      {{ col.label }}
                    </option>
                  </select>
                </div>
                <template v-if="field.validation.sumColumnId">
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-blue-600">Min Total</label>
                    <input
                      v-model="field.validation.minSum"
                      type="number"
                      class="w-14 p-1 text-xs border rounded"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-blue-600">Max Total</label>
                    <input
                      v-model="field.validation.maxSum"
                      type="number"
                      class="w-14 p-1 text-xs border rounded"
                    />
                  </div>
                </template>
              </template>
            </div>

            <div
              v-if="field.type === 'table'"
              class="col-span-12 bg-purple-50 p-4 rounded-lg border border-purple-100"
            >
              <div class="grid gap-2 mb-4">
                <h4 class="text-xs font-bold text-purple-800 uppercase">Column Configuration</h4>

                <div
                  v-for="(col, cIdx) in field.columns"
                  :key="col.id"
                  class="flex flex-col gap-2 bg-white p-3 rounded border border-purple-100"
                >
                  <div class="flex gap-2 items-center">
                    <input
                      v-model="col.label"
                      placeholder="Column Name"
                      class="border rounded p-1 text-sm flex-grow font-bold"
                    />
                    <select v-model="col.type" class="border rounded p-1 text-sm bg-gray-50">
                      <option value="text">String</option>
                      <option value="number">Number</option>
                      <option value="image">Picture</option>
                    </select>

                    <label
                      class="flex items-center gap-1 text-xs text-blue-600 cursor-pointer border border-blue-200 px-2 py-1 rounded bg-blue-50"
                    >
                      <input type="checkbox" v-model="col.required" /> Required?
                    </label>

                    <label
                      class="flex items-center gap-1 text-xs text-gray-600 cursor-pointer border px-2 py-1 rounded bg-gray-50"
                    >
                      <input type="checkbox" v-model="col.locked" /> Locked
                    </label>
                    <button
                      @click="removeTableColumn(index, cIdx)"
                      :disabled="field.columns.length <= 2"
                      class="text-red-400 hover:text-red-600 font-bold px-2"
                    >
                      ×
                    </button>
                  </div>

                  <div
                    v-if="!col.locked && col.type !== 'image'"
                    class="flex items-center gap-3 pl-2 border-l-2 border-purple-200"
                  >
                    <span class="text-[10px] text-purple-400 font-bold uppercase tracking-wide"
                      >Rules:</span
                    >

                    <template v-if="col.type === 'text'">
                      <div class="flex items-center gap-1">
                        <span class="text-[10px] text-gray-500">Min Len</span>
                        <input
                          v-model="col.validation.minLength"
                          type="number"
                          class="w-12 p-0.5 text-xs border rounded"
                          placeholder="0"
                        />
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-[10px] text-gray-500">Max Len</span>
                        <input
                          v-model="col.validation.maxLength"
                          type="number"
                          class="w-12 p-0.5 text-xs border rounded"
                          placeholder="∞"
                        />
                      </div>
                    </template>

                    <template v-if="col.type === 'number'">
                      <div class="flex items-center gap-1">
                        <span class="text-[10px] text-gray-500">Min Val</span>
                        <input
                          v-model="col.validation.min"
                          type="number"
                          class="w-12 p-0.5 text-xs border rounded"
                          placeholder="0"
                        />
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-[10px] text-gray-500">Max Val</span>
                        <input
                          v-model="col.validation.max"
                          type="number"
                          class="w-12 p-0.5 text-xs border rounded"
                          placeholder="∞"
                        />
                      </div>
                    </template>
                  </div>
                </div>

                <button
                  @click="addTableColumn(index)"
                  :disabled="field.columns.length >= 6"
                  class="text-xs text-left text-purple-600 hover:text-purple-800 font-bold mt-1"
                >
                  + Add Column
                </button>
              </div>

              <div>
                <div class="flex justify-between items-center mb-2">
                  <label class="text-xs text-purple-800 uppercase font-bold"
                    >Table Content Preview</label
                  >
                  <button
                    @click="addTableRow(index)"
                    class="text-xs bg-purple-200 text-purple-800 px-2 py-1 rounded hover:bg-purple-300"
                  >
                    Add Row
                  </button>
                </div>
                <div class="overflow-x-auto border rounded-lg bg-white">
                  <table class="w-full text-sm text-left">
                    <thead class="bg-purple-100 text-purple-900 font-bold">
                      <tr>
                        <th v-for="col in field.columns" :key="col.id" class="p-2 border-b">
                          {{ col.label }}
                        </th>
                        <th class="p-2 border-b w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(row, rIdx) in field.rows" :key="rIdx" class="hover:bg-gray-50">
                        <td
                          v-for="col in field.columns"
                          :key="col.id"
                          class="p-2 border-b border-gray-100"
                        >
                          <template v-if="col.locked">
                            <div v-if="col.type === 'image'">
                              <div v-if="row[col.id]" class="relative w-10 h-10 group">
                                <img
                                  :src="row[col.id]"
                                  class="w-full h-full object-cover rounded"
                                /><button
                                  @click="row[col.id] = ''"
                                  class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 text-xs"
                                >
                                  ×
                                </button>
                              </div>
                              <label v-else class="cursor-pointer text-xs text-blue-500"
                                >Img
                                <input
                                  type="file"
                                  class="hidden"
                                  @change="
                                    (e) => handleTableCellImageUpload(e, index, rIdx, col.id)
                                  "
                              /></label>
                            </div>
                            <input
                              v-else
                              v-model="row[col.id]"
                              class="w-full border rounded p-1 text-xs bg-yellow-50"
                            />
                          </template>
                          <div v-else class="text-xs text-gray-400 italic text-center">
                            User Input
                          </div>
                        </td>
                        <td class="p-2 border-b text-center">
                          <button
                            @click="removeTableRow(index, rIdx)"
                            class="text-red-400 font-bold"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div
              v-if="field.type === 'select'"
              class="col-span-12 bg-orange-50 border-orange-100 p-4 rounded-md border"
            >
              <label class="text-xs text-gray-600 uppercase font-bold"
                >Options (One per line)</label
              >
              <textarea
                rows="3"
                class="w-full border border-orange-200 rounded p-2 mt-1 focus:ring-orange-500 focus:border-orange-500 font-mono text-sm"
                :value="field.options ? field.options.join('\n') : ''"
                @input="(e) => (field.options = e.target.value.split('\n'))"
              ></textarea>
            </div>

            <div class="col-span-12 flex justify-end pt-2 border-t border-gray-100">
              <button
                @click="removeField(index)"
                class="text-red-500 hover:text-red-700 text-sm font-bold flex items-center gap-1"
              >
                <span>🗑️</span> Remove Field
              </button>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <div
        v-if="fields.length === 0"
        class="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 bg-gray-50"
      >
        <p>The form is empty.</p>
        <p class="text-sm">Click a button above to add your first question.</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* List Transitions for Drag & Drop */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.list-leave-active {
  position: absolute;
}
</style>
