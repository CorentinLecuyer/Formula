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
  // 1. Fetch User SAFELY inside onMounted (Fixes "Running in circles" bug)
  const { data } = await supabase.auth.getUser()
  currentUser.value = data.user

  // 2. Load Form if Editing
  if (route.params.slug) {
    isEditing.value = true
    await loadFormForEdit(route.params.slug)
  }
})

const loadFormForEdit = async (slug) => {
  isLoading.value = true
  console.log('🔹 Fetching form data for slug:', slug) // DEBUG

  const { data, error } = await supabase.from('forms').select('*').eq('slug', slug).single()

  console.log('🔹 Supabase Response:', { data, error }) // DEBUG

  if (error) {
    console.error('🔴 Error loading form:', error) // DEBUG
    toast.error('Error loading form: ' + error.message)
    // router.push('/') // Commented out so you can see the console
    return
  }

  if (!data) {
    console.error('🔴 No data returned! RLS Policy likely blocking access.') // DEBUG
    toast.error('Form not found or access denied.')
    return
  }

  // Populate State
  formId.value = data.id
  title.value = data.title
  description.value = data.description
  status.value = data.status
  infoBlocks.value = data.info_blocks || []
  fields.value = (data.schema || []).filter((field) => !field.is_partner)

  console.log('✅ Form Loaded Successfully:', title.value) // DEBUG
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
  // 1. Create the base field object
  const newField = {
    id: crypto.randomUUID(),
    type: type,
    label: '',
    required: false,
    options: [],
  }

  // 2. Add specific logic for 'table' type
  if (type === 'table') {
    newField.columns = [
      { id: crypto.randomUUID(), label: 'Item', type: 'text', locked: true },
      { id: crypto.randomUUID(), label: 'Quantity', type: 'number', locked: false },
    ]
    newField.rows = [
      // Initialize one empty row
      { [newField.columns[0].id]: '', [newField.columns[1].id]: '' },
    ]
  }

  // 3. Push to the main list
  fields.value.push(newField)
}

// --- TABLE SPECIFIC LOGIC ---
const addTableColumn = (fieldIndex) => {
  const field = fields.value[fieldIndex]
  if (field.columns.length >= 5) {
    toast.warning('Max 5 columns allowed')
    return
  }
  const newColId = crypto.randomUUID()
  field.columns.push({ id: newColId, label: 'New Col', type: 'text', locked: false })

  // Update existing rows to have this new column key
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

  // Clean up data in rows
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

const handleContentKeydown = async (event, index) => {
  if (!event.ctrlKey && !event.metaKey) return
  let tag = ''
  if (event.key === 'b') tag = 'b'
  else if (event.key === 'u') tag = 'u'
  else if (event.key === 'i') tag = 'i'

  if (tag) {
    event.preventDefault()
    applyTagToSelection(
      event.target,
      `<${tag}>`,
      `</${tag}>`,
      (val) => (infoBlocks.value[index].content = val),
    )
  }
}

const handleDescriptionKeydown = async (event) => {
  if (!event.ctrlKey && !event.metaKey) return
  let tag = ''
  if (event.key === 'b') tag = 'b'
  else if (event.key === 'u') tag = 'u'
  else if (event.key === 'i') tag = 'i'

  if (tag) {
    event.preventDefault()
    applyTagToSelection(event.target, `<${tag}>`, `</${tag}>`, (val) => (description.value = val))
  }
}

const applyTagToSelection = async (textarea, openTag, closeTag, updateFn) => {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = textarea.value
  const before = text.substring(0, start)
  const selected = text.substring(start, end)
  const after = text.substring(end)
  updateFn(before + openTag + selected + closeTag + after)
  await nextTick()
  textarea.focus()
  textarea.setSelectionRange(start + openTag.length, end + openTag.length)
}

// --- DRAG & DROP LOGIC ---
const dragIndex = ref(null)
const isDragHandleHovered = ref(false)

const onDragStart = (event, index) => {
  dragIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
}

const onDragEnter = (index) => {
  if (dragIndex.value === null || dragIndex.value === index) return
  const itemToMove = fields.value.splice(dragIndex.value, 1)[0]
  fields.value.splice(index, 0, itemToMove)
  dragIndex.value = index
}

const onDragEnd = () => {
  dragIndex.value = null
  isDragHandleHovered.value = false
}

// --- SAVE & DELETE LOGIC ---
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

    // Partner fields logic
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
  if (!confirm('Are you sure? This will delete the form AND all submissions associated with it.'))
    return
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
    try { fileToUpload = await compressImage(file) } catch (e) { console.warn(e) }
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
  if (error) {
    alert('Upload failed: ' + error.message)
    return
  }
  const { data } = supabase.storage.from('attachments').getPublicUrl(filePath)
  infoBlocks.value[index].image = data.publicUrl
}

const handleTableCellImageUpload = async (event, fieldIndex, rowIndex, colId) => {
  const file = event.target.files[0]
  if (!file) return
  try {
    const url = await uploadFile(file)
    // Assign URL to the specific cell in the specific row
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
      Loading form data...
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
            class="bg-red-50 text-red-600 border border-red-200 px-6 py-2 rounded-lg font-bold hover:bg-red-100 disabled:opacity-50 transition"
          >
            Delete
          </button>

          <button
            @click="saveForm"
            :disabled="isSaving"
            class="bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 transition shadow-sm"
          >
            {{ isSaving ? 'Saving...' : isEditing ? 'Update Form' : 'Create Form' }}
          </button>
        </div>
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Form Title</label>
          <input
            v-model="title"
            type="text"
            placeholder="e.g. Morning Safety Check"
            class="w-full border border-gray-300 rounded-md p-2 focus:ring-black focus:border-black"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            v-model="status"
            class="w-full border border-gray-300 rounded-md p-2 bg-white focus:ring-black focus:border-black"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Inactive</option>
          </select>
          <p class="text-xs text-gray-500 mt-1">Only "Active" forms are visible to users.</p>
        </div>
      </div>

      <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8 space-y-6">
        <h2 class="text-xl font-bold border-b pb-2">Presentation & Context</h2>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Introductory Summary
            <span class="text-gray-400 font-normal lowercase"
              >(Ctrl+B for Bold, Ctrl+U for Underline)</span
            >
          </label>
          <textarea
            v-model="description"
            @keydown="handleDescriptionKeydown"
            rows="3"
            placeholder="Explain the goal of this form to your users..."
            class="w-full border border-gray-300 rounded-md p-2 focus:ring-black focus:border-black font-mono text-sm"
          ></textarea>
        </div>

        <div class="space-y-4">
          <label class="block text-sm font-medium text-gray-700">Info Blocks (Optional)</label>

          <div
            v-for="(block, index) in infoBlocks"
            :key="index"
            class="bg-gray-50 p-4 rounded-lg border border-gray-200 relative group transition hover:shadow-md"
          >
            <div class="grid grid-cols-12 gap-4">
              <div class="col-span-2 flex flex-col items-center">
                <label class="text-xs text-gray-500 uppercase font-bold mb-1">Icon</label>
                <button
                  @click="openIconPicker(index)"
                  class="w-12 h-12 text-2xl bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition flex items-center justify-center shadow-sm"
                >
                  {{ block.icon || '📌' }}
                </button>
              </div>

              <div class="col-span-10">
                <label class="text-xs text-gray-500 uppercase font-bold">Block Title</label>
                <input
                  v-model="block.title"
                  type="text"
                  placeholder="e.g. Safety First"
                  class="w-full mt-1 border rounded p-2 focus:ring-black focus:border-black"
                />
              </div>

              <div class="col-span-12">
                <label class="text-xs text-gray-500 uppercase font-bold">
                  Content <span class="text-gray-400 font-normal lowercase">(Ctrl+B, Ctrl+U)</span>
                </label>
                <textarea
                  v-model="block.content"
                  @keydown="(e) => handleContentKeydown(e, index)"
                  rows="2"
                  placeholder="Details..."
                  class="w-full mt-1 border rounded p-2 text-sm focus:ring-black focus:border-black font-mono"
                ></textarea>
              </div>

              <div class="col-span-12 pt-2 border-t border-gray-100">
                <label class="text-xs text-gray-500 uppercase font-bold mb-2 block"
                  >Block Image (Optional)</label
                >

                <div v-if="block.image" class="relative inline-block group">
                  <img
                    :src="block.image"
                    class="h-32 w-auto rounded-lg border border-gray-200 shadow-sm object-cover"
                  />
                  <button
                    @click="block.image = null"
                    class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md hover:bg-red-600 font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div v-else>
                  <label
                    class="cursor-pointer flex items-center gap-2 text-sm text-blue-600 font-bold hover:bg-blue-50 w-fit px-3 py-2 rounded-md transition"
                  >
                    <span>📷 Add Picture</span>
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      @change="(e) => handleBlockImageUpload(e, index)"
                    />
                  </label>
                </div>
              </div>
            </div>

            <button
              @click="infoBlocks.splice(index, 1)"
              class="absolute top-2 right-2 text-gray-300 hover:text-red-500 transition font-bold"
            >
              ✕
            </button>
          </div>

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
          :draggable="isDragHandleHovered"
          @dragstart="onDragStart($event, index)"
          @dragenter.prevent="onDragEnter(index)"
          @dragover.prevent
          @dragend="onDragEnd"
          class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex gap-4 items-start group transition-all duration-300"
          :class="{
            'border-black ring-1 ring-black shadow-lg z-10 scale-[1.01]': dragIndex === index,
            'hover:border-gray-300': dragIndex !== index,
          }"
        >
          <div
            class="text-gray-300 mt-3 cursor-move text-xl flex self-center hover:text-black transition-colors px-2"
            @mouseenter="isDragHandleHovered = true"
            @mouseleave="isDragHandleHovered = false"
          >
            ⋮⋮
          </div>

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
                placeholder="What is the question?"
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
              v-if="field.type === 'table'"
              class="col-span-12 bg-gray-100 border-gray-200  p-4 rounded-lg border"
            >
              <div class="mb-6">
                <div class="flex justify-between items-center mb-2">
                  <label class="text-xs text-orange-800 uppercase font-bold"
                    >Table Columns (2-5)</label
                  >
                  <div class="flex gap-2">
                    <button
                      @click="addTableColumn(index)"
                      :disabled="field.columns.length >= 5"
                      class="text-xs bg-green-200 text-green-800 px-2 py-1 rounded hover:bg-green-300 disabled:opacity-50"
                    >
                      Add Column
                    </button>
                  </div>
                </div>

                <div class="grid gap-2">
                  <div
                    v-for="(col, cIdx) in field.columns"
                    :key="col.id"
                    class="flex gap-2 items-center bg-white p-2 rounded border border-gray-200"
                  >
                    <input
                      v-model="col.label"
                      placeholder="Col Name"
                      class="border rounded p-1 text-sm flex-grow"
                    />

                    <select v-model="col.type" class="border rounded p-1 text-sm bg-gray-50">
                      <option value="text">String</option>
                      <option value="number">Number</option>
                      <option value="image">Picture</option>
                    </select>

                    <label
                      class="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none border px-2 py-1 rounded bg-gray-50 hover:bg-gray-100"
                    >
                      <input type="checkbox" v-model="col.locked" />
                      <span>Locked?</span>
                    </label>

                    <button
                      @click="removeTableColumn(index, cIdx)"
                      :disabled="field.columns.length <= 2"
                      class="text-red-400 hover:text-red-600 font-bold px-2 disabled:opacity-30"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div class="flex justify-between items-center mb-2">
                  <label class="text-xs text-orange-800 uppercase font-bold"
                    >Table Content (Rows)</label
                  >
                  <button
                    @click="addTableRow(index)"
                    class="text-xs bg-green-200 text-green-800 px-2 py-1 rounded hover:bg-green-300"
                  >
                    Add Row
                  </button>
                </div>

                <div class="overflow-x-auto border rounded-lg bg-white">
                  <table class="w-full text-sm text-left">
                    <thead class="bg-orange-100 text-orange-900 font-bold">
                      <tr>
                        <th
                          v-for="col in field.columns"
                          :key="col.id"
                          class="p-2 border-b border-gray-200"
                        >
                          {{ col.label }}
                          <span
                            v-if="col.locked"
                            class="text-[10px] bg-gray-600 text-white px-1 rounded ml-1"
                            >LOCK</span
                          >
                          <span v-else class="text-[10px] bg-green-600 text-white px-1 rounded ml-1"
                            >USER</span
                          >
                        </th>
                        <th class="p-2 border-b border-purple-200 w-10"></th>
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
                              <div v-if="row[col.id]" class="relative group w-16 h-16">
                                <img
                                  :src="row[col.id]"
                                  class="h-[72px] w-auto object-contain align-middle"
                                />
                                <button
                                  @click="row[col.id] = ''"
                                  class="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs"
                                >
                                  ×
                                </button>
                              </div>
                              <label
                                v-else
                                class="cursor-pointer text-xs text-orange-500 hover:underline"
                              >
                                Upload
                                <input
                                  type="file"
                                  accept="image/*"
                                  class="hidden"
                                  @change="
                                    (e) => handleTableCellImageUpload(e, index, rIdx, col.id)
                                  "
                                />
                              </label>
                            </div>
                            <input
                              v-else
                              v-model="row[col.id]"
                              :type="col.type"
                              class="w-full border rounded p-1 text-sm bg-yellow-50"
                              placeholder="Pre-fill..."
                            />
                          </template>

                          <template v-else>
                            <div
                              class="w-full border rounded p-1 text-sm bg-gray-100 text-gray-400 italic text-center cursor-not-allowed"
                            >
                              User will fill
                            </div>
                          </template>
                        </td>
                        <td class="p-2 border-b border-gray-100 text-center">
                          <button
                            @click="removeTableRow(index, rIdx)"
                            class="text-red-400 hover:text-red-600 font-bold"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div
                    v-if="field.rows.length === 0"
                    class="p-4 text-center text-gray-400 text-xs italic"
                  >
                    No rows added. Table will be empty.
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="field.type === 'select'"
              class="col-span-12 bg-orange-50 border-orange-100 p-4 rounded-md border "
            >
              <label class="text-xs text-gray-600 uppercase font-bold"
                >Options (One per line)</label
              >
              <textarea
                rows="3"
                placeholder="Option 1&#10;Option 2&#10;Option 3"
                class="w-full border border-orange-200 rounded p-2 mt-1 focus:ring-orange-500 focus:border-orange-500 font-mono text-sm"
                :value="field.options ? field.options.join('\n') : ''"
                @input="(e) => (field.options = e.target.value.split('\n'))"
              ></textarea>
              <p class="text-xs text-gray-400 mt-1">
                Users will select one of these. Press Enter to add a new option.
              </p>
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

    <div
      v-if="showIconPicker"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        class="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div class="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 class="font-bold text-gray-800">Select an Icon</h3>
          <button
            @click="showIconPicker = false"
            class="text-gray-400 hover:text-black font-bold px-2 text-xl"
          >
            ✕
          </button>
        </div>
        <div class="p-6 overflow-y-auto">
          <div v-for="cat in iconLibrary" :key="cat.category" class="mb-6 last:mb-0">
            <h4 class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              {{ cat.category }}
            </h4>
            <div class="flex flex-wrap justify-between">
              <button
                v-for="icon in cat.icons"
                :key="icon"
                @click="selectIcon(icon)"
                class="text-2xl h-10 w-10 flex items-center justify-center rounded hover:bg-blue-100 hover:scale-110 transition cursor-pointer"
              >
                {{ icon }}
              </button>
            </div>
          </div>
        </div>
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
