<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { VueSignaturePad } from 'vue-signature-pad'

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: String 
})

const emit = defineEmits(['update:modelValue'])
const signaturePad = ref(null)

// Helper to load data safely
const loadSignature = async (data) => {
  if (!data) return
  
  await nextTick() // Wait for Vue to render DOM
  
  // Small safety delay to ensure Canvas context is ready
  setTimeout(() => {
    if (signaturePad.value) {
      signaturePad.value.fromDataURL(data)
    }
  }, 50)
}

// 1. Watch for data arriving from DB
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    loadSignature(newVal)
  }
}, { immediate: true })

// 2. Also try loading on mount (in case data was already there)
onMounted(() => {
  if (props.modelValue) {
    loadSignature(props.modelValue)
  }
})

const onEnd = () => {
  if (!signaturePad.value) return
  const { data } = signaturePad.value.saveSignature()
  emit('update:modelValue', data)
}

const clear = () => {
  if (!signaturePad.value) return
  signaturePad.value.clearSignature()
  emit('update:modelValue', null)
}
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="border border-gray-300 rounded-md overflow-hidden bg-white">
      <VueSignaturePad
        ref="signaturePad"
        width="100%"
        height="200px"
        :options="{ onEnd }"
      />
    </div>
    
    <button 
      type="button" 
      @click="clear" 
      class="text-xs text-red-500 hover:text-red-700 self-end font-semibold"
    >
      Clear Signature
    </button>
  </div>
</template>