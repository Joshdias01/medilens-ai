import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { LayoutDashboard, Upload, TrendingUp, LogOut, Menu, X, Stethoscope, Bell } from 'lucide-react'

export default function Navbar({ user, userRole }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const navigate = useNavigate()
  const location = useLocation()
  const isDoctor = userRole === 'doctor'

  useEffect(() => {
    if (!user) return
    // Listen for unread notifications
    const field = isDoctor ? 'doctorId' : 'patientId'
    const q = query(
      collection(db, 'reviews'),
      where(field, '==', user.uid),
      where('hasUnread', '==', true)
    )
    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.docs.length)
    })
    return () => unsub()
  }, [user, isDoctor])

  const handleLogout = async () => {
    await signOut(auth)
    toast.success('See you soon! 👋')
    navigate('/login')
  }

  const patientLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { to: '/upload', label: 'Upload', icon: <Upload className="w-4 h-4" /> },
    { to: '/trends', label: 'Trends', icon: <TrendingUp className="w-4 h-4" /> },
  ]

  const doctorLinks = [
    { to: '/doctor', label: 'Dashboard', icon: <Stethoscope className="w-4 h-4" /> },
  ]

  const links = isDoctor ? doctorLinks : patientLinks
  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link to={isDoctor ? '/doctor' : '/dashboard'} className="flex items-center gap-2">
            <div className="w-7 h-7 bg-violet-600 rounded-lg flex items-center justify-center">
              <span className="text-sm">🔬</span>
            </div>
            <div>
              <span className="font-bold text-gray-900 text-sm">MediLens</span>
              {isDoctor && (
                <span className="ml-1.5 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-lg font-medium">
                  Doctor
                </span>
              )}
            </div>
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive(link.to)
                    ? 'bg-violet-50 text-violet-600'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}

            {/* Notification Bell */}
            {unreadCount > 0 && (
              <div className="relative px-3 py-2">
                <Bell className="w-4 h-4 text-gray-500" />
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all ml-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          {/* Mobile */}
          <div className="md:hidden flex items-center gap-2">
            {unreadCount > 0 && (
              <div className="relative">
                <Bell className="w-5 h-5 text-gray-500" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              </div>
            )}
            <button
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden py-3 border-t border-gray-100">
            <div className="flex flex-col gap-1 pb-3">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive(link.to)
                      ? 'bg-violet-50 text-violet-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {link.icon}
                  {link.label}
                </Link>
              ))}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-50 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}