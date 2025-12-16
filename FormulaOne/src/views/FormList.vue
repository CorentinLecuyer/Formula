<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'
import { RouterLink } from 'vue-router'

const forms = ref([])

onMounted(async () => {
  const { data } = await supabase.from('forms').select('id, title, slug, created_at, status')
  forms.value = data
})
</script>

<template>
  <div class="max-w-7xl mx-auto p-8">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Formulaires</h1>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <RouterLink
        v-for="form in forms"
        :key="form.id"
        :to="'/form/' + form.slug"
        class="block p-6 bg-white border border-gray-200 rounded-lg hover:shadow-md transition hover:border-black group"
      >
        <div class="flex">
          <div class="flex-1">
            <h2 class="text-xl font-bold">{{ form.title }}</h2>
            <p class="text-gray-400 text-sm mt-2">
              Created: {{ new Date(form.created_at).toLocaleDateString() }}
            </p>
          </div>
          <div class="text-center flex flex-col items-center gap-2">
            <span class="text-xs text-gray-400 uppercase font-bold tracking-wider">Status</span>

            <p
              class="px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wide inline-block"
              :class="{
                'bg-green-100 text-green-800': form.status === 'active',
                'bg-orange-100 text-orange-800': form.status === 'draft',
                'bg-red-100 text-red-800': form.status !== 'active' && form.status !== 'draft',
              }"
            >
              {{ form.status === 'archived' ? 'Inactive' : form.status }}
            </p>
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>
