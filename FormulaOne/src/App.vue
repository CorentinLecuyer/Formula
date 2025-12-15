<script setup>
import { ref } from 'vue'
import FormRenderer from './components/FormRenderer.vue'

// 1. The Schema (Usually comes from Database, hardcoded for now)
const testSchema = ref([
  {
    id: "poc_name",
    type: "text",
    label: "POC Name",
    placeholder: "Enter the bar name...",
    required: true
  },
  {
    id: "machines_sold",
    type: "number", // We are reusing the text input for now, but we can add type="number" later
    label: "Machines Sold",
    required: true
  },
  {
    id: "final_poc",
    type: "poc_select", // <--- This triggers your new component
    label: "Search for a Point of Sale",
    required: true
  },
  {
    id: "manager_sign",
    type: "signature",
    label: "Manager Validation",
    required: true
  }
])

// 2. The Data (Starts empty)
const formData = ref({})
</script>

<template>
  <div class="max-w-2xl mx-auto p-10">
    <h1 class="text-3xl font-bold mb-8">Form Builder Test</h1>

    <div class="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
      
      <FormRenderer 
        :schema="testSchema" 
        v-model="formData" 
      />

    </div>

    <div class="mt-10 p-4 bg-gray-900 text-green-400 rounded-lg font-mono text-sm">
      <h3 class="text-white font-bold mb-2 uppercase">Live Data Store:</h3>
      <pre>{{ formData }}</pre>
    </div>
  </div>
</template>