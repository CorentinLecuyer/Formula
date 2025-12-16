<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import FormRenderer from '../components/FormRenderer.vue'
import { supabase } from '../supabase'

const route = useRoute()

// State
const currentSchema = ref([])
const formTitle = ref('Loading...')
const formId = ref(null)
const formData = ref({})
const isSubmitting = ref(false)
const loading = ref(true)

// 1. Fetch the Form Blueprint
const fetchForm = async () => {
  loading.value = true

  // 3. Get the slug from the URL (e.g., "summer-audit")
  const slugFromUrl = route.params.slug

  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('slug', slugFromUrl) // <--- Use the dynamic variable
    .single()

  if (error) {
    console.error('Error loading form:', error)
    formTitle.value = 'Form not found'
  } else {
    formTitle.value = data.title
    formId.value = data.id
    currentSchema.value = data.schema
  }

  loading.value = false
}

// 2. Submit Logic (Updated to use real ID)
const submitForm = async () => {
  if (!formId.value) return
  isSubmitting.value = true

  try {
    const { error } = await supabase.from('submissions').insert({
      form_id: formId.value, // <--- Using the real ID from the DB
      response_data: formData.value,
    })

    if (error) throw error

    alert('Report saved successfully!')
    formData.value = {} // Reset form
  } catch (err) {
    console.error(err)
    alert('Error saving: ' + err.message)
  } finally {
    isSubmitting.value = false
  }
}

// Load on startup
onMounted(() => {
  fetchForm()
})
</script>

<template>
  <div class="max-w-2xl mx-auto p-6">
    <div v-if="loading" class="text-center py-10">
      <div class="animate-spin text-3xl mb-2">⏳</div>
      <p class="text-gray-500">Loading form...</p>
    </div>

    <div v-else class="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
      <h1 class="text-2xl font-bold mb-6 border-b pb-4">{{ formTitle }}</h1>

      <FormRenderer :schema="currentSchema" v-model="formData" />

      <div class="mt-8 pt-6 border-t border-gray-100 flex justify-end">
        <button
          @click="submitForm"
          :disabled="isSubmitting"
          class="bg-black text-white px-8 py-3 rounded-lg font-bold hover:bg-gray-800 disabled:opacity-50 transition-all shadow-md"
        >
          {{ isSubmitting ? 'Saving...' : 'Submit Report' }}
        </button>
      </div>
    </div>
  </div>
</template>
