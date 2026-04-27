<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import loginImage from '../assets/Login_image_people_idea.png'

const email = ref('')
const otp = ref('')
const newPassword = ref('')
const step = ref(1) // 1: Verify Code, 2: New Password
const loading = ref(false)
const router = useRouter()
const toast = useToast()

const handleVerifyCode = async () => {
  if (!email.value || !otp.value) return toast.warning('Email and 6-digit code are required.')
  
  loading.value = true
  const { error } = await supabase.auth.verifyOtp({
    email: email.value,
    token: otp.value,
    type: 'recovery' // Strictly 'recovery'
  })

  if (error) {
    toast.error('Invalid or expired code.')
  } else {
    toast.success('Code verified! Please enter your new password.')
    step.value = 2
  }
  loading.value = false
}

const handleUpdatePassword = async () => {
  if (newPassword.value.length < 6) return toast.warning('Password must be at least 6 characters.')
  
  loading.value = true
  const { error } = await supabase.auth.updateUser({
    password: newPassword.value
  })

  if (error) {
    toast.error(error.message)
  } else {
    toast.success('Password reset successfully! You are logged in.')
    router.push('/summary')
  }
  loading.value = false
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
    <div class="flex w-full max-w-5xl min-h-[600px] bg-white rounded-2xl shadow-2xl overflow-hidden">
      
      <div class="hidden md:flex w-1/2 bg-gray-100 items-center justify-center p-12 relative">
        <div class="absolute inset-0 bg-gray-100/50 z-0"></div>
        <img :src="loginImage" class="relative z-10 max-w-full max-h-[400px] object-contain" />
      </div>

      <div class="w-full md:w-1/2 flex flex-col justify-center items-center p-8 md:p-12 bg-white">
        
        <div v-if="step === 1" class="w-full max-w-sm space-y-6 text-center">
          <div>
            <h1 class="text-3xl font-extrabold text-gray-900">Reset Password</h1>
            <p class="mt-2 text-sm text-gray-500">Enter your email and the 6-digit recovery code.</p>
          </div>

          <form class="space-y-4 text-left" @submit.prevent="handleVerifyCode">
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
              <input v-model="email" type="email" autocomplete="username" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-[#F5DF02]" />
            </div>
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1">6-Digit Code</label>
              <input v-model="otp" type="text" autocomplete="one-time-code" required maxlength="6" class="w-full px-4 py-3 border border-gray-300 rounded-lg text-center tracking-widest font-bold text-xl focus:ring-[#F5DF02]" />
            </div>
            <button type="submit" :disabled="loading" class="w-full py-3 font-bold rounded-lg bg-[#F5DF02] hover:bg-[#e3ce02] disabled:opacity-50">
              {{ loading ? 'Verifying...' : 'Verify Code' }}
            </button>
            <div class="text-center mt-4">
              <router-link to="/login" class="text-sm font-medium text-gray-500 hover:underline">Back to Login</router-link>
            </div>
          </form>
        </div>

        <div v-else class="w-full max-w-sm space-y-6 text-center">
          <div>
            <h1 class="text-3xl font-extrabold text-gray-900">New Password</h1>
            <p class="mt-2 text-sm text-gray-500">Create a new secure password.</p>
          </div>

          <form class="space-y-4 text-left" @submit.prevent="handleUpdatePassword">
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1">New Password</label>
              <input v-model="newPassword" type="password" autocomplete="new-password" required minlength="6" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-[#F5DF02]" />
            </div>
            <button type="submit" :disabled="loading" class="w-full py-3 font-bold rounded-lg bg-[#F5DF02] hover:bg-[#e3ce02] disabled:opacity-50">
              {{ loading ? 'Saving...' : 'Save & Login' }}
            </button>
          </form>
        </div>

      </div>
    </div>
  </div>
</template>