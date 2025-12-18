<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'
import { RouterLink } from 'vue-router'

const forms = ref([])

onMounted(async () => {
  const { data } = await supabase
    .from('forms')
    .select('id, title, slug, created_at, status')
    .order('created_at', { ascending: false })
    
  forms.value = data || []
})
</script>

<template>
  <div class="max-w-7xl mx-auto p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">My Forms</h1>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      
      <component
        v-for="form in forms"
        :key="form.id"
        :is="form.status === 'active' ? RouterLink : 'div'"
        :to="form.status === 'active' ? '/form/' + form.slug : undefined"
        class="block p-6 border rounded-lg transition group relative"
        :class="[
          form.status === 'active' 
            ? 'bg-white border-gray-200 hover:shadow-md hover:border-black cursor-pointer' 
            : 'bg-gray-100 border-gray-200 opacity-90 grayscale cursor-not-allowed'
        ]"
      >
        <div class="flex">
          <div class="flex-1">
            <h2 
              class="text-xl font-bold" 
              :class="form.status === 'active' ? 'group-hover:text-blue-600' : 'text-gray-500'"
            >
              {{ form.title }}
            </h2>
            <p class="text-gray-400 text-sm mt-2">
              Created: {{ new Date(form.created_at).toLocaleDateString() }}
            </p>
          </div>
          
          <div class="text-right flex flex-col items-end gap-2">
            <span class="text-xs text-gray-400 uppercase font-bold tracking-wider">Status</span>
            
            <span
              class="px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide inline-block"
              :class="{
                'bg-green-100 text-green-800': form.status === 'active',
                'bg-orange-100 text-orange-800': form.status === 'draft',
                'bg-red-100 text-red-800': form.status !== 'active' && form.status !== 'draft'
              }"
            >
              {{ form.status === 'archived' ? 'Inactive' : form.status }}
            </span>
          </div>
        </div>

        <div v-if="form.status !== 'active'" class="absolute inset-0 flex items-center justify-center z-10">
           <div class="bg-white/80 p-3 rounded-full shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
           </div>
        </div>
      </component>

    </div>
  </div>
</template>