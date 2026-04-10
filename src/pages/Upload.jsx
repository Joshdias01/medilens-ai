import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { Upload as UploadIcon, FileText, Image, X, CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { processReport } from '../utils/ocrProcessor'
import { enrichParameters } from '../utils/enrichParameters'

export default function Upload({ user }) {
  const [file, setFile] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState('')
  const [verificationWarning, setVerificationWarning] = useState(null)
  const [pendingResult, setPendingResult] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const navigate = useNavigate()

  // Create/revoke preview URL to prevent memory leaks
  useEffect(() => {
    if (file && file.type !== 'application/pdf') {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else {
      setPreviewUrl(null)
    }
  }, [file])

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      toast.error('Only images (JPG, PNG) and PDFs are allowed!')
      return
    }
    const selectedFile = acceptedFiles[0]
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB')
      return
    }
    setFile(selectedFile)
    setVerificationWarning(null)
    setPendingResult(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    multiple: false
  })

  const handleProcess = async () => {
    if (!file) {
      toast.error('Please select a file first!')
      return
    }

    setProcessing(true)
    setVerificationWarning(null)
    setPendingResult(null)

    try {
      setProgress('📄 Reading your report...')
      await new Promise(r => setTimeout(r, 500))

      // Get user profile for verification
      const { doc, getDoc } = await import('firebase/firestore')
      const { db } = await import('../firebase')
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      const userProfile = userDoc.exists() ? userDoc.data() : null

      const result = await processReport(file, userProfile, setProgress)

      if (result.success) {
        const ownership = result.data.ownership

        // If verification fails — show warning
        if (ownership && !ownership.verified && ownership.warning) {
          setVerificationWarning(ownership.warning)
          setPendingResult(result)
          setProcessing(false)
          return
        }

        // Enrich unknown parameters with AI
        setProgress('🔍 Looking up parameter information...')
        const enriched = await enrichParameters(result.data.parameters, setProgress)
        result.data.parameters = enriched

        toast.success('Report analyzed successfully!')
        navigate('/results', {
          state: { reportData: result.data, originalFile: file }
        })
      } else {
        toast.error(result.error || 'Could not extract data. Try a clearer image.')
      }
    } catch (error) {
      console.error(error)
      toast.error('Processing failed. Please try again.')
    } finally {
      setProcessing(false)
      setProgress('')
    }
  }

  const handleProceedAnyway = async () => {
    if (!pendingResult) return

    setProcessing(true)
    setVerificationWarning(null)

    try {
      setProgress('🔍 Looking up parameter information...')
      const enriched = await enrichParameters(
        pendingResult.data.parameters,
        setProgress
      )
      pendingResult.data.parameters = enriched

      toast.success('Report processed!')
      navigate('/results', {
        state: { reportData: pendingResult.data, originalFile: file }
      })
    } catch (error) {
      console.error(error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setProcessing(false)
      setProgress('')
    }
  }

  const removeFile = () => {
    setFile(null)
    setVerificationWarning(null)
    setPendingResult(null)
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8 pt-6">
          <h1 className="text-2xl font-bold text-gray-900">Upload Lab Report</h1>
          <p className="text-gray-400 text-sm mt-1">
            Upload any medical report — we'll extract and analyze your results
          </p>
        </div>

        {/* Privacy Notice */}
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 mb-6 flex gap-3">
          <span className="text-lg flex-shrink-0">🔒</span>
          <div>
            <p className="text-sm font-semibold text-violet-700">Your data stays private</p>
            <p className="text-xs text-violet-500 mt-0.5">
              Only numerical values are analyzed. No personal info or full reports are shared externally.
            </p>
          </div>
        </div>

        {/* Verification Warning */}
        {verificationWarning && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-700 text-sm">⚠️ Report Verification Failed</p>
                <p className="text-sm text-red-600 mt-1">{verificationWarning}</p>
                <p className="text-xs text-red-400 mt-2">
                  Please make sure you are uploading your own medical report.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={removeFile}
                className="flex-1 bg-red-100 hover:bg-red-200 text-red-700 font-semibold py-2.5 rounded-xl text-sm transition-colors"
              >
                Upload Different Report
              </button>
              <button
                onClick={handleProceedAnyway}
                disabled={processing}
                className="flex-1 bg-white border border-red-200 text-red-500 font-semibold py-2.5 rounded-xl text-sm hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {processing ? 'Processing...' : "It's My Report →"}
              </button>
            </div>
          </div>
        )}

        {/* Upload Area */}
        {!file ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 ${
              isDragActive
                ? 'border-violet-500 bg-violet-50 scale-105'
                : 'border-gray-200 bg-white hover:border-violet-400 hover:bg-violet-50'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center">
                <UploadIcon className="w-8 h-8 text-violet-500" />
              </div>
              {isDragActive ? (
                <p className="text-violet-600 font-semibold">Drop your file here!</p>
              ) : (
                <>
                  <div>
                    <p className="text-gray-700 font-semibold">Drag & drop your report here</p>
                    <p className="text-gray-400 text-sm mt-1">or tap to browse files</p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <span className="flex items-center gap-1 bg-gray-100 text-gray-500 text-xs px-3 py-1.5 rounded-full">
                      <Image className="w-3 h-3" /> JPG, PNG
                    </span>
                    <span className="flex items-center gap-1 bg-gray-100 text-gray-500 text-xs px-3 py-1.5 rounded-full">
                      <FileText className="w-3 h-3" /> PDF
                    </span>
                    <span className="flex items-center gap-1 bg-gray-100 text-gray-500 text-xs px-3 py-1.5 rounded-full">
                      Max 10MB
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* File Preview */
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  {file.type === 'application/pdf'
                    ? <FileText className="w-6 h-6 text-violet-600" />
                    : <Image className="w-6 h-6 text-violet-600" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate max-w-[200px]">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                  <span className="inline-block bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full mt-1">
                    ✓ Ready
                  </span>
                </div>
              </div>
              {!processing && (
                <button
                  onClick={removeFile}
                  className="p-2 hover:bg-red-50 rounded-xl transition-colors"
                >
                  <X className="w-4 h-4 text-red-400" />
                </button>
              )}
            </div>

            {/* Image preview */}
            {previewUrl && (
              <div className="mt-4 rounded-xl overflow-hidden border border-gray-100">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full max-h-44 object-contain bg-gray-50"
                />
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {processing && (
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-9 w-9 border-b-3 border-violet-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-800 text-sm">Analyzing your report...</p>
                <p className="text-xs text-violet-500 mt-0.5">{progress}</p>
              </div>
            </div>
            <div className="mt-4 bg-gray-100 rounded-full h-1.5">
              <div className="bg-violet-600 h-1.5 rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {/* Analyze Button */}
        {file && !processing && !verificationWarning && (
          <button
            onClick={handleProcess}
            className="w-full mt-4 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-4 rounded-2xl transition-all shadow-lg shadow-violet-200 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5" />
            Analyze Report
          </button>
        )}

        {/* Tips */}
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 p-5">
          <p className="font-semibold text-gray-700 text-sm mb-3">📋 Tips for best results</p>
          <ul className="space-y-2">
            {[
              'PDF uploads give the most accurate results',
              'Make sure the report text is clearly visible',
              'Works with CBC, Lipid, Thyroid, Kidney, Liver reports and more',
              'Upload only your own medical reports',
            ].map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                <span className="text-emerald-500 font-bold mt-0.5 flex-shrink-0">✓</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  )
}