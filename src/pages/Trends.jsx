import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserReports, getTrendsData } from '../utils/saveReport'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { TrendingUp, TrendingDown, Minus, ArrowLeft, Activity } from 'lucide-react'
import toast from 'react-hot-toast'

const NORMAL_RANGES = {
  hemoglobin:    { min: 12,     max: 17,     unit: 'g/dL',       label: 'Hemoglobin',           color: '#6366f1' },
  wbc:           { min: 4000,   max: 10000,  unit: 'cells/µL',   label: 'WBC Count',             color: '#8b5cf6' },
  rbc:           { min: 3.8,    max: 5.5,    unit: 'million/µL', label: 'RBC Count',             color: '#06b6d4' },
  pcv:           { min: 36,     max: 46,     unit: '%',          label: 'PCV',                   color: '#10b981' },
  mcv:           { min: 83,     max: 101,    unit: 'fL',         label: 'MCV',                   color: '#f59e0b' },
  mch:           { min: 27,     max: 32,     unit: 'pg',         label: 'MCH',                   color: '#ef4444' },
  mchc:          { min: 31.5,   max: 34.5,   unit: 'g/dL',       label: 'MCHC',                  color: '#ec4899' },
  platelets:     { min: 150000, max: 450000, unit: 'cells/µL',   label: 'Platelet Count',        color: '#f97316' },
  rdw:           { min: 11.3,   max: 14.7,   unit: '%',          label: 'RDW-CV',                color: '#84cc16' },
  neutrophils:   { min: 40,     max: 75,     unit: '%',          label: 'Neutrophils',           color: '#6366f1' },
  lymphocytes:   { min: 20,     max: 45,     unit: '%',          label: 'Lymphocytes',           color: '#8b5cf6' },
  eosinophils:   { min: 1,      max: 6,      unit: '%',          label: 'Eosinophils',           color: '#06b6d4' },
  monocytes:     { min: 2,      max: 10,     unit: '%',          label: 'Monocytes',             color: '#10b981' },
  basophils:     { min: 0,      max: 2,      unit: '%',          label: 'Basophils',             color: '#f59e0b' },
  aec:           { min: 20,     max: 500,    unit: 'cells/µL',   label: 'Abs. Eosinophil Count', color: '#ef4444' },
  alc:           { min: 1000,   max: 3000,   unit: 'cells/µL',   label: 'Abs. Lymphocyte Count', color: '#ec4899' },
  anc:           { min: 2000,   max: 7000,   unit: 'cells/µL',   label: 'Abs. Neutrophil Count', color: '#f97316' },
  glucose:       { min: 70,     max: 100,    unit: 'mg/dL',      label: 'Fasting Glucose',       color: '#f59e0b' },
  ppGlucose:     { min: 70,     max: 140,    unit: 'mg/dL',      label: 'PP Glucose',            color: '#f97316' },
  hba1c:         { min: 4,      max: 5.7,    unit: '%',          label: 'HbA1c',                 color: '#ef4444' },
  cholesterol:   { min: 0,      max: 200,    unit: 'mg/dL',      label: 'Total Cholesterol',     color: '#8b5cf6' },
  hdl:           { min: 40,     max: 60,     unit: 'mg/dL',      label: 'HDL Cholesterol',       color: '#10b981' },
  ldl:           { min: 0,      max: 130,    unit: 'mg/dL',      label: 'LDL Cholesterol',       color: '#ef4444' },
  triglycerides: { min: 0,      max: 150,    unit: 'mg/dL',      label: 'Triglycerides',         color: '#f97316' },
  creatinine:    { min: 0.6,    max: 1.2,    unit: 'mg/dL',      label: 'Creatinine',            color: '#06b6d4' },
  uricAcid:      { min: 3.5,    max: 7.2,    unit: 'mg/dL',      label: 'Uric Acid',             color: '#84cc16' },
  bilirubin:     { min: 0.2,    max: 1.2,    unit: 'mg/dL',      label: 'Total Bilirubin',       color: '#f59e0b' },
  sgpt:          { min: 7,      max: 40,     unit: 'U/L',        label: 'SGPT (ALT)',            color: '#ef4444' },
  sgot:          { min: 10,     max: 40,     unit: 'U/L',        label: 'SGOT (AST)',            color: '#ec4899' },
  sodium:        { min: 136,    max: 145,    unit: 'mEq/L',      label: 'Sodium',                color: '#6366f1' },
  potassium:     { min: 3.5,    max: 5.1,    unit: 'mEq/L',      label: 'Potassium',             color: '#8b5cf6' },
  calcium:       { min: 8.5,    max: 10.5,   unit: 'mg/dL',      label: 'Calcium',               color: '#06b6d4' },
  tsh:           { min: 0.4,    max: 4.0,    unit: 'µIU/mL',     label: 'TSH',                   color: '#6366f1' },
  t3:            { min: 0.8,    max: 2.0,    unit: 'ng/mL',      label: 'T3 (Total)',            color: '#10b981' },
  t4:            { min: 5.1,    max: 14.1,   unit: 'µg/dL',      label: 'T4 (Total)',            color: '#f59e0b' },
  vitaminD:      { min: 20,     max: 100,    unit: 'ng/mL',      label: 'Vitamin D',             color: '#f97316' },
  vitaminB12:    { min: 200,    max: 900,    unit: 'pg/mL',      label: 'Vitamin B12',           color: '#84cc16' },
  ferritin:      { min: 12,     max: 150,    unit: 'ng/mL',      label: 'Ferritin',              color: '#ec4899' },
  iron:          { min: 60,     max: 170,    unit: 'µg/dL',      label: 'Serum Iron',            color: '#f59e0b' },
  esr:           { min: 0,      max: 20,     unit: 'mm/hr',      label: 'ESR',                   color: '#ef4444' },
  crp:           { min: 0,      max: 5,      unit: 'mg/L',       label: 'CRP',                   color: '#f97316' },
}

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="font-bold text-gray-800">
          {typeof payload[0].value === 'number' && payload[0].value > 1000
            ? payload[0].value.toLocaleString('en-IN')
            : payload[0].value}
          <span className="text-xs font-normal text-gray-500 ml-1">{unit}</span>
        </p>
      </div>
    )
  }
  return null
}

export default function Trends({ user }) {
  const [reports, setReports] = useState([])
  const [trends, setTrends] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedParam, setSelectedParam] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadTrends()
  }, [user.uid])

  const loadTrends = async () => {
    setLoading(true)
    try {
      const userReports = await getUserReports(user.uid)
      setReports(userReports)
      const trendsData = getTrendsData(userReports)
      setTrends(trendsData)
      // Auto-select first parameter
      const keys = Object.keys(trendsData)
      if (keys.length > 0) setSelectedParam(keys[0])
    } catch (error) {
      toast.error('Failed to load trends')
    } finally {
      setLoading(false)
    }
  }

  const getTrend = (data) => {
    if (data.length < 2) return 'stable'
    const last = data[data.length - 1].value
    const prev = data[data.length - 2].value
    const diff = ((last - prev) / prev) * 100
    if (diff > 5) return 'up'
    if (diff < -5) return 'down'
    return 'stable'
  }

  const getParamStatus = (key, value) => {
    const range = NORMAL_RANGES[key]
    if (!range) return 'normal'
    if (value < range.min) return 'low'
    if (value > range.max) return 'high'
    return 'normal'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto mb-3" />
          <p className="text-gray-500">Loading your trends...</p>
        </div>
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
        <div className="max-w-2xl mx-auto pt-6">
          <div className="flex items-center gap-3 mb-8">
            <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white rounded-xl">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <h1 className="text-2xl font-bold text-gray-800">Health Trends</h1>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-10 h-10 text-indigo-300" />
            </div>
            <p className="font-semibold text-gray-600 mb-2">No data yet</p>
            <p className="text-gray-400 text-sm mb-6">
              Upload at least 2 reports to see trends over time
            </p>
            <button
              onClick={() => navigate('/upload')}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700"
            >
              Upload Report
            </button>
          </div>
        </div>
      </div>
    )
  }

  const paramKeys = Object.keys(trends)
  const selectedData = selectedParam ? trends[selectedParam] : null
  const range = selectedParam ? NORMAL_RANGES[selectedParam] : null
  const color = range?.color || '#6366f1'
  const latestValue = selectedData?.data[selectedData.data.length - 1]?.value
  const trend = selectedData ? getTrend(selectedData.data) : 'stable'
  const currentStatus = selectedParam && latestValue !== undefined
    ? getParamStatus(selectedParam, latestValue)
    : 'normal'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-3 pt-6 mb-6">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-white rounded-xl">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Health Trends</h1>
            <p className="text-gray-500 text-sm">{reports.length} reports analysed</p>
          </div>
        </div>

        {/* Parameter Selector */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-600 mb-2">Select Parameter:</p>
          <div className="flex flex-wrap gap-2">
            {paramKeys.map(key => {
              const r = NORMAL_RANGES[key]
              const lv = trends[key]?.data[trends[key].data.length - 1]?.value
              const st = lv !== undefined ? getParamStatus(key, lv) : 'normal'
              return (
                <button
                  key={key}
                  onClick={() => setSelectedParam(key)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    selectedParam === key
                      ? 'bg-indigo-600 text-white shadow-md'
                      : st === 'high' || st === 'low'
                        ? 'bg-red-50 text-red-600 border border-red-200'
                        : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {r?.label || key}
                  {(st === 'high' || st === 'low') && selectedParam !== key && (
                    <span className="ml-1">⚠️</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Chart Card */}
        {selectedData && (
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
            {/* Chart Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-bold text-gray-800">{selectedData.label}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold" style={{ color }}>
                    {typeof latestValue === 'number' && latestValue > 1000
                      ? latestValue.toLocaleString('en-IN')
                      : latestValue}
                  </span>
                  <span className="text-sm text-gray-400">{selectedData.unit}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {/* Trend indicator */}
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                  trend === 'up' ? 'bg-red-50 text-red-600' :
                  trend === 'down' ? 'bg-blue-50 text-blue-600' :
                  'bg-gray-50 text-gray-600'
                }`}>
                  {trend === 'up' && <TrendingUp className="w-3 h-3" />}
                  {trend === 'down' && <TrendingDown className="w-3 h-3" />}
                  {trend === 'stable' && <Minus className="w-3 h-3" />}
                  {trend === 'up' ? 'Rising' : trend === 'down' ? 'Falling' : 'Stable'}
                </div>
                {/* Status */}
                <span className={`text-xs px-2 py-1 rounded-lg font-semibold ${
                  currentStatus === 'high' ? 'bg-red-100 text-red-700' :
                  currentStatus === 'low' ? 'bg-blue-100 text-blue-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  {currentStatus === 'high' ? '⬆ High' :
                   currentStatus === 'low' ? '⬇ Low' : '✓ Normal'}
                </span>
              </div>
            </div>

            {/* Normal Range */}
            {range && (
              <div className="bg-gray-50 rounded-xl px-3 py-2 mb-4 flex items-center justify-between">
                <span className="text-xs text-gray-500">Normal Range</span>
                <span className="text-xs font-semibold text-gray-700">
                  {typeof range.min === 'number' && range.min > 1000
                    ? range.min.toLocaleString('en-IN')
                    : range.min} – {typeof range.max === 'number' && range.max > 1000
                    ? range.max.toLocaleString('en-IN')
                    : range.max} {range.unit}
                </span>
              </div>
            )}

            {/* Line Chart */}
            {selectedData.data.length === 1 ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                Upload more reports to see trend chart
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={selectedData.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    width={45}
                    tickFormatter={v => v > 1000 ? `${(v/1000).toFixed(0)}k` : v}
                  />
                  <Tooltip content={<CustomTooltip unit={selectedData.unit} />} />
                  {range && range.min > 0 && (
                    <ReferenceLine
                      y={range.min}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      label={{ value: 'Min', fontSize: 9, fill: '#94a3b8' }}
                    />
                  )}
                  {range && (
                    <ReferenceLine
                      y={range.max}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      label={{ value: 'Max', fontSize: 9, fill: '#94a3b8' }}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={color}
                    strokeWidth={3}
                    dot={{ fill: color, r: 5, strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7, stroke: color, strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        )}

        {/* All Parameters Summary */}
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-8">
          <h2 className="font-bold text-gray-800 mb-4">All Parameters Summary</h2>
          <div className="space-y-3">
            {paramKeys.map(key => {
              const r = NORMAL_RANGES[key]
              const pData = trends[key]
              const lv = pData?.data[pData.data.length - 1]?.value
              const st = lv !== undefined ? getParamStatus(key, lv) : 'normal'
              const tr = getTrend(pData?.data || [])
              return (
                <div
                  key={key}
                  onClick={() => setSelectedParam(key)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    selectedParam === key ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: r?.color || '#6366f1' }}
                    />
                    <span className="text-sm text-gray-700">{r?.label || key}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${
                      st === 'high' ? 'text-red-500' :
                      st === 'low' ? 'text-blue-500' : 'text-gray-700'
                    }`}>
                      {typeof lv === 'number' && lv > 1000
                        ? lv.toLocaleString('en-IN') : lv} {r?.unit}
                    </span>
                    {tr === 'up' && <TrendingUp className="w-3 h-3 text-red-400" />}
                    {tr === 'down' && <TrendingDown className="w-3 h-3 text-blue-400" />}
                    {tr === 'stable' && <Minus className="w-3 h-3 text-gray-300" />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}