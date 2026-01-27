<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'
import { RouterLink, useRouter } from 'vue-router' 
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const { isAdmin, currentUserId, fetchUser } = useAuth()
const forms = ref([])
const loading = ref(true)

onMounted(async () => {
  await fetchUser() // Safe to call even for visitors

  // Added 'description' and 'info_blocks' to the select query
  const { data, error } = await supabase
    .from('forms')
    .select('id, title, slug, created_at, status, created_by, description, info_blocks')
    .order('created_at', { ascending: false })

  forms.value = data || []
  loading.value = false
})

const canEdit = (form) => {
  if (isAdmin()) return true
  if (form.created_by === currentUserId()) return true
  return false
}

const navigateToEdit = (slug) => {
  router.push(`/edit/${slug}`)
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Forms</h1>
        <p class="text-gray-500 mt-1">Select a form to start a new submission.</p>
      </div>
    </div>

    <div v-if="loading" class="text-center py-20 text-gray-500">
      <div class="inline-block w-12 h-12 border-4 border-gray-200 border-t-yellow-400 rounded-full animate-spin mb-4"></div>
      <p>Loading...</p>
    </div>

    <div v-else-if="forms.length === 0" class="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-300">
      <p class="text-gray-500 text-lg">No forms available.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <component
        v-for="form in forms"
        :key="form.id"
        :is="form.status === 'active' ? RouterLink : 'div'"
        :to="form.status === 'active' ? '/form/' + form.slug : undefined"
        class="block p-6 border rounded-xl transition group relative flex flex-col justify-between min-h-[200px]"
        :class="[
          form.status === 'active'
            ? 'bg-white border-gray-200 hover:shadow-lg hover:border-yellow-400 cursor-pointer'
            : 'bg-gray-50 border-gray-200 opacity-75 grayscale cursor-not-allowed',
        ]"
      >
        <div>
          <div class="flex justify-between items-start mb-3">
            <div class="text-3xl bg-gray-50 p-2 rounded-lg group-hover:bg-yellow-50 transition">
              {{ form.info_blocks?.[0]?.icon || '📝' }}
            </div>
            
            <span
              class="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border"
              :class="{
                'bg-green-100 text-green-800 border-green-200': form.status === 'active',
                'bg-orange-100 text-orange-800 border-orange-200': form.status === 'draft',
                'bg-red-100 text-red-800 border-red-200': form.status !== 'active' && form.status !== 'draft',
              }"
            >
              {{ form.status === 'archived' ? 'Inactive' : form.status }}
            </span>
          </div>

          <h2
            class="text-xl font-bold mb-2 transition"
            :class="form.status === 'active' ? 'group-hover:text-yellow-600 text-gray-900' : 'text-gray-500'"
          >
            {{ form.title }}
          </h2>
          
          <p class="text-gray-500 text-sm line-clamp-2 mb-4">
            {{ form.description || 'No description available.' }}
          </p>

          <p class="text-gray-400 text-xs font-mono">
            Updated: {{ new Date(form.created_at).toLocaleDateString() }}
          </p>
        </div>

        <div
          v-if="canEdit(form)"
          class="mt-4 pt-4 border-t border-gray-100 flex justify-end z-20 relative"
        >
          <button
            @click.prevent.stop="navigateToEdit(form.slug)"
            class="text-xs font-bold text-gray-500 hover:text-black flex items-center gap-1 transition bg-white px-3 py-1.5 rounded-md hover:bg-gray-100 border border-gray-200 shadow-sm"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
            Edit Form
          </button>
        </div>

        <div
          v-if="form.status !== 'active'"
          class="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
        >
          <div class="bg-white/90 p-3 rounded-full shadow-sm backdrop-blur-sm">
            <svg class="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

      </component>
    </div>
  </div>
</template>