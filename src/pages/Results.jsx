import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, ArrowLeft, RefreshCw, Save, FileText, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { saveReport } from '../utils/saveReport'

const NORMAL_RANGES = {
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
  vitaminD:      { min: 20,      max: 100,     unit: 'ng/mL',      label: 'Vitamin D' },
  vitaminB12:    { min: 200,     max: 900,     unit: 'pg/mL',      label: 'Vitamin B12' },
  ferritin:      { min: 12,      max: 150,     unit: 'ng/mL',      label: 'Ferritin' },
  iron:          { min: 60,      max: 170,     unit: 'µg/dL',      label: 'Serum Iron' },
  esr:           { min: 0,       max: 20,      unit: 'mm/hr',      label: 'ESR' },
  crp:           { min: 0,       max: 5,       unit: 'mg/L',       label: 'CRP' },
  antiTpo: { min: 0, max: 34, unit: 'IU/mL', label: 'Anti TPO Antibody' },
}

const getStatus = (key, value) => {
  const range = NORMAL_RANGES[key]
  if (!range) return { status: 'Recorded', color: 'gray' }
  if (value < range.min) return { status: 'Low', color: 'blue' }
  if (value > range.max) return { status: 'High', color: 'red' }
  return { status: 'Normal', color: 'green' }
}

const statusColors = {
  green: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700', text: 'text-green-700' },
  red:   { bg: 'bg-red-50',   border: 'border-red-200',   badge: 'bg-red-100 text-red-700',     text: 'text-red-700'   },
  blue:  { bg: 'bg-blue-50',  border: 'border-blue-200',  badge: 'bg-blue-100 text-blue-700',   text: 'text-blue-700'  },
  gray:  { bg: 'bg-gray-50',  border: 'border-gray-200',  badge: 'bg-gray-100 text-gray-600',   text: 'text-gray-600'  },
}

export default function Results({ user }) {
  const location = useLocation()
  const navigate = useNavigate()
  const reportData = location.state?.reportData
  const originalFile = location.state?.originalFile || null
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  // Create local preview URL from file object (works before saving)
  const localFileURL = originalFile ? URL.createObjectURL(originalFile) : null
  const isPDF = originalFile?.type === 'application/pdf'
  const isTooBig = originalFile && originalFile.size >= 900 * 1024

  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-4">No report data found.</p>
          <button
            onClick={() => navigate('/upload')}
            className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold"
          >
            Upload a Report
          </button>
        </div>
      </div>
    )
  }

  const { parameters, fileName, reportDate } = reportData
  const paramKeys = Object.keys(parameters)

  const abnormalCount = paramKeys.filter(k => {
    const p = parameters[k]
    const val = typeof p === 'object' ? p.value : p
    const { status } = getStatus(k, val)
    return status === 'High' || status === 'Low'
  }).length

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveReport(user.uid, reportData, originalFile)
      if (result.success) {
        setSaved(true)
        toast.success('Report saved successfully!')
      } else {
        toast.error('Failed to save: ' + result.error)
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to save report')
    } finally {
      setSaving(false)
    }
  }

  const handleViewOriginal = () => {
    if (localFileURL) {
      window.open(localFileURL, '_blank')
    } else if (reportData?.fileData) {
      // If loaded from Firestore (saved report)
      const link = document.createElement('a')
      link.href = reportData.fileData
      link.target = '_blank'
      link.click()
    }
  }

  const canViewOriginal = localFileURL || reportData?.fileData

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 pt-6 mb-6">
          <button
            onClick={() => navigate('/upload')}
            className="p-2 hover:bg-white rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Report Results</h1>
            <p className="text-gray-400 text-sm truncate max-w-xs">{fileName}</p>
            {reportDate && (
              <p className="text-xs text-indigo-500 font-medium mt-0.5">
                📅 Report Date: {reportDate}
              </p>
            )}
          </div>
        </div>

        {/* Success Banner */}
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-700 font-medium">
            ✅ Report analyzed successfully! Review your results below.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-indigo-600">{paramKeys.length}</p>
            <p className="text-xs text-gray-500 mt-1">Parameters</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{paramKeys.length - abnormalCount}</p>
            <p className="text-xs text-gray-500 mt-1">Normal</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <p className="text-2xl font-bold text-red-500">{abnormalCount}</p>
            <p className="text-xs text-gray-500 mt-1">Attention</p>
          </div>
        </div>

        {/* Parameters List */}
        <div className="space-y-3 mb-6">
          {paramKeys.map((key) => {
            const param = parameters[key]
            const value = typeof param === 'object' ? param.value : param
            const unit = typeof param === 'object' ? param.unit : ''
            const label = typeof param === 'object'
              ? param.label
              : (NORMAL_RANGES[key]?.label || key)
            const { status, color } = getStatus(key, value)
            const colors = statusColors[color]
            const range = NORMAL_RANGES[key]

            return (
              <div key={key} className={`${colors.bg} border ${colors.border} rounded-2xl p-4`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm">{label}</p>
                    <p className={`text-2xl font-bold ${colors.text} mt-1`}>
                      {typeof value === 'number' && value > 1000
                        ? value.toLocaleString('en-IN')
                        : value}
                      <span className="text-sm font-normal text-gray-400 ml-1">{unit}</span>
                    </p>
                    {range && (
                      <p className="text-xs text-gray-400 mt-1">
                        Normal: {typeof range.min === 'number' && range.min > 1000
                          ? range.min.toLocaleString('en-IN')
                          : range.min} – {typeof range.max === 'number' && range.max > 1000
                          ? range.max.toLocaleString('en-IN')
                          : range.max} {range.unit}
                      </p>
                    )}
                  </div>
                  <span className={`${colors.badge} text-xs font-bold px-3 py-1.5 rounded-full ml-3 flex-shrink-0`}>
                    {status}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 mb-6">
          {!saved ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg disabled:opacity-50"
            >
              {saving
                ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                : <Save className="w-5 h-5" />
              }
              {saving ? 'Saving...' : 'Save Report'}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full bg-green-50 border border-green-200 text-green-700 font-bold py-4 rounded-2xl">
              <CheckCircle className="w-5 h-5" />
              Report Saved!
            </div>
          )}

          {/* View Original Report */}
          {canViewOriginal && (
            <button
              onClick={handleViewOriginal}
              className="flex items-center justify-center gap-2 w-full bg-white border border-indigo-200 text-indigo-600 font-semibold py-3 rounded-2xl hover:bg-indigo-50 transition-all"
            >
              <Eye className="w-5 h-5" />
              View Original Report
            </button>
          )}

          {/* File too large warning */}
          {isTooBig && (
            <div className="flex items-center justify-center gap-2 w-full bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm py-3 rounded-2xl px-4 text-center">
              ⚠️ File is large ({(originalFile.size / 1024).toFixed(0)}KB) — preview available now but won't be saved permanently
            </div>
          )}

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center justify-center gap-2 w-full bg-white border border-gray-200 text-gray-700 font-semibold py-3 rounded-2xl hover:bg-gray-50 transition-all"
          >
            View Dashboard
          </button>

          <button
            onClick={() => navigate('/upload')}
            className="flex items-center justify-center gap-2 w-full bg-white border border-gray-200 text-gray-700 font-semibold py-3 rounded-2xl hover:bg-gray-50 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
            Upload Another Report
          </button>
        </div>

        {/* Privacy Disclaimer */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center mb-8">
          <p className="text-xs text-gray-400">
            🔒 Your health data is stored securely. Values shown are for informational purposes only.
            Always consult a qualified medical doctor in India.
          </p>
        </div>

      </div>
    </div>
  )
}