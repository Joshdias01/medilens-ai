import Tesseract from 'tesseract.js'
import OpenAI from 'openai'

// ─── INIT OPENROUTER ──────────────────────────────────────────────────────────
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: import.meta.env.VITE_AI_API_KEY,
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    'HTTP-Referer': 'https://medilens-ai.vercel.app',
    'X-Title': 'MediLens AI'
  }
})

// ─── STRIP PERSONAL INFO ──────────────────────────────────────────────────────
const stripPersonalInfo = (text) => {
  return text
    .replace(/\b(mr\.?|mrs\.?|ms\.?|miss|dr\.?)\s+[a-z\s]{2,30}/gi, '[NAME]')
    .replace(/uhid\s*[:\s]*[0-9a-z.]+/gi, '[ID]')
    .replace(/encounter\s*no\.?\s*[:\s]*[0-9]+/gi, '[ID]')
    .replace(/sample\s*no\.?\s*[:\s]*[0-9]+/gi, '[SAMPLE]')
    .replace(/visit\s*id\s*[:\s]*[a-z0-9]+/gi, '[ID]')
    .replace(/pid\s*no\.?\s*[:\s]*[a-z0-9]+/gi, '[ID]')
    .replace(/\b[6-9]\d{9}\b/g, '[PHONE]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/\b\d{1,3}\s*y(ears?)?\s*\/?\s*[mf]\b/gi, '[AGE]')
    .replace(/age\s*[:\s]*\d{1,3}\s*years?/gi, '[AGE]')
    .replace(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g, '[DATE]')
    .replace(/\d{1,2}[-\/][a-z]{3}[-\/]\d{2,4}/gi, '[DATE]')
    .replace(/\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?/gi, '[TIME]')
    .replace(/patient\s*name\s*[:\s]*[a-z\s.]+/gi, '[NAME]')
    .replace(/name\s*[:\s]*[a-z\s.]{3,30}/gi, '[NAME]')
    .trim()
}

// ─── EXTRACT REPORT DATE ──────────────────────────────────────────────────────
const extractReportDate = (rawText) => {
  const patterns = [
    /(?:collected|reported|sample\s*date|test\s*date|date\s*of\s*collection|date\s*of\s*report)[:\s]+(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    /(?:collected|reported|date)[:\s]+(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})/i,
    /\b(\d{2}[-\/]\d{2}[-\/]\d{4})\b/,
    /\b(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4})\b/,
  ]

  for (const pattern of patterns) {
    const match = rawText.match(pattern)
    if (match) {
      const rawDate = match[1]
      try {
        const parts = rawDate.split(/[-\/]/)
        if (parts.length === 3) {
          const monthNames = {
            jan:0,feb:1,mar:2,apr:3,may:4,jun:5,
            jul:6,aug:7,sep:8,oct:9,nov:10,dec:11
          }
          if (isNaN(parts[1])) {
            const month = monthNames[parts[1].toLowerCase().substring(0,3)]
            const d = new Date(parseInt(parts[2]), month, parseInt(parts[0]))
            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
          } else if (parseInt(parts[2]) > 31) {
            const d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
            return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
          }
        }
        return rawDate
      } catch { return rawDate }
    }
  }
  return null
}

// ─── EXTRACT PATIENT INFO ─────────────────────────────────────────────────────
export const extractPatientInfo = (rawText) => {
  const info = { name: null, age: null }

  const namePatterns = [
    /patient\s*name\s*[:\s]+([A-Za-z\s.]+?)(?:\n|age|uhid|pid|gender|sex|ref|visit|$)/i,
    /name\s*[:\s]+([A-Za-z\s.]+?)(?:\n|age|uhid|pid|gender|sex|visit|$)/i,
    /(?:mr\.?|mrs\.?|ms\.?|miss\.?)\s+([A-Za-z\s.]+?)(?:\n|\d|age|uhid|visit|$)/i,
  ]

  for (const pattern of namePatterns) {
    const match = rawText.match(pattern)
    if (match) {
      const extracted = match[1].trim()
        .replace(/\s+/g, ' ')
        .replace(/[^A-Za-z\s.]/g, '')
        .trim()
      if (extracted.length > 2) { info.name = extracted; break }
    }
  }

  const agePatterns = [
    /age\s*[:\s]+(\d{1,3})\s*(?:y|yr|year)/i,
    /(\d{1,3})\s*(?:y|yr|years?)\s*(?:\/|0\s*m|\s*old)/i,
    /age\s*\/?\s*gender\s*[:\s]+(\d{1,3})/i,
    /(\d{1,3})\s*Y\s*\d+\s*M/i,
    /AGE\s*[:\s]+(\d{1,3})\s*Years/i,
  ]

  for (const pattern of agePatterns) {
    const match = rawText.match(pattern)
    if (match) {
      const age = parseInt(match[1])
      if (age > 0 && age < 120) { info.age = age; break }
    }
  }

  return info
}

// ─── VERIFY REPORT OWNERSHIP ──────────────────────────────────────────────────
export const verifyReportOwnership = (rawText, userProfile) => {
  const reportInfo = extractPatientInfo(rawText)
  const result = {
    nameMatch: null,
    ageMatch: null,
    reportName: reportInfo.name,
    reportAge: reportInfo.age,
    verified: true,
    warning: null
  }

  if (!reportInfo.name && !reportInfo.age) {
    result.warning = 'Could not find patient info in report to verify.'
    return result
  }

  if (reportInfo.name && userProfile?.name) {
    const reportWords = reportInfo.name.toLowerCase().split(' ').filter(w => w.length > 1)
    const userWords = userProfile.name.toLowerCase().split(' ').filter(w => w.length > 1)
    const commonWords = reportWords.filter(w =>
      userWords.some(uw => uw.includes(w) || w.includes(uw))
    )
    result.nameMatch = commonWords.length > 0
  }

  if (reportInfo.age && userProfile?.age) {
    result.ageMatch = Math.abs(reportInfo.age - parseInt(userProfile.age)) <= 2
  }

  if (result.nameMatch === false && result.ageMatch === false) {
    result.verified = false
    result.warning = `This report appears to belong to "${reportInfo.name}" (Age: ${reportInfo.age}), not your profile. Please upload your own report.`
  } else if (result.nameMatch === false && result.ageMatch === null) {
    result.verified = false
    result.warning = `Name mismatch — report is for "${reportInfo.name}" but your profile shows "${userProfile?.name}".`
  }

  return result
}

// ─── AI EXTRACTION ────────────────────────────────────────────────────────────
const extractWithAI = async (rawText) => {
  const cleanText = stripPersonalInfo(rawText)

  const MODELS = [
    'openrouter/auto',                              // Auto-selects best available free model
    'meta-llama/llama-3.1-8b-instruct:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'google/gemma-2-9b-it:free',
    'microsoft/phi-3-mini-128k-instruct:free',
    'deepseek/deepseek-v3-base:free',
  ]

  const messages = [
    {
      role: 'system',
      content: 'You are a medical lab report parser for Indian labs. Extract ALL test parameters. Return ONLY raw JSON, no markdown, no backticks, no explanation whatsoever.'
    },
    {
      role: 'user',
      content: `Extract ALL lab test parameters from this Indian medical report text.

IMPORTANT RULES:
1. The value might appear MANY lines after the parameter name — search the entire text
2. Extract EVERY parameter with a numeric result
3. Return ONLY raw JSON — absolutely no markdown or backticks
4. Format: {"keyName": {"value": number, "unit": "string", "label": "Full Name"}}
5. Standard keys to use:
   hemoglobin, wbc, rbc, pcv, mcv, mch, mchc, platelets, rdw,
   neutrophils, lymphocytes, eosinophils, monocytes, basophils,
   aec, alc, anc, glucose, ppGlucose, hba1c,
   cholesterol, hdl, ldl, triglycerides,
   creatinine, uricAcid, bilirubin, sgpt, sgot,
   sodium, potassium, calcium, tsh, t3, t4, antiTpo,
   vitaminD, vitaminB12, ferritin, iron, esr, crp
6. For antiTPO antibody use key: antiTpo
7. Do NOT include reference ranges as values
8. Only extract clearly numeric results

REPORT TEXT:
${cleanText}

JSON:`
    }
  ]

  for (const model of MODELS) {
    try {
      console.log(`Trying model: ${model}`)
      const completion = await openrouter.chat.completions.create({
        model,
        messages,
        temperature: 0.1,
        max_tokens: 2000
      })

      let response = completion.choices[0].message.content.trim()
      console.log('=== AI RAW RESPONSE ===', response)

      response = response.replace(/```json/gi, '').replace(/```/gi, '').trim()
      const firstBrace = response.indexOf('{')
      const lastBrace = response.lastIndexOf('}')
      if (firstBrace === -1 || lastBrace === -1) continue

      const parsed = JSON.parse(response.substring(firstBrace, lastBrace + 1))
      if (Object.keys(parsed).length > 0) return parsed
    } catch (err) {
      console.warn(`Model ${model} failed:`, err.message)
      // Small delay before trying next model to avoid rate limit cascade
      await new Promise(r => setTimeout(r, 500))
      continue
    }
  }

  throw new Error('All AI models failed')
}

// ─── SMART FALLBACK ───────────────────────────────────────────────────────────
const fallbackExtract = (rawText) => {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0)

  const extracted = {}

  const PARAMS = [
    { key: 'hemoglobin',    label: 'Hemoglobin',            unit: 'g/dL',       pattern: /haemoglobin|hemoglobin|\bhgb\b/i,                            min: 3,      max: 25,      lookahead: 8  },
    { key: 'wbc',           label: 'WBC / Total Count',      unit: 'cells/µL',   pattern: /tc\s*\(total|total\s*count|\bwbc\b|\btlc\b|leukocyte/i,      min: 500,    max: 100000,  lookahead: 8  },
    { key: 'rbc',           label: 'RBC Count',              unit: 'million/µL', pattern: /rbc\s*count|red\s*blood\s*cell|\brbc\b/i,                    min: 1,      max: 10,      lookahead: 8  },
    { key: 'pcv',           label: 'PCV / Hematocrit',       unit: '%',          pattern: /pcv\s*\(packed|packed\s*cell|\bpcv\b|\bhct\b/i,              min: 10,     max: 70,      lookahead: 8  },
    { key: 'mcv',           label: 'MCV',                    unit: 'fL',         pattern: /\bmcv\b|mean\s*corpuscular\s*vol/i,                          min: 50,     max: 130,     lookahead: 8  },
    { key: 'mch',           label: 'MCH',                    unit: 'pg',         pattern: /\bmch\b(?!c)/i,                                              min: 10,     max: 50,      lookahead: 8  },
    { key: 'mchc',          label: 'MCHC',                   unit: 'g/dL',       pattern: /\bmchc\b|mean\s*corpuscular\s*haemoglobin\s*conc/i,          min: 20,     max: 40,      lookahead: 8  },
    { key: 'platelets',     label: 'Platelet Count',          unit: 'cells/µL',   pattern: /platelet\s*count|platelet|\bplt\b/i,                         min: 10000,  max: 1500000, lookahead: 8  },
    { key: 'rdw',           label: 'RDW-CV',                 unit: '%',          pattern: /rdw\s*[-–]?\s*cv|\brdwcv\b|\brdw\b/i,                       min: 8,      max: 30,      lookahead: 8  },
    { key: 'neutrophils',   label: 'Neutrophils',            unit: '%',          pattern: /^neutrophil/i,                                               min: 20,     max: 90,      lookahead: 8  },
    { key: 'lymphocytes',   label: 'Lymphocytes',            unit: '%',          pattern: /^lymphocyte/i,                                               min: 10,     max: 60,      lookahead: 8  },
    { key: 'eosinophils',   label: 'Eosinophils',            unit: '%',          pattern: /^eosinophil/i,                                               min: 0.5,    max: 20,      lookahead: 8  },
    { key: 'monocytes',     label: 'Monocytes',              unit: '%',          pattern: /^monocyte/i,                                                 min: 1,      max: 20,      lookahead: 8  },
    { key: 'basophils',     label: 'Basophils',              unit: '%',          pattern: /^basophil/i,                                                 min: 0,      max: 5,       lookahead: 8  },
    { key: 'aec',           label: 'Abs. Eosinophil Count',  unit: 'cells/µL',   pattern: /absolute\s*eosinophil|\baec\b/i,                             min: 20,     max: 5000,    lookahead: 8  },
    { key: 'alc',           label: 'Abs. Lymphocyte Count',  unit: 'cells/µL',   pattern: /absolute\s*lymphocyte|\balc\b/i,                             min: 500,    max: 10000,   lookahead: 8  },
    { key: 'anc',           label: 'Abs. Neutrophil Count',  unit: 'cells/µL',   pattern: /absolute\s*neutrophil|\banc\b/i,                             min: 1000,   max: 20000,   lookahead: 8  },
    { key: 'glucose',       label: 'Fasting Glucose',        unit: 'mg/dL',      pattern: /fasting.*sugar|fasting.*glucose|blood\s*sugar|blood\s*glucose|\bfbs\b|\bfbg\b/i, min: 50, max: 800, lookahead: 8 },
    { key: 'ppGlucose',     label: 'PP Glucose',             unit: 'mg/dL',      pattern: /post\s*prandial|pp\s*blood\s*sugar|\bppbs\b/i,               min: 50,     max: 800,     lookahead: 8  },
    { key: 'hba1c',         label: 'HbA1c',                  unit: '%',          pattern: /hba1c|hb\s*a1c|glycated\s*haemo|glycosylated/i,              min: 4,      max: 20,      lookahead: 8  },
    { key: 'cholesterol',   label: 'Total Cholesterol',      unit: 'mg/dL',      pattern: /total\s*cholesterol|serum\s*cholesterol/i,                   min: 100,    max: 600,     lookahead: 8  },
    { key: 'hdl',           label: 'HDL Cholesterol',        unit: 'mg/dL',      pattern: /hdl\s*cholesterol|\bhdl\b|high\s*density/i,                 min: 20,     max: 200,     lookahead: 8  },
    { key: 'ldl',           label: 'LDL Cholesterol',        unit: 'mg/dL',      pattern: /ldl\s*cholesterol|\bldl\b|low\s*density/i,                  min: 20,     max: 400,     lookahead: 8  },
    { key: 'triglycerides', label: 'Triglycerides',          unit: 'mg/dL',      pattern: /triglyceride|\btg\b/i,                                       min: 30,     max: 2000,    lookahead: 8  },
    { key: 'creatinine',    label: 'Creatinine',             unit: 'mg/dL',      pattern: /creatinine|s\.?\s*creat/i,                                   min: 0.3,    max: 20,      lookahead: 8  },
    { key: 'uricAcid',      label: 'Uric Acid',              unit: 'mg/dL',      pattern: /uric\s*acid/i,                                               min: 1,      max: 20,      lookahead: 8  },
    { key: 'bilirubin',     label: 'Total Bilirubin',        unit: 'mg/dL',      pattern: /total\s*bilirubin|bilirubin/i,                               min: 0.1,    max: 30,      lookahead: 8  },
    { key: 'sgpt',          label: 'SGPT (ALT)',             unit: 'U/L',        pattern: /\bsgpt\b|\balt\b|alanine\s*amino/i,                          min: 5,      max: 2000,    lookahead: 8  },
    { key: 'sgot',          label: 'SGOT (AST)',             unit: 'U/L',        pattern: /\bsgot\b|\bast\b|aspartate\s*amino/i,                        min: 5,      max: 2000,    lookahead: 8  },
    { key: 'sodium',        label: 'Sodium',                 unit: 'mEq/L',      pattern: /\bsodium\b/i,                                                min: 120,    max: 180,     lookahead: 8  },
    { key: 'potassium',     label: 'Potassium',              unit: 'mEq/L',      pattern: /\bpotassium\b/i,                                             min: 2.5,    max: 8,       lookahead: 8  },
    { key: 'calcium',       label: 'Calcium',                unit: 'mg/dL',      pattern: /\bcalcium\b/i,                                               min: 6,      max: 15,      lookahead: 8  },
    { key: 'tsh',           label: 'TSH',                    unit: 'µIU/mL',     pattern: /tsh\s*\(?ultra|tsh\s*\(4th|\btsh\b/i,                       min: 0.05,   max: 50,      lookahead: 25 },
    { key: 't3',            label: 'T3 (Total)',             unit: 'ng/mL',      pattern: /t3\s*\(total\)|tri[\s-]*iodothyronine/i,                     min: 0.5,    max: 5,       lookahead: 15 },
    { key: 't4',            label: 'T4 (Total)',             unit: 'µg/dL',      pattern: /t4\s*\(total\)|thyroxine/i,                                  min: 3,      max: 25,      lookahead: 15 },
    { key: 'antiTpo',       label: 'Anti TPO Antibody',      unit: 'IU/mL',      pattern: /anti\s*tpo|anti\s*thyroid\s*peroxidase|thyroid\s*peroxidase\s*antibody/i, min: 0.1, max: 10000, lookahead: 20 },
    { key: 'vitaminD',      label: 'Vitamin D',              unit: 'ng/mL',      pattern: /vitamin\s*d|vit\.?\s*d|25\s*oh/i,                            min: 1,      max: 200,     lookahead: 8  },
    { key: 'vitaminB12',    label: 'Vitamin B12',            unit: 'pg/mL',      pattern: /vitamin\s*b\s*12|vit\.?\s*b12|cobalamin/i,                   min: 50,     max: 3000,    lookahead: 8  },
    { key: 'ferritin',      label: 'Ferritin',               unit: 'ng/mL',      pattern: /ferritin/i,                                                   min: 2,      max: 2000,    lookahead: 8  },
    { key: 'iron',          label: 'Serum Iron',             unit: 'µg/dL',      pattern: /serum\s*iron|\biron\b/i,                                      min: 20,     max: 300,     lookahead: 8  },
    { key: 'esr',           label: 'ESR',                    unit: 'mm/hr',      pattern: /\besr\b|erythrocyte\s*sed/i,                                 min: 0,      max: 140,     lookahead: 8  },
    { key: 'crp',           label: 'CRP',                    unit: 'mg/L',       pattern: /\bcrp\b|c[\s-]*reactive\s*protein/i,                         min: 0,      max: 300,     lookahead: 8  },
  ]

  // Lines to SKIP — these are not result values
  const skipPattern = /automated|calculated|flow\s*cyt|detection|manual|leishman|focusing|cumulative|hydrodynamic|eclia|chemilum|first\s*trim|second\s*trim|third\s*trim|within\s*range|raised|decreased|method|american|association|kindly|correlat|trimester|remark|outside|sample|report\s*status|processed|consultant|reference\s*range|biological|page\s*\d|terms|conditions|disclaimer|end\s*of\s*report|mc-\d/i

  // Lines that look like reference ranges — e.g. "0.40 - 4.20" or "0.1-2.5"
  const isRefRange = (line) => {
    return /^\s*\d+\.?\d*\s*[-–]\s*\d+\.?\d*\s*$/.test(line) ||
           /reference|ref\.?\s*range|bio\.?\s*ref|normal\s*range/i.test(line) ||
           /^\s*\*\d/.test(line) // lines starting with *number (trimester ranges)
  }

  for (const param of PARAMS) {
    if (extracted[param.key]) continue
    const lookahead = param.lookahead || 8

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!param.pattern.test(line)) continue

      // ── Strategy A: Inline — number RIGHT AFTER param name ──────────────
      const matchResult = line.match(param.pattern)
      if (matchResult) {
        const afterName = line.substring(matchResult.index + matchResult[0].length)
        // Skip if what comes after looks like a ref range
        if (!isRefRange(afterName)) {
          const firstNumMatch = afterName.match(/\b([0-9]+\.?[0-9]*)\b/)
          if (firstNumMatch) {
            let val = parseFloat(firstNumMatch[1])
            if (param.key === 'platelets' && val < 1000) val = val * 1000
            if (param.key === 'wbc' && val < 500) val = val * 1000
            if (val >= param.min && val <= param.max) {
              extracted[param.key] = { value: val, unit: param.unit, label: param.label }
              break
            }
          }
        }
      }

      // ── Strategy B: Multi-line — skip ref ranges and methodology ────────
      if (!extracted[param.key]) {
        for (let j = i + 1; j <= Math.min(i + lookahead, lines.length - 1); j++) {
          const nextLine = lines[j]

          // Skip methodology/comment lines
          if (skipPattern.test(nextLine)) continue

          // Skip reference range lines like "0.40 - 4.20"
          if (isRefRange(nextLine)) continue

          // Skip lines with dashes only or empty
          if (/^[-–\s*]+$/.test(nextLine)) continue

          // Match standalone number (the result value)
          const numMatch = nextLine.match(/^\s*([0-9]+\.?[0-9]*)\s*$/) ||
                           nextLine.match(/^([0-9]+\.?[0-9]*)(?:\s|$)/)

          if (numMatch) {
            let val = parseFloat(numMatch[1])
            if (param.key === 'platelets' && val < 1000) val = val * 1000
            if (param.key === 'wbc' && val < 500) val = val * 1000
            if (val >= param.min && val <= param.max) {
              extracted[param.key] = { value: val, unit: param.unit, label: param.label }
              break
            }
          }

          // Also check: number at END of line after spaces
          const endNum = nextLine.match(/\s{2,}([0-9]+\.?[0-9]*)\s*$/)
          if (endNum) {
            let val = parseFloat(endNum[1])
            if (param.key === 'platelets' && val < 1000) val = val * 1000
            if (param.key === 'wbc' && val < 500) val = val * 1000
            if (val >= param.min && val <= param.max) {
              extracted[param.key] = { value: val, unit: param.unit, label: param.label }
              break
            }
          }
        }
      }

      if (extracted[param.key]) break
    }
  }

  return extracted
}

// ─── PDF EXTRACTION ───────────────────────────────────────────────────────────
const extractTextFromPDF = async (file, setProgress) => {
  setProgress('📑 Reading PDF...')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result)
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).toString()
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise
        let fullText = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          setProgress(`📄 Reading page ${i} of ${pdf.numPages}...`)
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          const items = content.items
          let lastY = null
          let lineText = ''
          for (const item of items) {
            if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
              fullText += lineText.trim() + '\n'
              lineText = ''
            }
            lineText += item.str + ' '
            lastY = item.transform[5]
          }
          fullText += lineText.trim() + '\n'
        }
        resolve(fullText)
      } catch (err) { reject(err) }
    }
    reader.readAsArrayBuffer(file)
  })
}

// ─── IMAGE OCR ────────────────────────────────────────────────────────────────
const extractTextFromImage = async (file, setProgress) => {
  setProgress('🔍 Running OCR on image...')
  const result = await Tesseract.recognize(file, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        setProgress(`🔍 OCR Progress: ${Math.round(m.progress * 100)}%`)
      }
    }
  })
  return result.data.text
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export const processReport = async (file, userProfile, setProgress) => {
  try {
    let rawText = ''

    if (file.type === 'application/pdf') {
      rawText = await extractTextFromPDF(file, setProgress)
    } else {
      rawText = await extractTextFromImage(file, setProgress)
    }

    console.log('=== RAW OCR TEXT ===')
    console.log(rawText)
    console.log('===================')

    setProgress('🔬 Analyzing your report...')
    await new Promise(r => setTimeout(r, 300))

    let parameters = {}
    let usedFallback = false

    try {
      parameters = await extractWithAI(rawText)
      console.log('=== AI EXTRACTED ===', parameters)
      if (Object.keys(parameters).length < 2) {
        const fallbackData = fallbackExtract(rawText)
        parameters = { ...fallbackData, ...parameters }
        usedFallback = true
      }
    } catch (aiError) {
      console.warn('AI failed, using fallback:', aiError.message)
      parameters = fallbackExtract(rawText)
      usedFallback = true
    }

    console.log('=== FINAL PARAMETERS ===')
    console.log(parameters)

    if (Object.keys(parameters).length === 0) {
      return {
        success: false,
        error: 'No health parameters found. Please ensure the report is clear.'
      }
    }

    const reportDate = extractReportDate(rawText)
    const ownership = verifyReportOwnership(rawText, userProfile)

    setProgress('✅ Done! Preparing your results...')
    await new Promise(r => setTimeout(r, 300))

    return {
      success: true,
      data: {
        parameters,
        rawText: rawText.substring(0, 1000),
        fileName: file.name,
        fileType: file.type,
        processedAt: new Date().toISOString(),
        reportDate: reportDate || null,
        usedFallback,
        ownership
      }
    }
  } catch (error) {
    console.error('Processing Error:', error)
    return { success: false, error: error.message }
  }
}