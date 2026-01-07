<script setup>
import { RouterView } from 'vue-router'
import Navbar from './components/Navbar.vue' // ✅ Correct Import (Default)
</script>

<template>
  <div class="min-h-screen bg-gray-50 font-sans text-gray-900">
    <Navbar />
    <RouterView :key="$route.fullPath" />
  </div>
</template>