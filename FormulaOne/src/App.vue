<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen bg-gray-50 font-sans text-gray-900">
    <nav class="bg-gray-950 text-white p-4 shadow-md">
      <div class="max-w-6xl mx-auto flex justify-between items-center">

        <img src="./assets/Logo AB InBev FullColor-White.png" class="max-h-8" alt="Logo" />



        <div class="space-x-6">
          <RouterLink to="/" class="hover:text-yellow-400 transition">All forms</RouterLink>
          <RouterLink to="/create" class="hover:text-yellow-400 transition">+ Build New</RouterLink> 
          <RouterLink to="/summary" class="hover:text-yellow-400 transition">Dashboard</RouterLink>
        </div>
      </div>
    </nav>

    <RouterView />
  </div>
</template>