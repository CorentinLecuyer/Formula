<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase'
import { useToast } from 'vue-toastification'
import { useAuth } from '../composables/useAuth'

const { isAdmin } = useAuth()
const toast = useToast()

const users = ref([])
const loading = ref(false)
const searchQuery = ref('') // 🔍 Search State

// INVITE MODAL STATE
const showInviteModal = ref(false)
const inviteEmail = ref('')
const isInviting = ref(false)

// 1. Fetch Users
const fetchAllUsers = async () => {
  loading.value = true
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (!error) users.value = data
  loading.value = false
}

// 2. Search Logic 🔍
const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const query = searchQuery.value.toLowerCase()
  return users.value.filter(
    (u) => u.email.toLowerCase().includes(query) || u.role.toLowerCase().includes(query),
  )
})

// 3. Role Toggle Logic
const toggleRole = async (user) => {
  const newRole = user.role === 'admin' ? 'user' : 'admin'
  const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)

  if (error) {
    toast.error('Failed to update role')
  } else {
    user.role = newRole
    toast.success(`User is now an ${newRole}`)
  }
}

const sendInvite = async () => {
  if (!inviteEmail.value) return toast.warning('Please enter an email')
  isInviting.value = true

  const { error } = await supabase.auth.signInWithOtp({
    email: inviteEmail.value,
    options: {
      // 👇 CHANGE THIS LINE: Point to the new page
      emailRedirectTo: window.location.origin + '/set-password'
    }
  })

  if (error) {
    toast.error(error.message)
  } else {
    toast.success(`Invitation sent to ${inviteEmail.value}`)
    showInviteModal.value = false
    inviteEmail.value = ''
  }
  isInviting.value = false
}

onMounted(() => {
  if (isAdmin()) fetchAllUsers()
})
</script>

<template>
  <div class="max-w-5xl mx-auto p-8">
    <div class="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900">Team Management</h1>
        <p class="text-gray-500 mt-1">Manage user access and roles.</p>
      </div>

      <div class="flex gap-3 w-full md:w-auto">
        <div class="relative flex-grow md:flex-grow-0">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search users..."
            class="w-full md:w-64 border border-gray-300 rounded-lg px-4 py-2 pl-10 focus:ring-black focus:border-black transition shadow-sm"
          />
          <span class="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>

        <button
          @click="showInviteModal = true"
          class="bg-black text-white px-4 py-2 rounded-lg font-bold hover:bg-gray-800 transition shadow-sm whitespace-nowrap flex items-center gap-2"
        >
          <span>+</span> Add Member
        </button>
      </div>
    </div>

    <div class="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
            >
              Email
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider"
            >
              Role
            </th>
            <th
              class="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="u in filteredUsers" :key="u.id" class="hover:bg-gray-50 transition">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              {{ u.email }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span
                class="px-2 py-1 inline-flex text-xs leading-5 font-bold rounded-full uppercase"
                :class="
                  u.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                "
              >
                {{ u.role }}
              </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <button
                @click="toggleRole(u)"
                class="text-blue-600 hover:text-blue-900 font-bold text-xs border border-blue-200 px-3 py-1 rounded hover:bg-blue-50 transition"
              >
                {{ u.role === 'admin' ? 'Demote to User' : 'Promote to Super User' }}
              </button>
            </td>
          </tr>

          <tr v-if="filteredUsers.length === 0 && !loading">
            <td colspan="3" class="px-6 py-10 text-center text-gray-500">
              No users found matching "{{ searchQuery }}"
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div
      v-if="showInviteModal"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div class="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 class="text-xl font-bold">Invite New Member</h3>
          <button @click="showInviteModal = false" class="text-gray-400 hover:text-black">✕</button>
        </div>

        <div class="p-6 space-y-4">
          <p class="text-sm text-gray-500">
            Send an invitation email. The user will receive a link to sign in.
          </p>

          <div>
            <label class="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
            <input
              v-model="inviteEmail"
              type="email"
              placeholder="colleague@perfectdraft.com"
              class="w-full border border-gray-300 rounded-lg p-2 focus:ring-black focus:border-black"
            />
          </div>

          <button
            @click="sendInvite"
            :disabled="isInviting"
            class="w-full bg-[#F5DF02] text-black font-bold py-3 rounded-lg hover:bg-[#ffe44d] transition shadow disabled:opacity-50"
          >
            {{ isInviting ? 'Sending Invite...' : 'Send Invitation' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
