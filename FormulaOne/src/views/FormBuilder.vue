<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { supabase } from '../supabase'
import FormRenderer from '../components/FormRenderer.vue'
import FormPresentation from '../components/FormPresentation.vue'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const route = useRoute()
const slugFromUrl = route.params.slug
const submissionId = ref(route.query.submissionId || null)

// STATE
const formTitle = ref('')
const formSchema = ref([])
const formData = ref({})
const formId = ref(null)
const formDescription = ref('')
const formInfoBlocks = ref([])
// 🟢 FIX: Added missing variable declaration
const formEmailConfig = ref(null)
const currentUserEmail = ref('')

const loading = ref(true)
const submitting = ref(false)
const submitted = ref(false)
const validationErrors = ref([])

const getBase64FromUrl = async (url) => {
  if (!url) return null
  if (url.startsWith('data:')) return { base64: url, ratio: 1 }

  try {
    const response = await fetch(url)
    const blob = await response.blob()

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result
        const img = new Image()
        img.onload = () => {
          resolve({
            base64,
            ratio: img.width / img.height,
            width: img.width,
            height: img.height,
          })
        }
        img.onerror = () => resolve(null)
        img.src = base64
      }
      reader.readAsDataURL(blob)
    })
  } catch (e) {
    console.warn('PDF Image Load Failed:', url)
    return null
  }
}

const EMAIL_REGEX = /^[^\s@;,<>]+@[^\s@;,<>]+\.[^\s@;,<>]+$/i

const splitEmailList = (value) =>
  String(value || '')
    .split(/[;,\n]+/)
    .map((email) => email.trim())
    .filter(Boolean)

const isValidEmailAddress = (email) => EMAIL_REGEX.test(String(email || '').trim())

const getValidEmailsFromValue = (value) =>
  splitEmailList(value).filter((email) => isValidEmailAddress(email))

const getInvalidEmailsFromValue = (value) =>
  splitEmailList(value).filter((email) => !isValidEmailAddress(email))

const addEmailsFromValue = (value, recipientSet) => {
  if (value === null || value === undefined) return

  if (Array.isArray(value)) {
    value.forEach((entry) => addEmailsFromValue(entry, recipientSet))
    return
  }

  if (typeof value === 'object') {
    Object.values(value).forEach((entry) => addEmailsFromValue(entry, recipientSet))
    return
  }

  getValidEmailsFromValue(value).forEach((email) => {
    recipientSet.add(email.toLowerCase())
  })
}

const formatDisplayValue = (value) => {
  if (value === null || value === undefined || value === '') return '-'

  if (Array.isArray(value)) {
    return value.map((entry) => formatDisplayValue(entry)).join(', ')
  }

  if (typeof value === 'object') {
    if ('parent' in value || 'child' in value) {
      return [value.parent, value.child].filter(Boolean).join(' / ') || '-'
    }

    if (value.name) return value.name
    if (value.t1) return value.t1
    if (value.value) return value.value

    return JSON.stringify(value)
  }

  return String(value)
}

const addMavenFieldsToPdfRows = (field, rows) => {
  const isManualMaven =
    formData.value[`${field.id}_is_manual`] === true &&
    formData.value[`${field.id}_manual_mode`] === 'maven_account'

  if (!isManualMaven) return

  const mavenData = formData.value[`${field.id}_maven_account`] || {}
  const mavenFields = Array.isArray(field.mavenAccountFields) ? field.mavenAccountFields : []

  mavenFields.forEach((mavenField) => {
    rows.push([
      `${field.label} - Maven - ${mavenField.label || mavenField.key}`,
      formatDisplayValue(mavenData[mavenField.key]),
    ])
  })
}

const collectEmailRecipients = async () => {
  const recipientSet = new Set()
  let t1Email = null
  let t1Name = null

  // Main rule: send to every e-mail address present in the submission payload.
  // This includes normal email fields, fixed email fields, dynamic prefilled emails,
  // and any future nested field that contains an email address.
  addEmailsFromValue(formData.value, recipientSet)

  // Keep the existing T1 convenience lookup as a fallback when a T1 field is used.
  const t1Field = formSchema.value.find((field) => field.type === 't1_select')
  if (t1Field) {
    t1Name = formData.value[t1Field.id]

    if (t1Name) {
      const { data: t1Data, error: t1Err } = await supabase
        .from('t1_users')
        .select('email')
        .eq('full_name', t1Name)
        .maybeSingle()

      if (!t1Err && t1Data?.email) {
        t1Email = t1Data.email
        addEmailsFromValue(t1Data.email, recipientSet)
      } else if (t1Err) {
        console.warn('Could not find T1 user email:', t1Name, t1Err)
      }
    }
  }

  return {
    recipients: [...recipientSet],
    t1Email,
    t1Name,
  }
}

// --- 1. GENERATE PDF (Compact Rows, Scaled Images) ---
const generatePDFBase64 = async (t1Email, t1Name) => {
  const doc = new jsPDF()
  let yPos = 20
  const pageWidth = doc.internal.pageSize.width
  const margin = 14
  const maxTextWidth = pageWidth - margin * 2

  // HEADER
  doc.setFontSize(18)
  const splitTitle = doc.splitTextToSize(formTitle.value, maxTextWidth)
  doc.text(splitTitle, margin, yPos)
  yPos += splitTitle.length * 8 + 4

  // METADATA
  doc.setFontSize(10)
  const finalSubmitter = t1Email || t1Name || currentUserEmail.value || 'Anonymous'
  doc.text(`Submitted by: ${finalSubmitter}`, margin, yPos)
  yPos += 6
  doc.text(`Date: ${new Date().toLocaleDateString()}`, margin, yPos)
  yPos += 10

  // PREPARE DATA
  const generalFields = []
  const customTables = []
  let signatureUrl = null

  for (const field of formSchema.value) {
    const val = formData.value[field.id]

    if (field.type === 'signature') {
      signatureUrl = val
    } else if (field.type === 'table') {
      customTables.push({ field, rows: val || [] })
    } else if (!field.is_partner) {
      generalFields.push([field.label, formatDisplayValue(val)])

      if (field.type === 'poc_select') {
        addMavenFieldsToPdfRows(field, generalFields)
      }
    }
  }

  // DRAW GENERAL INFO
  if (generalFields.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Question', 'Response']],
      body: generalFields,
      theme: 'striped',
      headStyles: { fillColor: [40, 40, 40] },
      didDrawPage: (d) => {
        yPos = d.cursor.y
      },
    })
    yPos = doc.lastAutoTable.finalY + 10
  }

  // DRAW CUSTOM TABLES (Fixed Height Rows)
  for (const { field, rows } of customTables) {
    if (rows.length === 0) continue

    if (yPos + 30 > doc.internal.pageSize.height) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text(field.label, margin, yPos)
    yPos += 5

    const columns = field.columns.map((c) => c.label)
    const body = []
    const imagesToDraw = []

    // 🟢 FIX 1: Set a smaller fixed height (e.g., 20)
    const hasImages = field.columns.some((c) => c.type === 'image')
    const rowHeight = hasImages ? 20 : 10

    for (let r = 0; r < rows.length; r++) {
      const rowData = []
      for (let c = 0; c < field.columns.length; c++) {
        const col = field.columns[c]
        const cellVal = rows[r][col.id]

        if (col.type === 'image' && cellVal) {
          const imgData = await getBase64FromUrl(cellVal)
          if (imgData) imagesToDraw.push({ r, c, ...imgData })
          rowData.push('')
        } else {
          rowData.push(cellVal || '')
        }
      }
      body.push(rowData)
    }

    autoTable(doc, {
      startY: yPos,
      head: [columns],
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [200, 200, 200], textColor: 0 },
      styles: {
        minCellHeight: rowHeight, // Apply small fixed height
        valign: 'middle',
      },
      didDrawCell: (data) => {
        if (data.section === 'body') {
          const img = imagesToDraw.find((i) => i.r === data.row.index && i.c === data.column.index)
          if (img) {
            // 🟢 FIX 2: Fit Image into the small cell while keeping ratio
            const padding = 1 // Smaller padding for tight fit
            const cellW = data.cell.width - padding * 2
            const cellH = data.cell.height - padding * 2

            // Calculate constrained dimensions
            let drawW = cellW
            let drawH = cellW / img.ratio

            if (drawH > cellH) {
              drawH = cellH
              drawW = cellH * img.ratio
            }

            // Center image in cell
            const x = data.cell.x + padding + (cellW - drawW) / 2
            const y = data.cell.y + padding + (cellH - drawH) / 2

            doc.addImage(img.base64, 'JPEG', x, y, drawW, drawH)
          }
        }
      },
    })
    yPos = doc.lastAutoTable.finalY + 10
  }

  // DRAW SIGNATURE
  if (signatureUrl) {
    if (yPos + 40 > doc.internal.pageSize.height) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(12)
    doc.text('Signature:', margin, yPos)
    yPos += 5

    const sigData = await getBase64FromUrl(signatureUrl)
    if (sigData) {
      const sigW = 60
      const sigH = sigW / sigData.ratio
      doc.addImage(sigData.base64, 'PNG', margin, yPos, sigW, sigH)
    }
  }

  return doc.output('datauristring').split(',')[1]
}
const fetchForm = async () => {
  loading.value = true
  const {
    data: { user },
  } = await supabase.auth.getUser()
  currentUserEmail.value = user?.email || ''

  const { data, error } = await supabase.from('forms').select('*').eq('slug', slugFromUrl).single()

  if (error) {
    alert('Form not found!')
    loading.value = false
    return
  }

  formTitle.value = data.title
  formSchema.value = data.schema
  formId.value = data.id
  formDescription.value = data.description
  formInfoBlocks.value = data.info_blocks
  formEmailConfig.value = data.email_config

  const initialData = {}
  data.schema.forEach((field) => {
    if (['poc_select', 'manager_select', 'depot_select', 't1_select'].includes(field.type)) {
      initialData[field.id] = null
    } else if (field.type === 'table') {
      initialData[field.id] = field.rows ? JSON.parse(JSON.stringify(field.rows)) : []
    } else {
      if (field.type === 'email' && field.validation?.autoFillUser) {
        initialData[field.id] = currentUserEmail.value
      } else {
        initialData[field.id] = ''
      }
    }
  })

  if (submissionId.value) {
    const { data: subData } = await supabase
      .from('submissions')
      .select('response_data')
      .eq('id', submissionId.value)
      .single()
    if (subData) formData.value = { ...initialData, ...subData.response_data }
  } else {
    formData.value = initialData
  }
  loading.value = false
}
// ---------------------------------------------------------
// 🛡️ UPDATED VALIDATION LOGIC
// ---------------------------------------------------------
const isEmptyValue = (value) =>
  value === null ||
  value === undefined ||
  value === '' ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0)

const getDisplayValue = (value) => {
  if (value === null || value === undefined || value === '') return '-'

  if (Array.isArray(value)) {
    return value.map(getDisplayValue).join(', ')
  }

  if (typeof value === 'object') {
    if ('parent' in value || 'child' in value) {
      return [value.parent, value.child].filter(Boolean).join(' / ') || '-'
    }

    if ('name' in value) return value.name || '-'
    if ('t1' in value) return value.t1 || '-'

    return Object.entries(value)
      .map(([key, val]) => `${key}: ${getDisplayValue(val)}`)
      .join(' | ')
  }

  return String(value)
}

const getMavenAccountFieldValue = (mavenData, mavenField) => {
  if (!mavenData || !mavenField) return ''

  const value = mavenData[mavenField.key]
  if (value === null || value === undefined) return ''

  return getDisplayValue(value)
}

const validateForm = () => {
  validationErrors.value = []
  formSchema.value.forEach((field) => {
    const val = formData.value[field.id]
    const rules = field.validation || {}

    if (field.required && !field.is_partner) {
      if (isEmptyValue(val)) {
        validationErrors.value.push(`Field "${field.label}" is required.`)
        return
      }
    }

    if (field.type === 'poc_select' && formData.value[`${field.id}_is_manual`]) {
      const manualMode = formData.value[`${field.id}_manual_mode`] || field.manualPocMode

      if (manualMode === 'maven_account') {
        const mavenData = formData.value[`${field.id}_maven_account`] || {}
        const missingMavenFields = (field.mavenAccountFields || []).filter((mavenField) => {
          if (!mavenField.required) return false

          const value = mavenData[mavenField.key]

          if (mavenField.type === 'dependent_select') {
            return !value?.parent || !value?.child
          }

          return isEmptyValue(value)
        })

        missingMavenFields.forEach((mavenField) => {
          validationErrors.value.push(`Field "${mavenField.label}" is required.`)
        })
      }
    }

    if (!val && val !== 0) return
    if (field.type === 'email') {
      const emails = splitEmailList(val)
      const invalidEmails = getInvalidEmailsFromValue(val)

      if (field.required && emails.length === 0) {
        validationErrors.value.push(`"${field.label}": at least one email address is required.`)
      }

      if (invalidEmails.length > 0) {
        validationErrors.value.push(
          `"${field.label}": invalid email address(es): ${invalidEmails.join(', ')}.`,
        )
      }
    }
    // Simple text validation
    if (field.type === 'text') {
      if (rules.minLength && val.length < rules.minLength)
        validationErrors.value.push(`"${field.label}": Min ${rules.minLength} chars.`)
      if (rules.maxLength && val.length > rules.maxLength)
        validationErrors.value.push(`"${field.label}": Max ${rules.maxLength} chars.`)
    }

    // 3. NUMBER RULES
    if (field.type === 'number') {
      if (rules.min !== null && Number(val) < rules.min)
        validationErrors.value.push(`"${field.label}": Value must be at least ${rules.min}.`)
      if (rules.max !== null && Number(val) > rules.max)
        validationErrors.value.push(`"${field.label}": Value must be at most ${rules.max}.`)
    }

    // 4. MULTI-SELECT RULES
    if (field.type === 'select' && Array.isArray(val)) {
      if (rules.minSelect && val.length < rules.minSelect)
        validationErrors.value.push(
          `"${field.label}": Please select at least ${rules.minSelect} options.`,
        )
      if (rules.maxSelect && val.length > rules.maxSelect)
        validationErrors.value.push(
          `"${field.label}": Please select at most ${rules.maxSelect} options.`,
        )
    }

    // 5. TABLE VALIDATION
    if (field.type === 'table') {
      const rows = val || []
      const getRowLabel = (row, idx) => {
        const textCol = field.columns.find((c) => c.type === 'text')
        return textCol && row[textCol.id] ? `"${row[textCol.id]}"` : `Row ${idx + 1}`
      }

      field.columns.forEach((col) => {
        if (col.locked) return
        rows.forEach((row, rIdx) => {
          let cellVal = row[col.id]
          const colRules = col.validation || {}

          if (
            col.type === 'number' &&
            (cellVal === '' || cellVal === null || cellVal === undefined)
          ) {
            cellVal = 0
            row[col.id] = 0
          }

          if (col.required && (cellVal === '' || cellVal === null || cellVal === undefined)) {
            validationErrors.value.push(
              `Table "${field.label}" (${getRowLabel(row, rIdx)}): "${col.label}" is required.`,
            )
          }

          if (cellVal === '' || cellVal === null || cellVal === undefined) return

          if (col.type === 'text') {
            if (colRules.minLength && cellVal.length < colRules.minLength)
              validationErrors.value.push(
                `Table "${field.label}" (${getRowLabel(row, rIdx)}): "${col.label}" too short.`,
              )
            if (colRules.maxLength && cellVal.length > colRules.maxLength)
              validationErrors.value.push(
                `Table "${field.label}" (${getRowLabel(row, rIdx)}): "${col.label}" too long.`,
              )
          }
          if (col.type === 'number') {
            if (colRules.min !== null && Number(cellVal) < colRules.min)
              validationErrors.value.push(
                `Table "${field.label}" (${getRowLabel(row, rIdx)}): "${col.label}" must be ≥ ${colRules.min}.`,
              )
            if (colRules.max !== null && Number(cellVal) > colRules.max)
              validationErrors.value.push(
                `Table "${field.label}" (${getRowLabel(row, rIdx)}): "${col.label}" must be ≤ ${colRules.max}.`,
              )
          }
        })
      })

      if (rules.sumColumnId) {
        const targetCol = field.columns.find((c) => c.id === rules.sumColumnId)
        if (targetCol) {
          const total = rows.reduce((sum, row) => sum + (Number(row[rules.sumColumnId]) || 0), 0)
          if (rules.minSum !== null && total < rules.minSum)
            validationErrors.value.push(
              `"${field.label}": Total ${targetCol.label} is ${total} (Min: ${rules.minSum}).`,
            )
          if (rules.maxSum !== null && total > rules.maxSum)
            validationErrors.value.push(
              `"${field.label}": Total ${targetCol.label} is ${total} (Max: ${rules.maxSum}).`,
            )
        }
      }
    }
  })

  return validationErrors.value.length === 0
}

const collectEmailsDeep = (value) => {
  const emails = []

  if (value === null || value === undefined) {
    return emails
  }

  if (typeof value === 'string') {
    emails.push(...getValidEmailsFromValue(value))
    return emails
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      emails.push(...collectEmailsDeep(item))
    })
    return emails
  }

  if (typeof value === 'object') {
    Object.values(value).forEach((item) => {
      emails.push(...collectEmailsDeep(item))
    })
  }

  return emails
}

const submitForm = async () => {
  if (!validateForm()) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  submitting.value = true

  // A. Save to DB
  const payload = { form_id: formId.value, response_data: formData.value }
  let error = null

  if (submissionId.value) {
    const { error: uErr } = await supabase
      .from('submissions')
      .update({ response_data: formData.value })
      .eq('id', submissionId.value)
    error = uErr
  } else {
    const { error: iErr } = await supabase.from('submissions').insert(payload)
    error = iErr
  }

  if (error) {
    alert('Error: ' + error.message)
    submitting.value = false
    return
  }

  // B. Email Logic
  const config = formEmailConfig.value || {}
  const emailEnabled = config.enabled !== false

  if (emailEnabled) {
    const { recipients, t1Email, t1Name } = await collectEmailRecipients()

    if (recipients.length === 0) {
      console.warn(
        'Submission saved, but no email recipient was found in formData:',
        formData.value,
      )
      alert('Submission saved, but no email was sent because no recipient email address was found.')
    } else {
      try {
        const pdfBase64 = await generatePDFBase64(t1Email, t1Name)

        const { data: emailResult, error: emailError } = await supabase.functions.invoke(
          'send-email',
          {
            body: {
              to: recipients,
              subject: config.subject || `Bon de commande: ${formTitle.value}`,
              text:
                config.body ||
                'Bonjour,\n\nVeuillez trouver en pièce jointe le bon de commande généré depuis le formulaire.\n\nMerci.',
              pdfBase64,
              filename: `${formTitle.value.replace(/[^a-z0-9]/gi, '_')}.pdf`,
            },
          },
        )

        if (emailError) {
          throw new Error(emailError.message || JSON.stringify(emailError))
        }

        if (emailResult?.error) {
          throw new Error(emailResult.error)
        }

        console.info('Bon de commande email sent:', {
          recipients,
          result: emailResult,
        })
      } catch (emailErr) {
        console.error('Email failed:', emailErr)
        alert(
          'Submission saved, but the bon de commande email could not be sent: ' +
            (emailErr.message || 'Unknown email error'),
        )
      }
    }
  }

  submitted.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
  submitting.value = false
}
onMounted(() => {
  fetchForm()
})
</script>

<template>
  <div class="min-h-full bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
    <div v-if="loading" class="text-center text-gray-500 mt-20">
      <div class="flex items-center justify-center">
        <div
          class="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"
        ></div>
      </div>
      {{ submissionId ? 'Loading submission...' : 'Loading form...' }}
    </div>

    <div
      v-else-if="submitted"
      class="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg text-center border border-green-100"
    >
      <div class="text-6xl mb-4">🎉</div>
      <h2 class="text-2xl font-bold text-gray-900 mb-2">
        {{ submissionId ? 'Updated Successfully!' : 'Thank You!' }}
      </h2>
      <p class="text-gray-500">
        {{ submissionId ? 'Your report has been updated.' : 'Your submission has been received.' }}
      </p>

      <div class="mt-6 flex flex-col gap-2">
        <button @click="$router.push('/summary')" class="text-black font-bold hover:underline">
          Back to Dashboard
        </button>
        <button
          v-if="!submissionId"
          @click="$router.go(0)"
          class="text-blue-600 font-bold hover:underline"
        >
          Submit another response
        </button>
      </div>
    </div>

    <div v-else class="mx-auto">
      <div
        v-if="submissionId"
        class="mb-4 bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-yellow-800 text-sm font-bold text-center"
      >
        ⚠️ You are editing an existing submission
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-2 items-start">
        <div class="lg:col-span-5 lg:sticky lg:top-8">
          <div class="bg-white shadow-sm rounded-2xl p-6 lg:p-8 border border-gray-100">
            <FormPresentation
              :title="formTitle"
              :description="formDescription"
              :blocks="formInfoBlocks"
            />
          </div>
        </div>

        <div class="lg:col-span-7">
          <div class="bg-white shadow-lg rounded-2xl p-6 lg:p-10 border border-gray-100 relative">
            <form @submit.prevent="submitForm" class="space-y-8">
              <FormRenderer :schema="formSchema" v-model="formData" />

              <div
                v-if="validationErrors.length > 0"
                class="bg-red-50 border border-red-200 rounded-lg p-4"
              >
                <div class="flex items-center gap-2 text-red-700 font-bold mb-2">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    ></path>
                  </svg>
                  <span>Please fix the following errors:</span>
                </div>
                <ul class="list-disc list-inside text-sm text-red-600 space-y-1">
                  <li v-for="(err, i) in validationErrors" :key="i">{{ err }}</li>
                </ul>
              </div>

              <div class="pt-6 border-t border-gray-100 flex justify-center">
                <button
                  type="submit"
                  :disabled="submitting"
                  class="bg-black text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition shadow-md w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ submitting ? 'Saving...' : submissionId ? 'Update Report' : 'Submit Report' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
