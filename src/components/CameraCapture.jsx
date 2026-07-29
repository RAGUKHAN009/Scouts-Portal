import { useEffect, useRef, useState } from 'react'
import { useAlert } from '../context/AlertContext'

// Lets a leader take the scout's photo straight from the device camera
// (works on phones and laptops) instead of uploading a file. Falls back
// to a normal file picker if camera access isn't available/granted.
export default function CameraCapture({ onCapture, existingPreview }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const { showAlert } = useAlert()

  const [cameraOn, setCameraOn] = useState(false)
  const [preview, setPreview] = useState(existingPreview || null)

  useEffect(() => {
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
    } catch (err) {
      showAlert('Could not access camera. You can upload a photo instead.', 'warning')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOn(false)
  }

  function takeSnapshot() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(
      (blob) => {
        const url = URL.createObjectURL(blob)
        setPreview(url)
        onCapture(blob)
        stopCamera()
        showAlert('Photo captured.', 'success')
      },
      'image/jpeg',
      0.9
    )
  }

  function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    onCapture(file)
  }

  function retake() {
    setPreview(null)
    onCapture(null)
  }

  return (
    <div className="camera-box">
      {!cameraOn && !preview && (
        <>
          <p className="muted" style={{ marginBottom: 10 }}>Take the scout's photo</p>
          <div className="camera-buttons">
            <button type="button" className="btn btn-primary btn-sm" onClick={startCamera}>
              📷 Open Camera
            </button>
            <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
              Upload Instead
              <input type="file" accept="image/*" onChange={handleFileUpload} hidden />
            </label>
          </div>
        </>
      )}

      {cameraOn && (
        <>
          <video ref={videoRef} className="camera-preview" playsInline muted />
          <div className="camera-buttons">
            <button type="button" className="btn btn-gold btn-sm" onClick={takeSnapshot}>
              Capture
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={stopCamera}>
              Cancel
            </button>
          </div>
        </>
      )}

      {preview && !cameraOn && (
        <>
          <img src={preview} alt="Scout preview" className="camera-preview" />
          <div className="camera-buttons">
            <button type="button" className="btn btn-outline btn-sm" onClick={retake}>
              Retake / Remove
            </button>
          </div>
        </>
      )}

      <canvas ref={canvasRef} hidden />
    </div>
  )
}
