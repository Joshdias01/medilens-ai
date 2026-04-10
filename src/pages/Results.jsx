import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, ArrowLeft, RefreshCw, Save, Eye, Stethoscope, ChevronRight, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { saveReport } from '../utils/saveReport'
import { getParameterStatus, KNOWN_RANGES } from '../utils/enrichParameters'
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

const statusColors = {
  green: { bg: 'bg-green-50', border: 'border-green-100', badge: 'bg-green-100 text-green-700', text: 'text-green-700' },
  red:   { bg: 'bg-red-50',   border: 'border-red-100',   badge: 'bg-red-100 text-red-700',     text: 'text-red-700'   },
  blue:  { bg: 'bg-blue-50',  border: 'border-blue-100',  badge: 'bg-blue-100 text-blue-700',   text: 'text-blue-700'  },
  gray:  { bg: 'bg-gray-50',  border: 'border-gray-100',  badge: 'bg-gray-100 text-gray-500',   text: 'text-gray-600'  },
}

export default function Results({ user }) {
  const location = useLocation()
  const navigate = useNavigate()
  const reportData = location.state?.reportData
  const originalFile = location.state?.originalFile || null

  // If reportData already has an id it came from Firestore (Dashboard) — already saved
  const isAlreadySaved = !!reportData?.id

  const [saved, setSaved] = useState(isAlreadySaved)
  const [saving, setSaving] = useState(false)
  const [expandedInsight, setExpandedInsight] = useState(null)
  const [requestingReview, setRequestingReview] = useState(false)
  const [reviewRequested, setReviewRequested] = useState(false)

  // Doctor picker states
  const [showDoctorPicker, setShowDoctorPicker] = useState(false)
  const [availableDoctors, setAvailableDoctors] = useState([])
  const [loadingDoctors, setLoadingDoctors] = useState(false)

  const localFileURL = originalFile ? URL.createObjectURL(originalFile) : null
  const isTooBig = originalFile && originalFile.size >= 900 * 1024

  // On mount: if this is an already-saved report, check if a review was already sent
  useEffect(() => {
    if (!reportData?.id) return
    const checkExistingReview = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'reviews'),
            where('patientId', '==', user.uid),
            where('reportId', '==', reportData.id)
          )
        )
        if (!snap.empty) setReviewRequested(true)
      } catch { /* non-critical */ }
    }
    checkExistingReview()
  }, [reportData?.id])

  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <p className="text-2xl mb-2">📋</p>
          <p className="text-gray-500 mb-4">No report data found</p>
          <button
            onClick={() => navigate('/upload')}
            className="bg-violet-600 text-white px-6 py-3 rounded-2xl font-semibold"
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
    const rangeInfo = typeof p === 'object' ? p.rangeInfo : null
    const { status } = getParameterStatus(k, val, rangeInfo)
    return status === 'High' || status === 'Low'
  }).length

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveReport(user.uid, reportData, originalFile)
      if (result.success) {
        setSaved(true)
        toast.success('Report saved!')
      } else {
        toast.error('Failed to save: ' + result.error)
      }
    } catch (err) {
      toast.error('Failed to save report')
    } finally {
      setSaving(false)
    }
  }

  const handleViewOriginal = () => {
    if (localFileURL) {
      window.open(localFileURL, '_blank')
    } else if (reportData?.fileData) {
      const link = document.createElement('a')
      link.href = reportData.fileData
      link.target = '_blank'
      link.click()
    }
  }

  // Step 1: Open doctor picker
  const handleRequestReview = async () => {
    if (showDoctorPicker) { setShowDoctorPicker(false); return }
    setLoadingDoctors(true)
    try {
      const doctorsSnap = await getDocs(
        query(collection(db, 'users'), where('role', '==', 'doctor'))
      )
      const doctors = doctorsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (doctors.length === 0) {
        toast.error('No doctors available right now. Please try again later.')
        return
      }
      setAvailableDoctors(doctors)
      setShowDoctorPicker(true)
    } catch (err) {
      console.error(err)
      toast.error('Could not load doctors. Please try again.')
    } finally {
      setLoadingDoctors(false)
    }
  }

  // Step 2: Patient picks a specific doctor
  const handleSelectDoctor = async (doctor) => {
    setShowDoctorPicker(false)
    setRequestingReview(true)
    try {
      const abnormalCount = Object.entries(parameters).filter(([k, p]) => {
        const val = typeof p === 'object' ? p.value : p
        const rangeInfo = typeof p === 'object' ? p.rangeInfo : null
        const { status } = getParameterStatus(k, val, rangeInfo)
        return status === 'High' || status === 'Low'
      }).length

      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const userData = userDoc.exists() ? userDoc.data() : {}
      const firstName = userData.name?.split(' ')[0] || 'Patient'

      await addDoc(collection(db, 'reviews'), {
        patientId: user.uid,
        patientFirstName: firstName,
        patientAge: userData.age || null,
        doctorId: doctor.id,
        doctorName: doctor.name,
        reportId: reportData.id || null,
        parameters,
        reportDate: reportData.reportDate || null,
        reportType: fileName,
        abnormalCount,
        status: 'pending',
        hasUnread: true,
        doctorNotes: '',
        flaggedParams: [],
        createdAt: new Date().toISOString()
      })

      setReviewRequested(true)
      toast.success(`Review sent to Dr. ${doctor.name.split(' ').slice(-1)[0]}! You'll be notified when reviewed.`)
    } catch (err) {
      console.error(err)
      toast.error('Failed to request review. Please try again.')
    } finally {
      setRequestingReview(false)
    }
  }

  const canViewOriginal = localFileURL || reportData?.fileData

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-2xl mx-auto px-4">

        {/* Header */}
        <div className="flex items-center gap-3 pt-6 mb-6">
          <button
            onClick={() => navigate(isAlreadySaved ? '/dashboard' : '/upload')}
            className="p-2 hover:bg-white rounded-xl transition-colors border border-gray-200"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">Report Results</h1>
            <p className="text-gray-400 text-xs truncate">
              {fileName}
              {reportDate && (
                <span className="text-violet-500 ml-2">· {reportDate}</span>
              )}
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
            <p className="text-2xl font-bold text-violet-600">{paramKeys.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Found</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
            <p className="text-2xl font-bold text-emerald-500">{paramKeys.length - abnormalCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Normal</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
            <p className="text-2xl font-bold text-red-500">{abnormalCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Attention</p>
          </div>
        </div>

        {/* Parameters List */}
        <div className="space-y-2.5 mb-6">
          {paramKeys.map((key) => {
            const param = parameters[key]
            const value = typeof param === 'object' ? param.value : param
            const unit = typeof param === 'object' ? (param.rangeInfo?.unit || param.unit) : ''
            const label = typeof param === 'object'
              ? (param.rangeInfo?.label || param.label || key)
              : key
            const rangeInfo = typeof param === 'object' ? param.rangeInfo : (KNOWN_RANGES[key] || null)
            const { status, color } = getParameterStatus(key, value, rangeInfo)
            const colors = statusColors[color]
            const isExpanded = expandedInsight === key
            const hasInsight = rangeInfo && (status === 'High' || status === 'Low')
            const isAIGenerated = rangeInfo?.aiGenerated

            return (
              <div
                key={key}
                className={`bg-white border ${colors.border} rounded-2xl overflow-hidden transition-all`}
              >
                <div
                  className={`p-4 ${hasInsight ? 'cursor-pointer' : ''}`}
                  onClick={() => hasInsight && setExpandedInsight(isExpanded ? null : key)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{label}</p>
                        {isAIGenerated && (
                          <span className="text-xs bg-violet-50 text-violet-500 px-1.5 py-0.5 rounded-lg">
                            ✨ auto
                          </span>
                        )}
                      </div>
                      {rangeInfo?.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{rangeInfo.description}</p>
                      )}
                      <div className="flex items-baseline gap-1 mt-1.5">
                        <p className={`text-xl font-bold ${colors.text}`}>
                          {typeof value === 'number' && value > 1000
                            ? value.toLocaleString('en-IN')
                            : value}
                        </p>
                        <p className="text-xs text-gray-400">{unit}</p>
                      </div>
                      {rangeInfo && rangeInfo.min !== undefined && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Normal: {rangeInfo.min} – {rangeInfo.max} {rangeInfo.unit}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2 ml-3 flex-shrink-0">
                      <span className={`${colors.badge} text-xs font-semibold px-2.5 py-1 rounded-full`}>
                        {status}
                      </span>
                      {hasInsight && (
                        <span className="text-xs text-gray-400">
                          {isExpanded ? '▲' : '▼ insight'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expandable Insight */}
                {hasInsight && isExpanded && (
                  <div className={`px-4 pb-4 border-t ${colors.border}`}>
                    <div className={`rounded-xl p-3 mt-3 ${color === 'red' ? 'bg-red-50' : 'bg-blue-50'}`}>
                      <p className="text-xs font-semibold text-gray-700 mb-1">
                        ⚠️ {status === 'High' ? 'Why this matters:' : 'What this means:'}
                      </p>
                      <p className="text-xs text-gray-600">
                        {status === 'High' ? rangeInfo.highEffect : rangeInfo.lowEffect}
                      </p>
                      {rangeInfo.tips && rangeInfo.tips.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-semibold text-gray-700 mb-1">💡 What to do:</p>
                          {rangeInfo.tips.map((tip, i) => (
                            <div key={i} className="flex items-start gap-1.5 mb-1">
                              <span className="text-emerald-500 text-xs mt-0.5 flex-shrink-0">✓</span>
                              <p className="text-xs text-gray-600">{tip}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-400 mt-2 italic">
                        Always consult a qualified doctor before making health decisions.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 mb-6">

          {/* Save Report — hidden if already saved (came from Dashboard) */}
          {!saved ? (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center justify-center gap-2 w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-4 rounded-2xl transition-all shadow-md shadow-violet-100 disabled:opacity-50"
            >
              {saving
                ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                : <Save className="w-4 h-4" />
              }
              {saving ? 'Saving...' : 'Save Report'}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold py-4 rounded-2xl">
              <CheckCircle className="w-4 h-4" />
              {isAlreadySaved ? 'Report already saved' : 'Saved successfully!'}
            </div>
          )}

          {/* Request Doctor Review — show after saving, hide if already requested */}
          {saved && !reviewRequested && (
            <>
              <button
                onClick={handleRequestReview}
                disabled={requestingReview || loadingDoctors}
                className={`flex items-center justify-center gap-2 w-full font-semibold py-4 rounded-2xl transition-all shadow-md disabled:opacity-50 ${
                  showDoctorPicker
                    ? 'bg-gray-100 text-gray-700 border border-gray-200'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {loadingDoctors
                  ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  : showDoctorPicker
                    ? <><X className="w-4 h-4" /> Cancel</>  
                    : <><Stethoscope className="w-4 h-4" /> 👨‍⚕️ Request Doctor Review</>
                }
                {loadingDoctors && ' Loading doctors...'}
              </button>

              {/* Doctor Picker Panel */}
              {showDoctorPicker && availableDoctors.length > 0 && (
                <div className="bg-white border border-blue-100 rounded-2xl overflow-hidden shadow-md">
                  <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                    <p className="text-sm font-bold text-blue-800">👨‍⚕️ Choose a Doctor</p>
                    <p className="text-xs text-blue-500 mt-0.5">Select who you'd like to review your report</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {availableDoctors.map(doctor => (
                      <button
                        key={doctor.id}
                        onClick={() => handleSelectDoctor(doctor)}
                        disabled={requestingReview}
                        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-blue-50 transition-colors text-left group disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                            <Stethoscope className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">Dr. {doctor.name}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {doctor.specialization || 'General Physician'}
                              {doctor.verified && <span className="ml-1.5 text-emerald-500">✓ Verified</span>}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {reviewRequested && (
            <div className="flex items-center justify-center gap-2 w-full bg-blue-50 border border-blue-200 text-blue-700 font-semibold py-4 rounded-2xl">
              <Stethoscope className="w-4 h-4" />
              Doctor Review Requested! ✅
            </div>
          )}

          {/* View Original */}
          {canViewOriginal && (
            <button
              onClick={handleViewOriginal}
              className="flex items-center justify-center gap-2 w-full bg-white border border-gray-200 text-gray-700 font-semibold py-3 rounded-2xl hover:bg-gray-50 transition-all"
            >
              <Eye className="w-4 h-4" />
              View Original Report
            </button>
          )}

          {isTooBig && (
            <p className="text-xs text-center text-amber-600 bg-amber-50 py-2 px-4 rounded-xl">
              ⚠️ File too large to save permanently
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 font-medium py-3 rounded-2xl hover:bg-gray-50 transition-all text-sm"
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate('/upload')}
              className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 font-medium py-3 rounded-2xl hover:bg-gray-50 transition-all text-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              New Upload
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-gray-400 px-4 pb-4">
          🔒 Results are for informational purposes only. Always consult a qualified medical doctor in India.
        </p>

      </div>
    </div>
  )
}