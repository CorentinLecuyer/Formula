<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import loginImage from '../assets/Login_image_people_idea.png'

const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const router = useRouter()
const toast = useToast()

// Security Check: Verify user is actually logged in (Magic Link worked)
onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    toast.error('Invalid or expired link. Please try logging in again.')
    router.push('/login')
  }
})

const handleSetPassword = async () => {
  if (password.value !== confirmPassword.value) {
    return toast.warning('Passwords do not match.')
  }
  if (password.value.length < 6) {
    return toast.warning('Password must be at least 6 characters.')
  }

  loading.value = true
  
  // Update the user's password
  const { error } = await supabase.auth.updateUser({
    password: password.value
  })

  if (error) {
    toast.error(error.message)
  } else {
    toast.success('Password set successfully! You are now logged in.')
    router.push('/summary') // Redirect to Dashboard
  }
  
  loading.value = false
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 overflow-y-auto">
    <div class="flex w-full max-w-5xl min-h-[600px] bg-white rounded-2xl shadow-2xl overflow-hidden">
      
      <div class="hidden md:flex w-1/2 bg-gray-100 items-center justify-center p-12 relative">
        <div class="absolute inset-0 bg-gray-100/50 z-0"></div>
        <img
          :src="loginImage"
          alt="Illustration"
          class="relative z-10 max-w-full max-h-[400px] object-contain drop-shadow-lg transition-transform hover:scale-105 duration-500"
        />
      </div>

      <div class="w-full md:w-1/2 flex flex-col justify-center items-center p-8 md:p-12 bg-white">
        <div class="w-full max-w-sm space-y-8 text-center">
          
          <div>
            <h1 class="text-3xl font-extrabold text-gray-900 tracking-tight">Set Password</h1>
            <p class="mt-2 text-sm text-gray-500">Secure your account to continue</p>
          </div>

          <form class="mt-8 space-y-6" @submit.prevent="handleSetPassword">
            <div class="space-y-4 text-left">
              
              <div>
                <label for="password" class="block text-sm font-bold text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  v-model="password"
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="••••••••"
                  minlength="6"
                  class="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5DF02] focus:border-[#F5DF02] focus:z-10 sm:text-sm transition-all"
                />
              </div>

              <div>
                <label for="confirmPassword" class="block text-sm font-bold text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  v-model="confirmPassword"
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  placeholder="••••••••"
                  class="appearance-none relative block w-full px-4 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F5DF02] focus:border-[#F5DF02] focus:z-10 sm:text-sm transition-all"
                />
              </div>
            </div>

            <div class="space-y-3 pt-2">
              <button
                type="submit"
                :disabled="loading"
                class="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-gray-900 bg-[#F5DF02] hover:bg-[#e3ce02] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F5DF02] shadow-md hover:shadow-lg transform transition hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span v-if="loading" class="absolute left-0 inset-y-0 flex items-center pl-3">
                  <svg class="animate-spin h-5 w-5 text-gray-800" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
                {{ loading ? 'Saving...' : 'Set Password & Login' }}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  </div>
</template>