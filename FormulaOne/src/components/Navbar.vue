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
</script>

<template>
  <nav class="bg-gray-950 border-b border-gray-800 sticky top-0 z-40 shadow-md font-extralight">
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
          <router-link
            v-if="route.path !== '/'"
            to="/"
            class="text-sm font-extralight text-gray-300 hover:text-[#F5DF02] transition-colors px-3 py-2"
          >
            All Forms
          </router-link>

          <router-link
            v-if="route.path !== '/summary'"
            to="/summary"
            class="text-sm font-extralight text-gray-300 hover:text-[#F5DF02] transition-colors px-3 py-2"
          >
            Dashboard
          </router-link>

          <template v-if="user">
            <div class="h-6 w-px bg-gray-700 mx-1"></div>

            <router-link
              v-if="isAdmin() && route.path !== '/team'"
              to="/team"
              class="text-sm font-extralight text-gray-300 hover:text-[#F5DF02] transition-colors flex items-center gap-2 px-3 py-2"
            >
              Manage Team
            </router-link>

            <router-link
              v-if="route.path !== '/create'"
              to="/create"
              class="text-sm font-extralight text-gray-300 hover:text-[#F5DF02] transition-colors flex items-center gap-2 px-3 py-2"
            >
              New Form
            </router-link>

            <button
              @click="handleLogout"
              class="text-sm font-extralight text-gray-300 transition-colors flex items-center gap-2 px-3 py-2 hover:text-red-500"
            >
              Sign Out
            </button>
          </template>

          <template v-else>
            <div class="h-6 w-px bg-gray-700 mx-1"></div>
            <router-link
              to="/login"
              class="text-sm font-extralight text-[#F5DF02] hover:text-white transition-colors px-3 py-2"
            >
              Log In
            </router-link>
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
        <router-link
          v-if="route.path !== '/'"
          to="/"
          @click="isMenuOpen = false"
          class="block text-sm font-extralight text-gray-900 hover:text-gray-500 transition-colors px-3 py-2"
        >
          All Forms
        </router-link>

        <router-link
          v-if="route.path !== '/summary'"
          to="/summary"
          @click="isMenuOpen = false"
          class="block text-sm font-extralight text-gray-900 hover:text-gray-500 transition-colors px-3 py-2"
        >
          Dashboard
        </router-link>

        <template v-if="user">
          <div class="h-px bg-gray-300 mx-3 my-2"></div>

          <router-link
            v-if="isAdmin() && route.path !== '/team'"
            to="/team"
            @click="isMenuOpen = false"
            class="block text-sm font-extralight text-gray-900 hover:text-gray-500 transition-colors px-3 py-2"
          >
            Manage Team
          </router-link>

          <router-link
            v-if="route.path !== '/create'"
            to="/create"
            @click="isMenuOpen = false"
            class="block text-sm font-extralight text-gray-900 hover:text-gray-500 transition-colors px-3 py-2"
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
