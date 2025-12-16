<script setup>
import { ref, watch } from 'vue'
import { supabase } from '../supabase'


const iconMap = {
  info: 'ℹ️',
  alert: '⚠️',
  star: '⭐',
  check: '✅',
  question: '❓',
  target: '🎯',
  // Add other categories if needed
}

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: [String, Object], // The URL of the uploaded file
})

const emit = defineEmits(['update:modelValue'])

const isUploading = ref(false)
const errorMsg = ref('')
const previewUrl = ref(props.modelValue || '')

watch(() => props.modelValue, (newVal) => {
  previewUrl.value = newVal || ''
})
// HELPER: Compress Image to max 1920px width (Client-side)
const compressImage = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1920
        const scaleSize = MAX_WIDTH / img.width

        // Only resize if image is massive
        if (img.width > MAX_WIDTH) {
          canvas.width = MAX_WIDTH
          canvas.height = img.height * scaleSize
        } else {
          canvas.width = img.width
          canvas.height = img.height
        }

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        // Compress to JPEG at 80% quality
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

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  // 1. LIMIT CHECK: 200MB
  if (file.size > 200 * 1024 * 1024) {
    errorMsg.value = 'File is too large (Max 200MB).'
    return
  }

  isUploading.value = true
  errorMsg.value = ''
  let fileToUpload = file

  // 2. IMAGE OPTIMIZATION
  // If it's an image, we compress it. If it's a PDF/Doc, we leave it alone.
  if (file.type.startsWith('image/')) {
    try {
      fileToUpload = await compressImage(file)
    } catch (e) {
      console.warn('Compression failed, uploading original.', e)
    }
  }

  // 3. UPLOAD TO SUPABASE
  // Path: attachments/timestamp_filename
  const filePath = `form_uploads/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`

  const { data, error } = await supabase.storage.from('attachments').upload(filePath, fileToUpload)

  if (error) {
    errorMsg.value = 'Upload failed: ' + error.message
    isUploading.value = false
    return
  }

  // 4. GET PUBLIC URL
  const { data: urlData } = supabase.storage.from('attachments').getPublicUrl(filePath)

  // 5. SAVE
  previewUrl.value = urlData.publicUrl
  emit('update:modelValue', urlData.publicUrl)
  isUploading.value = false
}

const removeFile = () => {
  emit('update:modelValue', '')
  previewUrl.value = ''
}
</script>

<template>
  <div class="flex flex-col gap-2">
    
    <div v-if="!previewUrl">
      <input
        type="file"
        @change="handleFileUpload"
        class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 transition"
      />
      <p v-if="isUploading" class="text-xs text-blue-500 mt-1 animate-pulse">
        Uploading and compressing...
      </p>
      <p v-if="errorMsg" class="text-xs text-red-500 mt-1">{{ errorMsg }}</p>
    </div>

    <div v-else class="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
      <div
        class="h-10 w-10 flex-shrink-0 bg-white rounded border flex items-center justify-center text-xl"
      >
        {{ previewUrl.match(/\.(jpeg|jpg|gif|png)$/i) ? '🖼️' : '📄' }}
      </div>

      <div class="flex-grow overflow-hidden">
        <a
          :href="previewUrl"
          target="_blank"
          class="text-sm font-bold text-blue-600 hover:underline truncate block"
        >
          View Attachment
        </a>
        <span class="text-xs text-green-600">Successfully Uploaded</span>
      </div>

      <button
        @click="removeFile"
        type="button"
        class="text-gray-400 hover:text-red-500 font-bold px-2"
      >
        ✕
      </button>
    </div>
  </div>
</template>
