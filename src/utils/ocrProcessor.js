import Tesseract from 'tesseract.js'
import OpenAI from 'openai'

// ─── INIT OPENROUTER ─────────────────────────────────────────────────────────
const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: import.meta.env.VITE_AI_API_KEY,
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    'HTTP-Referer': 'https://medilens-ai.vercel.app',
    'X-Title': 'MediLens AI'
  }
})

// ─── STRIP PERSONAL INFO ─────────────────────────────────────────────────────
const stripPersonalInfo = (text) => {
  return text
    .replace(/\b(mr\.?|mrs\.?|ms\.?|miss|dr\.?)\s+[a-z\s]{2,30}/gi, '[NAME]')
    .replace(/uhid\s*[:\s]*[0-9a-z.]+/gi, '[ID]')
    .replace(/encounter\s*no\.?\s*[:\s]*[0-9]+/gi, '[ID]')
    .replace(/sample\s*no\.?\s*[:\s]*[0-9]+/gi, '[SAMPLE]')
    .replace(/visit\s*id\s*[:\s]*[a-z0-9]+/gi, '[ID]')
    .replace(/\b[6-9]\d{9}\b/g, '[PHONE]')
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
    .replace(/\b\d{1,3}\s*y(ears?)?\s*\/?\s*[mf]\b/gi, '[AGE]')
    .replace(/\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/g, '[DATE]')
    .replace(/\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?/gi, '[TIME]')
    .replace(/patient\s*name\s*[:\s]*[a-z\s.]+/gi, '[NAME]')
    .trim()
}

// ─── AI EXTRACTION ────────────────────────────────────────────────────────────
const extractWithAI = async (rawText) => {
  const cleanText = stripPersonalInfo(rawText)

  const completion = await openrouter.chat.completions.create({
    model: 'google/gemini-2.0-flash-exp:free',
    messages: [
      {
        role: 'system',
        content: `You are a medical lab report parser for Indian laboratory reports. 
Extract ALL test parameters from the raw text and return ONLY a valid JSON object.
No markdown, no backticks, no explanation — just pure JSON.`
      },
      {
        role: 'user',
        content: `Extract all lab parameters from this Indian medical report text.

RULES:
1. Extract EVERY test parameter with a numeric result
2. Return ONLY raw JSON — no markdown, no backticks
3. Format: {"keyName": {"value": number, "unit": "string", "label": "Full Parameter Name"}}
4. Use these standard key names:
   hemoglobin, wbc, rbc, pcv, mcv, mch, mchc, platelets, rdw,
   neutrophils, lymphocytes, eosinophils, monocytes, basophils,
   aec, alc, anc, glucose, ppGlucose, hba1c,
   cholesterol, hdl, ldl, triglycerides,
   creatinine, uricAcid, bilirubin, sgpt, sgot,
   sodium, potassium, calcium, tsh, t3, t4,
   vitaminD, vitaminB12, ferritin, iron, esr, crp
5. For unknown parameters use camelCase
6. Do NOT include reference ranges as values
7. Only include numeric results
8. Convert to standard Indian units:
   - Hemoglobin → g/dL
   - Glucose, Cholesterol, LDL, HDL, Triglycerides, Creatinine, Uric Acid → mg/dL
   - WBC, Platelets → cells/µL
   - TSH → µIU/mL, HbA1c → %, SGPT/SGOT → U/L

EXAMPLE OUTPUT:
{"hemoglobin":{"value":12.8,"unit":"g/dL","label":"Haemoglobin"},"wbc":{"value":5830,"unit":"cells/µL","label":"Total Count"}}

REPORT TEXT:
${cleanText}

JSON:`
      }
    ],
    temperature: 0.1,
    max_tokens: 2000
  })

  let response = completion.choices[0].message.content.trim()

  console.log('=== AI RAW RESPONSE ===')
  console.log(response)
  console.log('=======================')

  // Clean any markdown if present
  response = response.replace(/```json/gi, '').replace(/```/gi, '').trim()

  // Extract JSON object
  const firstBrace = response.indexOf('{')
  const lastBrace = response.lastIndexOf('}')

  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON found in AI response')
  }

  const jsonString = response.substring(firstBrace, lastBrace + 1)
  return JSON.parse(jsonString)
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
    { key: 'hemoglobin',    label: 'Hemoglobin',            unit: 'g/dL',       pattern: /haemoglobin|hemoglobin|\bhgb\b/i,                            min: 3,      max: 25      },
    { key: 'wbc',           label: 'WBC / Total Count',      unit: 'cells/µL',   pattern: /tc\s*\(total|total\s*count|\bwbc\b|\btlc\b|leukocyte/i,      min: 500,    max: 100000  },
    { key: 'rbc',           label: 'RBC Count',              unit: 'million/µL', pattern: /rbc\s*count|red\s*blood\s*cell|\brbc\b/i,                    min: 1,      max: 10      },
    { key: 'pcv',           label: 'PCV / Hematocrit',       unit: '%',          pattern: /pcv\s*\(packed|packed\s*cell|\bpcv\b|\bhct\b/i,              min: 10,     max: 70      },
    { key: 'mcv',           label: 'MCV',                    unit: 'fL',         pattern: /\bmcv\b|mean\s*corpuscular\s*vol/i,                          min: 50,     max: 130     },
    { key: 'mch',           label: 'MCH',                    unit: 'pg',         pattern: /\bmch\b(?!c)/i,                                              min: 10,     max: 50      },
    { key: 'mchc',          label: 'MCHC',                   unit: 'g/dL',       pattern: /\bmchc\b|mean\s*corpuscular\s*haemoglobin\s*conc/i,          min: 20,     max: 40      },
    { key: 'platelets',     label: 'Platelet Count',          unit: 'cells/µL',   pattern: /platelet\s*count|platelet|\bplt\b/i,                         min: 10000,  max: 1500000 },
    { key: 'rdw',           label: 'RDW-CV',                 unit: '%',          pattern: /rdw\s*[-–]?\s*cv|\brdwcv\b|\brdw\b/i,                       min: 8,      max: 30      },
    { key: 'neutrophils',   label: 'Neutrophils',            unit: '%',          pattern: /^neutrophil/i,                                               min: 20,     max: 90      },
    { key: 'lymphocytes',   label: 'Lymphocytes',            unit: '%',          pattern: /^lymphocyte/i,                                               min: 10,     max: 60      },
    { key: 'eosinophils',   label: 'Eosinophils',            unit: '%',          pattern: /^eosinophil/i,                                               min: 0,      max: 20      },
    { key: 'monocytes',     label: 'Monocytes',              unit: '%',          pattern: /^monocyte/i,                                                 min: 0,      max: 20      },
    { key: 'basophils',     label: 'Basophils',              unit: '%',          pattern: /^basophil/i,                                                 min: 0,      max: 5       },
    { key: 'aec',           label: 'Abs. Eosinophil Count',  unit: 'cells/µL',   pattern: /absolute\s*eosinophil|\baec\b/i,                             min: 20,     max: 5000    },
    { key: 'alc',           label: 'Abs. Lymphocyte Count',  unit: 'cells/µL',   pattern: /absolute\s*lymphocyte|\balc\b/i,                             min: 500,    max: 10000   },
    { key: 'anc',           label: 'Abs. Neutrophil Count',  unit: 'cells/µL',   pattern: /absolute\s*neutrophil|\banc\b/i,                             min: 1000,   max: 20000   },
    { key: 'glucose',       label: 'Fasting Glucose',        unit: 'mg/dL',      pattern: /fasting.*sugar|fasting.*glucose|blood\s*sugar|blood\s*glucose|\bfbs\b|\bfbg\b/i, min: 50, max: 800 },
    { key: 'ppGlucose',     label: 'PP Glucose',             unit: 'mg/dL',      pattern: /post\s*prandial|pp\s*blood\s*sugar|\bppbs\b/i,               min: 50,     max: 800     },
    { key: 'hba1c',         label: 'HbA1c',                  unit: '%',          pattern: /hba1c|hb\s*a1c|glycated\s*haemo|glycosylated/i,              min: 4,      max: 20      },
    { key: 'cholesterol',   label: 'Total Cholesterol',      unit: 'mg/dL',      pattern: /total\s*cholesterol|serum\s*cholesterol/i,                   min: 100,    max: 600     },
    { key: 'hdl',           label: 'HDL Cholesterol',        unit: 'mg/dL',      pattern: /hdl\s*cholesterol|\bhdl\b|high\s*density/i,                 min: 20,     max: 200     },
    { key: 'ldl',           label: 'LDL Cholesterol',        unit: 'mg/dL',      pattern: /ldl\s*cholesterol|\bldl\b|low\s*density/i,                  min: 20,     max: 400     },
    { key: 'triglycerides', label: 'Triglycerides',          unit: 'mg/dL',      pattern: /triglyceride|\btg\b/i,                                       min: 30,     max: 2000    },
    { key: 'creatinine',    label: 'Creatinine',             unit: 'mg/dL',      pattern: /creatinine|s\.?\s*creat/i,                                   min: 0.3,    max: 20      },
    { key: 'uricAcid',      label: 'Uric Acid',              unit: 'mg/dL',      pattern: /uric\s*acid/i,                                               min: 1,      max: 20      },
    { key: 'bilirubin',     label: 'Total Bilirubin',        unit: 'mg/dL',      pattern: /total\s*bilirubin|bilirubin/i,                               min: 0.1,    max: 30      },
    { key: 'sgpt',          label: 'SGPT (ALT)',             unit: 'U/L',        pattern: /\bsgpt\b|\balt\b|alanine\s*amino/i,                          min: 5,      max: 2000    },
    { key: 'sgot',          label: 'SGOT (AST)',             unit: 'U/L',        pattern: /\bsgot\b|\bast\b|aspartate\s*amino/i,                        min: 5,      max: 2000    },
    { key: 'sodium',        label: 'Sodium',                 unit: 'mEq/L',      pattern: /\bsodium\b/i,                                                min: 120,    max: 180     },
    { key: 'potassium',     label: 'Potassium',              unit: 'mEq/L',      pattern: /\bpotassium\b/i,                                             min: 2.5,    max: 8       },
    { key: 'calcium',       label: 'Calcium',                unit: 'mg/dL',      pattern: /\bcalcium\b/i,                                               min: 6,      max: 15      },
    // Thyroid — tight ranges to avoid wrong matches
    { key: 'tsh',           label: 'TSH',                    unit: 'µIU/mL',     pattern: /tsh\s*\(ultrasensitive\)|tsh\s*\(4th|tsh\s*ultrasensitive|\btsh\b/i, min: 0.1, max: 50 },
    { key: 't3',            label: 'T3 (Total)',             unit: 'ng/mL',      pattern: /t3\s*\(total\)|tri[\s-]*iodothyronine/i,                     min: 0.5,    max: 5       },
    { key: 't4',            label: 'T4 (Total)',             unit: 'µg/dL',      pattern: /t4\s*\(total\)|thyroxine/i,                                  min: 3,      max: 25      },
    { key: 'vitaminD',      label: 'Vitamin D',              unit: 'ng/mL',      pattern: /vitamin\s*d|vit\.?\s*d|25\s*oh/i,                            min: 1,      max: 200     },
    { key: 'vitaminB12',    label: 'Vitamin B12',            unit: 'pg/mL',      pattern: /vitamin\s*b\s*12|vit\.?\s*b12|cobalamin/i,                   min: 50,     max: 3000    },
    { key: 'ferritin',      label: 'Ferritin',               unit: 'ng/mL',      pattern: /ferritin/i,                                                   min: 2,      max: 2000    },
    { key: 'iron',          label: 'Serum Iron',             unit: 'µg/dL',      pattern: /serum\s*iron|\biron\b/i,                                      min: 20,     max: 300     },
    { key: 'esr',           label: 'ESR',                    unit: 'mm/hr',      pattern: /\besr\b|erythrocyte\s*sed/i,                                 min: 0,      max: 140     },
    { key: 'crp',           label: 'CRP',                    unit: 'mg/L',       pattern: /\bcrp\b|c[\s-]*reactive\s*protein/i,                         min: 0,      max: 300     },
  ]

  for (const param of PARAMS) {
    if (extracted[param.key]) continue

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!param.pattern.test(line)) continue

      // ── Strategy A: Inline — pick the FIRST number after the parameter name ──
      // e.g. "T3 (Total)   0.88   ng/mL   0.84-2.01"
      // We split at the match position and look at what comes AFTER the name
      const matchResult = line.match(param.pattern)
      if (matchResult) {
        const afterName = line.substring(matchResult.index + matchResult[0].length)
        // Get first number after the parameter name
        const firstNumMatch = afterName.match(/([0-9]+\.?[0-9]*)/)
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

      // ── Strategy B: Multi-line — value on next lines ──────────────────────
      // e.g. CBC format where value is 2-3 lines below name
      if (!extracted[param.key]) {
        for (let j = i + 1; j <= Math.min(i + 5, lines.length - 1); j++) {
          const nextLine = lines[j]
          // Skip methodology/comment lines
          if (/automated|calculated|flow\s*cyt|detection|manual|leishman|focusing|cumulative|hydrodynamic|eclia|chemilum|first\s*trim|second\s*trim|third\s*trim|within\s*range|raised|decreased/i.test(nextLine)) continue
          const numMatch = nextLine.match(/^([0-9]+\.?[0-9]*)/)
          if (numMatch) {
            let val = parseFloat(numMatch[1])
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
export const processReport = async (file, user, setProgress) => {
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
      console.log('=== AI EXTRACTED ===')
      console.log(parameters)

      // If AI returns too few, supplement with fallback
      if (Object.keys(parameters).length < 3) {
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
        usedFallback
      }
    }
  } catch (error) {
    console.error('Processing Error:', error)
    return { success: false, error: error.message }
  }
}