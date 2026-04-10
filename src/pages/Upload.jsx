import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { Upload as UploadIcon, FileText, Image, X, CheckCircle, AlertCircle, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import { processReport } from '../utils/ocrProcessor'

export default function Upload({ user }) {
  const [file, setFile] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState('')
  const [verificationWarning, setVerificationWarning] = useState(null)
  const [pendingResult, setPendingResult] = useState(null)
  const navigate = useNavigate()

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

        // If verification fails — show warning, pause navigation
        if (ownership && !ownership.verified && ownership.warning) {
          setVerificationWarning(ownership.warning)
          setPendingResult(result)
          setProcessing(false)
          return
        }

        toast.success('Report processed successfully!')
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

  // User confirms it's their report despite mismatch
  const handleProceedAnyway = () => {
    if (pendingResult) {
      toast.success('Report processed!')
      navigate('/results', {
        state: { reportData: pendingResult.data, originalFile: file }
      })
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8 pt-6">
          <h1 className="text-3xl font-bold text-gray-800">Upload Lab Report</h1>
          <p className="text-gray-500 mt-2">Upload your medical report to extract key health parameters</p>
        </div>

        {/* Privacy Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-blue-700">🔒 Privacy Protected</p>
            <p className="text-xs text-blue-600 mt-1">
              Only numerical health values are analyzed. No personal data or full reports are shared externally.
            </p>
          </div>
        </div>

        {/* Verification Warning */}
        {verificationWarning && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <ShieldAlert className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-red-700 text-sm">⚠️ Report Verification Failed</p>
                <p className="text-sm text-red-600 mt-1">{verificationWarning}</p>
                <p className="text-xs text-red-500 mt-2">
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
                className="flex-1 bg-white border border-red-200 text-red-500 font-semibold py-2.5 rounded-xl text-sm hover:bg-red-50 transition-colors"
              >
                It's My Report →
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
                ? 'border-indigo-500 bg-indigo-50 scale-105'
                : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50'
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center">
                <UploadIcon className="w-10 h-10 text-indigo-500" />
              </div>
              {isDragActive ? (
                <p className="text-indigo-600 font-semibold text-lg">Drop your file here!</p>
              ) : (
                <>
                  <div>
                    <p className="text-gray-700 font-semibold text-lg">Drag & drop your report here</p>
                    <p className="text-gray-400 text-sm mt-1">or tap to browse files</p>
                  </div>
                  <div className="flex gap-3 mt-2">
                    <span className="flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-full">
                      <Image className="w-3 h-3" /> JPG, PNG
                    </span>
                    <span className="flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-full">
                      <FileText className="w-3 h-3" /> PDF
                    </span>
                    <span className="flex items-center gap-1 bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-full">
                      Max 10MB
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  {file.type === 'application/pdf'
                    ? <FileText className="w-7 h-7 text-indigo-600" />
                    : <Image className="w-7 h-7 text-indigo-600" />
                  }
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate max-w-xs">{file.name}</p>
                  <p className="text-sm text-gray-400">{formatFileSize(file.size)}</p>
                  <span className="inline-block bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full mt-1">
                    ✓ Ready to process
                  </span>
                </div>
              </div>
              {!processing && (
                <button onClick={removeFile} className="p-2 hover:bg-red-50 rounded-xl transition-colors">
                  <X className="w-5 h-5 text-red-400" />
                </button>
              )}
            </div>

            {file.type !== 'application/pdf' && (
              <div className="mt-4 rounded-xl overflow-hidden border border-gray-100">
                <img
                  src={URL.createObjectURL(file)}
                  alt="Report preview"
                  className="w-full max-h-48 object-contain bg-gray-50"
                />
              </div>
            )}
          </div>
        )}

        {/* Progress */}
        {processing && (
          <div className="mt-6 bg-white rounded-2xl shadow-md p-6">
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-gray-800">Processing your report...</p>
                <p className="text-sm text-indigo-600 mt-1">{progress}</p>
              </div>
            </div>
            <div className="mt-4 bg-gray-100 rounded-full h-2">
              <div className="bg-indigo-600 h-2 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {/* Analyze Button */}
        {file && !processing && !verificationWarning && (
          <button
            onClick={handleProcess}
            className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all duration-200 shadow-lg hover:shadow-xl text-lg flex items-center justify-center gap-3"
          >
            <CheckCircle className="w-6 h-6" />
            Analyze Report
          </button>
        )}

        {/* Tips */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold text-gray-700 mb-3">📋 Tips for best results:</h3>
          <ul className="space-y-2 text-sm text-gray-500">
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold mt-0.5">✓</span>
              Make sure the report is clearly visible and not blurry
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold mt-0.5">✓</span>
              PDF uploads give the most accurate results
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold mt-0.5">✓</span>
              Upload only your own medical reports
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500 font-bold mt-0.5">✓</span>
              Report date will be automatically detected from the document
            </li>
          </ul>
        </div>

      </div>
    </div>
  )
}