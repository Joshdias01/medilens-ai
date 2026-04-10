import { useState, useEffect } from 'react'
import { db } from '../firebase'
import {
  collection, query, where,
  onSnapshot, doc, getDoc, updateDoc
} from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { Stethoscope, Clock, CheckCircle, AlertTriangle, ChevronRight, User, Shield, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function DoctorDashboard({ user }) {
  const [reviews, setReviews] = useState([])
  const [doctorProfile, setDoctorProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pending')
  const navigate = useNavigate()

  useEffect(() => {
    loadProfile()
    const q = query(
      collection(db, 'reviews'),
      where('doctorId', '==', user.uid)
    )
    const unsub = onSnapshot(q, async (snap) => {
      const reviewsData = await Promise.all(
        snap.docs.map(async (d) => {
          const data = { id: d.id, ...d.data() }
          return data
        })
      )
      reviewsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setReviews(reviewsData)
      setLoading(false)
    })
    return () => unsub()
  }, [user.uid])

  const loadProfile = async () => {
    const docSnap = await getDoc(doc(db, 'users', user.uid))
    if (docSnap.exists()) setDoctorProfile(docSnap.data())
  }

  const pendingReviews = reviews.filter(r => r.status === 'pending')
  const completedReviews = reviews.filter(r => r.status === 'completed')
  const shownReviews = tab === 'pending' ? pendingReviews : completedReviews

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-2xl mx-auto px-4">

        {/* Header */}
        <div className="pt-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                Dr. {doctorProfile?.name?.split(' ').slice(-1)[0] || 'Doctor'} 👋
              </h1>
              <p className="text-gray-400 text-sm">{doctorProfile?.specialization || 'Doctor'}</p>
            </div>
            {/* Verification Badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold ${
              doctorProfile?.verified
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {doctorProfile?.verified
                ? <><ShieldCheck className="w-3.5 h-3.5" /> Verified</>
                : <><Shield className="w-3.5 h-3.5" /> Pending Verification</>
              }
            </div>
          </div>

          {!doctorProfile?.verified && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
              <p className="text-xs text-amber-700">
                ⏳ Your account is under review. You can still accept and review patient reports — verification confirms your credentials publicly.
              </p>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
            <p className="text-2xl font-bold text-amber-500">{pendingReviews.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Pending</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
            <p className="text-2xl font-bold text-emerald-500">{completedReviews.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Completed</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center border border-gray-100">
            <p className="text-2xl font-bold text-violet-600">{reviews.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-4">
          <button
            onClick={() => setTab('pending')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'pending' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending ({pendingReviews.length})
          </button>
          <button
            onClick={() => setTab('completed')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              tab === 'completed' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Done ({completedReviews.length})
          </button>
        </div>

        {/* Reviews List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto" />
            <p className="text-gray-400 text-sm mt-3">Loading reviews...</p>
          </div>
        ) : shownReviews.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <div className="text-4xl mb-3">{tab === 'pending' ? '🎉' : '📋'}</div>
            <p className="font-semibold text-gray-600">
              {tab === 'pending' ? 'No pending reviews!' : 'No completed reviews yet'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {tab === 'pending'
                ? 'You\'re all caught up. New requests will appear here.'
                : 'Completed reviews will show here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shownReviews.map((review) => (
              <div
                key={review.id}
                onClick={() => navigate(`/review/${review.id}`)}
                className="bg-white rounded-2xl border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-all active:scale-95"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      review.status === 'pending' ? 'bg-amber-100' : 'bg-emerald-100'
                    }`}>
                      <User className={`w-5 h-5 ${
                        review.status === 'pending' ? 'text-amber-600' : 'text-emerald-600'
                      }`} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800 text-sm">
                        {review.patientFirstName || 'Patient'}'s Report
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Age {review.patientAge} · {review.reportType || 'Lab Report'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(review.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit', month: 'short', year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      review.status === 'pending'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {review.status === 'pending' ? '⏳ Pending' : '✅ Done'}
                    </span>
                    {review.abnormalCount > 0 && (
                      <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {review.abnormalCount} abnormal
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}