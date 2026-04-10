import OpenAI from 'openai'

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: import.meta.env.VITE_AI_API_KEY,
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    'HTTP-Referer': 'https://medilens-ai.vercel.app',
    'X-Title': 'MediLens AI'
  }
})

// ─── KNOWN RANGES (our existing ones) ────────────────────────────────────────
export const KNOWN_RANGES = {
  hemoglobin:    { min: 12,      max: 17,      unit: 'g/dL',       label: 'Hemoglobin' },
  wbc:           { min: 4000,    max: 10000,   unit: 'cells/µL',   label: 'WBC / Total Count' },
  rbc:           { min: 3.8,     max: 5.5,     unit: 'million/µL', label: 'RBC Count' },
  pcv:           { min: 36,      max: 46,      unit: '%',          label: 'PCV / Hematocrit' },
  mcv:           { min: 83,      max: 101,     unit: 'fL',         label: 'MCV' },
  mch:           { min: 27,      max: 32,      unit: 'pg',         label: 'MCH' },
  mchc:          { min: 31.5,    max: 34.5,    unit: 'g/dL',       label: 'MCHC' },
  platelets:     { min: 150000,  max: 450000,  unit: 'cells/µL',   label: 'Platelet Count' },
  rdw:           { min: 11.3,    max: 14.7,    unit: '%',          label: 'RDW-CV' },
  neutrophils:   { min: 40,      max: 75,      unit: '%',          label: 'Neutrophils' },
  lymphocytes:   { min: 20,      max: 45,      unit: '%',          label: 'Lymphocytes' },
  eosinophils:   { min: 1,       max: 6,       unit: '%',          label: 'Eosinophils' },
  monocytes:     { min: 2,       max: 10,      unit: '%',          label: 'Monocytes' },
  basophils:     { min: 0,       max: 2,       unit: '%',          label: 'Basophils' },
  aec:           { min: 20,      max: 500,     unit: 'cells/µL',   label: 'Abs. Eosinophil Count' },
  alc:           { min: 1000,    max: 3000,    unit: 'cells/µL',   label: 'Abs. Lymphocyte Count' },
  anc:           { min: 2000,    max: 7000,    unit: 'cells/µL',   label: 'Abs. Neutrophil Count' },
  glucose:       { min: 70,      max: 100,     unit: 'mg/dL',      label: 'Fasting Glucose' },
  ppGlucose:     { min: 70,      max: 140,     unit: 'mg/dL',      label: 'PP Glucose' },
  hba1c:         { min: 4,       max: 5.7,     unit: '%',          label: 'HbA1c' },
  cholesterol:   { min: 0,       max: 200,     unit: 'mg/dL',      label: 'Total Cholesterol' },
  hdl:           { min: 40,      max: 60,      unit: 'mg/dL',      label: 'HDL Cholesterol' },
  ldl:           { min: 0,       max: 130,     unit: 'mg/dL',      label: 'LDL Cholesterol' },
  vldl:          { min: 2,       max: 30,      unit: 'mg/dL',      label: 'VLDL Cholesterol' },
  tcHdlRatio:    { min: 0,       max: 5,       unit: '',           label: 'TC/HDL Ratio' },
  ldlHdlRatio:   { min: 0,       max: 3.5,     unit: '',           label: 'LDL/HDL Ratio' },
  triglycerides: { min: 0,       max: 150,     unit: 'mg/dL',      label: 'Triglycerides' },
  creatinine:    { min: 0.6,     max: 1.2,     unit: 'mg/dL',      label: 'Creatinine' },
  uricAcid:      { min: 3.5,     max: 7.2,     unit: 'mg/dL',      label: 'Uric Acid' },
  bilirubin:     { min: 0.2,     max: 1.2,     unit: 'mg/dL',      label: 'Total Bilirubin' },
  sgpt:          { min: 7,       max: 40,      unit: 'U/L',        label: 'SGPT (ALT)' },
  sgot:          { min: 10,      max: 40,      unit: 'U/L',        label: 'SGOT (AST)' },
  sodium:        { min: 136,     max: 145,     unit: 'mEq/L',      label: 'Sodium' },
  potassium:     { min: 3.5,     max: 5.1,     unit: 'mEq/L',      label: 'Potassium' },
  calcium:       { min: 8.5,     max: 10.5,    unit: 'mg/dL',      label: 'Calcium' },
  tsh:           { min: 0.4,     max: 4.0,     unit: 'µIU/mL',     label: 'TSH' },
  t3:            { min: 0.8,     max: 2.0,     unit: 'ng/mL',      label: 'T3 (Total)' },
  t4:            { min: 5.1,     max: 14.1,    unit: 'µg/dL',      label: 'T4 (Total)' },
  antiTpo:       { min: 0,       max: 34,      unit: 'IU/mL',      label: 'Anti TPO Antibody' },
  vitaminD:      { min: 20,      max: 100,     unit: 'ng/mL',      label: 'Vitamin D' },
  vitaminB12:    { min: 200,     max: 900,     unit: 'pg/mL',      label: 'Vitamin B12' },
  ferritin:      { min: 12,      max: 150,     unit: 'ng/mL',      label: 'Ferritin' },
  iron:          { min: 60,      max: 170,     unit: 'µg/dL',      label: 'Serum Iron' },
  esr:           { min: 0,       max: 20,      unit: 'mm/hr',      label: 'ESR' },
  crp:           { min: 0,       max: 5,       unit: 'mg/L',       label: 'CRP' },
}

// ─── CACHE for AI-fetched ranges (session only) ───────────────────────────────
const aiRangeCache = {}

// ─── ASK AI FOR UNKNOWN PARAMETER INFO ───────────────────────────────────────
const fetchRangeFromAI = async (key, label, value, unit) => {
  // Check cache first
  if (aiRangeCache[key]) return aiRangeCache[key]

  const MODELS = [
    'meta-llama/llama-3.1-8b-instruct:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'google/gemma-2-9b-it:free',
  ]

  const prompt = `You are a medical reference expert for Indian lab reports.

For this lab parameter: "${label || key}" with value ${value} ${unit}

Return ONLY a raw JSON object (no markdown, no explanation):
{
  "label": "Full proper name of this parameter",
  "unit": "standard unit used in India",
  "min": normal range minimum (number),
  "max": normal range maximum (number),
  "description": "one line what this parameter measures",
  "highEffect": "brief effect if high (1 sentence)",
  "lowEffect": "brief effect if low (1 sentence)",
  "tips": ["tip 1", "tip 2", "tip 3"]
}

Only return JSON. No text before or after.`

  for (const model of MODELS) {
    try {
      const completion = await openrouter.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500
      })

      let response = completion.choices[0].message.content.trim()
      response = response.replace(/```json/gi, '').replace(/```/gi, '').trim()

      const firstBrace = response.indexOf('{')
      const lastBrace = response.lastIndexOf('}')
      if (firstBrace === -1 || lastBrace === -1) continue

      const parsed = JSON.parse(response.substring(firstBrace, lastBrace + 1))
      if (parsed.min !== undefined && parsed.max !== undefined) {
        aiRangeCache[key] = parsed
        return parsed
      }
    } catch (err) {
      console.warn(`AI range fetch failed for ${key}:`, err.message)
      continue
    }
  }
  return null
}

// ─── ENRICH ALL PARAMETERS ────────────────────────────────────────────────────
// Finds unknown params and fetches their info from AI
export const enrichParameters = async (parameters, setProgress) => {
  const enriched = {}
  const unknownKeys = []

  // Separate known from unknown
  for (const [key, param] of Object.entries(parameters)) {
    if (KNOWN_RANGES[key]) {
      enriched[key] = {
        ...param,
        rangeInfo: KNOWN_RANGES[key]
      }
    } else {
      unknownKeys.push(key)
      enriched[key] = { ...param }
    }
  }

  // Fetch AI info for unknown parameters
  if (unknownKeys.length > 0) {
    setProgress && setProgress(`🔍 Looking up ${unknownKeys.length} new parameter(s)...`)

    for (const key of unknownKeys) {
      const param = parameters[key]
      const value = typeof param === 'object' ? param.value : param
      const unit = typeof param === 'object' ? param.unit : ''
      const label = typeof param === 'object' ? param.label : key

      const aiInfo = await fetchRangeFromAI(key, label, value, unit)

      if (aiInfo) {
        enriched[key] = {
          ...enriched[key],
          label: aiInfo.label || label,
          rangeInfo: {
            min: aiInfo.min,
            max: aiInfo.max,
            unit: aiInfo.unit || unit,
            label: aiInfo.label || label,
            description: aiInfo.description,
            highEffect: aiInfo.highEffect,
            lowEffect: aiInfo.lowEffect,
            tips: aiInfo.tips || [],
            aiGenerated: true
          }
        }
      } else {
        // No AI info — mark as recorded only
        enriched[key] = {
          ...enriched[key],
          rangeInfo: null
        }
      }
    }
  }

  return enriched
}

// ─── GET STATUS using rangeInfo ───────────────────────────────────────────────
export const getParameterStatus = (key, value, rangeInfo) => {
  if (!rangeInfo) return { status: 'Recorded', color: 'gray' }
  if (rangeInfo.min === 0 && rangeInfo.max === 0) return { status: 'Recorded', color: 'gray' }
  if (value < rangeInfo.min) return { status: 'Low', color: 'blue' }
  if (value > rangeInfo.max) return { status: 'High', color: 'red' }
  return { status: 'Normal', color: 'green' }
}