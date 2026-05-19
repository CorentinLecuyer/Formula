<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { supabase } from '../supabase'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'

const router = useRouter()
const route = useRoute()
const toast = useToast()

const PREMADE_LIST_TYPES = ['depot_select', 't1_select']

const createDefaultValidation = () => ({
  minLength: null,
  maxLength: null,
  min: null,
  max: null,
  multiSelect: false,
  minSelect: null,
  maxSelect: null,
  maxFileSize: 5,
  sumColumnId: '',
  minSum: null,
  maxSum: null,
  autoFillUser: false,
})

const defaultSourceFilter = () => ({
  mode: 'all',
  allowedOptions: [],
})

const defaultEmailPrefillConfig = () => ({
  enabled: false,
  sourceSchema: 'public',
  sourceTable: '',
  sourceColumn: '',
  strategy: 'single_row', // 'single_row', 'lookup', or 'fixed'
  lookupFieldId: '',
  lookupColumn: '',
  fixedEmailAddress: '',
  allowEdit: true,
})

const normalizeEmailPrefillConfig = (field) => {
  if (!field || field.type !== 'email') return

  field.emailPrefillConfig = {
    ...defaultEmailPrefillConfig(),
    ...(field.emailPrefillConfig || {}),
  }

  if (!field.emailPrefillConfig.sourceSchema) {
    field.emailPrefillConfig.sourceSchema = 'public'
  }

  if (!['single_row', 'lookup', 'fixed'].includes(field.emailPrefillConfig.strategy)) {
    field.emailPrefillConfig.strategy = 'single_row'
  }

  if (field.emailPrefillConfig.strategy !== 'lookup') {
    field.emailPrefillConfig.lookupFieldId = ''
    field.emailPrefillConfig.lookupColumn = ''
  }

  field.emailPrefillConfig.fixedEmailAddress = String(
    field.emailPrefillConfig.fixedEmailAddress || '',
  )
}

const DEFAULT_MAVEN_SEGMENT_MAPPING = [
  'Débit de boisson: Bar, Bar à Bières, Bar Cavistes, Cavistes, Cocktail Bar, Bar de nuit, Pub',
  'Restaurant: Restaurant, Restauration rapide, Hybrid',
  'Autres: Evènements',
].join('\n')

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

const createDefaultMavenAccountFields = () => [
  { key: 'establishment_name', label: "Nom de l'établissement", type: 'text', required: true },
  { key: 'address', label: 'Addresse', type: 'text', required: true },
  { key: 'postal_code', label: 'Code Postal', type: 'text', required: true },
  { key: 'city', label: 'Ville', type: 'text', required: true },
  { key: 'region', label: 'Région', type: 'text', required: true },
  { key: 'vat', label: 'VAT', type: 'text', required: true },
  { key: 'siren', label: 'SIREN', type: 'text', required: true },
  { key: 'siret', label: 'SIRET', type: 'text', required: true },
  {
    key: 'segment_subsegment',
    label: 'Segment / subsegment',
    type: 'dependent_select',
    required: true,
    parentLabel: 'Segment',
    childLabel: 'Sous-Segment',
    mappingText: DEFAULT_MAVEN_SEGMENT_MAPPING,
    mappingData: parseDependentMappingText(DEFAULT_MAVEN_SEGMENT_MAPPING),
  },
]

const normalizeMavenAccountField = (mavenField, index = 0) => {
  const normalized = {
    key: mavenField.key || `field_${index + 1}`,
    label: mavenField.label || `Field ${index + 1}`,
    type: mavenField.type || 'text',
    required: !!mavenField.required,
  }

  if (normalized.type === 'dependent_select') {
    normalized.parentLabel = mavenField.parentLabel || 'Segment'
    normalized.childLabel = mavenField.childLabel || 'Sous-Segment'
    normalized.mappingText = mavenField.mappingText || DEFAULT_MAVEN_SEGMENT_MAPPING
    normalized.mappingData = parseDependentMappingText(normalized.mappingText)
  }

  return normalized
}

const normalizeMavenAccountFieldInPlace = (mavenField) => {
  Object.assign(mavenField, normalizeMavenAccountField(mavenField))
}

const resetMavenAccountFields = (field) => {
  if (!field || field.type !== 'poc_select') return
  field.mavenAccountFields = createDefaultMavenAccountFields()
}

const normalizePocManualConfig = (field) => {
  if (!field || field.type !== 'poc_select') return

  if (!field.manualPocMode) {
    field.manualPocMode = 'name_only'
  }

  if (!Array.isArray(field.mavenAccountFields) || field.mavenAccountFields.length === 0) {
    field.mavenAccountFields = createDefaultMavenAccountFields()
  } else {
    field.mavenAccountFields = field.mavenAccountFields.map((mavenField, index) =>
      normalizeMavenAccountField(mavenField, index),
    )
  }
}

const isPremadeListField = (field) => field && PREMADE_LIST_TYPES.includes(field.type)

const ensureSourceFilter = (field) => {
  if (!isPremadeListField(field)) return

  if (!field.sourceFilter) {
    field.sourceFilter = defaultSourceFilter()
  }

  if (!field.sourceFilter.mode) {
    field.sourceFilter.mode = 'all'
  }

  if (!Array.isArray(field.sourceFilter.allowedOptions)) {
    field.sourceFilter.allowedOptions = []
  }
}

const normalizeFieldForBuilder = (field) => {
  if (!field.validation) {
    field.validation = createDefaultValidation()
  } else {
    field.validation = {
      ...createDefaultValidation(),
      ...field.validation,
    }
  }

  if (field.type === 'email') {
    normalizeEmailPrefillConfig(field)
  }

  if (isPremadeListField(field)) {
    ensureSourceFilter(field)
  }

  normalizePocManualConfig(field)

  if (field.type === 'table' && Array.isArray(field.columns)) {
    field.columns.forEach((col) => {
      if (!col.validation) {
        col.validation =
          col.type === 'number'
            ? { min: null, max: null }
            : { minLength: null, maxLength: null, min: null, max: null }
      }

      if (col.required === undefined) col.required = false
      if (col.locked === undefined) col.locked = false
    })
  }
}

// STATE
const isSaving = ref(false)
const isLoading = ref(false)
const isEditing = ref(false)
const formId = ref(null)
const currentUser = ref(null)

// 1. Form Metadata
const status = ref('draft')
const title = ref('')
const description = ref('')
const infoBlocks = ref([])
const emailConfig = ref({
  enabled: true,
  subject: 'Copy of your submission: [Form Title]',
  body: 'Hello,\n\nThanks for participating. Please find attached a PDF version of the form you just filled in.\n\nCheers,\nThe Team',
})

// 2. Fields List
const fields = ref([])

// STATE FOR ICON PICKER
const showIconPicker = ref(false)
const activeBlockIndex = ref(null)

// STATE FOR DRAG & DROP
const dragIndex = ref(null)
const isDragHandleHovered = ref(false)

// STATE FOR PREMADE LIST FILTERS
const premadeSearch = ref({})
const premadeResults = ref({})
const premadeLoading = ref({})

// STATE FOR EMAIL PREFILL SOURCES
const emailPrefillColumns = ref([])
const emailPrefillColumnsLoading = ref(false)
const emailPrefillColumnsError = ref('')
const emailPrefillLookupColumnsByTable = ref({})
const emailPrefillLookupColumnsLoadingByTable = ref({})

const iconLibrary = [
  { category: 'Status', icons: ['ℹ️', '⚠️', '✅', '❌', '❓', '❗', '🎨', '🆗'] },
  { category: 'Safety', icons: ['⛑️', '🦺', '👓', '🧤', '🔥', '⚡', '🚧', '🚑'] },
  { category: 'Business', icons: ['📊', '📈', '📉', '📅', '📎', '💼', '📁', '🤝'] },
  { category: 'Logistics', icons: ['📦', '🚛', '🏭', '📍', '🗺️', '⏱️', '🧱', '🏗️'] },
  { category: 'Action', icons: ['🎯', '🚀', '🔍', '✏️', '📸', '📞', '💾', '🗑️'] },
  { category: 'Fun/Other', icons: ['🍺', '🍻', '⭐', '💡', '🎉', '🏆', '🍔', '👍'] },
  { category: 'Tools', icons: ['🧰', '⛏️', '🔨', '🔧', '⚒️', '🛠️', '🔩'] },
]

onMounted(async () => {
  const { data } = await supabase.auth.getUser()
  currentUser.value = data.user

  await loadEmailPrefillColumns()

  if (route.params.slug) {
    isEditing.value = true
    await loadFormForEdit(route.params.slug)
  }
})

const loadFormForEdit = async (slug) => {
  isLoading.value = true

  const { data, error } = await supabase.from('forms').select('*').eq('slug', slug).single()

  if (error) {
    toast.error('Error loading form: ' + error.message)
    isLoading.value = false
    router.push('/')
    return
  }

  formId.value = data.id
  title.value = data.title
  description.value = data.description || ''
  status.value = data.status || 'draft'
  infoBlocks.value = data.info_blocks || []

  if (data.email_config) {
    emailConfig.value = data.email_config
  } else {
    emailConfig.value.subject = `Copy of your submission: ${data.title}`
  }

  const rawSchema = data.schema || []
  rawSchema.forEach(normalizeFieldForBuilder)

  fields.value = rawSchema.filter((field) => !field.is_partner)
  isLoading.value = false
}

// --- HELPER FUNCTIONS ---
const openIconPicker = (index) => {
  activeBlockIndex.value = index
  showIconPicker.value = true
}

const selectIcon = (icon) => {
  if (activeBlockIndex.value !== null) infoBlocks.value[activeBlockIndex.value].icon = icon
  showIconPicker.value = false
  activeBlockIndex.value = null
}

const addInfoBlock = () => {
  infoBlocks.value.push({ icon: 'ℹ️', title: '', content: '' })
}

const addDescriptionBlock = () => {
  fields.value.push({
    id: 'desc_' + Date.now(),
    type: 'description',
    label: '',
    content: '',
    imageUrl: '',
    is_partner: false,
  })
}

const addField = (type) => {
  if (type === 'email') {
    const emailCount = fields.value.filter((field) => field.type === 'email').length
    if (emailCount >= 6) {
      toast.warning('Maximum 6 email fields allowed.')
      return
    }
  }

  const newField = {
    id: crypto.randomUUID(),
    type,
    label: '',
    required: false,
    options: [],
    validation: createDefaultValidation(),
  }

  if (type === 'email') {
    newField.emailPrefillConfig = defaultEmailPrefillConfig()
  }

  if (PREMADE_LIST_TYPES.includes(type)) {
    newField.sourceFilter = defaultSourceFilter()
  }

  if (type === 'poc_select') {
    newField.manualPocMode = 'name_only'
    newField.mavenAccountFields = createDefaultMavenAccountFields()
  }

  if (type === 'table') {
    newField.columns = [
      {
        id: crypto.randomUUID(),
        label: 'Item',
        type: 'text',
        locked: true,
        required: false,
        validation: { minLength: null, maxLength: null },
      },
      {
        id: crypto.randomUUID(),
        label: 'Quantity',
        type: 'number',
        locked: false,
        required: true,
        validation: { min: null, max: null },
      },
    ]
    newField.rows = [{ [newField.columns[0].id]: '', [newField.columns[1].id]: '' }]
  }

  if (type === 'dependent_select') {
    newField.parentLabel = 'Category'
    newField.childLabel = 'Subcategory'
    newField.mappingText = 'Fruits: Apple, Banana, Orange\nVegetables: Carrot, Broccoli'
    newField.mappingData = {}
  }

  fields.value.push(newField)
}

// --- EMAIL PREFILL LOGIC ---
const getTableCacheKey = (schema, table) => `${schema || 'public'}::${table || ''}`

const createEmailColumnSelectValue = ({ schema, table, column }) =>
  JSON.stringify({
    schema: schema || 'public',
    table,
    column,
  })

const parseEmailColumnSelectValue = (value) => {
  if (!value) return null

  try {
    const parsed = JSON.parse(value)
    if (parsed?.table && parsed?.column) {
      return {
        schema: parsed.schema || 'public',
        table: parsed.table,
        column: parsed.column,
      }
    }
  } catch {
    // Fallback for old values like "depots.Email order".
  }

  const separatorIndex = value.indexOf('.')
  if (separatorIndex === -1) return null

  return {
    schema: 'public',
    table: value.slice(0, separatorIndex),
    column: value.slice(separatorIndex + 1),
  }
}

const loadEmailPrefillColumns = async () => {
  emailPrefillColumnsLoading.value = true
  emailPrefillColumnsError.value = ''

  try {
    const { data, error } = await supabase.rpc('get_email_prefill_columns')
    if (error) throw error

    emailPrefillColumns.value = (data || []).map((row) => ({
      table_schema: row.table_schema || row.schema_name || 'public',
      table_name: row.table_name,
      column_name: row.column_name,
      data_type: row.data_type,
      display_label:
        row.display_label ||
        `${row.table_schema || row.schema_name || 'public'}.${row.table_name}.${row.column_name}`,
    }))
  } catch (error) {
    emailPrefillColumnsError.value =
      'Could not load Supabase email columns. Please check the RPC and reload.'
    emailPrefillColumns.value = []
    console.warn('Could not load email prefill columns:', error)
  } finally {
    emailPrefillColumnsLoading.value = false
  }
}

const getSupportedEmailPrefillColumns = () => emailPrefillColumns.value

const formatEmailPrefillColumnValue = (column) =>
  createEmailColumnSelectValue({
    schema: column.table_schema || 'public',
    table: column.table_name,
    column: column.column_name,
  })

const getSelectedEmailPrefillColumnValue = (field) => {
  normalizeEmailPrefillConfig(field)

  if (!field.emailPrefillConfig.sourceTable || !field.emailPrefillConfig.sourceColumn) return ''

  return createEmailColumnSelectValue({
    schema: field.emailPrefillConfig.sourceSchema || 'public',
    table: field.emailPrefillConfig.sourceTable,
    column: field.emailPrefillConfig.sourceColumn,
  })
}

const loadEmailPrefillLookupColumns = async (field) => {
  normalizeEmailPrefillConfig(field)

  const schema = field.emailPrefillConfig.sourceSchema || 'public'
  const table = field.emailPrefillConfig.sourceTable
  if (!table) return

  const cacheKey = getTableCacheKey(schema, table)

  if (emailPrefillLookupColumnsByTable.value[cacheKey]) {
    return
  }

  emailPrefillLookupColumnsLoadingByTable.value = {
    ...emailPrefillLookupColumnsLoadingByTable.value,
    [cacheKey]: true,
  }

  try {
    const { data, error } = await supabase.rpc('get_email_prefill_lookup_columns', {
      p_table_schema: schema,
      p_table_name: table,
    })

    if (error) throw error

    emailPrefillLookupColumnsByTable.value = {
      ...emailPrefillLookupColumnsByTable.value,
      [cacheKey]: data || [],
    }
  } catch (error) {
    console.warn('Could not load lookup columns:', error)
    emailPrefillLookupColumnsByTable.value = {
      ...emailPrefillLookupColumnsByTable.value,
      [cacheKey]: [],
    }
  } finally {
    emailPrefillLookupColumnsLoadingByTable.value = {
      ...emailPrefillLookupColumnsLoadingByTable.value,
      [cacheKey]: false,
    }
  }
}

const getEmailPrefillLookupColumns = (field) => {
  normalizeEmailPrefillConfig(field)

  const cacheKey = getTableCacheKey(
    field.emailPrefillConfig.sourceSchema || 'public',
    field.emailPrefillConfig.sourceTable,
  )

  return emailPrefillLookupColumnsByTable.value[cacheKey] || []
}

const isEmailPrefillLookupColumnsLoading = (field) => {
  normalizeEmailPrefillConfig(field)

  const cacheKey = getTableCacheKey(
    field.emailPrefillConfig.sourceSchema || 'public',
    field.emailPrefillConfig.sourceTable,
  )

  return !!emailPrefillLookupColumnsLoadingByTable.value[cacheKey]
}

const getEmailPrefillLookupFields = (field) => {
  normalizeEmailPrefillConfig(field)

  if (field.emailPrefillConfig.strategy !== 'lookup') return []

  return fields.value.filter((candidate) => {
    if (!candidate || candidate.id === field.id) return false
    if (candidate.is_partner) return false

    return !['email', 'description', 'table', 'file', 'signature'].includes(candidate.type)
  })
}

const ensureEmailPrefillLookupField = (field) => {
  normalizeEmailPrefillConfig(field)

  if (field.emailPrefillConfig.strategy !== 'lookup') {
    field.emailPrefillConfig.lookupFieldId = ''
    field.emailPrefillConfig.lookupColumn = ''
    return
  }

  const lookupFields = getEmailPrefillLookupFields(field)
  const currentLookupStillValid = lookupFields.some(
    (lookupField) => lookupField.id === field.emailPrefillConfig.lookupFieldId,
  )

  if (!currentLookupStillValid) {
    field.emailPrefillConfig.lookupFieldId = lookupFields[0]?.id || ''
  }
}

const setEmailPrefillEnabled = async (field, enabled) => {
  normalizeEmailPrefillConfig(field)

  field.emailPrefillConfig.enabled = enabled

  if (enabled && field.emailPrefillConfig.strategy === 'lookup') {
    ensureEmailPrefillLookupField(field)
    await loadEmailPrefillLookupColumns(field)
  }
}

const setEmailPrefillSourceColumn = async (field, value) => {
  normalizeEmailPrefillConfig(field)

  const selected = parseEmailColumnSelectValue(value)

  if (!selected) {
    field.emailPrefillConfig.sourceSchema = 'public'
    field.emailPrefillConfig.sourceTable = ''
    field.emailPrefillConfig.sourceColumn = ''
    field.emailPrefillConfig.lookupColumn = ''
    field.emailPrefillConfig.lookupFieldId = ''
    return
  }

  const previousTable = field.emailPrefillConfig.sourceTable

  field.emailPrefillConfig.sourceSchema = selected.schema
  field.emailPrefillConfig.sourceTable = selected.table
  field.emailPrefillConfig.sourceColumn = selected.column

  if (previousTable !== selected.table) {
    field.emailPrefillConfig.lookupColumn = ''
  }

  if (field.emailPrefillConfig.strategy === 'lookup') {
    ensureEmailPrefillLookupField(field)
    await loadEmailPrefillLookupColumns(field)
  }
}

const setEmailPrefillStrategy = async (field, strategy) => {
  normalizeEmailPrefillConfig(field)

  field.emailPrefillConfig.strategy = strategy

  if (strategy === 'fixed') {
    field.emailPrefillConfig.lookupFieldId = ''
    field.emailPrefillConfig.lookupColumn = ''
    field.emailPrefillConfig.allowEdit = false
    return
  }

  if (strategy === 'single_row') {
    field.emailPrefillConfig.lookupFieldId = ''
    field.emailPrefillConfig.lookupColumn = ''
    return
  }

  ensureEmailPrefillLookupField(field)
  await loadEmailPrefillLookupColumns(field)
}

const getEmailPrefillSourceDescription = (field) => {
  normalizeEmailPrefillConfig(field)

  if (field.emailPrefillConfig.strategy === 'fixed') {
    return field.emailPrefillConfig.fixedEmailAddress
      ? `This email field will always use ${field.emailPrefillConfig.fixedEmailAddress} for this form.`
      : 'Enter the fixed email address to use for this form.'
  }

  if (!field.emailPrefillConfig.sourceTable || !field.emailPrefillConfig.sourceColumn) {
    return 'Choose a source email column first.'
  }

  const sourceLabel = `${field.emailPrefillConfig.sourceTable}.${field.emailPrefillConfig.sourceColumn}`

  if (field.emailPrefillConfig.strategy === 'single_row') {
    return `The email will be fetched from the first non-empty row of ${sourceLabel}.`
  }

  const lookupField = fields.value.find(
    (candidate) => candidate.id === field.emailPrefillConfig.lookupFieldId,
  )

  if (!lookupField) {
    return 'Choose which form field should be used to find the matching row.'
  }

  if (!field.emailPrefillConfig.lookupColumn) {
    return `Choose which column in ${field.emailPrefillConfig.sourceTable} should match “${lookupField.label || lookupField.type}”.`
  }

  return `The email will be fetched from ${sourceLabel} where ${field.emailPrefillConfig.lookupColumn} matches “${lookupField.label || lookupField.type}”.`
}

// --- PREMADE LIST FILTER LOGIC ---
const setSourceFilterMode = (field, mode) => {
  ensureSourceFilter(field)
  field.sourceFilter.mode = mode

  // "All" means we do not store a huge list of every Depot/T1.
  if (mode === 'all') {
    field.sourceFilter.allowedOptions = []
    premadeSearch.value = { ...premadeSearch.value, [field.id]: '' }
    premadeResults.value = { ...premadeResults.value, [field.id]: [] }
  }
}

const isAllowedOptionSelected = (field, option) => {
  ensureSourceFilter(field)
  return field.sourceFilter.allowedOptions.some((item) => item.value === option.value)
}

const addAllowedOption = (field, option) => {
  ensureSourceFilter(field)

  if (!isAllowedOptionSelected(field, option)) {
    field.sourceFilter.allowedOptions.push(option)
  }
}

const removeAllowedOption = (field, optionValue) => {
  ensureSourceFilter(field)
  field.sourceFilter.allowedOptions = field.sourceFilter.allowedOptions.filter(
    (item) => item.value !== optionValue,
  )
}

const updatePremadeSearch = async (field, value) => {
  premadeSearch.value = { ...premadeSearch.value, [field.id]: value }
  await searchPremadeOptions(field)
}

const searchPremadeOptions = async (field) => {
  ensureSourceFilter(field)

  const term = (premadeSearch.value[field.id] || '').trim()

  if (term.length < 2) {
    premadeResults.value = { ...premadeResults.value, [field.id]: [] }
    return
  }

  premadeLoading.value = { ...premadeLoading.value, [field.id]: true }

  try {
    let options = []

    if (field.type === 'depot_select') {
      const { data, error } = await supabase
        .from('depots')
        .select('id, "Ship to Name", "Ship to number"')
        .ilike('"Ship to Name"', `%${term}%`)
        .limit(50)

      if (error) throw error

      options = (data || []).map((row) => ({
        value: row['Ship to number'],
        label: row['Ship to Name'],
        meta: row['Ship to number'],
      }))
    }

    if (field.type === 't1_select') {
      const { data, error } = await supabase
        .from('t1_users')
        .select(
          `
          full_name,
          t2_users ( full_name )
        `,
        )
        .ilike('full_name', `%${term}%`)
        .limit(50)

      if (error) throw error

      options = (data || []).map((row) => ({
        value: row.full_name,
        label: row.full_name,
        meta: row.t2_users?.full_name || 'No Manager Linked',
      }))
    }

    premadeResults.value = { ...premadeResults.value, [field.id]: options }
  } catch (error) {
    toast.error('Could not load options: ' + error.message)
  } finally {
    premadeLoading.value = { ...premadeLoading.value, [field.id]: false }
  }
}

// --- TABLE SPECIFIC LOGIC ---
const addTableColumn = (fieldIndex) => {
  const field = fields.value[fieldIndex]
  if (field.columns.length >= 6) {
    toast.warning('Max 6 columns allowed')
    return
  }

  const newColId = crypto.randomUUID()
  field.columns.push({
    id: newColId,
    label: 'New Col',
    type: 'text',
    locked: false,
    required: false,
    validation: { minLength: null, maxLength: null },
  })

  field.rows.forEach((row) => {
    row[newColId] = ''
  })
}

const removeTableColumn = (fieldIndex, colIndex) => {
  const field = fields.value[fieldIndex]
  if (field.columns.length <= 2) {
    toast.warning('Min 2 columns required')
    return
  }

  const colIdToRemove = field.columns[colIndex].id
  field.columns.splice(colIndex, 1)
  field.rows.forEach((row) => {
    delete row[colIdToRemove]
  })
}

const addTableRow = (fieldIndex) => {
  const field = fields.value[fieldIndex]
  const newRow = {}
  field.columns.forEach((col) => {
    newRow[col.id] = ''
  })
  field.rows.push(newRow)
}

const removeTableRow = (fieldIndex, rowIndex) => {
  fields.value[fieldIndex].rows.splice(rowIndex, 1)
}

const removeField = (index) => {
  fields.value.splice(index, 1)
}

// --- DRAG & DROP LOGIC ---
const onDragStart = (event, index) => {
  dragIndex.value = index
  event.dataTransfer.effectAllowed = 'move'
}

const onDragEnter = (index) => {
  if (dragIndex.value === null || dragIndex.value === index) return
  const itemToMove = fields.value.splice(dragIndex.value, 1)[0]
  fields.value.splice(index, 0, itemToMove)
  dragIndex.value = index
}

const onDragEnd = () => {
  dragIndex.value = null
  isDragHandleHovered.value = false
}

// --- TEXT FORMATTING LOGIC ---
const handleContentKeydown = async (event, index) => {
  if (!event.ctrlKey && !event.metaKey) return

  let tag = ''
  if (event.key === 'b') tag = 'b'
  else if (event.key === 'u') tag = 'u'
  else if (event.key === 'i') tag = 'i'

  if (tag) {
    event.preventDefault()
    applyTagToSelection(
      event.target,
      `<${tag}>`,
      `</${tag}>`,
      (val) => (infoBlocks.value[index].content = val),
    )
  }
}

const handleDescriptionKeydown = async (event) => {
  if (!event.ctrlKey && !event.metaKey) return

  let tag = ''
  if (event.key === 'b') tag = 'b'
  else if (event.key === 'u') tag = 'u'
  else if (event.key === 'i') tag = 'i'

  if (tag) {
    event.preventDefault()
    applyTagToSelection(event.target, `<${tag}>`, `</${tag}>`, (val) => (description.value = val))
  }
}

const applyTagToSelection = async (textarea, openTag, closeTag, updateFn) => {
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = textarea.value
  const before = text.substring(0, start)
  const selected = text.substring(start, end)
  const after = text.substring(end)

  updateFn(before + openTag + selected + closeTag + after)

  await nextTick()
  textarea.focus()
  textarea.setSelectionRange(start + openTag.length, end + openTag.length)
}

// --- IMAGE UPLOAD LOGIC ---
const compressImage = async (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)

    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result

      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_WIDTH = 1000
        const scaleSize = MAX_WIDTH / img.width

        if (img.width > MAX_WIDTH) {
          canvas.width = MAX_WIDTH
          canvas.height = img.height * scaleSize
        } else {
          canvas.width = img.width
          canvas.height = img.height
        }

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        canvas.toBlob(
          (blob) => {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }))
          },
          'image/jpeg',
          0.8,
        )
      }
    }
  })
}

const uploadFile = async (file) => {
  let fileToUpload = file

  if (file.type.startsWith('image/')) {
    try {
      fileToUpload = await compressImage(file)
    } catch (error) {
      console.warn(error)
    }
  }

  const filePath = `builder_assets/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`
  const { error } = await supabase.storage.from('attachments').upload(filePath, fileToUpload)
  if (error) throw error

  const { data } = supabase.storage.from('attachments').getPublicUrl(filePath)
  return data.publicUrl
}

const handleBlockImageUpload = async (event, index) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const url = await uploadFile(file)
    infoBlocks.value[index].image = url
  } catch (error) {
    alert('Upload failed: ' + error.message)
  }
}

const handleFieldImageUpload = async (event, fieldIndex) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const url = await uploadFile(file)
    fields.value[fieldIndex].imageUrl = url
  } catch (error) {
    alert('Upload failed: ' + error.message)
  }
}

const handleTableCellImageUpload = async (event, fieldIndex, rowIndex, colId) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    const url = await uploadFile(file)
    fields.value[fieldIndex].rows[rowIndex][colId] = url
  } catch (error) {
    alert('Upload failed: ' + error.message)
  }
}


const isValidEmailAddress = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim())

// --- SAVE ---
const saveForm = async () => {
  if (!title.value) return toast.warning('Please provide a Title.')

  const emptyLimitedField = fields.value.find((field) => {
    if (!isPremadeListField(field)) return false

    ensureSourceFilter(field)

    return field.sourceFilter.mode === 'limited' && field.sourceFilter.allowedOptions.length === 0
  })

  if (emptyLimitedField) {
    return toast.warning(
      `Please select at least one option for "${emptyLimitedField.label || emptyLimitedField.type}" or switch it back to All.`,
    )
  }

  const invalidFixedEmailField = fields.value.find((field) => {
    if (field.type !== 'email') return false
    normalizeEmailPrefillConfig(field)

    return (
      field.emailPrefillConfig.enabled &&
      field.emailPrefillConfig.strategy === 'fixed' &&
      !isValidEmailAddress(field.emailPrefillConfig.fixedEmailAddress)
    )
  })

  if (invalidFixedEmailField) {
    return toast.warning(
      `Please enter a valid fixed email address for "${invalidFixedEmailField.label || 'Email'}".`,
    )
  }

  isSaving.value = true

  let finalSlug = route.params.slug
  if (!isEditing.value) {
    finalSlug = title.value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const finalSchema = []

  fields.value.forEach((field) => {
    normalizeFieldForBuilder(field)

    if (field.type === 'select' && Array.isArray(field.options)) {
      field.options = field.options.filter((opt) => String(opt).trim().length > 0)
    }

    if (field.type === 'dependent_select' && field.mappingText) {
      field.mappingData = parseDependentMappingText(field.mappingText)
    }

    if (field.type === 'poc_select' && Array.isArray(field.mavenAccountFields)) {
      field.mavenAccountFields.forEach((mavenField) => {
        if (mavenField.type === 'dependent_select') {
          mavenField.mappingData = parseDependentMappingText(mavenField.mappingText)
        }
      })
    }

    finalSchema.push(field)

    if (field.type === 'depot_select') {
      finalSchema.push({
        id: field.id + '_ship_to_number',
        type: 'text',
        label: 'Depot ID',
        required: false,
        readOnly: true,
        is_partner: true,
      })
    } else if (field.type === 'poc_select') {
      finalSchema.push(
        {
          id: field.id + '_sap_id',
          type: 'text',
          label: 'POC ID',
          required: false,
          readOnly: true,
          is_partner: true,
        },
        {
          id: field.id + '_id',
          type: 'text',
          label: 'POC Internal ID',
          required: false,
          readOnly: true,
          is_partner: true,
        },
        {
          id: field.id + '_is_manual',
          type: 'text',
          label: 'Manual POC?',
          required: false,
          readOnly: true,
          is_partner: true,
        },
        {
          id: field.id + '_manual_mode',
          type: 'text',
          label: 'Manual POC Mode',
          required: false,
          readOnly: true,
          is_partner: true,
        },
        {
          id: field.id + '_maven_account',
          type: 'json',
          label: 'Maven Account Creation Data',
          required: false,
          readOnly: true,
          is_partner: true,
        },
      )
    } else if (field.type === 't1_select') {
      finalSchema.push({
        id: field.id + '_manager_name',
        type: 'text',
        label: 'T2 Manager',
        required: false,
        readOnly: true,
        is_partner: true,
      })
    }
  })

  const payload = {
    title: title.value,
    slug: finalSlug,
    description: description.value,
    info_blocks: infoBlocks.value,
    schema: finalSchema,
    status: status.value,
    created_by: currentUser.value?.id,
    email_config: emailConfig.value,
  }

  try {
    let dbError = null

    if (isEditing.value) {
      const res = await supabase.from('forms').update(payload).eq('id', formId.value)
      dbError = res.error
    } else {
      const res = await supabase.from('forms').insert(payload)
      dbError = res.error
    }

    if (dbError) {
      toast.error('Error saving: ' + dbError.message)
    } else {
      toast.success(isEditing.value ? 'Form updated!' : 'Form created!')
      router.push('/')
    }
  } catch (error) {
    toast.error('Error saving: ' + error.message)
  } finally {
    isSaving.value = false
  }
}

const deleteForm = async () => {
  if (!confirm('Are you sure?')) return

  isSaving.value = true

  try {
    await supabase.from('submissions').delete().eq('form_id', formId.value)
    const { error } = await supabase.from('forms').delete().eq('id', formId.value)

    if (error) {
      toast.error('Error deleting: ' + error.message)
    } else {
      router.push('/')
    }
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-4 py-8 md:px-8 bg-stone-50 min-h-screen text-zinc-950">
    <div v-if="isLoading" class="text-center py-20 text-zinc-500">
      <div
        class="w-12 h-12 border-4 border-stone-200 border-t-zinc-900 rounded-md animate-spin mx-auto"
      ></div>
    </div>

    <div v-else>
      <div class="flex justify-between items-end mb-8">
        <div>
          <h1 class="text-3xl font-semibold tracking-tight text-zinc-950">
            {{ isEditing ? 'Edit Form' : 'Build New Form' }}
          </h1>
          <p v-if="isEditing" class="text-sm text-zinc-400 mt-1">Editing: {{ title }}</p>
        </div>

        <div class="flex gap-3">
          <button
            v-if="isEditing"
            type="button"
            @click="deleteForm"
            :disabled="isSaving"
            class="bg-red-600 text-white border border-red-900 px-6 py-2 rounded-md font-semibold hover:bg-red-400 disabled:opacity-50"
          >
            Delete
          </button>

          <button
            type="button"
            @click="saveForm"
            :disabled="isSaving"
            class="bg-[#F5DF02] text-zinc-950 px-6 py-2 rounded-md font-semibold hover:bg-[#e6d200] disabled:opacity-50 shadow-sm"
          >
            {{ isSaving ? 'Saving...' : 'Save Form' }}
          </button>
        </div>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 mb-6">
        <div class="mb-4">
          <label class="block text-sm font-medium text-zinc-800 mb-1">Form Title</label>
          <input
            v-model="title"
            type="text"
            class="w-full border border-stone-300 rounded-md p-2 focus:ring-zinc-950 focus:border-zinc-950"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-zinc-800 mb-1">Status</label>
          <select v-model="status" class="w-full border border-stone-300 rounded-md p-2 bg-white">
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Inactive</option>
          </select>
        </div>
      </div>

      <div class="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 mb-8 space-y-6">
        <h2 class="text-xl font-semibold border-b pb-2">Presentation & Context</h2>

        <div>
          <label class="block text-sm font-medium text-zinc-800 mb-1">
            Introductory Summary
            <span class="text-zinc-400 font-normal lowercase">
              (Ctrl+B for Bold, Ctrl+U for Underline)
            </span>
          </label>
          <textarea
            v-model="description"
            @keydown="handleDescriptionKeydown"
            rows="3"
            placeholder="Explain the goal of this form to your users..."
            class="w-full border border-stone-300 rounded-md p-2 focus:ring-zinc-950 focus:border-zinc-950 font-mono text-sm"
          ></textarea>
        </div>

        <div class="space-y-4">
          <label class="block text-sm font-medium text-zinc-800">Info Blocks (Optional)</label>

          <div
            v-for="(block, index) in infoBlocks"
            :key="index"
            class="bg-stone-50 p-4 rounded-lg border border-stone-200 relative group transition hover:shadow-md"
          >
            <div class="grid grid-cols-12 gap-4">
              <div class="col-span-2 flex flex-col items-center">
                <label class="text-xs text-zinc-500 uppercase font-semibold tracking-wide mb-1">
                  Icon
                </label>
                <button
                  type="button"
                  @click="openIconPicker(index)"
                  class="w-12 h-12 text-2xl bg-white border border-stone-300 rounded-lg hover:bg-stone-50 hover:border-stone-300 transition flex items-center justify-center shadow-sm"
                >
                  {{ block.icon || '📌' }}
                </button>
              </div>

              <div class="col-span-10">
                <label class="text-xs text-zinc-500 uppercase font-semibold tracking-wide">
                  Block Title
                </label>
                <input
                  v-model="block.title"
                  type="text"
                  placeholder="e.g. Safety First"
                  class="w-full mt-1 border rounded p-2 focus:ring-zinc-950 focus:border-zinc-950"
                />
              </div>

              <div class="col-span-12">
                <label class="text-xs text-zinc-500 uppercase font-semibold tracking-wide">
                  Content
                  <span class="text-zinc-400 font-normal lowercase">(Ctrl+B, Ctrl+U)</span>
                </label>
                <textarea
                  v-model="block.content"
                  @keydown="(event) => handleContentKeydown(event, index)"
                  rows="2"
                  placeholder="Details..."
                  class="w-full mt-1 border rounded p-2 text-sm focus:ring-zinc-950 focus:border-zinc-950 font-mono"
                ></textarea>
              </div>

              <div class="col-span-12 pt-2 border-t border-stone-200">
                <label class="text-xs text-zinc-500 uppercase font-semibold tracking-wide mb-2 block">
                  Block Image (Optional)
                </label>

                <div v-if="block.image" class="relative inline-block group">
                  <img
                    :src="block.image"
                    class="h-32 w-auto rounded-lg border border-stone-200 shadow-sm object-cover"
                  />
                  <button
                    type="button"
                    @click="block.image = null"
                    class="absolute -top-2 -right-2 bg-red-500 text-white rounded-md w-6 h-6 flex items-center justify-center shadow-md hover:bg-red-600 font-semibold"
                  >
                    ✕
                  </button>
                </div>

                <div v-else>
                  <label
                    class="cursor-pointer flex items-center gap-2 text-sm text-zinc-700 font-semibold hover:bg-stone-50 w-fit px-3 py-2 rounded-md transition"
                  >
                    <span>📷 Add Picture</span>
                    <input
                      type="file"
                      accept="image/*"
                      class="hidden"
                      @change="(event) => handleBlockImageUpload(event, index)"
                    />
                  </label>
                </div>
              </div>
            </div>

            <button
              type="button"
              @click="infoBlocks.splice(index, 1)"
              class="absolute top-2 right-2 text-zinc-300 hover:text-red-500 transition font-semibold"
            >
              ✕
            </button>
          </div>

          <button
            type="button"
            @click="addInfoBlock"
            class="flex items-center gap-2 text-sm text-zinc-950 font-semibold hover:opacity-70 mt-2"
          >
            <span
              class="bg-zinc-950 text-white rounded-md w-5 h-5 flex items-center justify-center text-xs"
            >
              +
            </span>
            Add Info Block
          </button>
        </div>
      </div>

      <div
        class="bg-gradient-to-r from-white to-stone-50 p-6 rounded-2xl shadow-sm border border-stone-200 mb-8 space-y-6"
      >
        <div class="flex justify-between items-center border-b border-stone-200 pb-2">
          <h2 class="text-xl font-semibold text-zinc-950">Email Automation (PDF)</h2>
          <span class="text-xs bg-stone-200 text-zinc-900 px-2 py-1 rounded-md font-semibold">
            PDF Sent Automatically
          </span>
        </div>

        <p class="text-sm text-zinc-700">
          Configure the email sent to the addresses collected in the form. The PDF copy of the
          submission will be attached automatically.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">
              Email Subject
            </label>
            <input
              v-model="emailConfig.subject"
              type="text"
              class="w-full border border-stone-300 rounded-md p-2 focus:ring-zinc-900 focus:border-zinc-900"
              placeholder="Copy of submission..."
            />
          </div>

          <div>
            <label class="block text-xs font-semibold text-zinc-500 uppercase mb-1">
              Email Body Message
            </label>
            <textarea
              v-model="emailConfig.body"
              rows="4"
              class="w-full border border-stone-300 rounded-md p-2 focus:ring-zinc-900 focus:border-zinc-900 text-sm"
            ></textarea>
          </div>
        </div>
      </div>

      <div
        class="bg-black backdrop-blur p-3 rounded-md shadow-sm flex flex-wrap gap-2 mb-8 border border-stone-200 justify-center"
      >
        <span class="text-sm text-white uppercase tracking-wide font-semibold">
          Add New Field:
        </span>
      </div>
      <div
        class="bg-white/95 backdrop-blur p-3 shadow-sm flex flex-wrap gap-2 mb-8 border border-stone-200 justify-center sticky top-16 z-20"
      >
        <button
          type="button"
          @click="addField('text')"
          class="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md text-sm font-semibold shadow-sm"
        >
          + Text input
        </button>

        <button
          type="button"
          @click="addField('number')"
          class="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md text-sm font-semibold shadow-sm"
        >
          + Number
        </button>

        <button
          type="button"
          @click="addField('email')"
          class="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md text-sm font-semibold shadow-sm"
        >
          + Email
        </button>

        <button
          type="button"
          @click="addField('select')"
          class="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md text-sm font-semibold shadow-sm"
        >
          + Dropdown
        </button>

        <button
          type="button"
          @click="addField('dependent_select')"
          class="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md text-sm font-semibold shadow-sm"
        >
          + Dependent Dropdown
        </button>

        <button
          type="button"
          @click="addField('table')"
          class="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md text-sm font-semibold shadow-sm"
        >
          + Custom Table
        </button>

        <button
          type="button"
          @click="addField('signature')"
          class="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md text-sm font-semibold shadow-sm"
        >
          + Signature
        </button>

        <button
          type="button"
          @click="addField('file')"
          class="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 text-white rounded-md text-sm font-semibold shadow-sm"
        >
          + Attachment
        </button>

        <div class="w-px h-8 bg-stone-300 mx-2"></div>

        <button
          type="button"
          @click="addDescriptionBlock"
          class="bg-stone-100 text-zinc-900 border border-stone-300 px-4 py-2 rounded-md font-semibold hover:bg-stone-200 transition"
        >
          + Add Text/Image Block
        </button>

        <div class="w-px h-8 bg-stone-300 mx-2"></div>

        <button
          type="button"
          @click="addField('poc_select')"
          class="px-4 py-2 bg-[#F5DF02] hover:bg-[#e6d200] text-zinc-950 rounded-md text-sm font-semibold shadow-sm"
        >
          + POC Search
        </button>

        <button
          type="button"
          @click="addField('depot_select')"
          class="px-4 py-2 bg-[#F5DF02] hover:bg-[#e6d200] text-zinc-950 rounded-md text-sm font-semibold shadow-sm"
        >
          + Depot
        </button>

        <button
          type="button"
          @click="addField('t1_select')"
          class="px-4 py-2 bg-[#F5DF02] hover:bg-[#e6d200] text-zinc-950 rounded-md text-sm font-semibold shadow-sm"
        >
          + T1 User
        </button>
      </div>

      <TransitionGroup name="list" tag="div" class="space-y-4 mb-20">
        <div
          v-for="(field, index) in fields"
          :key="field.id"
          :draggable="isDragHandleHovered"
          @dragstart="onDragStart($event, index)"
          @dragenter.prevent="onDragEnter(index)"
          @dragover.prevent
          @dragend="onDragEnd"
          class="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex gap-4 items-start group transition-all duration-300"
          :class="{
            'border-zinc-950 ring-1 ring-zinc-950 shadow-lg z-10 scale-[1.01]': dragIndex === index,
          }"
        >
          <div
            class="text-zinc-300 mt-3 cursor-move text-xl flex self-center hover:text-zinc-950 transition-colors px-2"
            @mouseenter="isDragHandleHovered = true"
            @mouseleave="isDragHandleHovered = false"
          >
            ⋮⋮
          </div>

          <div class="flex-grow grid grid-cols-12 gap-6">
            <template v-if="field.type === 'description'">
              <div class="col-span-12 space-y-4">
                <div class="flex justify-between items-center">
                  <h3
                    class="text-sm font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-2"
                  >
                    <span class="text-xl">ℹ️</span> Information Block (Read-Only)
                  </h3>
                </div>

                <div>
                  <label class="text-xs text-zinc-500 uppercase font-semibold tracking-wide">
                    Block Title (Optional)
                  </label>
                  <input
                    v-model="field.label"
                    type="text"
                    class="w-full border rounded p-2 mt-1 focus:ring-zinc-950 focus:border-zinc-950"
                    placeholder="e.g. Terms and Conditions"
                  />
                </div>

                <div>
                  <label class="text-xs text-zinc-500 uppercase font-semibold tracking-wide">
                    Content Text
                  </label>
                  <textarea
                    v-model="field.content"
                    rows="4"
                    class="w-full border rounded p-2 mt-1 focus:ring-zinc-950 focus:border-zinc-950 text-sm"
                    placeholder="Add your legal mentions or instructions here..."
                  ></textarea>
                </div>

                <div class="pt-2 border-t border-stone-200">
                  <label class="text-xs text-zinc-500 uppercase font-semibold tracking-wide mb-2 block">
                    Block Image (Optional)
                  </label>

                  <div v-if="field.imageUrl" class="relative inline-block group">
                    <img
                      :src="field.imageUrl"
                      class="h-32 w-auto rounded-lg border border-stone-200 shadow-sm object-cover"
                    />
                    <button
                      type="button"
                      @click="field.imageUrl = ''"
                      class="absolute -top-2 -right-2 bg-red-500 text-white rounded-md w-6 h-6 flex items-center justify-center shadow-md hover:bg-red-600 font-semibold"
                    >
                      ✕
                    </button>
                  </div>

                  <div v-else>
                    <label
                      class="cursor-pointer flex items-center gap-2 text-sm text-zinc-700 font-semibold hover:bg-stone-50 w-fit px-3 py-2 rounded-md transition"
                    >
                      <span>📷 Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        class="hidden"
                        @change="(event) => handleFieldImageUpload(event, index)"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </template>

            <template v-else-if="field.type === 'dependent_select'">
              <div class="col-span-12 bg-stone-50 border-stone-200 p-5 rounded-md border shadow-sm">
                <div class="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label class="text-xs text-zinc-700 uppercase font-semibold tracking-wide">
                      1st Dropdown Label
                    </label>
                    <input
                      v-model="field.parentLabel"
                      type="text"
                      placeholder="e.g. Category"
                      class="w-full border border-stone-200 rounded p-2 mt-1 focus:ring-zinc-900 text-sm"
                    />
                  </div>

                  <div>
                    <label class="text-xs text-zinc-700 uppercase font-semibold tracking-wide">
                      2nd Dropdown Label
                    </label>
                    <input
                      v-model="field.childLabel"
                      type="text"
                      placeholder="e.g. Subcategory"
                      class="w-full border border-stone-200 rounded p-2 mt-1 focus:ring-zinc-900 text-sm"
                    />
                  </div>
                </div>

                <label class="text-xs text-zinc-700 uppercase font-semibold tracking-wide">
                  Options Mapping
                  <span class="normal-case text-zinc-400 font-normal ml-2">
                    Format -> Parent: Child 1, Child 2
                  </span>
                </label>
                <textarea
                  v-model="field.mappingText"
                  rows="5"
                  placeholder="Vehicles: Car, Truck, Bike&#10;Animals: Dog, Cat"
                  class="w-full border border-stone-200 rounded p-2 mt-1 focus:ring-zinc-900 font-mono text-sm leading-relaxed"
                ></textarea>
              </div>
            </template>

            <template v-else>
              <div class="col-span-2">
                <label class="text-xs text-zinc-500 uppercase font-semibold tracking-wide">
                  Type
                </label>
                <div
                  class="bg-stone-100 px-3 py-2 rounded text-sm font-mono mt-1 text-zinc-700 border border-stone-200"
                >
                  {{ field.type === 'email' ? '📧 Email' : field.type }}
                </div>
              </div>

              <div class="col-span-8">
                <label class="text-xs text-zinc-500 uppercase font-semibold tracking-wide">
                  Question Label
                </label>
                <input
                  v-model="field.label"
                  type="text"
                  class="w-full border border-stone-300 rounded p-2 mt-1 focus:ring-zinc-950 focus:border-zinc-950"
                />
              </div>

              <div class="col-span-2 flex flex-col items-center">
                <label class="text-xs text-zinc-500 uppercase font-semibold tracking-wide">
                  Required?
                </label>
                <input
                  v-model="field.required"
                  type="checkbox"
                  class="mt-3 h-5 w-5 text-zinc-950 focus:ring-zinc-950 border-stone-300 rounded"
                />
              </div>

              <div
                v-if="['depot_select', 't1_select'].includes(field.type)"
                class="col-span-12 bg-stone-50 border border-stone-200 rounded-md p-4 space-y-4"
              >
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h4 class="text-xs font-semibold text-zinc-950 uppercase tracking-wide">
                      Premade List Options
                    </h4>
                    <p class="text-xs text-zinc-700 mt-1">
                      By default, users can search all available options. Switch to limited mode to
                      restrict this list for this form.
                    </p>
                  </div>

                  <div class="flex gap-2 bg-white border border-stone-200 rounded-lg p-1">
                    <label
                      class="text-xs px-3 py-1 rounded cursor-pointer"
                      :class="
                        field.sourceFilter?.mode !== 'limited'
                          ? 'bg-[#F5DF02] text-zinc-950 font-semibold'
                          : 'text-zinc-700'
                      "
                    >
                      <input
                        type="radio"
                        class="hidden"
                        :checked="field.sourceFilter?.mode !== 'limited'"
                        @change="setSourceFilterMode(field, 'all')"
                      />
                      All
                    </label>

                    <label
                      class="text-xs px-3 py-1 rounded cursor-pointer"
                      :class="
                        field.sourceFilter?.mode === 'limited'
                          ? 'bg-[#F5DF02] text-zinc-950 font-semibold'
                          : 'text-zinc-700'
                      "
                    >
                      <input
                        type="radio"
                        class="hidden"
                        :checked="field.sourceFilter?.mode === 'limited'"
                        @change="setSourceFilterMode(field, 'limited')"
                      />
                      Limited
                    </label>
                  </div>
                </div>

                <div v-if="field.sourceFilter?.mode === 'limited'" class="space-y-3">
                  <div>
                    <label class="text-xs text-zinc-950 uppercase font-semibold tracking-wide">
                      Search options to allow
                    </label>

                    <input
                      :value="premadeSearch[field.id] || ''"
                      @input="updatePremadeSearch(field, $event.target.value)"
                      type="text"
                      :placeholder="
                        field.type === 'depot_select' ? 'Search depot name...' : 'Search T1 user...'
                      "
                      class="w-full mt-1 border border-stone-200 rounded p-2 text-sm focus:ring-zinc-900 focus:border-zinc-900"
                    />

                    <p v-if="premadeLoading[field.id]" class="text-xs text-zinc-600 mt-1">
                      Loading options...
                    </p>
                  </div>

                  <div
                    v-if="premadeResults[field.id]?.length"
                    class="bg-white border border-stone-200 rounded-md max-h-48 overflow-auto divide-y divide-stone-100"
                  >
                    <button
                      v-for="option in premadeResults[field.id]"
                      :key="option.value"
                      type="button"
                      @click="addAllowedOption(field, option)"
                      :disabled="isAllowedOptionSelected(field, option)"
                      class="w-full text-left px-3 py-2 text-sm hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <span class="font-semibold text-zinc-900">{{ option.label }}</span>
                      <span v-if="option.meta" class="text-xs text-zinc-500 ml-2">
                        {{ option.meta }}
                      </span>
                    </button>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <span
                      v-for="option in field.sourceFilter.allowedOptions"
                      :key="option.value"
                      class="inline-flex items-center gap-2 bg-white border border-stone-200 rounded-md px-3 py-1 text-xs text-zinc-950"
                    >
                      <span class="font-semibold">{{ option.label }}</span>
                      <span v-if="option.meta" class="text-zinc-500">{{ option.meta }}</span>
                      <button
                        type="button"
                        @click="removeAllowedOption(field, option.value)"
                        class="text-red-500 hover:text-red-700 font-semibold"
                      >
                        ×
                      </button>
                    </span>
                  </div>

                  <p
                    v-if="field.sourceFilter.allowedOptions.length === 0"
                    class="text-xs text-amber-800 bg-stone-50 border border-stone-200 rounded p-2"
                  >
                    No option selected yet. Add at least one option or switch back to All.
                  </p>
                </div>
              </div>

              <div
                v-if="field.type === 'poc_select'"
                class="col-span-12 bg-stone-50 border border-stone-200 rounded-md p-4 space-y-4"
              >
                <div>
                  <h4 class="text-xs font-semibold text-zinc-950 uppercase tracking-wide">
                    If POC is not in the list
                  </h4>
                  <p class="text-xs text-zinc-700 mt-1">
                    Choose what respondents should fill in after selecting “Inexistant dans la
                    liste”.
                  </p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label
                    class="cursor-pointer bg-white border rounded-lg p-3 text-sm transition"
                    :class="
                      field.manualPocMode === 'name_only'
                        ? 'border-[#F5DF02] ring-2 ring-[#F5DF02]/30 bg-[#F5DF02]/10'
                        : 'border-stone-200 hover:border-[#F5DF02]/60'
                    "
                  >
                    <input
                      type="radio"
                      class="mr-2"
                      value="name_only"
                      v-model="field.manualPocMode"
                    />
                    <span class="font-semibold text-zinc-950">Simply the name of the POC</span>
                    <p class="text-xs text-zinc-500 mt-1">
                      The respondent only enters the missing POC name.
                    </p>
                  </label>

                  <label
                    class="cursor-pointer bg-white border rounded-lg p-3 text-sm transition"
                    :class="
                      field.manualPocMode === 'maven_account'
                        ? 'border-[#F5DF02] ring-2 ring-[#F5DF02]/30 bg-[#F5DF02]/10'
                        : 'border-stone-200 hover:border-[#F5DF02]/60'
                    "
                  >
                    <input
                      type="radio"
                      class="mr-2"
                      value="maven_account"
                      v-model="field.manualPocMode"
                    />
                    <span class="font-semibold text-zinc-950">
                      Propose full Maven account creation
                    </span>
                    <p class="text-xs text-zinc-500 mt-1">
                      The respondent enters the extra information needed to request account
                      creation.
                    </p>
                  </label>
                </div>

                <div
                  v-if="field.manualPocMode === 'maven_account'"
                  class="bg-white border border-stone-200 rounded-lg p-3 space-y-4"
                >
                  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <p class="text-xs font-semibold text-zinc-950 uppercase">
                        Maven account fields shown to the respondent
                      </p>
                      <p class="text-xs text-zinc-500 mt-1">
                        The segment field is a dependent dropdown: users first choose the segment,
                        then the matching subsegment.
                      </p>
                    </div>

                    <button
                      type="button"
                      @click="resetMavenAccountFields(field)"
                      class="text-xs bg-[#F5DF02]/20 text-zinc-950 border border-[#F5DF02]/40 px-3 py-1.5 rounded-md font-semibold hover:bg-[#F5DF02]/30"
                    >
                      Reset default Maven fields
                    </button>
                  </div>

                  <div
                    v-for="mavenField in field.mavenAccountFields"
                    :key="mavenField.key"
                    class="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-3"
                  >
                    <div class="grid grid-cols-12 gap-2 items-center">
                      <input
                        v-model="mavenField.label"
                        class="col-span-12 md:col-span-6 border border-stone-300 rounded p-2 text-xs"
                        placeholder="Field label"
                      />

                      <select
                        v-model="mavenField.type"
                        @change="normalizeMavenAccountFieldInPlace(mavenField)"
                        class="col-span-8 md:col-span-3 border border-stone-300 rounded p-2 text-xs bg-white"
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="number">Number</option>
                        <option value="textarea">Long text</option>
                        <option value="dependent_select">Dependent dropdown</option>
                      </select>

                      <label
                        class="col-span-4 md:col-span-3 flex items-center gap-1 text-xs text-zinc-700"
                      >
                        <input type="checkbox" v-model="mavenField.required" />
                        Required
                      </label>
                    </div>

                    <div
                      v-if="mavenField.type === 'dependent_select'"
                      class="bg-white border border-stone-200 p-4 rounded-md space-y-3"
                    >
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label class="text-xs text-zinc-700 uppercase font-semibold tracking-wide">
                            1st Dropdown Label
                          </label>
                          <input
                            v-model="mavenField.parentLabel"
                            type="text"
                            class="w-full border border-stone-200 rounded p-2 mt-1 focus:ring-zinc-900 text-sm"
                            placeholder="Segment"
                          />
                        </div>

                        <div>
                          <label class="text-xs text-zinc-700 uppercase font-semibold tracking-wide">
                            2nd Dropdown Label
                          </label>
                          <input
                            v-model="mavenField.childLabel"
                            type="text"
                            class="w-full border border-stone-200 rounded p-2 mt-1 focus:ring-zinc-900 text-sm"
                            placeholder="Sous-Segment"
                          />
                        </div>
                      </div>

                      <div>
                        <label class="text-xs text-zinc-700 uppercase font-semibold tracking-wide">
                          Options Mapping
                          <span class="normal-case text-zinc-400 font-normal ml-2">
                            Format -> Parent: Child 1, Child 2
                          </span>
                        </label>
                        <textarea
                          v-model="mavenField.mappingText"
                          rows="5"
                          class="w-full border border-stone-200 rounded p-2 mt-1 focus:ring-zinc-900 font-mono text-sm leading-relaxed"
                          placeholder="Débit de boisson: Bar, Pub&#10;Restaurant: Restaurant, Hybrid"
                        ></textarea>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                v-if="field.type === 'email'"
                class="col-span-12 bg-stone-50 p-4 rounded border border-stone-200 space-y-4"
              >
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <span
                      class="text-xs font-semibold text-zinc-900 uppercase flex items-center gap-1"
                    >
                      🛡️ Email Settings
                    </span>
                    <p class="text-xs text-zinc-700 mt-1">
                      Keep the classic connected-user auto-fill, or pre-fill this email from any
                      public Supabase column containing “mail” or “email”.
                    </p>
                  </div>

                  <button
                    type="button"
                    @click="loadEmailPrefillColumns"
                    class="text-xs bg-white border border-stone-200 text-zinc-700 px-3 py-1.5 rounded-md font-semibold hover:bg-stone-50"
                  >
                    Reload columns
                  </button>
                </div>

                <div class="flex flex-wrap gap-4 items-center">
                  <label
                    class="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer select-none bg-white px-3 py-2 rounded border border-stone-200"
                  >
                    <input type="checkbox" v-model="field.validation.autoFillUser" />
                    Auto-fill with connected user email
                  </label>

                  <label
                    class="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer select-none bg-white px-3 py-2 rounded border border-stone-200"
                  >
                    <input
                      type="checkbox"
                      :checked="field.emailPrefillConfig?.enabled"
                      @change="setEmailPrefillEnabled(field, $event.target.checked)"
                    />
                    Pre-fill or fix this email
                  </label>
                </div>

                <div
                  v-if="field.emailPrefillConfig?.enabled"
                  class="bg-white border border-stone-200 rounded-lg p-4 space-y-4"
                >
                  <div v-if="emailPrefillColumnsLoading" class="text-xs text-zinc-700">
                    Loading Supabase columns...
                  </div>

                  <div
                    v-if="emailPrefillColumnsError"
                    class="text-xs text-amber-800 bg-stone-50 border border-stone-200 rounded p-2"
                  >
                    {{ emailPrefillColumnsError }}
                  </div>

                  <div v-if="field.emailPrefillConfig.strategy !== 'fixed'">
                    <label class="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                      Source email column
                    </label>
                    <select
                      :value="getSelectedEmailPrefillColumnValue(field)"
                      @change="setEmailPrefillSourceColumn(field, $event.target.value)"
                      class="w-full border border-stone-200 rounded p-2 text-sm bg-white focus:ring-zinc-900 focus:border-zinc-900"
                    >
                      <option value="">Choose a source column...</option>
                      <option
                        v-for="column in getSupportedEmailPrefillColumns()"
                        :key="formatEmailPrefillColumnValue(column)"
                        :value="formatEmailPrefillColumnValue(column)"
                      >
                        {{ column.display_label }}
                      </option>
                    </select>
                    <p class="text-[11px] text-zinc-400 mt-1">
                      This list is loaded dynamically from public Supabase text columns containing
                      “email” or “mail”.
                    </p>
                  </div>

                  <div class="bg-stone-50 border border-stone-200 rounded-lg p-3 space-y-3">
                    <label class="block text-xs font-semibold text-zinc-700 uppercase">
                      Prefill strategy
                    </label>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
                      <label
                        class="cursor-pointer bg-white border rounded-lg p-3 text-sm transition"
                        :class="
                          field.emailPrefillConfig.strategy === 'single_row'
                            ? 'border-[#F5DF02] ring-2 ring-[#F5DF02]/30 bg-[#F5DF02]/10'
                            : 'border-stone-200 hover:border-[#F5DF02]/60'
                        "
                      >
                        <input
                          type="radio"
                          class="mr-2"
                          value="single_row"
                          :checked="field.emailPrefillConfig.strategy === 'single_row'"
                          @change="setEmailPrefillStrategy(field, 'single_row')"
                        />
                        <span class="font-semibold text-zinc-950">Use first row</span>
                        <p class="text-xs text-zinc-500 mt-1">
                          Best for a single-row table like CPM.email_Manager.
                        </p>
                      </label>

                      <label
                        class="cursor-pointer bg-white border rounded-lg p-3 text-sm transition"
                        :class="
                          field.emailPrefillConfig.strategy === 'lookup'
                            ? 'border-[#F5DF02] ring-2 ring-[#F5DF02]/30 bg-[#F5DF02]/10'
                            : 'border-stone-200 hover:border-[#F5DF02]/60'
                        "
                      >
                        <input
                          type="radio"
                          class="mr-2"
                          value="lookup"
                          :checked="field.emailPrefillConfig.strategy === 'lookup'"
                          @change="setEmailPrefillStrategy(field, 'lookup')"
                        />
                        <span class="font-semibold text-zinc-950">Match with another field</span>
                        <p class="text-xs text-zinc-500 mt-1">
                          Best when the email depends on a selected Depot, POC, T1, or another form answer.
                        </p>
                      </label>

                      <label
                        class="cursor-pointer bg-white border rounded-lg p-3 text-sm transition"
                        :class="
                          field.emailPrefillConfig.strategy === 'fixed'
                            ? 'border-[#F5DF02] ring-2 ring-[#F5DF02]/30 bg-[#F5DF02]/10'
                            : 'border-stone-200 hover:border-[#F5DF02]/60'
                        "
                      >
                        <input
                          type="radio"
                          class="mr-2"
                          value="fixed"
                          :checked="field.emailPrefillConfig.strategy === 'fixed'"
                          @change="setEmailPrefillStrategy(field, 'fixed')"
                        />
                        <span class="font-semibold text-zinc-950">Fixed email for this form</span>
                        <p class="text-xs text-zinc-500 mt-1">
                          Best for a mandatory recipient that should always receive this form.
                        </p>
                      </label>
                    </div>
                  </div>

                  <div
                    v-if="field.emailPrefillConfig.strategy === 'fixed'"
                    class="bg-white border border-stone-200 rounded-lg p-4 space-y-2"
                  >
                    <label class="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                      Fixed email address
                    </label>
                    <input
                      v-model.trim="field.emailPrefillConfig.fixedEmailAddress"
                      type="email"
                      placeholder="manager@example.com"
                      class="w-full border border-stone-200 rounded p-2 text-sm bg-white focus:ring-zinc-900 focus:border-zinc-900"
                    />
                    <p class="text-[11px] text-zinc-400">
                      This address is stored in this form schema only. It does not need to exist in any Supabase table.
                    </p>
                  </div>

                  <div
                    v-if="field.emailPrefillConfig.strategy === 'lookup'"
                    class="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div>
                      <label class="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                        Lookup field in this form
                      </label>
                      <select
                        v-model="field.emailPrefillConfig.lookupFieldId"
                        class="w-full border border-stone-200 rounded p-2 text-sm bg-white focus:ring-zinc-900 focus:border-zinc-900"
                      >
                        <option value="">Choose a field...</option>
                        <option
                          v-for="lookupField in getEmailPrefillLookupFields(field)"
                          :key="lookupField.id"
                          :value="lookupField.id"
                        >
                          {{ lookupField.label || lookupField.type }}
                        </option>
                      </select>
                      <p class="text-[11px] text-zinc-400 mt-1">
                        Example: choose your Depot field if the source table should be matched by depot ID.
                      </p>
                    </div>

                    <div>
                      <label class="block text-xs font-semibold text-zinc-700 uppercase mb-1">
                        Lookup column in source table
                      </label>
                      <select
                        v-model="field.emailPrefillConfig.lookupColumn"
                        class="w-full border border-stone-200 rounded p-2 text-sm bg-white focus:ring-zinc-900 focus:border-zinc-900"
                      >
                        <option value="">Choose a lookup column...</option>
                        <option
                          v-for="column in getEmailPrefillLookupColumns(field)"
                          :key="column.column_name"
                          :value="column.column_name"
                        >
                          {{ column.display_label || column.column_name }}
                        </option>
                      </select>

                      <p v-if="isEmailPrefillLookupColumnsLoading(field)" class="text-[11px] text-zinc-500 mt-1">
                        Loading lookup columns...
                      </p>
                      <p v-else class="text-[11px] text-zinc-400 mt-1">
                        Example: use “Ship to number” for depot matching.
                      </p>
                    </div>
                  </div>

                  <div class="flex flex-col gap-2">
                    <label
                      class="flex items-center gap-2 text-xs text-zinc-700 cursor-pointer select-none bg-stone-50 px-3 py-2 rounded border border-stone-200 w-fit"
                    >
                      <input type="checkbox" v-model="field.emailPrefillConfig.allowEdit" />
                      Let respondent modify the pre-filled email
                    </label>

                    <p class="text-xs text-zinc-500">
                      {{ getEmailPrefillSourceDescription(field) }}
                    </p>
                  </div>
                </div>
              </div>

              <div
                v-if="field.required && field.type !== 'email'"
                class="col-span-12 bg-stone-50 p-3 rounded border border-stone-200 flex flex-wrap gap-4 items-center"
              >
                <span class="text-xs font-semibold text-zinc-900 uppercase flex items-center gap-1">
                  🛡️ Validation Rules
                </span>

                <template v-if="field.type === 'text'">
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-zinc-700">Min Chars</label>
                    <input
                      v-model="field.validation.minLength"
                      type="number"
                      class="w-16 p-1 text-xs border rounded"
                      placeholder="0"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-zinc-700">Max Chars</label>
                    <input
                      v-model="field.validation.maxLength"
                      type="number"
                      class="w-16 p-1 text-xs border rounded"
                      placeholder="∞"
                    />
                  </div>
                </template>

                <template v-if="field.type === 'number'">
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-zinc-700">Min Value</label>
                    <input
                      v-model="field.validation.min"
                      type="number"
                      class="w-16 p-1 text-xs border rounded"
                      placeholder="0"
                    />
                  </div>
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-zinc-700">Max Value</label>
                    <input
                      v-model="field.validation.max"
                      type="number"
                      class="w-16 p-1 text-xs border rounded"
                      placeholder="∞"
                    />
                  </div>
                </template>

                <template v-if="field.type === 'select'">
                  <label
                    class="flex items-center gap-1 text-xs text-zinc-700 cursor-pointer select-none bg-white px-2 py-1 rounded border border-stone-200"
                  >
                    <input type="checkbox" v-model="field.validation.multiSelect" />
                    Allow Multiple?
                  </label>

                  <template v-if="field.validation.multiSelect">
                    <div class="flex items-center gap-2">
                      <label class="text-xs text-zinc-700">Min Select</label>
                      <input
                        v-model="field.validation.minSelect"
                        type="number"
                        class="w-14 p-1 text-xs border rounded"
                      />
                    </div>
                    <div class="flex items-center gap-2">
                      <label class="text-xs text-zinc-700">Max Select</label>
                      <input
                        v-model="field.validation.maxSelect"
                        type="number"
                        class="w-14 p-1 text-xs border rounded"
                      />
                    </div>
                  </template>
                </template>

                <template v-if="['file', 'signature'].includes(field.type)">
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-zinc-700">Max File Size (MB)</label>
                    <input
                      v-model="field.validation.maxFileSize"
                      type="number"
                      class="w-16 p-1 text-xs border rounded"
                      placeholder="5"
                    />
                  </div>
                </template>

                <template v-if="field.type === 'table'">
                  <div class="flex items-center gap-2">
                    <label class="text-xs text-zinc-700">Sum Check on:</label>
                    <select
                      v-model="field.validation.sumColumnId"
                      class="text-xs p-1 border rounded w-24"
                    >
                      <option value="">(None)</option>
                      <option
                        v-for="col in field.columns.filter(
                          (col) => col.type === 'number' && !col.locked,
                        )"
                        :key="col.id"
                        :value="col.id"
                      >
                        {{ col.label }}
                      </option>
                    </select>
                  </div>

                  <template v-if="field.validation.sumColumnId">
                    <div class="flex items-center gap-2">
                      <label class="text-xs text-zinc-700">Min Total</label>
                      <input
                        v-model="field.validation.minSum"
                        type="number"
                        class="w-14 p-1 text-xs border rounded"
                      />
                    </div>
                    <div class="flex items-center gap-2">
                      <label class="text-xs text-zinc-700">Max Total</label>
                      <input
                        v-model="field.validation.maxSum"
                        type="number"
                        class="w-14 p-1 text-xs border rounded"
                      />
                    </div>
                  </template>
                </template>
              </div>

              <div
                v-if="field.type === 'table'"
                class="col-span-12 bg-stone-50 p-4 rounded-lg border border-stone-200"
              >
                <div class="grid gap-2 mb-4">
                  <div class="flex justify-between items-center mb-2">
                    <h4 class="text-xs font-semibold text-zinc-900 uppercase">
                      Column Configuration
                    </h4>
                    <button
                      type="button"
                      @click="addTableColumn(index)"
                      :disabled="field.columns.length >= 6"
                      class="text-xs bg-stone-200 text-zinc-900 px-2 py-1 rounded hover:bg-stone-300"
                    >
                      + Add Column
                    </button>
                  </div>

                  <div
                    v-for="(col, cIdx) in field.columns"
                    :key="col.id"
                    class="flex flex-col gap-2 bg-white p-3 rounded border border-stone-200"
                  >
                    <div class="flex gap-2 items-center">
                      <input
                        v-model="col.label"
                        placeholder="Column Name"
                        class="border rounded p-1 text-sm flex-grow font-semibold"
                      />

                      <select v-model="col.type" class="border rounded p-1 text-sm bg-stone-50">
                        <option value="text">String</option>
                        <option value="number">Number</option>
                        <option value="image">Picture</option>
                      </select>

                      <label
                        class="flex items-center gap-1 text-xs text-zinc-700 cursor-pointer border border-stone-200 px-2 py-1 rounded bg-stone-50"
                      >
                        <input type="checkbox" v-model="col.required" />
                        Required?
                      </label>

                      <label
                        class="flex items-center gap-1 text-xs text-zinc-700 cursor-pointer border px-2 py-1 rounded bg-stone-50"
                      >
                        <input type="checkbox" v-model="col.locked" />
                        Locked
                      </label>

                      <button
                        type="button"
                        @click="removeTableColumn(index, cIdx)"
                        :disabled="field.columns.length <= 2"
                        class="text-red-400 hover:text-red-600 font-semibold px-2"
                      >
                        ×
                      </button>
                    </div>

                    <div
                      v-if="!col.locked && col.type !== 'image'"
                      class="flex items-center gap-3 pl-2 border-l-2 border-stone-200"
                    >
                      <span class="text-[10px] text-zinc-400 font-semibold uppercase tracking-wide">
                        Rules:
                      </span>

                      <template v-if="col.type === 'text'">
                        <div class="flex items-center gap-1">
                          <span class="text-[10px] text-zinc-500">Min Len</span>
                          <input
                            v-model="col.validation.minLength"
                            type="number"
                            class="w-12 p-0.5 text-xs border rounded"
                            placeholder="0"
                          />
                        </div>
                        <div class="flex items-center gap-1">
                          <span class="text-[10px] text-zinc-500">Max Len</span>
                          <input
                            v-model="col.validation.maxLength"
                            type="number"
                            class="w-12 p-0.5 text-xs border rounded"
                            placeholder="∞"
                          />
                        </div>
                      </template>

                      <template v-if="col.type === 'number'">
                        <div class="flex items-center gap-1">
                          <span class="text-[10px] text-zinc-500">Min Val</span>
                          <input
                            v-model="col.validation.min"
                            type="number"
                            class="w-12 p-0.5 text-xs border rounded"
                            placeholder="0"
                          />
                        </div>
                        <div class="flex items-center gap-1">
                          <span class="text-[10px] text-zinc-500">Max Val</span>
                          <input
                            v-model="col.validation.max"
                            type="number"
                            class="w-12 p-0.5 text-xs border rounded"
                            placeholder="∞"
                          />
                        </div>
                      </template>
                    </div>
                  </div>
                </div>

                <div>
                  <div class="flex justify-between items-center mb-2">
                    <label class="text-xs text-zinc-900 uppercase font-semibold tracking-wide">
                      Table Content Preview
                    </label>
                    <button
                      type="button"
                      @click="addTableRow(index)"
                      class="text-xs bg-stone-200 text-zinc-900 px-2 py-1 rounded hover:bg-stone-300"
                    >
                      Add Row
                    </button>
                  </div>

                  <div class="overflow-x-auto border rounded-lg bg-white">
                    <table class="w-full text-sm text-left">
                      <thead class="bg-stone-100 text-zinc-950 font-semibold">
                        <tr>
                          <th v-for="col in field.columns" :key="col.id" class="p-2 border-b">
                            {{ col.label }}
                          </th>
                          <th class="p-2 border-b w-8"></th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr v-for="(row, rIdx) in field.rows" :key="rIdx" class="hover:bg-stone-50">
                          <td
                            v-for="col in field.columns"
                            :key="col.id"
                            class="p-2 border-b border-stone-200"
                          >
                            <template v-if="col.locked">
                              <div v-if="col.type === 'image'">
                                <div v-if="row[col.id]" class="relative w-10 h-10 group">
                                  <img
                                    :src="row[col.id]"
                                    class="w-full h-full object-cover rounded"
                                  />
                                  <button
                                    type="button"
                                    @click="row[col.id] = ''"
                                    class="absolute -top-1 -right-1 bg-red-500 text-white rounded-md w-4 h-4 text-xs"
                                  >
                                    ×
                                  </button>
                                </div>

                                <label v-else class="cursor-pointer text-xs text-zinc-600">
                                  Img
                                  <input
                                    type="file"
                                    class="hidden"
                                    @change="
                                      (event) =>
                                        handleTableCellImageUpload(event, index, rIdx, col.id)
                                    "
                                  />
                                </label>
                              </div>

                              <input
                                v-else
                                v-model="row[col.id]"
                                class="w-full border rounded p-1 text-xs bg-stone-50"
                              />
                            </template>

                            <div v-else class="text-xs text-zinc-400 italic text-center">
                              User Input
                            </div>
                          </td>

                          <td class="p-2 border-b border-stone-200 text-center">
                            <button
                              type="button"
                              @click="removeTableRow(index, rIdx)"
                              class="text-red-400 font-semibold"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div
                v-if="field.type === 'select'"
                class="col-span-12 bg-stone-50 border-stone-200 p-4 rounded-md border"
              >
                <label class="text-xs text-zinc-700 uppercase font-semibold tracking-wide">
                  Options (One per line)
                </label>
                <textarea
                  rows="3"
                  class="w-full border border-stone-200 rounded p-2 mt-1 focus:ring-zinc-900 focus:border-zinc-900 font-mono text-sm"
                  :value="field.options ? field.options.join('\n') : ''"
                  @input="(event) => (field.options = event.target.value.split('\n'))"
                ></textarea>
              </div>
            </template>

            <div class="col-span-12 flex justify-end pt-2 border-t border-stone-200">
              <button
                type="button"
                @click="removeField(index)"
                class="text-red-500 hover:text-red-700 text-sm font-semibold flex items-center gap-1"
              >
                <span>🗑️</span> Remove Field
              </button>
            </div>
          </div>
        </div>
      </TransitionGroup>

      <div
        v-if="fields.length === 0"
        class="text-center py-12 border-2 border-dashed border-stone-300 rounded-2xl text-zinc-400 bg-stone-50"
      >
        <p>The form is empty.</p>
        <p class="text-sm">Click a button above to add your first question.</p>
      </div>
    </div>

    <div
      v-if="showIconPicker"
      class="fixed inset-0 bg-zinc-950/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div class="p-4 border-b flex justify-between items-center bg-stone-50">
          <h3 class="font-semibold text-zinc-900">Select an Icon</h3>
          <button
            type="button"
            @click="showIconPicker = false"
            class="text-zinc-400 hover:text-zinc-950 font-semibold px-2 text-xl"
          >
            ✕
          </button>
        </div>

        <div class="p-6 overflow-y-auto">
          <div v-for="cat in iconLibrary" :key="cat.category" class="mb-6 last:mb-0">
            <h4 class="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
              {{ cat.category }}
            </h4>

            <div class="flex flex-wrap gap-2">
              <button
                v-for="icon in cat.icons"
                :key="icon"
                type="button"
                @click="selectIcon(icon)"
                class="text-2xl h-10 w-10 flex items-center justify-center rounded hover:bg-stone-100 hover:scale-110 transition cursor-pointer"
              >
                {{ icon }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

.list-leave-active {
  position: absolute;
}
</style>
