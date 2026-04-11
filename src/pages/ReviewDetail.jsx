import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import {
  doc, getDoc, updateDoc, collection,
  addDoc, onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore'
import { ArrowLeft, Send, CheckCircle, MessageCircle, FileText, Flag } from 'lucide-react'
import toast from 'react-hot-toast'
import { getParameterStatus, KNOWN_RANGES } from '../utils/enrichParameters'

const statusColors = {
  green: { bg: 'bg-white', border: 'border-emerald-100', badge: 'bg-emerald-50 text-emerald-700', text: 'text-emerald-600' },
  red:   { bg: 'bg-white', border: 'border-red-100',     badge: 'bg-red-50 text-red-600',       text: 'text-red-600'   },
  blue:  { bg: 'bg-white', border: 'border-blue-100',    badge: 'bg-blue-50 text-blue-600',     text: 'text-blue-600'  },
  gray:  { bg: 'bg-white', border: 'border-gray-100',    badge: 'bg-gray-100 text-gray-500',    text: 'text-gray-600'  },
}

export default function ReviewDetail({ user, userRole }) {
  const { reviewId } = useParams()
  const navigate = useNavigate()
  const isDoctor = userRole === 'doctor'

  const [review, setReview] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [doctorNotes, setDoctorNotes] = useState('')
  const [flaggedParams, setFlaggedParams] = useState([])
  const [activeTab, setActiveTab] = useState('report')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    loadReview()
    // Listen to messages
    const q = query(
      collection(db, 'chats', reviewId, 'messages'),
      orderBy('createdAt', 'asc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => unsub()
  }, [reviewId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadReview = async () => {
    try {
      const reviewDoc = await getDoc(doc(db, 'reviews', reviewId))
      if (reviewDoc.exists()) {
        const data = { id: reviewDoc.id, ...reviewDoc.data() }
        setReview(data)
        setDoctorNotes(data.doctorNotes || '')
        setFlaggedParams(data.flaggedParams || [])
      }
    } catch (err) {
      toast.error('Failed to load review')
    } finally {
      setLoading(false)
    }

    // Only clear 'hasUnread' for the patient (i.e., when patient opens a completed doctor review)
    // Don't wipe notifications when the doctor opens their own pending review
    if (!isDoctor) {
      await updateDoc(doc(db, 'reviews', reviewId), {
        hasUnread: false
      }).catch(() => {})
    }
  }

  const sendMessage = async () => {
    if (!newMessage.trim()) return
    setSending(true)
    try {
      await addDoc(collection(db, 'chats', reviewId, 'messages'), {
        text: newMessage.trim(),
        senderId: user.uid,
        senderRole: userRole,
        senderName: isDoctor ? `Dr. ${user.displayName?.split(' ').slice(-1)[0]}` : user.displayName?.split(' ')[0],
        createdAt: serverTimestamp()
      })
      // Mark unread for the other party
      await updateDoc(doc(db, 'reviews', reviewId), {
        hasUnread: true,
        lastMessage: newMessage.trim(),
        lastMessageAt: new Date().toISOString()
      })
      setNewMessage('')
    } catch (err) {
      toast.error('Failed to send message')
    } finally {
      setSending(false)
    }
  }

  const toggleFlagParam = (key) => {
    setFlaggedParams(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const completeReview = async () => {
    if (!doctorNotes.trim()) {
      toast.error('Please add your clinical notes before completing the review')
      return
    }
    setCompleting(true)
    try {
      await updateDoc(doc(db, 'reviews', reviewId), {
        status: 'completed',
        doctorNotes,
        flaggedParams,
        completedAt: new Date().toISOString(),
        hasUnread: true
      })

      // Send completion message
      await addDoc(collection(db, 'chats', reviewId, 'messages'), {
        text: `✅ Review completed. Doctor's notes: "${doctorNotes}"`,
        senderId: user.uid,
        senderRole: 'doctor',
        senderName: `Dr. ${user.displayName?.split(' ').slice(-1)[0] || 'Doctor'}`,
        isSystem: true,
        createdAt: serverTimestamp()
      })

      toast.success('Review completed successfully!')
      setReview(prev => ({ ...prev, status: 'completed', doctorNotes, flaggedParams }))
    } catch (err) {
      toast.error('Failed to complete review')
    } finally {
      setCompleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-violet-200 border-t-violet-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Loading review...</p>
        </div>
      </div>
    )
  }

  if (!review) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-400">Review not found</p>
      </div>
    )
  }

  const parameters = review.parameters || {}
  const paramKeys = Object.keys(parameters)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-violet-50/20 pb-12">
      <div className="max-w-2xl mx-auto px-4">

        {/* Header */}
        <div className="flex items-center gap-3 pt-6 mb-5">
          <button
            onClick={() => navigate(isDoctor ? '/doctor' : '/dashboard')}
            className="p-2 hover:bg-white rounded-xl border border-gray-200 transition-all hover:shadow-sm"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">
              {isDoctor ? `${review.patientFirstName || 'Patient'}'s Report` : 'Doctor Review'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                review.status === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {review.status === 'pending' ? '⏳ Pending Review' : '✅ Completed'}
              </span>
              {review.reportDate && (
                <span className="text-xs text-gray-400">· {review.reportDate}</span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100/80 rounded-2xl p-1 mb-5 gap-1">
          {[
            { key: 'report', label: 'Report', icon: <FileText className="w-3.5 h-3.5" /> },
            { key: 'chat', label: 'Chat', icon: <MessageCircle className="w-3.5 h-3.5" /> },
          ].map(tab_ => (
            <button
              key={tab_.key}
              onClick={() => setActiveTab(tab_.key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
                activeTab === tab_.key
                  ? 'bg-white text-violet-600 shadow-md shadow-gray-200/60'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab_.icon}
              {tab_.label}
              {tab_.key === 'chat' && messages.length > 0 && (
                <span className="bg-violet-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                  {messages.length > 9 ? '9+' : messages.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* REPORT TAB */}
        {activeTab === 'report' && (
          <div className="space-y-3 animate-fade-in">

            {/* Doctor completed notes */}
            {review.status === 'completed' && review.doctorNotes && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1.5">
                  <span>👨‍⚕️</span> Doctor's Clinical Notes
                </p>
                <p className="text-sm text-emerald-800 leading-relaxed">{review.doctorNotes}</p>
              </div>
            )}

            {/* Parameters */}
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
              const isFlagged = flaggedParams.includes(key)

              return (
                <div
                  key={key}
                  className={`bg-white border ${
                    isFlagged ? 'border-orange-300 ring-2 ring-orange-100' : colors.border
                  } rounded-2xl p-4 shadow-sm transition-all`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800 text-sm">{label}</p>
                        {isFlagged && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-lg flex items-center gap-1 font-medium">
                            <Flag className="w-3 h-3" /> Flagged
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1 mt-1.5">
                        <p className={`text-xl font-bold ${colors.text}`}>
                          {typeof value === 'number' && value > 1000
                            ? value.toLocaleString('en-IN') : value}
                        </p>
                        <p className="text-xs text-gray-400">{unit}</p>
                      </div>
                      {rangeInfo && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Normal: {rangeInfo.min} – {rangeInfo.max} {rangeInfo.unit}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`${colors.badge} text-xs font-semibold px-2.5 py-1 rounded-full`}>
                        {status}
                      </span>
                      {isDoctor && review.status === 'pending' && (
                        <button
                          onClick={() => toggleFlagParam(key)}
                          className={`text-xs px-2.5 py-1 rounded-lg transition-all font-medium ${
                            isFlagged
                              ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                              : 'bg-gray-100 text-gray-400 hover:bg-orange-50 hover:text-orange-500'
                          }`}
                        >
                          {isFlagged ? '🚩 Flagged' : '🏳 Flag'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Doctor Notes Input */}
            {isDoctor && review.status === 'pending' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-2 shadow-sm">
                <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span>📝</span> Clinical Notes
                </p>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Add your clinical assessment, recommendations, and any follow-up advice for the patient..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-300 text-sm text-gray-800 placeholder-gray-400 resize-none transition-all"
                />
                <button
                  onClick={completeReview}
                  disabled={completing || !doctorNotes.trim()}
                  className="w-full mt-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 text-white font-semibold py-3.5 rounded-2xl transition-all disabled:opacity-40 flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-200"
                >
                  {completing
                    ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    : <CheckCircle className="w-4 h-4" />
                  }
                  {completing ? 'Submitting...' : 'Complete Review & Send to Patient'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <div className="flex flex-col animate-fade-in">
            {/* Chat Info */}
            <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100 rounded-2xl p-3 mb-4 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-violet-500 flex-shrink-0" />
              <p className="text-xs text-violet-600 font-medium">
                {isDoctor
                  ? `Chat with ${review.patientFirstName || 'Patient'} (first name only — privacy protected)`
                  : `Chat with Dr. ${review.doctorName?.split(' ').slice(-1)[0] || 'your doctor'}`
                }
              </p>
            </div>

            {/* Messages */}
            <div className="space-y-3 mb-3 min-h-[300px] max-h-[420px] overflow-y-auto scrollbar-thin pr-1">
              {messages.length === 0 ? (
                <div className="text-center py-14">
                  <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <MessageCircle className="w-7 h-7 text-violet-300" />
                  </div>
                  <p className="text-gray-500 font-medium text-sm">No messages yet</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {isDoctor
                      ? 'Ask the patient for more information if needed'
                      : 'Ask your doctor any questions about your report'
                    }
                  </p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderId === user.uid
                  const isSystem = msg.isSystem
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isSystem ? 'justify-center' : isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      {isSystem ? (
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-2.5 rounded-2xl max-w-[280px] text-center leading-relaxed">
                          {msg.text}
                        </div>
                      ) : (
                        <div className={`max-w-[72%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          <p className={`text-[10px] text-gray-400 mb-1 font-medium ${isMe ? 'text-right' : 'text-left'}`}>
                            {msg.senderName}
                          </p>
                          <div className={`px-4 py-2.5 text-sm leading-relaxed ${
                            isMe
                              ? 'bg-gradient-to-br from-violet-600 to-indigo-500 text-white rounded-2xl rounded-tr-sm shadow-md shadow-violet-200'
                              : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm shadow-sm'
                          }`}>
                            {msg.text}
                          </div>
                          {msg.createdAt && (
                            <p className="text-[10px] text-gray-300 mt-1">
                              {msg.createdAt.toDate?.()?.toLocaleTimeString('en-IN', {
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={isDoctor ? "Ask the patient..." : "Ask your doctor..."}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-300 text-sm text-gray-800 placeholder-gray-400 transition-all shadow-sm"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                className="bg-gradient-to-br from-violet-600 to-indigo-500 hover:from-violet-700 hover:to-indigo-600 text-white p-3 rounded-2xl transition-all disabled:opacity-40 flex-shrink-0 shadow-md shadow-violet-200"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}