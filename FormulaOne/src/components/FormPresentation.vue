<script setup>
import { computed } from 'vue'

const props = defineProps({
  title: String,
  description: String,
  blocks: { type: Array, default: () => [] },
})
</script>

<template>
  <div class="mb-8 space-y-6">
    <div class="text-center space-y-4">
      <h1 class="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
        {{ title }}
      </h1>
      <p
        v-if="description"
        class="max-w-2xl mx-auto text-gray-500 whitespace-pre-line text-left pt-6"
        v-html="description"
      ></p>
    </div>

    <div v-if="blocks && blocks.length > 0" class="grid grid-cols-1 gap-6 mt-8">
      <div
        v-for="(block, index) in blocks"
        :key="index"
        class="bg-gray-50 rounded-xl border border-gray-100 transition hover:shadow-md overflow-hidden"
      >
        <div class="flex items-center gap-4 p-6">
          <div class="text-3xl bg-white p-2 rounded-lg shadow-sm shrink-0">
            {{ block.icon || '📌' }}
          </div>

          <div class="flex-1 min-w-0 pt-1">
            <h3 class="font-bold text-lg text-gray-900 mb-1">{{ block.title }}</h3>
            <div
              v-if="block.content"
              class="text-gray-600 text-sm whitespace-pre-wrap leading-relaxed"
              v-html="block.content"
            ></div>
          </div>
        </div>

        <div v-if="block.image" class="px-6 pb-6 justify-center flex">
          <img
            :src="block.image"
            alt="Block visual"
            class="rounded-lg border border-gray-200 w-auto max-h-96 shadow-sm"
          />
        </div>

      </div>
    </div>
  </div>
</template>
