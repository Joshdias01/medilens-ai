import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getUserReports, deleteReport } from '../utils/saveReport'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import {
  Activity, Upload, TrendingUp, FileText,
  Trash2, ChevronRight, User,
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Brain, TrendingDown, Minus
} from 'lucide-react'
import toast from 'react-hot-toast'

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
  antiTpo: { min: 0,  max: 34,  unit: 'IU/mL',  label: 'Anti TPO Antibody' },
}

// ─── RULE-BASED INSIGHTS ─────────────────────────────────────────────────────
const INSIGHTS = {
  hemoglobin: {
    high: {
      effect: 'High hemoglobin can thicken blood, increasing risk of clots, stroke, or heart issues.',
      tips: ['Stay well hydrated throughout the day', 'Avoid iron supplements unless prescribed', 'Consult doctor — may indicate a blood disorder', 'Avoid smoking which worsens the condition']
    },
    low: {
      effect: 'Low hemoglobin means less oxygen reaches your organs — causing fatigue, weakness, and breathlessness.',
      tips: ['Eat iron-rich foods: spinach, beetroot, dates, jaggery, lentils', 'Consume Vitamin C (lemon, amla) with meals to boost iron absorption', 'Avoid tea/coffee immediately after meals', 'Consider iron supplements after consulting a doctor']
    }
  },
  glucose: {
    high: {
      effect: 'High fasting blood sugar may indicate pre-diabetes or diabetes, damaging kidneys, eyes, and nerves over time.',
      tips: ['Reduce sugar, maida, and refined carbs', 'Walk 30 minutes daily — especially after meals', 'Eat smaller, frequent meals', 'Monitor blood sugar regularly', 'Consult a diabetologist']
    },
    low: {
      effect: 'Low blood sugar can cause dizziness, fainting, and in severe cases — unconsciousness.',
      tips: ['Never skip meals, especially breakfast', 'Carry glucose tablets or a sweet when traveling', 'Eat complex carbs like oats and brown rice', 'Consult doctor if this is recurring']
    }
  },
  cholesterol: {
    high: {
      effect: 'High cholesterol clogs arteries, significantly increasing risk of heart attack and stroke.',
      tips: ['Reduce fried foods, ghee, and red meat', 'Eat more fiber: oats, fruits, vegetables', 'Exercise at least 30 minutes 5 days a week', 'Quit smoking if you smoke', 'Get a lipid profile done every 6 months']
    },
    low: {
      effect: 'Very low cholesterol is rare but may affect hormone production and brain function.',
      tips: ['Include healthy fats: nuts, seeds, avocado', 'Eat eggs and dairy in moderation', 'Consult a doctor for further evaluation']
    }
  },
  hdl: {
    high: {
      effect: 'High HDL is actually good — it protects your heart by removing bad cholesterol.',
      tips: ['Maintain your healthy lifestyle', 'Continue regular exercise', 'Keep up your balanced diet']
    },
    low: {
      effect: 'Low HDL increases heart disease risk as less bad cholesterol is being cleared.',
      tips: ['Exercise regularly — cardio boosts HDL most effectively', 'Quit smoking', 'Include healthy fats: olive oil, nuts, fish', 'Avoid trans fats completely', 'Lose excess weight if applicable']
    }
  },
  ldl: {
    high: {
      effect: 'High LDL (bad cholesterol) builds up in arteries, causing blockages and heart disease.',
      tips: ['Cut down on saturated fats: butter, coconut oil, red meat', 'Eat more soluble fiber: oats, apples, beans', 'Regular aerobic exercise', 'Medication may be needed — consult a cardiologist', 'Retest after 3 months of lifestyle changes']
    },
    low: {
      effect: 'Low LDL is generally good for heart health.',
      tips: ['Maintain current healthy habits', 'Ensure balanced nutrition']
    }
  },
  triglycerides: {
    high: {
      effect: 'High triglycerides increase risk of heart disease and pancreatitis.',
      tips: ['Reduce sugar and alcohol completely', 'Cut refined carbs: white rice, bread, sweets', 'Eat omega-3 rich foods: fish, flaxseed, walnuts', 'Exercise daily — even a 20-minute walk helps', 'Lose weight if overweight']
    },
    low: {
      effect: 'Low triglycerides are generally not a concern.',
      tips: ['Maintain balanced diet', 'Ensure adequate calorie intake']
    }
  },
  tsh: {
    high: {
      effect: 'High TSH suggests your thyroid is underactive (Hypothyroidism) — causing fatigue, weight gain, and cold sensitivity.',
      tips: ['Consult an endocrinologist immediately', 'Thyroid medication (Thyroxine) may be needed', 'Avoid raw cabbage, broccoli which affect thyroid', 'Ensure adequate iodine intake (use iodized salt)', 'Retest TSH in 6-8 weeks after treatment']
    },
    low: {
      effect: 'Low TSH suggests overactive thyroid (Hyperthyroidism) — causing weight loss, anxiety, and rapid heartbeat.',
      tips: ['See an endocrinologist urgently', 'Avoid excess iodine and thyroid supplements', 'Monitor heart rate regularly', 'Medication, radioiodine, or surgery may be needed']
    }
  },
  t3: {
    high: {
      effect: 'High T3 may indicate hyperthyroidism causing rapid heartbeat, weight loss, and anxiety.',
      tips: ['Consult an endocrinologist', 'Avoid iodine-rich supplements', 'Monitor heart rate daily', 'Treatment options include medication or radioiodine therapy']
    },
    low: {
      effect: 'Low T3 is often seen in hypothyroidism or non-thyroidal illness.',
      tips: ['Consult your doctor for comprehensive thyroid evaluation', 'Ensure adequate selenium and zinc in diet', 'Manage stress which can lower T3', 'Follow up with TSH and T4 tests']
    }
  },
  t4: {
    high: {
      effect: 'High T4 suggests hyperthyroidism or excess thyroid medication.',
      tips: ['Review thyroid medication dosage with doctor', 'Consult endocrinologist', 'Avoid self-medicating thyroid supplements']
    },
    low: {
      effect: 'Low T4 confirms hypothyroidism — thyroid replacement therapy is usually needed.',
      tips: ['Start Thyroxine therapy as prescribed', 'Take medicine on empty stomach in morning', 'Retest after 6-8 weeks', 'Avoid calcium supplements within 4 hours of medication']
    }
  },
  creatinine: {
    high: {
      effect: 'High creatinine indicates kidneys are not filtering waste properly.',
      tips: ['Drink 2.5-3 litres of water daily', 'Reduce protein intake temporarily', 'Avoid painkillers like ibuprofen/diclofenac', 'Consult a nephrologist', 'Control blood pressure and diabetes if present']
    },
    low: {
      effect: 'Low creatinine may indicate muscle loss or low protein intake.',
      tips: ['Increase protein in diet: dal, eggs, milk, chicken', 'Light strength training exercises', 'Consult doctor if very low']
    }
  },
  uricAcid: {
    high: {
      effect: 'High uric acid causes gout (joint pain), kidney stones, and kidney disease.',
      tips: ['Drink plenty of water — minimum 3 litres daily', 'Avoid red meat, organ meats, and shellfish', 'Limit alcohol especially beer', 'Reduce fructose: avoid packaged juices and sodas', 'Eat cherries, lemon water — they help reduce uric acid', 'Medication may be needed — consult doctor']
    },
    low: {
      effect: 'Low uric acid is rare and usually not a concern.',
      tips: ['Maintain balanced diet', 'Stay hydrated']
    }
  },
  vitaminD: {
    high: {
      effect: 'Vitamin D toxicity can cause nausea, weakness, and kidney problems.',
      tips: ['Stop Vitamin D supplements immediately', 'Reduce sun exposure temporarily', 'Increase fluid intake', 'Consult doctor for re-evaluation']
    },
    low: {
      effect: 'Low Vitamin D causes bone weakness, fatigue, low immunity, and muscle pain — very common in India.',
      tips: ['Get 15-20 minutes of morning sunlight daily (before 10 AM)', 'Eat fatty fish, egg yolks, fortified milk', 'Take Vitamin D3 supplements as prescribed (60,000 IU weekly is common in India)', 'Retest after 3 months of supplementation', 'Vitamin D deficiency is extremely common in urban Indians']
    }
  },
  vitaminB12: {
    high: {
      effect: 'Very high B12 can sometimes indicate liver or blood disorders.',
      tips: ['Stop B12 supplements', 'Consult doctor for liver function tests', 'Retest in 3 months']
    },
    low: {
      effect: 'Low B12 causes nerve damage, anemia, brain fog, and fatigue — especially common in vegetarians.',
      tips: ['Take B12 supplements (methylcobalamin) as prescribed', 'Eat dairy, eggs, and meat if non-vegetarian', 'Vegetarians: B12 injections may be more effective than tablets', 'Fortified foods: cereals, plant milk', 'Retest after 3 months']
    }
  },
  hba1c: {
    high: {
      effect: 'High HbA1c means blood sugar has been consistently high for 3 months — indicating diabetes or poor control.',
      tips: ['Strict dietary control: avoid sugar, maida, white rice', 'Daily 45 minutes of exercise', 'Medication review with your diabetologist', 'Monitor blood sugar at home daily', 'Target: bring HbA1c below 7% with treatment']
    },
    low: {
      effect: 'Low HbA1c may indicate hypoglycemia or anemia affecting the reading.',
      tips: ['Consult doctor to rule out anemia', 'Ensure you are not over-medicating for diabetes', 'Maintain regular meal timings']
    }
  },
  platelets: {
    high: {
      effect: 'High platelets may increase risk of blood clots.',
      tips: ['Stay well hydrated', 'Consult doctor if very high (>10 lakh)', 'Avoid prolonged immobility']
    },
    low: {
      effect: 'Low platelets increase bleeding risk — bruising easily, prolonged bleeding from cuts.',
      tips: ['Avoid aspirin and ibuprofen', 'Be careful to avoid injuries', 'Eat papaya leaves — proven to help in dengue-related low platelets', 'Consult doctor urgently if below 50,000', 'Avoid alcohol completely']
    }
  },
  sgpt: {
    high: {
      effect: 'High SGPT indicates liver inflammation or damage.',
      tips: ['Avoid alcohol completely', 'Stop any herbal supplements that may affect liver', 'Eat light, low-fat diet', 'Stay hydrated', 'Consult gastroenterologist', 'Retest in 4-6 weeks']
    },
    low: { effect: 'Low SGPT is normal.', tips: ['Maintain healthy lifestyle'] }
  },
  sgot: {
    high: {
      effect: 'High SGOT can indicate liver, heart, or muscle issues.',
      tips: ['Avoid alcohol', 'Consult doctor to identify cause', 'Rest and light diet', 'Follow up with liver function tests']
    },
    low: { effect: 'Low SGOT is normal.', tips: ['Maintain healthy lifestyle'] }
  },
  wbc: {
    high: {
      effect: 'High WBC usually means your body is fighting an infection or inflammation.',
      tips: ['Rest and complete any prescribed antibiotic course', 'Stay hydrated', 'Consult doctor if fever persists', 'Retest after treatment is complete']
    },
    low: {
      effect: 'Low WBC means weakened immunity — higher risk of infections.',
      tips: ['Avoid crowded places during illness outbreaks', 'Wash hands frequently', 'Eat immunity-boosting foods: turmeric, ginger, garlic', 'Consult doctor — may need further investigation']
    }
  },
  esr: {
    high: {
      effect: 'High ESR indicates inflammation somewhere in the body — infection, autoimmune, or chronic disease.',
      tips: ['Consult doctor to find root cause', 'Anti-inflammatory diet: turmeric, ginger, green leafy vegetables', 'Avoid processed and fried foods', 'Further tests may be needed']
    },
    low: { effect: 'Low ESR is generally normal.', tips: ['Maintain healthy lifestyle'] }
  },
  ferritin: {
    high: {
      effect: 'High ferritin can indicate iron overload, liver disease, or inflammation.',
      tips: ['Stop iron supplements', 'Avoid red meat temporarily', 'Consult doctor for further tests', 'Stay hydrated']
    },
    low: {
      effect: 'Low ferritin means iron stores are depleted — causing fatigue and hair loss even before anemia develops.',
      tips: ['Take iron supplements as prescribed', 'Eat iron-rich foods: red meat, lentils, spinach, jaggery', 'Pair with Vitamin C for better absorption', 'Avoid tea/coffee with meals', 'Retest after 3 months']
    }
  }
}

const getRuleBasedInsight = (key, value) => {
  const range = NORMAL_RANGES[key]
  const insight = INSIGHTS[key]
  if (!range || !insight) return null
  if (value > range.max && insight.high) return { type: 'high', ...insight.high }
  if (value < range.min && insight.low) return { type: 'low', ...insight.low }
  return null
}

const getReportStatus = (parameters) => {
  let abnormal = 0
  let total = 0
  Object.entries(parameters).forEach(([key, param]) => {
    const val = typeof param === 'object' ? param.value : param
    const range = NORMAL_RANGES[key]
    if (range) { total++; if (val < range.min || val > range.max) abnormal++ }
  })
  return { abnormal, total }
}

export default function Dashboard({ user }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [showAllParams, setShowAllParams] = useState(false)
  const [showInsights, setShowInsights] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { loadData() }, [user.uid])

  const loadData = async () => {
    setLoading(true)
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) setUserProfile(userDoc.data())
      const { getUserReports } = await import('../utils/saveReport')
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
    const { deleteReport } = await import('../utils/saveReport')
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
  const totalAbnormal = latestReport ? getReportStatus(latestReport.parameters).abnormal : 0

  // Get insights for abnormal params in latest report
  const insights = latestReport
    ? Object.entries(latestReport.parameters)
        .map(([key, param]) => {
          const val = typeof param === 'object' ? param.value : param
          const insight = getRuleBasedInsight(key, val)
          const label = typeof param === 'object' ? param.label : (NORMAL_RANGES[key]?.label || key)
          return insight ? { key, label, val, unit: typeof param === 'object' ? param.unit : '', ...insight } : null
        })
        .filter(Boolean)
    : []

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

        {/* Health Insights */}
        {insights.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
            <button
              onClick={() => setShowInsights(!showInsights)}
              className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Brain className="w-5 h-5 text-orange-500" />
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-800">Health Insights</p>
                  <p className="text-xs text-gray-400">{insights.length} parameter{insights.length > 1 ? 's' : ''} need attention</p>
                </div>
              </div>
              {showInsights
                ? <ChevronUp className="w-5 h-5 text-gray-400" />
                : <ChevronDown className="w-5 h-5 text-gray-400" />
              }
            </button>

            {showInsights && (
              <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
                {insights.map((insight, idx) => (
                  <div key={idx} className={`rounded-2xl p-4 ${insight.type === 'high' ? 'bg-red-50 border border-red-100' : 'bg-blue-50 border border-blue-100'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-gray-800 text-sm">{insight.label}</p>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${insight.type === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                        {insight.type === 'high' ? '⬆ High' : '⬇ Low'}: {insight.val} {insight.unit}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mb-3">⚠️ {insight.effect}</p>
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-gray-700">💡 What you can do:</p>
                      {insight.tips.map((tip, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-green-500 text-xs mt-0.5 flex-shrink-0">✓</span>
                          <p className="text-xs text-gray-600">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-gray-400 text-center pt-1">
                  ⚕️ Always consult a qualified doctor before making any health decisions.
                </p>
              </div>
            )}
          </div>
        )}

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
              {Object.entries(latestReport.parameters)
                .slice(0, showAllParams ? undefined : 5)
                .map(([key, param]) => {
                  const val = typeof param === 'object' ? param.value : param
                  const label = typeof param === 'object' ? param.label : (NORMAL_RANGES[key]?.label || key)
                  const unit = typeof param === 'object' ? param.unit : ''
                  const range = NORMAL_RANGES[key]
                  const isAbnormal = range && (val < range.min || val > range.max)
                  return (
                    <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-600 flex items-center gap-2">
                        {isAbnormal
                          ? <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          : <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                        }
                        {label}
                      </span>
                      <span className={`text-sm font-semibold ${isAbnormal ? 'text-red-500' : 'text-gray-800'}`}>
                        {typeof val === 'number' && val > 1000 ? val.toLocaleString('en-IN') : val} {unit}
                      </span>
                    </div>
                  )
              })}
            </div>
            {Object.keys(latestReport.parameters).length > 5 && (
              <button
                onClick={() => setShowAllParams(!showAllParams)}
                className="mt-3 w-full text-center text-sm text-indigo-500 font-semibold py-2 hover:bg-indigo-50 rounded-xl transition-colors flex items-center justify-center gap-1"
              >
                {showAllParams
                  ? <><ChevronUp className="w-4 h-4" /> Show Less</>
                  : <><ChevronDown className="w-4 h-4" /> +{Object.keys(latestReport.parameters).length - 5} more parameters</>
                }
              </button>
            )}
          </div>
        )}

        {/* Report History */}
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
                const { abnormal } = getReportStatus(report.parameters)
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
                        {report.reportDate || new Date(report.createdAt).toLocaleDateString('en-IN', {
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