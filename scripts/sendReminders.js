// ─── MEDILENS AI — DAILY HEALTH REMINDER SENDER ──────────────────────────────
// Runs daily via GitHub Actions at 9 AM IST (3:30 AM UTC).
// Reads all users from Firestore who have FCM tokens + reminders enabled,
// checks their latest report for abnormal parameters, and sends personalized
// push notifications via Firebase Cloud Messaging (FCM).
//
// SETUP: Add FIREBASE_SERVICE_ACCOUNT as a GitHub Secret (see README).

'use strict'

const admin = require('firebase-admin')

// ─── INITIALIZE ───────────────────────────────────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db        = admin.firestore()
const messaging = admin.messaging()

// ─── NORMAL RANGES ────────────────────────────────────────────────────────────
const NORMAL_RANGES = {
  hemoglobin:    { min: 12,      max: 17,      label: 'Hemoglobin'           },
  wbc:           { min: 4000,    max: 10000,   label: 'WBC Count'            },
  rbc:           { min: 3.8,     max: 5.5,     label: 'RBC Count'            },
  pcv:           { min: 36,      max: 46,      label: 'PCV / Hematocrit'     },
  platelets:     { min: 150000,  max: 450000,  label: 'Platelet Count'       },
  glucose:       { min: 70,      max: 100,     label: 'Fasting Glucose'      },
  hba1c:         { min: 4,       max: 5.7,     label: 'HbA1c'                },
  cholesterol:   { min: 0,       max: 200,     label: 'Total Cholesterol'    },
  hdl:           { min: 40,      max: 60,      label: 'HDL Cholesterol'      },
  ldl:           { min: 0,       max: 130,     label: 'LDL Cholesterol'      },
  triglycerides: { min: 0,       max: 150,     label: 'Triglycerides'        },
  creatinine:    { min: 0.6,     max: 1.2,     label: 'Creatinine'           },
  uricAcid:      { min: 3.5,     max: 7.2,     label: 'Uric Acid'            },
  sgpt:          { min: 7,       max: 40,      label: 'SGPT (ALT)'           },
  sgot:          { min: 10,      max: 40,      label: 'SGOT (AST)'           },
  tsh:           { min: 0.4,     max: 4.0,     label: 'TSH'                  },
  t3:            { min: 0.8,     max: 2.0,     label: 'T3 (Total)'           },
  t4:            { min: 5.1,     max: 14.1,    label: 'T4 (Total)'           },
  vitaminD:      { min: 20,      max: 100,     label: 'Vitamin D'            },
  vitaminB12:    { min: 200,     max: 900,     label: 'Vitamin B12'          },
  ferritin:      { min: 12,      max: 150,     label: 'Ferritin'             },
  iron:          { min: 60,      max: 170,     label: 'Serum Iron'           },
  esr:           { min: 0,       max: 20,      label: 'ESR'                  },
  crp:           { min: 0,       max: 5,       label: 'CRP'                  },
}

// ─── TIPS (rotate by day of year so users get different tips daily) ────────────
const TIPS = {
  hemoglobin:    ['Eat iron-rich foods: spinach, lentils, or jaggery.', 'Have lemon water to boost iron absorption.', 'Avoid tea/coffee for 1hr after eating.', 'Add beetroot to your meal — natural hemoglobin booster.', 'Short walk today stimulates red blood cell production.', '10 min of sunlight helps Vitamin D + hemoglobin.', 'Eat raisins or dates as a snack — high in iron.'],
  glucose:       ['Skip maida and sugar today — choose whole wheat.', 'Walk 30 min after your largest meal.', 'Drink methi water on empty stomach.', 'Eat smaller meals today.', 'Try bitter gourd as a side dish.', 'Stay off packaged snacks — they spike sugar.', 'Check blood sugar if dizzy or unusually tired.'],
  cholesterol:   ['Use olive or mustard oil today.', 'Eat oats for breakfast — soluble fiber lowers cholesterol.', 'Have a small handful of walnuts.', 'Avoid fried foods completely today.', 'Go for a 20-min brisk walk.', 'Add flaxseeds to your dal or roti.', 'Eat an apple — proven to lower cholesterol.'],
  hdl:           ['Do any cardio today to raise HDL.', 'Add olive oil to today\'s salad.', 'Eat fatty fish like mackerel for dinner.', 'Every smoke-free day raises your HDL.', 'Eat a small handful of almonds.', 'Avoid trans fats — skip anything with hydrogenated oil.', 'Try 10 min yoga — stress reduction helps HDL.'],
  ldl:           ['Oats for breakfast — beta-glucan scrubs LDL.', 'Have garlic in today\'s meal.', 'Avoid red meat or full-fat dairy today.', 'Walk 30 min — cardio reduces LDL over time.', 'Drink green tea instead of regular tea.', 'Add psyllium husk (isabgol) to water.', 'Eat avocado — healthy fats lower LDL.'],
  triglycerides: ['Skip sugar and alcohol today.', 'Eat 2 servings of vegetables today.', 'Have flaxseed or fish for omega-3.', 'Avoid white rice and maida today.', 'Walk after dinner — burns triglycerides.', 'Avoid packaged juices — 6 tsp sugar per glass.', 'Dark chocolate (85%+) is actually good for lipids.'],
  tsh:           ['Take thyroid medicine same time every morning.', 'Avoid raw cabbage and broccoli today.', 'Use iodized salt today.', 'Avoid calcium supplements 4hr after thyroid meds.', '10 min meditation — stress directly affects thyroid.', 'Avoid soy products if on thyroid medication.', 'Morning sunlight — Vitamin D supports thyroid.'],
  vitaminD:      ['Get 15–20 min morning sunlight (before 10 AM).', 'Eat egg yolks for breakfast.', 'Take your Vitamin D3 supplement today.', 'Have fortified milk today.', 'Salmon or mackerel for dinner.', 'No sunscreen for your 15-min morning sun session.', 'Take supplement with a meal that has healthy fats.'],
  vitaminB12:    ['Take methylcobalamin supplement today.', 'Eat eggs or dairy with today\'s meals.', 'Fortified cereals or nutritional yeast for vegetarians.', 'B12 injections are more effective for severe deficiency.', 'Pair B12 with folate-rich leafy greens.', 'Avoid excess alcohol — it blocks B12 absorption.', 'Get B12 checked if you have nerve tingling or brain fog.'],
  creatinine:    ['Drink 2.5–3 litres of water today.', 'Avoid ibuprofen/diclofenac today.', 'Reduce protein slightly — excess stresses kidneys.', 'Skip intense gym today — muscle breakdown raises creatinine.', 'Avoid large amounts of red meat today.', 'Monitor blood pressure — hypertension damages kidneys.', 'Eat cucumber or watermelon — natural diuretics.'],
  uricAcid:      ['Drink 3 litres of water — flushes uric acid.', 'Avoid red meat, organ meats, shellfish today.', 'Squeeze lemon in water — alkalizes uric acid.', 'Eat cherries — proven to reduce uric acid.', 'No alcohol today, especially beer.', 'Avoid packaged juices — fructose raises uric acid.', 'Take uric acid medication without fail today.'],
  sgpt:          ['Avoid alcohol completely today.', 'Skip herbal supplements unless prescribed.', 'Eat light today — dal, rice, sabzi.', 'Drink plenty of water — liver needs hydration.', 'Eat walnuts — arginine detoxes the liver.', 'Fresh sugarcane juice is a natural liver cleanser.', 'Avoid paracetamol unless necessary.'],
  hba1c:         ['Take diabetes medication without skipping.', 'Walk 45 min — most effective HbA1c reducer.', 'Avoid sugar, maida, white rice today.', 'Check blood sugar and log it.', 'Eat protein-rich breakfast — controls blood sugar.', 'Sleep 7–8 hours — poor sleep raises HbA1c.', 'Eat soaked fenugreek seeds on empty stomach.'],
  ferritin:      ['Take iron supplement with Vitamin C today.', 'Eat masoor dal for iron.', 'No tea/coffee 1hr before/after iron foods.', 'Eat beetroot or pomegranate today.', 'Pair spinach with tomatoes — boosts absorption.', 'Don\'t eat calcium and iron-rich foods together.', 'Keep up iron supplementation — ferritin takes months.'],
}

const DEFAULT_TIPS = [
  'Drink 8 glasses of water today.',
  'Walk 30 minutes — improves almost every health parameter.',
  'Eat a balanced meal with vegetables, protein, and whole grains.',
  'Sleep 7–8 hours tonight.',
  'Reduce stress with 10 minutes of deep breathing.',
  'Avoid processed foods today.',
  'Consult your doctor if any parameter stays abnormal.',
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const getDayOfYear = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now - start) / 86400000)
}

const getTodaysTip = (key) => {
  const tips = TIPS[key] || DEFAULT_TIPS
  return tips[getDayOfYear() % tips.length]
}

const getAbnormalParams = (parameters) => {
  const result = []
  for (const [key, param] of Object.entries(parameters)) {
    const value = typeof param === 'object' ? param.value : param
    const label = typeof param === 'object' ? (param.label || key) : key
    const range = NORMAL_RANGES[key]
    if (!range || typeof value !== 'number') continue
    if (value > range.max) result.push({ key, label, type: 'high', value })
    else if (value < range.min) result.push({ key, label, type: 'low', value })
  }
  return result
}

// ─── SEND FCM TO ONE TOKEN ────────────────────────────────────────────────────
const sendToToken = async (token, abnormalParams, firstName) => {
  if (abnormalParams.length === 0) return 'skipped'

  const param = abnormalParams[0]
  const tip = getTodaysTip(param.key)
  const arrow = param.type === 'high' ? '⬆' : '⬇'
  const emoji = param.type === 'high' ? '⚠️' : '💙'

  const message = {
    token,
    notification: {
      title: `${emoji} ${param.label} is ${param.type === 'high' ? 'High' : 'Low'} ${arrow}`,
      body: `Today's tip: ${tip}`,
    },
    webpush: {
      notification: {
        icon: 'https://medilens-ai.vercel.app/favicon.ico',
        badge: 'https://medilens-ai.vercel.app/favicon.ico',
        tag: `medilens-${param.key}`,
        requireInteraction: false,
        click_action: 'https://medilens-ai.vercel.app/dashboard',
      },
      fcmOptions: { link: 'https://medilens-ai.vercel.app/dashboard' },
    },
    data: {
      type: 'health-reminder',
      paramKey: param.key,
      paramLabel: param.label,
      abnormalType: param.type,
      tip,
    },
  }

  try {
    const response = await messaging.send(message)
    console.log(`  ✅ Token ...${token.slice(-8)} → ${firstName} (${param.label}):`, response)
    return 'ok'
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered') {
      console.warn(`  ⚠️ Stale token ...${token.slice(-8)} — will remove.`)
      return 'stale'
    }
    console.error(`  ❌ Token ...${token.slice(-8)} failed:`, err.message)
    return 'error'
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function sendDailyReminders() {
  console.log(`\n🔔 MediLens Daily Reminder Job — ${new Date().toISOString()}\n`)

  const usersSnap = await db.collection('users')
    .where('remindersEnabled', '==', true)
    .get()

  if (usersSnap.empty) {
    console.log('No users with reminders enabled.')
    return
  }

  console.log(`Found ${usersSnap.size} users with reminders enabled.\n`)

  let sent = 0, failed = 0, skipped = 0

  for (const userDoc of usersSnap.docs) {
    const userData  = userDoc.data()
    const firstName = userData.name?.split(' ')[0] || 'User'

    // Support both new fcmTokens[] array and legacy single fcmToken field
    const tokens = Array.isArray(userData.fcmTokens) && userData.fcmTokens.length > 0
      ? userData.fcmTokens
      : userData.fcmToken
        ? [userData.fcmToken]
        : []

    if (tokens.length === 0) {
      console.log(`⚪ ${firstName} — no FCM token on any device, skipping.`)
      skipped++
      continue
    }

    // Get their latest report
    const reportsSnap = await db.collection('reports')
      .where('userId', '==', userDoc.id)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    if (reportsSnap.empty) {
      console.log(`⚪ ${firstName} — no reports found, skipping.`)
      skipped++
      continue
    }

    const report   = reportsSnap.docs[0].data()
    const abnormal = getAbnormalParams(report.parameters || {})

    if (abnormal.length === 0) {
      console.log(`✓ ${firstName} — all parameters normal, skipping.`)
      skipped++
      continue
    }

    console.log(`\n👤 ${firstName} — ${tokens.length} device(s), ${abnormal.length} abnormal param(s)`)

    // Send to every registered device
    const staleTokens = []
    for (const token of tokens) {
      const result = await sendToToken(token, abnormal, firstName)
      if (result === 'ok')    sent++
      if (result === 'error') failed++
      if (result === 'stale') { staleTokens.push(token); failed++ }
    }

    // Remove stale tokens from Firestore array
    if (staleTokens.length > 0) {
      await db.collection('users').doc(userDoc.id).update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...staleTokens)
      }).catch(() => {})
    }
  }

  console.log(`\n📊 Results: ${sent} sent | ${failed} failed | ${skipped} skipped\n`)
}

sendDailyReminders()
  .then(() => process.exit(0))
  .catch((err) => { console.error('Fatal:', err); process.exit(1) })
