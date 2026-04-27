<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import loginImage from '../assets/Login_image_people_idea.png'

const email = ref('')
const otp = ref('')
const password = ref('')
const loading = ref(false)
const router = useRouter()
const toast = useToast()

const handleAcceptInvite = async () => {
  if (!email.value || !otp.value) return toast.warning('Email and code are required.')
  if (password.value.length < 6) return toast.warning('Password must be at least 6 characters.')

  loading.value = true

  // 1. Verify Invite Code
  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: email.value,
    token: otp.value,
    type: 'invite', // Strictly 'invite'
  })

  if (verifyError) {
    toast.error('Invalid or expired invite code.')
    loading.value = false
    return
  }

  // 2. Set Initial Password
  const { error: updateError } = await supabase.auth.updateUser({
    password: password.value,
  })

  if (updateError) {
    toast.error(updateError.message)
  } else {
    toast.success('Welcome to the team! Password set successfully.')
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
        <div class="w-full max-w-sm space-y-6 text-center">
          <div>
            <h1 class="text-3xl font-extrabold text-gray-900">Accept Invite</h1>
            <p class="mt-2 text-sm text-gray-500">Enter your code to join the team.</p>
          </div>

          <form class="space-y-4 text-left" @submit.prevent="handleAcceptInvite">
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1">Email Address</label>
              <input v-model="email" type="email" autocomplete="username" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-[#F5DF02]" />
            </div>
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1">6-Digit Code</label>
              <input v-model="otp" type="text" autocomplete="one-time-code" required maxlength="6" class="w-full px-4 py-3 border border-gray-300 rounded-lg text-center tracking-widest font-bold text-xl focus:ring-[#F5DF02]" />
            </div>
            <div>
              <label class="block text-sm font-bold text-gray-700 mb-1">Create Password</label>
              <input v-model="password" type="password" autocomplete="new-password" required minlength="6" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-[#F5DF02]" />
            </div>
            <button type="submit" :disabled="loading" class="w-full py-3 font-bold rounded-lg bg-[#F5DF02] hover:bg-[#e3ce02] disabled:opacity-50">
              {{ loading ? 'Verifying...' : 'Set Password & Join' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>