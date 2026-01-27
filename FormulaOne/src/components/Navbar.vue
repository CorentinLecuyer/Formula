<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '../supabase'
import { useAuth } from '../composables/useAuth'

const router = useRouter()
const route = useRoute()
const { user, fetchUser, isAdmin } = useAuth()
const isMenuOpen = ref(false)

onMounted(() => {
  fetchUser()
})

const handleLogout = async () => {
  await supabase.auth.signOut()
  isMenuOpen.value = false
  router.push('/login')
}

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

// Helper to determine active state style
const getLinkClass = (path) => {
  const base = 'text-sm transition-all duration-200 px-3 py-2'

  // Active State: Yellow + Glow + Normal Weight
  if (route.path === path) {
    return `${base} text-[#F5DF02] font-normal underline-offset-4 underline drop-shadow-[0_0_2px_rgba(245,223,2,0.1)]`
  }

  // Inactive State: Gray + Extralight + Yellow Hover
  return `${base} text-gray-300 font-extralight hover:text-[#F5DF02]`
}

// Mobile Helper
const getMobileLinkClass = (path) => {
  const base = 'block text-sm transition-all duration-200 px-3 py-2'
  if (route.path === path) {
    return `${base} text-[#F5DF02] font-normal bg-gray-900`
  }
  return `${base} text-gray-900 font-extralight hover:text-gray-500`
}
</script>

<template>
  <nav class="bg-gray-950 border-b border-gray-800 sticky top-0 z-40 shadow-md">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between h-16 items-center">
        <div class="flex-shrink-0 flex items-center">
          <router-link to="/summary" class="flex items-center gap-2">
            <img
              src="../assets/Logo AB InBev FullColor-White.png"
              class="max-h-8 object-contain"
              alt="Logo"
            />
          </router-link>
        </div>

        <div class="hidden md:flex items-center gap-4">
          <router-link to="/" :class="getLinkClass('/')"> All Forms </router-link>

          <router-link to="/summary" :class="getLinkClass('/summary')"> Dashboard </router-link>

          <template v-if="user">
            <div class="h-6 w-px bg-gray-700 mx-1"></div>

            <router-link
              v-if="isAdmin()"
              to="/team"
              :class="getLinkClass('/team')"
              class="flex items-center gap-2"
            >
              Manage Team
            </router-link>

            <router-link to="/create" :class="getLinkClass('/create')"> New Form </router-link>

            <button
              @click="handleLogout"
              class="text-sm font-extralight text-gray-300 transition-colors flex items-center gap-2 px-3 py-2 hover:text-red-500"
            >
              Sign Out
            </button>
          </template>

          <template v-else>
            <div class="h-6 w-px bg-gray-700 mx-1"></div>
            <router-link to="/login" :class="getLinkClass('/login')"> Log In </router-link>
          </template>
        </div>

        <div class="flex items-center md:hidden">
          <button @click="toggleMenu" class="text-gray-300 hover:text-white focus:outline-none p-2">
            <svg
              v-if="!isMenuOpen"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            <svg v-else class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div v-if="isMenuOpen" class="md:hidden bg-gray-50 border-b border-gray-50 shadow-inner">
      <div class="px-4 pb-6 pt-3 space-y-3">
        <router-link to="/" @click="isMenuOpen = false" :class="getMobileLinkClass('/')">
          All Forms
        </router-link>

        <router-link
          to="/summary"
          @click="isMenuOpen = false"
          :class="getMobileLinkClass('/summary')"
        >
          Dashboard
        </router-link>

        <div v-if="user" class="h-px bg-gray-300 mx-3 my-2"></div>

        <template v-if="user">
          <router-link
            v-if="isAdmin()"
            to="/team"
            @click="isMenuOpen = false"
            :class="getMobileLinkClass('/team')"
          >
            Manage Team
          </router-link>

          <router-link
            to="/create"
            @click="isMenuOpen = false"
            :class="getMobileLinkClass('/create')"
          >
            New Form
          </router-link>

          <button
            @click="handleLogout"
            class="block w-full text-left text-sm font-extralight text-red-700 transition-colors px-3 py-2 hover:text-red-500"
          >
            Sign Out
          </button>
        </template>

        <template v-else>
          <router-link
            to="/login"
            @click="isMenuOpen = false"
            class="block text-sm font-extralight text-gray-900 hover:text-[#F5DF02] px-3 py-2"
          >
            Log In
          </router-link>
        </template>
      </div>
    </div>
  </nav>
</template>
