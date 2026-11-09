const MAX_BYTES = 3.5 * 1024 * 1024 // the server accepts 4 MB per file (Vercel's request limit is 4.5 MB)
const MAX_SIDE = 2400 // longer than the 1200px we publish, so there is headroom for sharp's resize

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable'))
    }
    img.src = url
  })
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

/**
 * Shrinks a large photo in the browser before upload. Phone photos are often 5-12 MB, which the hosting platform
 * would reject, and they upload much faster on mobile data once reduced. Small files are sent untouched.
 */
export async function prepareImage(file: File): Promise<File> {
  if (file.size <= MAX_BYTES * 0.6 && /^image\/(jpeg|png|webp)$/.test(file.type)) return file
  let img: HTMLImageElement
  try {
    img = await loadImage(file)
  } catch {
    // The browser cannot decode it (e.g. HEIC). Send as is if it fits; the server explains otherwise.
    return file
  }
  const keepAlpha = file.type === 'image/png' // logos may be transparent
  let scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  for (let attempt = 0; attempt < 5; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    if (!keepAlpha) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await toBlob(canvas, keepAlpha ? 'image/png' : 'image/jpeg', 0.86)
    if (blob && blob.size <= MAX_BYTES) {
      const ext = keepAlpha ? 'png' : 'jpg'
      return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type })
    }
    scale *= 0.75
  }
  return file
}
