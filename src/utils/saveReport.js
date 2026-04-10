import { db } from '../firebase'
import {
  collection, addDoc, query,
  where, orderBy, getDocs,
  deleteDoc, doc
} from 'firebase/firestore'

import OpenAI from 'openai'

const openrouter = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: import.meta.env.VITE_AI_API_KEY,
  dangerouslyAllowBrowser: true,
  defaultHeaders: {
    'HTTP-Referer': 'https://medilens-ai.vercel.app',
    'X-Title': 'MediLens AI'
  }
})

// ─── CONVERT FILE TO BASE64 ───────────────────────────────────────────────────
const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result) // includes data:mime;base64,...
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── SAVE REPORT ──────────────────────────────────────────────────────────────
export const saveReport = async (userId, reportData, file = null) => {
  try {
    let fileData = null

    // Only store file if it's under 900KB (Firestore 1MB doc limit)
    if (file && file.size < 900 * 1024) {
      fileData = await fileToBase64(file)
    }

    const reportsRef = collection(db, 'reports')
    const docRef = await addDoc(reportsRef, {
      userId,
      fileName: reportData.fileName,
      fileType: reportData.fileType,
      parameters: reportData.parameters,
      processedAt: reportData.processedAt,
      reportDate: reportData.reportDate || null,
      createdAt: new Date().toISOString(),
      fileData: fileData || null
    })

    return { success: true, id: docRef.id }
  } catch (error) {
    console.error('Save error:', error)
    return { success: false, error: error.message }
  }
}

// ─── GET ALL USER REPORTS ─────────────────────────────────────────────────────
export const getUserReports = async (userId) => {
  try {
    const reportsRef = collection(db, 'reports')
    const q = query(
      reportsRef,
      where('userId', '==', userId)
    )
    const snapshot = await getDocs(q)
    const reports = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))
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

// Resolve the best available date for a report:
// Priority: reportDate (date on the printed report) → processedAt (upload date)
const resolveReportDate = (report) => {
  if (report.reportDate) {
    // Try parsing the extracted date string (e.g. "15/03/2025", "15 Mar 2025")
    const parsed = new Date(report.reportDate)
    if (!isNaN(parsed.getTime())) {
      return {
        displayDate: parsed.toLocaleDateString('en-IN', {
          day: '2-digit', month: 'short', year: '2-digit'
        }),
        sortKey: parsed.toISOString()
      }
    }
    // Can't auto-parse (unusual format) — show as-is, sort by upload date
    return { displayDate: report.reportDate, sortKey: report.processedAt }
  }
  // No reportDate extracted — fall back to upload timestamp
  const fallback = new Date(report.processedAt)
  return {
    displayDate: fallback.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: '2-digit'
    }),
    sortKey: report.processedAt
  }
}

export const getTrendsData = (reports) => {
  const trends = {}

  reports.forEach(report => {
    const { displayDate, sortKey } = resolveReportDate(report)

    Object.entries(report.parameters).forEach(([key, param]) => {
      const value = typeof param === 'object' ? param.value : param
      const label = typeof param === 'object' ? param.label : key
      const unit  = typeof param === 'object' ? param.unit  : ''

      if (!trends[key]) {
        trends[key] = { label, unit, data: [] }
      }
      trends[key].data.push({
        date: displayDate,   // actual report date shown on X-axis
        sortKey,             // ISO string for chronological sorting
        value,
        reportId: report.id
      })
    })
  })

  // Sort data points chronologically by the real report date
  Object.keys(trends).forEach(key => {
    trends[key].data.sort((a, b) => new Date(a.sortKey) - new Date(b.sortKey))
  })

  return trends
}