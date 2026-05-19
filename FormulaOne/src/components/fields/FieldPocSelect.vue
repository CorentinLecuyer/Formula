<script setup>
import { computed, ref, watch } from 'vue'
import { supabase } from '../../supabase'

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [Object, null], default: null },
})

const emit = defineEmits(['update:modelValue'])

const MANUAL_MAVEN_PLACEHOLDER = 'to be created in maven'

const searchQuery = ref('')
const results = ref([])
const showResults = ref(false)
const isSearching = ref(false)
const isManualMode = ref(false)
const manualInputName = ref('')
const selectedPocName = ref('')
const selectedSapId = ref('')
const mavenAccountData = ref({})
const syncingFromProps = ref(false)

const parseDependentMappingText = (mappingText = '') => {
  const parsedMap = {}

  String(mappingText || '')
    .split('\n')
    .forEach((line) => {
      if (!line.includes(':')) return

      const [rawParent, ...rawChildrenParts] = line.split(':')
      const parent = rawParent.trim()
      const rawChildren = rawChildrenParts.join(':')

      if (!parent) return

      parsedMap[parent] = rawChildren
        .split(',')
        .map((child) => child.trim())
        .filter((child) => child.length > 0)
    })

  return parsedMap
}

const manualPocMode = computed(() => props.field?.manualPocMode || 'name_only')

const isMavenManualMode = computed(() => manualPocMode.value === 'maven_account')

const mavenAccountFields = computed(() => {
  if (!Array.isArray(props.field?.mavenAccountFields)) return []

  return props.field.mavenAccountFields.map((mavenField, index) => {
    const normalized = {
      key: mavenField.key || `field_${index + 1}`,
      label: mavenField.label || `Field ${index + 1}`,
      type: mavenField.type || 'text',
      required: !!mavenField.required,
      parentLabel: mavenField.parentLabel || 'Segment',
      childLabel: mavenField.childLabel || 'Sous-Segment',
      mappingText: mavenField.mappingText || '',
      mappingData: mavenField.mappingData || {},
    }

    if (normalized.type === 'dependent_select') {
      normalized.mappingData =
        Object.keys(normalized.mappingData || {}).length > 0
          ? normalized.mappingData
          : parseDependentMappingText(normalized.mappingText)
    }

    return normalized
  })
})

const getMavenEstablishmentName = () =>
  String(mavenAccountData.value?.establishment_name || '').trim()

const getManualPocName = () => {
  if (isMavenManualMode.value) {
    return getMavenEstablishmentName() || MANUAL_MAVEN_PLACEHOLDER
  }

  return String(manualInputName.value || '').trim()
}

const syncSelectedManualDisplay = () => {
  if (!isManualMode.value) return
  selectedPocName.value = getManualPocName()
  selectedSapId.value = '00000000'
}

const emitManualValue = () => {
  const manualMode = manualPocMode.value
  const manualName = getManualPocName()

  syncSelectedManualDisplay()

  emit('update:modelValue', {
    name: manualName,
    id: 'MANUAL',
    sap_id: '00000000',
    is_manual: true,
    manual_mode: manualMode,
    maven_account: manualMode === 'maven_account' ? { ...mavenAccountData.value } : null,
  })
}

const updateMavenAccountField = (key, value) => {
  mavenAccountData.value = {
    ...mavenAccountData.value,
    [key]: value,
  }

  emitManualValue()
}

const updateMavenDependentField = (mavenField, level, value) => {
  const currentValue = mavenAccountData.value[mavenField.key] || {
    parent: '',
    child: '',
  }

  const nextValue =
    level === 'parent'
      ? { parent: value, child: '' }
      : { ...currentValue, child: value }

  updateMavenAccountField(mavenField.key, nextValue)
}

const searchPocs = async () => {
  if (searchQuery.value.length < 2) {
    showResults.value = false
    results.value = []
    return
  }

  isSearching.value = true

  const { data, error } = await supabase
    .from('pocs')
    .select('id, Name, ABI_SFA_City__c, ABI_SFA_SAPID__c')
    .ilike('Name', `%${searchQuery.value}%`)
    .limit(200)

  if (error) {
    console.error('POC search failed:', error)
    results.value = []
  } else {
    results.value = data || []
  }

  showResults.value = true
  isSearching.value = false
}

const selectPoc = (poc) => {
  if (poc.id === 'MANUAL_ENTRY') {
    isManualMode.value = true
    manualInputName.value = ''
    mavenAccountData.value = {}
    selectedPocName.value = isMavenManualMode.value ? MANUAL_MAVEN_PLACEHOLDER : ''
    selectedSapId.value = '00000000'
    searchQuery.value = ''
    showResults.value = false

    emitManualValue()
    return
  }

  isManualMode.value = false
  selectedPocName.value = poc.Name || ''
  selectedSapId.value = poc.ABI_SFA_SAPID__c || ''
  manualInputName.value = ''
  mavenAccountData.value = {}
  searchQuery.value = ''
  showResults.value = false

  emit('update:modelValue', {
    name: poc.Name || '',
    id: poc.id,
    sap_id: poc.ABI_SFA_SAPID__c || '',
    is_manual: false,
    manual_mode: null,
    maven_account: null,
  })
}

const clearSelection = () => {
  selectedPocName.value = ''
  selectedSapId.value = ''
  isManualMode.value = false
  manualInputName.value = ''
  mavenAccountData.value = {}
  searchQuery.value = ''
  showResults.value = false
  emit('update:modelValue', null)
}

watch(manualInputName, () => {
  if (syncingFromProps.value) return
  if (!isManualMode.value) return
  if (isMavenManualMode.value) return

  emitManualValue()
})

watch(
  () => manualPocMode.value,
  () => {
    if (!isManualMode.value) return

    if (isMavenManualMode.value) {
      manualInputName.value = ''
      selectedPocName.value = getManualPocName()
    } else {
      mavenAccountData.value = {}
      selectedPocName.value = manualInputName.value || ''
    }

    emitManualValue()
  },
)

watch(
  () => props.modelValue,
  (newVal) => {
    syncingFromProps.value = true

    if (!newVal) {
      selectedPocName.value = ''
      selectedSapId.value = ''
      isManualMode.value = false
      manualInputName.value = ''
      mavenAccountData.value = {}
      syncingFromProps.value = false
      return
    }

    selectedSapId.value = newVal.sap_id || ''

    if (newVal.id === 'MANUAL_ENTRY' || newVal.id === 'MANUAL' || newVal.is_manual) {
      isManualMode.value = true
      mavenAccountData.value = { ...(newVal.maven_account || {}) }

      if (newVal.manual_mode === 'maven_account' || isMavenManualMode.value) {
        manualInputName.value = ''
        selectedPocName.value =
          String(mavenAccountData.value.establishment_name || '').trim() ||
          newVal.name ||
          MANUAL_MAVEN_PLACEHOLDER
      } else {
        manualInputName.value = newVal.name || ''
        selectedPocName.value = newVal.name || ''
      }

      selectedSapId.value = '00000000'
    } else {
      isManualMode.value = false
      selectedPocName.value = newVal.name || ''
      manualInputName.value = ''
      mavenAccountData.value = {}
    }

    queueMicrotask(() => {
      syncingFromProps.value = false
    })
  },
  { immediate: true },
)
</script>

<template>
  <div class="space-y-4">
    <div class="relative">
      <input
        v-model="searchQuery"
        @input="searchPocs"
        type="text"
        placeholder="Type to search POC..."
        class="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-black"
      />

      <ul
        v-if="showResults"
        class="absolute z-50 bg-white border mt-1 w-full shadow-lg rounded max-h-60 overflow-auto"
      >
        <li
          @click="selectPoc({ id: 'MANUAL_ENTRY' })"
          class="px-3 py-2 hover:bg-yellow-50 cursor-pointer text-sm border-b border-gray-100 bg-gray-50 text-blue-600 font-bold"
        >
          --- Inexistant dans la liste ---
        </li>

        <li v-if="isSearching" class="px-3 py-2 text-sm text-gray-400">
          Searching...
        </li>

        <li
          v-for="poc in results"
          :key="poc.id"
          @click="selectPoc(poc)"
          class="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm border-b last:border-0"
        >
          <span class="font-bold">{{ poc.Name }}</span>
          <span class="text-xs text-gray-500 block">{{ poc.ABI_SFA_City__c }}</span>
          <span v-if="poc.ABI_SFA_SAPID__c" class="text-[11px] text-gray-400 block">
            SAP ID: {{ poc.ABI_SFA_SAPID__c }}
          </span>
        </li>

        <li v-if="!isSearching && results.length === 0" class="px-3 py-2 text-xs text-gray-400">
          No matching POC found. Use the manual option above if needed.
        </li>
      </ul>
    </div>

    <div v-if="isManualMode" class="space-y-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
      <div
        v-if="!isMavenManualMode"
        class="space-y-1"
      >
        <label class="block text-xs font-bold text-yellow-900 uppercase mb-1">
          Nom du POC
        </label>
        <input
          type="text"
          :value="manualInputName"
          @input="manualInputName = $event.target.value"
          class="w-full border-2 border-yellow-400 bg-white rounded-md p-2 text-gray-900 focus:ring-0 placeholder-gray-500"
          placeholder="Entrer le nom du POC manuellement"
          required
        />
      </div>

      <div
        v-if="isMavenManualMode"
        class="space-y-3 bg-white border border-yellow-100 rounded-lg p-4"
      >
        <div>
          <h4 class="text-sm font-bold text-gray-900">Full Maven account creation</h4>
          <p class="text-xs text-gray-500 mt-1">
            Complete the Maven account request. The field “Nom de l'établissement” will be used as
            the POC name. Until it is filled, the POC is stored as “{{ MANUAL_MAVEN_PLACEHOLDER }}”.
          </p>
        </div>

        <div v-for="mavenField in mavenAccountFields" :key="mavenField.key" class="space-y-1">
          <template v-if="mavenField.type === 'dependent_select'">
            <label class="block text-xs font-bold text-gray-600 uppercase">
              {{ mavenField.label }}
              <span v-if="mavenField.required" class="text-red-500">*</span>
            </label>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-[11px] font-semibold text-gray-500 mb-1">
                  {{ mavenField.parentLabel || 'Segment' }}
                </label>
                <select
                  :value="mavenAccountData[mavenField.key]?.parent || ''"
                  :required="mavenField.required"
                  @change="updateMavenDependentField(mavenField, 'parent', $event.target.value)"
                  class="w-full border border-gray-300 rounded-md p-2 text-sm bg-white focus:ring-black focus:border-black"
                >
                  <option value="" disabled>Select {{ mavenField.parentLabel || 'Segment' }}...</option>
                  <option
                    v-for="parentOpt in Object.keys(mavenField.mappingData || {})"
                    :key="parentOpt"
                    :value="parentOpt"
                  >
                    {{ parentOpt }}
                  </option>
                </select>
              </div>

              <div>
                <label class="block text-[11px] font-semibold text-gray-500 mb-1">
                  {{ mavenField.childLabel || 'Sous-Segment' }}
                </label>
                <select
                  :value="mavenAccountData[mavenField.key]?.child || ''"
                  :required="mavenField.required"
                  :disabled="!mavenAccountData[mavenField.key]?.parent"
                  @change="updateMavenDependentField(mavenField, 'child', $event.target.value)"
                  class="w-full border border-gray-300 rounded-md p-2 text-sm bg-white focus:ring-black focus:border-black disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="" disabled>
                    Select {{ mavenField.childLabel || 'Sous-Segment' }}...
                  </option>
                  <option
                    v-for="childOpt in mavenField.mappingData?.[mavenAccountData[mavenField.key]?.parent] || []"
                    :key="childOpt"
                    :value="childOpt"
                  >
                    {{ childOpt }}
                  </option>
                </select>
              </div>
            </div>
          </template>

          <template v-else>
            <label class="block text-xs font-bold text-gray-600 uppercase">
              {{ mavenField.label }}
              <span v-if="mavenField.required" class="text-red-500">*</span>
            </label>

            <textarea
              v-if="mavenField.type === 'textarea'"
              :value="mavenAccountData[mavenField.key] || ''"
              rows="3"
              :required="mavenField.required"
              @input="updateMavenAccountField(mavenField.key, $event.target.value)"
              class="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-black focus:border-black"
            ></textarea>

            <input
              v-else
              :value="mavenAccountData[mavenField.key] || ''"
              :type="mavenField.type || 'text'"
              :required="mavenField.required"
              @input="updateMavenAccountField(mavenField.key, $event.target.value)"
              class="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-black focus:border-black"
            />
          </template>
        </div>
      </div>
    </div>

    <div class="flex gap-4 p-3 bg-gray-50 rounded border border-gray-200">
      <div class="flex-1">
        <label class="text-[10px] text-gray-400 uppercase">Selected POC</label>
        <div class="font-bold text-gray-800">{{ selectedPocName || '-' }}</div>
      </div>

      <div class="w-1/3 border-l pl-4 border-gray-200 relative">
        <label class="text-[10px] text-gray-400 uppercase">Ship To #</label>
        <div class="font-bold text-gray-500">{{ selectedSapId || '-' }}</div>

        <button
          v-if="selectedPocName || isManualMode"
          @click="clearSelection"
          type="button"
          class="absolute top-0 right-0 text-red-400 hover:text-red-600 font-bold px-1"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>
