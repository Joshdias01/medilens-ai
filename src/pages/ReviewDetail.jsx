import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db } from '../firebase'
import {
  doc, getDoc, updateDoc, collection,
  addDoc, onSnapshot, query, orderBy, serverTimestamp
} from 'firebase/firestore'
import { ArrowLeft, Send, CheckCircle, AlertTriangle, MessageCircle, FileText, Flag } from 'lucide-react'
import toast from 'react-hot-toast'
import { getParameterStatus, KNOWN_RANGES } from '../utils/enrichParameters'

const statusColors = {
  green: { bg: 'bg-green-50', border: 'border-green-100', badge: 'bg-green-100 text-green-700', text: 'text-green-700' },
  red:   { bg: 'bg-red-50',   border: 'border-red-100',   badge: 'bg-red-100 text-red-700',     text: 'text-red-700'   },
  blue:  { bg: 'bg-blue-50',  border: 'border-blue-100',  badge: 'bg-blue-100 text-blue-700',   text: 'text-blue-700'  },
  gray:  { bg: 'bg-gray-50',  border: 'border-gray-100',  badge: 'bg-gray-100 text-gray-500',   text: 'text-gray-600'  },
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

    // Mark as read
    await updateDoc(doc(db, 'reviews', reviewId), {
      hasUnread: false
    }).catch(() => {})
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600" />
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
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-2xl mx-auto px-4">

        {/* Header */}
        <div className="flex items-center gap-3 pt-6 mb-5">
          <button
            onClick={() => navigate(isDoctor ? '/doctor' : '/dashboard')}
            className="p-2 hover:bg-white rounded-xl border border-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900">
              {isDoctor ? `${review.patientFirstName || 'Patient'}'s Report` : 'Doctor Review'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                review.status === 'pending'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {review.status === 'pending' ? '⏳ Pending' : '✅ Completed'}
              </span>
              {review.reportDate && (
                <span className="text-xs text-gray-400">· {review.reportDate}</span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
          {[
            { key: 'report', label: 'Report', icon: <FileText className="w-3.5 h-3.5" /> },
            { key: 'chat', label: 'Chat', icon: <MessageCircle className="w-3.5 h-3.5" /> },
          ].map(tab_ => (
            <button
              key={tab_.key}
              onClick={() => setActiveTab(tab_.key)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === tab_.key ? 'bg-white text-violet-600 shadow-sm' : 'text-gray-500'
              }`}
            >
              {tab_.icon}
              {tab_.label}
              {tab_.key === 'chat' && messages.length > 0 && (
                <span className="bg-violet-600 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                  {messages.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* REPORT TAB */}
        {activeTab === 'report' && (
          <div className="space-y-3">

            {/* Doctor completed notes */}
            {review.status === 'completed' && review.doctorNotes && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-emerald-700 mb-1">
                  👨‍⚕️ Doctor's Clinical Notes
                </p>
                <p className="text-sm text-emerald-800">{review.doctorNotes}</p>
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
                    isFlagged ? 'border-orange-300 ring-1 ring-orange-200' : colors.border
                  } rounded-2xl p-4`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800 text-sm">{label}</p>
                        {isFlagged && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-lg flex items-center gap-1">
                            <Flag className="w-3 h-3" /> Flagged
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1 mt-1">
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
                      {/* Doctor can flag parameters */}
                      {isDoctor && review.status === 'pending' && (
                        <button
                          onClick={() => toggleFlagParam(key)}
                          className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                            isFlagged
                              ? 'bg-orange-100 text-orange-600'
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
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mt-4">
                <p className="text-sm font-bold text-gray-800 mb-3">📝 Clinical Notes</p>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Add your clinical assessment, recommendations, and any follow-up advice for the patient..."
                  rows={4}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-800 placeholder-gray-400 resize-none"
                />
                <button
                  onClick={completeReview}
                  disabled={completing || !doctorNotes.trim()}
                  className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3.5 rounded-2xl transition-all disabled:opacity-40 flex items-center justify-center gap-2 text-sm shadow-md"
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
          <div className="flex flex-col">
            {/* Chat Info */}
            <div className="bg-violet-50 border border-violet-100 rounded-2xl p-3 mb-4 flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-violet-500 flex-shrink-0" />
              <p className="text-xs text-violet-600">
                {isDoctor
                  ? `Chat with ${review.patientFirstName || 'Patient'} (first name only — privacy protected)`
                  : `Chat with your reviewing doctor`
                }
              </p>
            </div>

            {/* Messages */}
            <div className="space-y-3 mb-4 min-h-[300px] max-h-[400px] overflow-y-auto">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">💬</p>
                  <p className="text-gray-400 text-sm">No messages yet</p>
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
                        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs px-4 py-2 rounded-2xl max-w-xs text-center">
                          {msg.text}
                        </div>
                      ) : (
                        <div className={`max-w-xs ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                          <p className={`text-xs text-gray-400 mb-1 ${isMe ? 'text-right' : 'text-left'}`}>
                            {msg.senderName}
                          </p>
                          <div className={`px-4 py-2.5 rounded-2xl text-sm ${
                            isMe
                              ? 'bg-violet-600 text-white rounded-tr-sm'
                              : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm'
                          }`}>
                            {msg.text}
                          </div>
                          {msg.createdAt && (
                            <p className="text-xs text-gray-300 mt-1">
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
            <div className="flex gap-2 sticky bottom-0">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={isDoctor ? "Ask the patient..." : "Ask your doctor..."}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-sm text-gray-800 placeholder-gray-400"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                className="bg-violet-600 hover:bg-violet-700 text-white p-3 rounded-2xl transition-all disabled:opacity-40 flex-shrink-0"
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