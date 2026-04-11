// ─── DAILY HEALTH REMINDER UTILITY ───────────────────────────────────────────
// Uses the Browser Notifications API to send OS-level health reminders.
// Reminders fire once per day based on localStorage date tracking.
// Tips rotate daily so users get different advice each day.

const STORAGE_KEY_DATE    = 'medilens_last_reminder_date'
const STORAGE_KEY_ENABLED = 'medilens_reminders_enabled'

// ─── TIPS PER PARAMETER (rotate by day of week) ──────────────────────────────
const TIPS = {
  hemoglobin: [
    'Eat iron-rich foods today: spinach, lentils, or jaggery with your meal.',
    'Have lemon water or amla juice with your food to boost iron absorption.',
    'Avoid tea or coffee for 1 hour after eating — they block iron absorption.',
    'Add beetroot to your lunch or dinner — a natural hemoglobin booster.',
    'Consider a short walk today — mild exercise stimulates red blood cell production.',
    '10 minutes of sunlight today helps vitamin D, which supports hemoglobin.',
    'Eat a small handful of raisins or dates as a snack — high in iron.',
  ],
  glucose: [
    'Skip the maida and sugar today — choose whole wheat or brown rice instead.',
    'Go for a 30-minute walk after your largest meal today.',
    'Drink a glass of methi (fenugreek) water on empty stomach this morning.',
    'Eat smaller meals today — avoid a single large meal.',
    'Try bitter gourd (karela) as a side dish today — it naturally lowers sugar.',
    'Stay off packaged snacks today — they spike blood sugar silently.',
    'Check your blood sugar if you feel dizzy or unusually tired today.',
  ],
  cholesterol: [
    'Swap your cooking oil to olive oil or mustard oil for today\'s meals.',
    'Eat a bowl of oats for breakfast — soluble fiber actively lowers cholesterol.',
    'Have a small handful of walnuts today — the best nut for heart health.',
    'Avoid fried foods completely today — just for today.',
    'Go for a 20-minute brisk walk. Cardio is the #1 cholesterol fighter.',
    'Add flaxseeds (alsi) to your dal, curd, or roti today.',
    'Eat an apple today — "an apple a day" is actually proven for cholesterol.',
  ],
  hdl: [
    'Do any cardio today — cycling, swimming, or a brisk walk to raise HDL.',
    'Add olive oil to today\'s salad — healthy fats boost HDL.',
    'Eat fatty fish like mackerel or sardines for lunch or dinner today.',
    'Quit or reduce smoking — every smoke-free day raises your HDL.',
    'Eat a small handful of almonds today — proven to raise good cholesterol.',
    'Avoid trans fats today — check labels and skip anything with "hydrogenated oil".',
    'Try a 10-minute yoga session today — stress reduction helps HDL.',
  ],
  ldl: [
    'Eat oats for breakfast today — beta-glucan in oats scrubs LDL from blood.',
    'Have garlic in today\'s meal — allicin in garlic actively lowers LDL.',
    'Avoid red meat or full-fat dairy today.',
    'Take a 30-minute abrisk walk — even mild cardio reduces LDL over time.',
    'Eat an avocado or use avocado-based dressing today — healthy monounsaturated fats.',
    'Drink green tea today instead of regular tea — EGCG compounds reduce LDL.',
    'Add psyllium husk (isabgol) to a glass of water today — effective LDL reducer.',
  ],
  triglycerides: [
    'Skip sugar and alcohol completely today — they convert directly to triglycerides.',
    'Eat 2 servings of vegetables today with no added sugar.',
    'Have omega-3 rich flaxseed chutney or fish for today\'s meal.',
    'Avoid white rice and maida today — they spike triglycerides just like sugar.',
    'Go for a walk after dinner today — it burns the triglycerides from your meal.',
    'Avoid packaged fruit juices today — 1 glass has 6 teaspoons of sugar.',
    'Eat a small piece of dark chocolate (85%+) — it\'s actually good for fats.',
  ],
  tsh: [
    'Take your thyroid medicine at the same time every morning on empty stomach.',
    'Avoid raw cabbage and broccoli today — cook them to neutralize goitrogens.',
    'Use iodized salt in today\'s cooking — iodine is essential for thyroid function.',
    'Avoid calcium supplements for 4 hours after your thyroid medication.',
    'Manage stress today with 10 minutes of meditation — stress affects thyroid directly.',
    'Avoid soy products today if you take thyroid medication — they affect absorption.',
    'Get some morning sunlight today — Vitamin D supports healthy thyroid function.',
  ],
  vitaminD: [
    'Get 15–20 minutes of direct morning sunlight today (before 10 AM).',
    'Eat egg yolks in today\'s breakfast — a natural Vitamin D source.',
    'Take your Vitamin D3 supplement today if prescribed.',
    'Add fortified milk to your diet today.',
    'Salmon or mackerel for today\'s dinner is an excellent Vitamin D source.',
    'Avoid sunscreen for your 15-minute morning sun exposure today.',
    'Remember: Vitamin D is fat-soluble — take your supplement with a meal that has healthy fats.',
  ],
  vitaminB12: [
    'Take your B12 supplement or methylcobalamin today as prescribed.',
    'Eat eggs or dairy with today\'s meals — natural B12 sources.',
    'If vegetarian: fortified cereals or nutritional yeast is your B12 friend.',
    'Get your B12 checked if you\'ve had nerve tingling, brain fog, or fatigue.',
    'B12 injections are more effective than tablets for severe deficiency — ask your doctor.',
    'Pair your B12 supplement with folate-rich foods like leafy greens today.',
    'Avoid excessive alcohol — it blocks B12 absorption significantly.',
  ],
  creatinine: [
    'Drink 2.5–3 litres of water throughout today — kidneys need hydration to function.',
    'Avoid ibuprofen or diclofenac today — they reduce blood flow to kidneys.',
    'Reduce protein intake slightly today — excess protein makes kidneys work harder.',
    'Skip the gym or reduce intense exercise today — muscle breakdown raises creatinine.',
    'Avoid eating large amounts of red meat for today\'s meals.',
    'Monitor your blood pressure today — hypertension damages kidneys gradually.',
    'Eat cucumber, watermelon, or bottle gourd today — natural diuretics that help kidneys.',
  ],
  uricAcid: [
    'Drink at least 3 litres of water today — it flushes uric acid out of your body.',
    'Avoid red meat, organ meats, and shellfish today completely.',
    'Squeeze lemon into water and drink 2–3 glasses today — alkalizes uric acid.',
    'Eat cherries today — proven to reduce uric acid and prevent gout attacks.',
    'Skip alcohol completely today, especially beer — it blocks uric acid excretion.',
    'Avoid packaged juices and sodas today — fructose directly raises uric acid.',
    'Take your doctor-prescribed uric acid medication today without fail.',
  ],
  sgpt: [
    'Avoid alcohol completely today — liver needs rest.',
    'Stop any herbal supplements unless prescribed — many are toxic to liver.',
    'Eat light today: dal, rice, sabzi — avoid heavy fried foods.',
    'Drink plenty of water today — liver detoxification needs hydration.',
    'Eat a few walnuts today — they contain arginine that detoxes the liver.',
    'Have a glass of fresh sugarcane juice today — a natural liver cleanser.',
    'Avoid paracetamol today unless absolutely necessary — it stresses the liver.',
  ],
  hba1c: [
    'Take your diabetes medication today without skipping.',
    'Walk for 45 minutes today — it\'s the most effective HbA1c reducer.',
    'Avoid sugar, maida, and white rice completely today.',
    'Check your blood sugar today and log it.',
    'Eat a protein-rich breakfast today — it controls blood sugar for hours.',
    'Sleep 7–8 hours tonight — poor sleep directly raises HbA1c levels.',
    'Eat fenugreek seeds soaked overnight in water today on empty stomach.',
  ],
  platelets: [
    'Eat papaya leaf extract today — clinically proven to increase platelets.',
    'Avoid aspirin and ibuprofen today — they thin blood and reduce platelet function.',
    'Drink plenty of water and fresh coconut water today.',
    'Eat pumpkin today — it\'s rich in Vitamin A which supports platelet production.',
    'Avoid alcohol completely today — it suppresses platelet production.',
    'Eat leafy greens today: spinach, methi — Vitamin K supports platelet function.',
    'Get adequate rest today — body produces platelets during deep sleep.',
  ],
  wbc: [
    'Eat turmeric with black pepper today — curcumin boosts immune cell production.',
    'Eat garlic in today\'s meal — allicin is a potent immune system stimulant.',
    'Take Vitamin C today: amla, lemon, or a supplement.',
    'Avoid crowded places today if WBC is critically low — infection risk is high.',
    'Sleep 8 hours tonight — immune cells are produced during deep sleep.',
    'Include ginger in today\'s tea or food — powerful anti-inflammatory.',
    'Wash hands frequently today — most infections enter through hands.',
  ],
  ferritin: [
    'Take your iron supplement today with Vitamin C (not with milk or tea).',
    'Eat iron-rich lentils (masoor dal) for today\'s meal.',
    'Avoid tea or coffee for 1 hour before and after eating iron-rich foods.',
    'Eat beetroot or pomegranate today — they help replenish iron stores.',
    'Pair spinach with tomatoes today — the Vitamin C boosts iron absorption significantly.',
    'Don\'t eat calcium-rich food at the same time as iron-rich food — calcium blocks absorption.',
    'Keep up your iron supplementation consistently — ferritin takes months to rebuild.',
  ],
}

// Fallback tips for any unlisted parameter
const DEFAULT_TIPS = [
  'Drink 8 glasses of water today — most health issues improve with hydration.',
  'Go for a 30-minute walk — exercise improves almost every health parameter.',
  'Eat a balanced meal with vegetables, protein, and whole grains today.',
  'Sleep 7–8 hours tonight — sleep is the body\'s most powerful healer.',
  'Reduce stress today with 10 minutes of deep breathing or meditation.',
  'Avoid processed and packaged foods today.',
  'Consult your doctor if any parameter stays abnormal for more than 2 weeks.',
]

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
  iron:          { min: 60,      max: 170     },
  esr:           { min: 0,       max: 20      },
  crp:           { min: 0,       max: 5       },
}

// ─── GET ABNORMAL PARAMETERS ─────────────────────────────────────────────────
export const getAbnormalForReminder = (parameters) => {
  const abnormal = []
  Object.entries(parameters).forEach(([key, param]) => {
    const value = typeof param === 'object' ? param.value : param
    const label = typeof param === 'object' ? (param.label || key) : key
    const range = NORMAL_RANGES[key]
    if (!range || typeof value !== 'number') return
    if (value > range.max) abnormal.push({ key, label, type: 'high', value })
    else if (value < range.min) abnormal.push({ key, label, type: 'low', value })
  })
  return abnormal
}

// ─── GET TODAY'S TIP (rotates by day of year) ────────────────────────────────
export const getTodaysTip = (key) => {
  const tips = TIPS[key] || DEFAULT_TIPS
  const dayOfYear = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  )
  return tips[dayOfYear % tips.length]
}

// ─── NOTIFICATION PERMISSION ─────────────────────────────────────────────────
export const getNotifSupport = () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export const requestNotifPermission = async (userId = null) => {
  if (!('Notification' in window)) return 'unsupported'

  let result
  try {
    result = await Notification.requestPermission()
  } catch (err) {
    // Some older browsers use callback style
    result = await new Promise(resolve => Notification.requestPermission(resolve))
  }

  // If granted, register FCM token so GitHub Actions can push even when app is closed
  if (result === 'granted' && userId) {
    try {
      const { getOrSaveFcmToken } = await import('../firebase')
      const token = await getOrSaveFcmToken(userId)
      if (token) {
        console.log('[Reminders] FCM token registered ✅', token.slice(0, 20) + '...')
      } else {
        console.warn('[Reminders] FCM token not saved — check VITE_FIREBASE_VAPID_KEY in .env')
      }
    } catch (err) {
      console.warn('[Reminders] FCM registration failed:', err.message)
    }
  }

  return result
}

// ─── SCHEDULER HELPERS ───────────────────────────────────────────────────────
export const remindersEnabled = () =>
  localStorage.getItem(STORAGE_KEY_ENABLED) === 'true'

export const setRemindersEnabled = (val) =>
  localStorage.setItem(STORAGE_KEY_ENABLED, val ? 'true' : 'false')

export const shouldSendToday = () => {
  const last = localStorage.getItem(STORAGE_KEY_DATE)
  if (!last) return true
  return new Date(last).toDateString() !== new Date().toDateString()
}

export const markReminderSentToday = () =>
  localStorage.setItem(STORAGE_KEY_DATE, new Date().toISOString())

// ─── FIRE A BROWSER NOTIFICATION ─────────────────────────────────────────────
// IMPORTANT: new Notification() does NOT work on mobile Chrome — it silently fails.
// We MUST use serviceWorkerRegistration.showNotification() for cross-platform support.
// We also cannot use navigator.serviceWorker.ready blindly — it hangs if SW failed.
export const fireHealthReminder = async (abnormalParam, isSilent = false) => {
  if (Notification.permission !== 'granted') return false

  const { key, label, type } = abnormalParam
  const tip   = getTodaysTip(key)
  const arrow = type === 'high' ? '⬆' : '⬇'
  const emoji = type === 'high' ? '⚠️' : '💙'

  const title   = `${emoji} ${label} is ${type === 'high' ? 'High' : 'Low'} ${arrow}`
  const options = {
    body:               `Today's tip: ${tip}`,
    icon:               '/favicon.ico',
    badge:              '/favicon.ico',
    tag:                `medilens-${key}`,
    requireInteraction: false,
    silent:             isSilent,
  }

  // Try SW-based notification first (required for mobile Chrome, also works on desktop)
  if ('serviceWorker' in navigator) {
    try {
      const origin = window.location.origin
      const regList = await navigator.serviceWorker.getRegistrations()
      // Find an active registration that covers our origin
      const reg = regList.find(r => r.active && r.scope.includes(origin)) ||
                  regList.find(r => r.active) ||
                  regList[0]

      if (reg && reg.active) {
        await reg.showNotification(title, options)
        return true
      }

      // If no active SW yet, try waiting for one (with timeout)
      const swReg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), 4000))
      ])
      await swReg.showNotification(title, options)
      return true
    } catch (swErr) {
      console.warn('[Notif] SW showNotification failed:', swErr.message)
    }
  }

  // Desktop-only fallback (not supported on mobile Chrome)
  try {
    if (typeof Notification !== 'undefined') {
      new Notification(title, options)
      return true
    }
  } catch (fallbackErr) {
    console.warn('[Notif] Fallback Notification failed:', fallbackErr.message)
  }

  return false
}

// ─── FIRE ALL REMINDERS (up to 3 most critical) ───────────────────────────────
export const fireDailyReminders = async (parameters) => {
  if (Notification.permission !== 'granted') return 0
  if (!remindersEnabled()) return 0

  const abnormal = getAbnormalForReminder(parameters)
  if (abnormal.length === 0) return 0

  // Fire up to 3, staggered so OS doesn't collapse them into a group
  const toFire = abnormal.slice(0, 3)
  for (let i = 0; i < toFire.length; i++) {
    await new Promise(resolve => setTimeout(resolve, i * 1500))
    await fireHealthReminder(toFire[i])
  }

  markReminderSentToday()
  return toFire.length
}
