import { db } from '../firebase'
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc
} from 'firebase/firestore'

// ─── SAVE REPORT TO FIRESTORE ─────────────────────────────────────────────────
export const saveReport = async (userId, reportData) => {
  try {
    const reportsRef = collection(db, 'reports')
    const docRef = await addDoc(reportsRef, {
      userId,
      fileName: reportData.fileName,
      fileType: reportData.fileType,
      parameters: reportData.parameters,
      processedAt: reportData.processedAt,
      createdAt: new Date().toISOString()
    })
    return { success: true, id: docRef.id }
  } catch (error) {
    console.error('Save error:', error)
    return { success: false, error: error.message }
  }
}

// ─── GET ALL REPORTS FOR USER ─────────────────────────────────────────────────
export const getUserReports = async (userId) => {
  try {
    const reportsRef = collection(db, 'reports')
    // Simplified query - no orderBy to avoid index requirement
    const q = query(
      reportsRef,
      where('userId', '==', userId)
    )
    const snapshot = await getDocs(q)
    const reports = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    // Sort on client side instead
    reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    return reports
  } catch (error) {
    console.error('Fetch error:', error)
    return []
  }
}

// ─── DELETE REPORT ────────────────────────────────────────────────────────────
export const deleteReport = async (reportId) => {
  try {
    await deleteDoc(doc(db, 'reports', reportId))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ─── GET TRENDS DATA ──────────────────────────────────────────────────────────
// Returns time-series data for each parameter
export const getTrendsData = (reports) => {
  const trends = {}

  reports.forEach(report => {
    const date = new Date(report.processedAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    })

    Object.entries(report.parameters).forEach(([key, param]) => {
      const value = typeof param === 'object' ? param.value : param
      const label = typeof param === 'object' ? param.label : key
      const unit = typeof param === 'object' ? param.unit : ''

      if (!trends[key]) {
        trends[key] = { label, unit, data: [] }
      }
      trends[key].data.push({ date, value, reportId: report.id })
    })
  })

  // Sort each parameter's data by date
  Object.keys(trends).forEach(key => {
    trends[key].data.sort((a, b) => new Date(a.date) - new Date(b.date))
  })

  return trends
}