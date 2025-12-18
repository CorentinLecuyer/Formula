<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { supabase } from '../supabase'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

// STATE
const isSaving = ref(false)
const isLoading = ref(false)
const isEditing = ref(false) // Track mode
const formId = ref(null) // Store ID for updates

// 1. Form Metadata
const status = ref('draft')
const title = ref('')
const description = ref('')
const infoBlocks = ref([])

// 2. Fields List
const fields = ref([])

// STATE FOR ICON PICKER
const showIconPicker = ref(false)
const activeBlockIndex = ref(null)

// THE BIG LIST OF ICONS 🎨
const iconLibrary = [
  { category: 'Status', icons: ['ℹ️', '⚠️', '✅', '❌', '❓', '❗', '🎨', '🆗'] },
  { category: 'Safety', icons: ['⛑️', '🦺', '👓', '🧤', '🔥', '⚡', '🚧', '🚑'] },
  { category: 'Business', icons: ['📊', '📈', '📉', '📅', '📎', '💼', '📁', '🤝'] },
  { category: 'Logistics', icons: ['📦', '🚛', '🏭', '📍', '🗺️', '⏱️', '🧱', '🏗️'] },
  { category: 'Action', icons: ['🎯', '🚀', '🔍', '✏️', '📸', '📞', '💾', '🗑️'] },
  { category: 'Fun/Other', icons: ['🍺', '🍻', '⭐', '💡', '🎉', '🏆', '🍔', '👍'] },
  { category: 'Tools', icons: ['🧰', '⛏️', '🔨', '🔧', '⚒️', '🛠️', '🔩'] },
]

// --- LOAD EXISTING DATA (IF EDITING) ---
onMounted(async () => {
  if (route.params.slug) {
    isEditing.value = true
    await loadFormForEdit(route.params.slug)
  }
})

// --- DRAG & DROP LOGIC (MOVED TO TOP LEVEL) ---
const dragIndex = ref(null)
const isDragHandleHovered = ref(false)

// 1. Start Dragging
const onDragStart = (event, index) => {
  dragIndex.value = index
  // Optional: Change the drag image or effect here
  event.dataTransfer.effectAllowed = 'move'
}

// 2. Swapping Logic (Live Reorder)
const onDragEnter = (index) => {
  // If not dragging, or dragging over the same item, stop
  if (dragIndex.value === null || dragIndex.value === index) return

  // Remove the item from its old position
  const itemToMove = fields.value.splice(dragIndex.value, 1)[0]
  
  // Insert it at the new position
  fields.value.splice(index, 0, itemToMove)
  
  // Update the tracker so we keep following the item
  dragIndex.value = index
}

// 3. End Dragging
const onDragEnd = () => {
  dragIndex.value = null
  isDragHandleHovered.value = false
}

const loadFormForEdit = async (slug) => {
  isLoading.value = true
  const { data, error } = await supabase.from('forms').select('*').eq('slug', slug).single()

  if (error) {
    alert('Error loading form: ' + error.message)
    router.push('/')
    return
  }

  // Populate State
  formId.value = data.id
  title.value = data.title
  description.value = data.description
  infoBlocks.value = data.info_blocks || []

  // IMPORTANT: Filter out the auto-generated "Partner Fields"
  // We don't want to show the read-only ID fields in the builder UI
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
  fields.value.push({
    id: crypto.randomUUID(),
    type: type,
    label: '',
    required: false,
    options: [],
  })
}

const removeField = (index) => {
  fields.value.splice(index, 1)
}

// KEYBOARD SHORTCUTS
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

// --- SAVE & DELETE LOGIC ---

const saveForm = async () => {
  if (!title.value) return alert('Please provide a Title.')
  isSaving.value = true

  // Generate Slug (Only updates if this is a NEW form to avoid breaking links)
  let finalSlug = route.params.slug

  if (!isEditing.value) {
    finalSlug = title.value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  // Process Schema (Re-inject Partner Fields)
  const finalSchema = []
  fields.value.forEach((field) => {
    finalSchema.push(field)
    // Re-add partner fields for smart objects
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
    slug: finalSlug, // We keep the slug consistent during edit
    description: description.value,
    info_blocks: infoBlocks.value,
    schema: finalSchema,
    status: status.value,
  }

  let dbError = null

  if (isEditing.value) {
    // UPDATE
    const res = await supabase.from('forms').update(payload).eq('id', formId.value)
    dbError = res.error
  } else {
    // INSERT
    const res = await supabase.from('forms').insert(payload)
    dbError = res.error
  }

  isSaving.value = false

  if (dbError) {
    alert('Error saving: ' + dbError.message)
  } else {
    alert(isEditing.value ? 'Form updated!' : 'Form created!')
    router.push('/')
  }
}

const deleteForm = async () => {
  if (
    !confirm(
      'Are you sure? This will delete the form AND all submissions associated with it. This cannot be undone.',
    )
  )
    return

  isSaving.value = true
  // Delete submissions first (if not cascading) - usually cascading handles it but safer to be sure
  await supabase.from('submissions').delete().eq('form_id', formId.value)

  // Delete Form
  const { error } = await supabase.from('forms').delete().eq('id', formId.value)

  if (error) {
    alert('Error deleting: ' + error.message)
    isSaving.value = false
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
        const MAX_WIDTH = 1000 // Smaller max width for info blocks
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

// UPLOAD HANDLER FOR BLOCKS
const handleBlockImageUpload = async (event, index) => {
  const file = event.target.files[0]
  if (!file) return

  // 1. Upload logic
  let fileToUpload = file
  if (file.type.startsWith('image/')) {
    try {
      fileToUpload = await compressImage(file)
    } catch (e) {
      console.warn('Compression failed', e)
    }
  }

  const filePath = `builder_assets/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`

  // 2. Upload to 'attachments' bucket
  const { error } = await supabase.storage.from('attachments').upload(filePath, fileToUpload)

  if (error) {
    alert('Upload failed: ' + error.message)
    return
  }

  // 3. Get URL
  const { data } = supabase.storage.from('attachments').getPublicUrl(filePath)

  // 4. Save URL to the specific block
  infoBlocks.value[index].image = data.publicUrl

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
          @click="addField('select')"
          class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-md text-sm font-bold shadow transition"
        >
          + Dropdown
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

      <div class="space-y-4 mb-20">
        <div
          v-for="(field, index) in fields"
          :key="field.id"
          :draggable="isDragHandleHovered"
          @dragstart="onDragStart(index)"
          @dragenter.prevent="onDragEnter(index)"
          @dragover.prevent
          @dragend="onDragEnd"
          class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex gap-4 items-start group transition-all duration-200"
          :class="{ 'opacity-50 border-dashed border-black scale-[0.98]': dragIndex === index }"
        >
          <div
            class="text-gray-300 mt-3 cursor-move text-xl flex self-center hover:text-black transition-colors"
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
              v-if="field.type === 'select'"
              class="col-span-12 bg-orange-50 p-4 rounded-md border border-orange-100"
            >
              <label class="text-xs text-gray-600 uppercase font-bold"
                >Options (Comma Separated)</label
              >
              <input
                type="text"
                placeholder="e.g. Red, Blue, Green"
                class="w-full border border-orange-200 rounded p-2 mt-1 focus:ring-orange-500 focus:border-orange-500"
                :value="field.options ? field.options.join(', ') : ''"
                @input="(e) => (field.options = e.target.value.split(',').map((s) => s.trim()))"
              />
              <p class="text-xs text-gray-400 mt-1">Users will select one of these.</p>
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

        <div
          v-if="fields.length === 0"
          class="text-center py-12 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 bg-gray-50"
        >
          <p>The form is empty.</p>
          <p class="text-sm">Click a button above to add your first question.</p>
        </div>
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
