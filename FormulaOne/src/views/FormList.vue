<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'
import { RouterLink } from 'vue-router'

const forms = ref([])

onMounted(async () => {
  const { data } = await supabase.from('forms').select('id, title, slug, created_at')
  forms.value = data
})
</script>

<template>
  <div class="max-w-4xl mx-auto p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">My Forms</h1>
      <RouterLink to="/create" class="bg-black text-white px-4 py-2 rounded font-bold hover:bg-gray-800">
        + Create New
      </RouterLink>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RouterLink 
        v-for="form in forms" 
        :key="form.id"
        :to="'/form/' + form.slug"
        class="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition hover:border-black group"
      >
        <h2 class="text-xl font-bold group-hover:text-blue-600">{{ form.title }}</h2>
        <p class="text-gray-400 text-sm mt-2">Created: {{ new Date(form.created_at).toLocaleDateString() }}</p>
      </RouterLink>
    </div>
  </div>
</template>