import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserReports, deleteReport } from '../utils/saveReport'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import {
  Activity, Upload, TrendingUp, FileText,
  Trash2, ChevronRight, User, Calendar,
  AlertTriangle, CheckCircle, Info
} from 'lucide-react'
import toast from 'react-hot-toast'

// Normal ranges for status check
const NORMAL_RANGES = {
  hemoglobin:    { min: 12,      max: 17      },
  wbc:           { min: 4000,    max: 10000   },
  rbc:           { min: 3.8,     max: 5.5     },
  pcv:           { min: 36,      max: 46      },
  mcv:           { min: 83,      max: 101     },
  mch:           { min: 27,      max: 32      },
  mchc:          { min: 31.5,    max: 34.5    },
  platelets:     { min: 150000,  max: 450000  },
  rdw:           { min: 11.3,    max: 14.7    },
  neutrophils:   { min: 40,      max: 75      },
  lymphocytes:   { min: 20,      max: 45      },
  eosinophils:   { min: 1,       max: 6       },
  monocytes:     { min: 2,       max: 10      },
  basophils:     { min: 0,       max: 2       },
  aec:           { min: 20,      max: 500     },
  alc:           { min: 1000,    max: 3000    },
  anc:           { min: 2000,    max: 7000    },
  glucose:       { min: 70,      max: 100     },
  ppGlucose:     { min: 70,      max: 140     },
  hba1c:         { min: 4,       max: 5.7     },
  cholesterol:   { min: 0,       max: 200     },
  hdl:           { min: 40,      max: 60      },
  ldl:           { min: 0,       max: 130     },
  triglycerides: { min: 0,       max: 150     },
  creatinine:    { min: 0.6,     max: 1.2     },
  uricAcid:      { min: 3.5,     max: 7.2     },
  bilirubin:     { min: 0.2,     max: 1.2     },
  sgpt:          { min: 7,       max: 40      },
  sgot:          { min: 10,      max: 40      },
  sodium:        { min: 136,     max: 145     },
  potassium:     { min: 3.5,     max: 5.1     },
  calcium:       { min: 8.5,     max: 10.5    },
  tsh:           { min: 0.4,     max: 4.0     },
  t3:            { min: 0.8,     max: 2.0     },
  t4:            { min: 5.1,     max: 14.1    },
  vitaminD:      { min: 20,      max: 100     },
  vitaminB12:    { min: 200,     max: 900     },
  ferritin:      { min: 12,      max: 150     },
  esr:           { min: 0,       max: 20      },
  crp:           { min: 0,       max: 5       },
}

const getReportStatus = (parameters) => {
  let abnormal = 0
  let total = 0
  Object.entries(parameters).forEach(([key, param]) => {
    const val = typeof param === 'object' ? param.value : param
    const range = NORMAL_RANGES[key]
    if (range) {
      total++
      if (val < range.min || val > range.max) abnormal++
    }
  })
  return { abnormal, total }
}

export default function Dashboard({ user }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
  loadData()
}, [user.uid])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load user profile
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) setUserProfile(userDoc.data())

      // Load reports
      const userReports = await getUserReports(user.uid)
      setReports(userReports)
    } catch (error) {
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (reportId, e) => {
    e.stopPropagation()
    if (!confirm('Delete this report?')) return
    setDeleting(reportId)
    const result = await deleteReport(reportId)
    if (result.success) {
      setReports(reports.filter(r => r.id !== reportId))
      toast.success('Report deleted')
    } else {
      toast.error('Failed to delete')
    }
    setDeleting(null)
  }

  const latestReport = reports[0]
  const totalAbnormal = latestReport
    ? getReportStatus(latestReport.parameters).abnormal
    : 0

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto mb-3" />
          <p className="text-gray-500">Loading your health data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="pt-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            Hello, {userProfile?.name?.split(' ')[0] || user.displayName?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">Here's your health summary</p>
        </div>

        {/* Profile Card */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 mb-6 text-white shadow-lg">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center flex-shrink-0">
              <User className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-lg truncate">{userProfile?.name || user.displayName}</p>
              <p className="text-indigo-200 text-sm">Age: {userProfile?.age || 'N/A'} years</p>
              <p className="text-indigo-200 text-sm truncate">{user.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/20">
            <div className="text-center">
              <p className="text-2xl font-bold">{reports.length}</p>
              <p className="text-xs text-indigo-200">Reports</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {latestReport ? Object.keys(latestReport.parameters).length : 0}
              </p>
              <p className="text-xs text-indigo-200">Last Parameters</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{totalAbnormal}</p>
              <p className="text-xs text-indigo-200">Need Attention</p>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => navigate('/upload')}
            className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-all active:scale-95"
          >
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Upload className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Upload</p>
              <p className="text-xs text-gray-400">New report</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/trends')}
            className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-all active:scale-95"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-left">
              <p className="font-semibold text-gray-800 text-sm">Trends</p>
              <p className="text-xs text-gray-400">View charts</p>
            </div>
          </button>
        </div>

        {/* Latest Report Summary */}
        {latestReport && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">Latest Report</h2>
              <span className="text-xs text-gray-400">
                {new Date(latestReport.processedAt).toLocaleDateString('en-IN')}
              </span>
            </div>
            <div className="space-y-2">
              {Object.entries(latestReport.parameters).slice(0, 5).map(([key, param]) => {
                const val = typeof param === 'object' ? param.value : param
                const label = typeof param === 'object' ? param.label : key
                const unit = typeof param === 'object' ? param.unit : ''
                const range = NORMAL_RANGES[key]
                const isAbnormal = range && (val < range.min || val > range.max)
                return (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      {isAbnormal
                        ? <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        : <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                      }
                      {label}
                    </span>
                    <span className={`text-sm font-semibold ${isAbnormal ? 'text-red-500' : 'text-gray-800'}`}>
                      {typeof val === 'number' && val > 1000 ? val.toLocaleString('en-IN') : val} {unit}
                    </span>
                  </div>
                )
              })}
              {Object.keys(latestReport.parameters).length > 5 && (
                <p className="text-xs text-indigo-500 text-center pt-1">
                  +{Object.keys(latestReport.parameters).length - 5} more parameters
                </p>
              )}
            </div>
          </div>
        )}

        {/* Reports History */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800">Report History</h2>
            <span className="text-xs text-gray-400">{reports.length} total</span>
          </div>

          {reports.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-semibold text-gray-600 mb-1">No reports yet</p>
              <p className="text-gray-400 text-sm mb-4">Upload your first medical report to get started</p>
              <button
                onClick={() => navigate('/upload')}
                className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors"
              >
                Upload Now
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => {
                const { abnormal, total } = getReportStatus(report.parameters)
                const paramCount = Object.keys(report.parameters).length
                return (
                  <div
                    key={report.id}
                    className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-all cursor-pointer active:scale-95"
                    onClick={() => navigate('/results', { state: { reportData: report } })}
                  >
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <FileText className="w-6 h-6 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{report.fileName}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(report.processedAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
                          {paramCount} parameters
                        </span>
                        {abnormal > 0 && (
                          <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">
                            {abnormal} abnormal
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={(e) => handleDelete(report.id, e)}
                        className="p-2 hover:bg-red-50 rounded-xl transition-colors"
                        disabled={deleting === report.id}
                      >
                        {deleting === report.id
                          ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400" />
                          : <Trash2 className="w-4 h-4 text-red-400" />
                        }
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Privacy Notice */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 text-center mb-8">
          <p className="text-xs text-gray-400">
            🔒 Your health data is stored securely and privately. Only you can access your reports.
          </p>
        </div>
      </div>
    </div>
  )
}