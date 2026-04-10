import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { auth, db } from './firebase'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Results from './pages/Results'
import Trends from './pages/Trends'
import DoctorDashboard from './pages/DoctorDashboard'
import ReviewDetail from './pages/ReviewDetail'
import Navbar from './components/Navbar'
import { Toaster } from 'react-hot-toast'

function App() {
  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser)
        // Fetch role from Firestore
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role || 'patient')
        }
      } else {
        setUser(null)
        setUserRole(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
        <div className="text-center">
          <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔬</span>
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto mt-4" />
          <p className="text-gray-400 text-sm mt-3">Loading MediLens AI...</p>
        </div>
      </div>
    )
  }

  const isDoctor = userRole === 'doctor'

  return (
    <Router>
      <Toaster position="top-center" toastOptions={{
        style: { borderRadius: '12px', fontSize: '14px' }
      }} />
      {user && <Navbar user={user} userRole={userRole} />}
      <Routes>
        <Route path="/" element={
          !user ? <Navigate to="/login" /> :
          isDoctor ? <Navigate to="/doctor" /> :
          <Navigate to="/dashboard" />
        } />
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/register" element={!user ? <Register /> : <Navigate to="/" />} />

        {/* Patient Routes */}
        <Route path="/dashboard" element={user && !isDoctor ? <Dashboard user={user} /> : <Navigate to="/" />} />
        <Route path="/upload" element={user && !isDoctor ? <Upload user={user} /> : <Navigate to="/" />} />
        <Route path="/results" element={user && !isDoctor ? <Results user={user} /> : <Navigate to="/" />} />
        <Route path="/trends" element={user && !isDoctor ? <Trends user={user} /> : <Navigate to="/" />} />

        {/* Doctor Routes */}
        <Route path="/doctor" element={user && isDoctor ? <DoctorDashboard user={user} /> : <Navigate to="/" />} />
        <Route path="/review/:reviewId" element={user ? <ReviewDetail user={user} userRole={userRole} /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  )
}

export default App