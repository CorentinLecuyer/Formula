<script setup>
import { ref, watch } from 'vue'
import { VueSignaturePad } from 'vue-signature-pad'

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: String // The signature is stored as a base64 string
})

const emit = defineEmits(['update:modelValue'])
const signaturePad = ref(null)

// If we already have a signature (e.g. editing), load it
watch(() => props.modelValue, (val) => {
  if (val && signaturePad.value) {
    signaturePad.value.fromDataURL(val)
  }
})

const onEnd = () => {
  const { data } = signaturePad.value.saveSignature()
  emit('update:modelValue', data)
}

const clear = () => {
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
      class="text-xs text-red-500 hover:text-red-700 self-end"
    >
      Clear Signature
    </button>
  </div>
</template>