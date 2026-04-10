import { useState } from 'react'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Eye, EyeOff } from 'lucide-react'

export default function Register() {
  const [role, setRole] = useState('patient')
  const [form, setForm] = useState({
    name: '', dob: '', email: '', password: '',
    specialization: '', regNumber: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const calculateAge = (dob) => {
    const today = new Date()
    const birth = new Date(dob)
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    const age = calculateAge(form.dob)
    if (age < 1 || age > 120) {
      toast.error('Please enter a valid date of birth')
      return
    }
    if (role === 'doctor' && !form.regNumber) {
      toast.error('Medical registration number is required')
      return
    }
    setLoading(true)
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, form.email, form.password)
      await updateProfile(userCredential.user, { displayName: form.name })

      const userData = {
        name: form.name,
        dob: form.dob,
        age,
        email: form.email,
        role,
        createdAt: new Date().toISOString(),
      }

      if (role === 'doctor') {
        userData.specialization = form.specialization || 'General Physician'
        userData.regNumber = form.regNumber
        userData.verified = false // needs admin approval
        userData.rating = 0
        userData.reviewsCount = 0
      }

      await setDoc(doc(db, 'users', userCredential.user.uid), userData)
      toast.success(role === 'doctor' ? 'Doctor account created! Awaiting verification.' : 'Welcome to MediLens! 🎉')
      navigate('/')
    } catch (error) {
      if (error.code === 'auth/email-already-in-use') toast.error('Email already registered')
      else if (error.code === 'auth/weak-password') toast.error('Password must be at least 6 characters')
      else toast.error('Registration failed. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const age = form.dob ? calculateAge(form.dob) : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-600 rounded-2xl mb-3 shadow-lg shadow-violet-200">
            <span className="text-2xl">🔬</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">MediLens AI</h1>
          <p className="text-gray-400 text-sm mt-1">Your personal health companion</p>
        </div>

        {/* Role Toggle */}
        <div className="flex bg-gray-100 rounded-2xl p-1 mb-6">
          <button
            type="button"
            onClick={() => setRole('patient')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              role === 'patient'
                ? 'bg-white text-violet-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            🙋 I'm a Patient
          </button>
          <button
            type="button"
            onClick={() => setRole('doctor')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              role === 'doctor'
                ? 'bg-white text-violet-600 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            👨‍⚕️ I'm a Doctor
          </button>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-7">
          <h2 className="text-lg font-bold text-gray-900 mb-1">
            {role === 'doctor' ? 'Doctor Registration' : 'Create your account'}
          </h2>
          <p className="text-gray-400 text-sm mb-5">
            {role === 'doctor'
              ? 'Your account will be verified before activation'
              : 'Start tracking your health today'}
          </p>

          <form onSubmit={handleRegister} className="space-y-4">

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {role === 'doctor' ? 'Full Name (as per registration)' : 'Full Name'}
              </label>
              <input
                type="text"
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder={role === 'doctor' ? 'Dr. Rajesh Kumar' : 'Rahul Sharma'}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white focus:border-transparent text-gray-800 placeholder-gray-400 transition-all text-sm"
              />
            </div>

            {/* Doctor specific fields */}
            {role === 'doctor' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Specialization</label>
                  <select
                    name="specialization"
                    value={form.specialization}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-gray-800 transition-all text-sm"
                  >
                    <option value="">Select specialization</option>
                    <option value="General Physician">General Physician</option>
                    <option value="Cardiologist">Cardiologist</option>
                    <option value="Endocrinologist">Endocrinologist</option>
                    <option value="Hematologist">Hematologist</option>
                    <option value="Nephrologist">Nephrologist</option>
                    <option value="Diabetologist">Diabetologist</option>
                    <option value="Pathologist">Pathologist</option>
                    <option value="Internal Medicine">Internal Medicine</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Medical Registration Number
                  </label>
                  <input
                    type="text"
                    name="regNumber"
                    required
                    value={form.regNumber}
                    onChange={handleChange}
                    placeholder="KMC-12345 or MCI-67890"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white text-gray-800 placeholder-gray-400 transition-all text-sm"
                  />
                </div>
              </>
            )}

            {/* DOB */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date of Birth</label>
              <input
                type="date"
                name="dob"
                required
                value={form.dob}
                onChange={handleChange}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500 text-gray-800 transition-all text-sm"
              />
              {age !== null && age >= 0 && (
                <p className="text-xs text-violet-500 mt-1.5 ml-1">🎂 {age} years old</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                name="email"
                required
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white text-gray-800 placeholder-gray-400 transition-all text-sm"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  minLength="6"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 6 characters"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:bg-white text-gray-800 placeholder-gray-400 transition-all text-sm pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3.5 rounded-2xl transition-all disabled:opacity-50 shadow-lg shadow-violet-100 text-sm mt-1"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  Creating account...
                </span>
              ) : role === 'doctor' ? 'Register as Doctor →' : 'Create Account →'}
            </button>
          </form>

          <p className="text-center text-gray-400 text-sm mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-violet-600 font-semibold hover:underline">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-xs text-gray-400 mt-5 px-4">
          🔒 Your data is encrypted and never shared with third parties
        </p>
      </div>
    </div>
  )
}