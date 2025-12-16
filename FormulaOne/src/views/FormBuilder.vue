<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'
import FormRenderer from '../components/FormRenderer.vue'
import FormPresentation from '../components/FormPresentation.vue'

const route = useRoute()
const slugFromUrl = route.params.slug

const formTitle = ref('')
const formSchema = ref([])
const formData = ref({})
const formId = ref(null)
const formDescription = ref('')
const formInfoBlocks = ref([])

const loading = ref(true)
const submitting = ref(false)
const submitted = ref(false)

const fetchForm = async () => {
  loading.value = true
  // Fetch form by slug
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('slug', slugFromUrl)
    .single()

  if (error) {
    alert('Form not found!')
  } else {
    formTitle.value = data.title
    formSchema.value = data.schema
    formId.value = data.id
    formDescription.value = data.description
    formInfoBlocks.value = data.info_blocks
    
    // Initialize empty answers object
    const initialData = {}
    data.schema.forEach(field => {
      initialData[field.id] = ''
    })
    formData.value = initialData
  }
  loading.value = false
}

const submitForm = async () => {
  submitting.value = true
  
  const { error } = await supabase
    .from('submissions')
    .insert({
      form_id: formId.value,
      response_data: formData.value
    })
    
  if (error) {
    alert('Error submitting form: ' + error.message)
  } else {
    submitted.value = true
  }
  submitting.value = false
}

onMounted(() => {
  fetchForm()
})
</script>

<template>
  <div class="min-h-full bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    
    <div v-if="loading" class="text-center text-gray-500 mt-20">
      <div class="animate-spin text-4xl mb-4">⌛</div>
      Loading form...
    </div>

    <div v-else-if="submitted" class="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg text-center border border-green-100">
      <div class="text-6xl mb-4">🎉</div>
      <h2 class="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
      <p class="text-gray-500">Your submission has been received.</p>
      <button @click="$router.go(0)" class="mt-6 text-blue-600 font-bold hover:underline">
        Submit another response
      </button>
    </div>

    <div v-else class="mx-auto">
      
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        
        <div class="lg:col-span-5 lg:sticky lg:top-8">
          <div class="bg-white shadow-sm rounded-2xl p-6 lg:p-8 border border-gray-100">
            <FormPresentation 
              :title="formTitle"
              :description="formDescription"
              :blocks="formInfoBlocks"
            />
          </div>
        </div>

        <div class="lg:col-span-7">
          <div class="bg-white shadow-lg rounded-2xl p-6 lg:p-10 border border-gray-100 relative">
          

            <form @submit.prevent="submitForm" class="space-y-8">
              
              <FormRenderer 
                :schema="formSchema" 
                v-model="formData" 
              />

              <div class="pt-6 border-t border-gray-100 flex justify-center">
                <button 
                  type="submit" 
                  :disabled="submitting"
                  class="bg-black text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition shadow-md w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ submitting ? 'Sending...' : 'Submit Report' }}
                </button>
              </div>

            </form>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>