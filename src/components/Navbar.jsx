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

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

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
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100/80 sticky top-0 z-50 shadow-sm shadow-gray-100/50">
      <div className="max-w-3xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link to={isDoctor ? '/doctor' : '/dashboard'} className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 bg-gradient-to-br from-violet-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-md shadow-violet-200 group-hover:shadow-violet-300 transition-shadow">
              <span className="text-sm">🔬</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-gray-900 text-sm tracking-tight">MediLens</span>
              <span className="font-bold text-sm tracking-tight gradient-text">AI</span>
              {isDoctor && (
                <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-lg font-semibold">
                  Doctor
                </span>
              )}
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(link.to)
                    ? 'bg-violet-50 text-violet-600 shadow-sm'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}

            {/* Bell */}
            <button
              onClick={() => navigate(isDoctor ? '/doctor' : '/dashboard')}
              className="relative px-3 py-2 hover:bg-gray-100 rounded-xl transition-colors ml-0.5"
              title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
            >
              <Bell className={`w-4 h-4 ${unreadCount > 0 ? 'text-violet-500' : 'text-gray-400'}`} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold pulse-ring">
                  {unreadCount}
                </span>
              )}
            </button>

            <div className="w-px h-5 bg-gray-200 mx-1" />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          {/* Mobile: Bell + Hamburger */}
          <div className="md:hidden flex items-center gap-1">
            <button
              onClick={() => navigate(isDoctor ? '/doctor' : '/dashboard')}
              className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-violet-500' : 'text-gray-400'}`} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
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
          <div className="md:hidden py-3 border-t border-gray-100 animate-slide-up">
            <div className="flex flex-col gap-1 pb-3">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive(link.to)
                      ? 'bg-violet-50 text-violet-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {link.icon}
                  {link.label}
                  {isActive(link.to) && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500" />
                  )}
                </Link>
              ))}
              <div className="h-px bg-gray-100 mx-2 my-1" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-red-400 hover:bg-red-50 transition-all"
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