export function createFileBlob(file: File): string {
  return URL.createObjectURL(file)
}

export function extractFileType(file: File): string {
  const fileName = file.name
  const extension = fileName.split('.').pop()?.toLowerCase()
  return extension || ''
}

export async function convertFileToBase64WithoutFileReader(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const uint8Array = new Uint8Array(buffer)

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(new Blob([uint8Array]))

    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1])
      } else {
        reject(new Error('Failed to convert file to Base64'))
      }
    }

    reader.onerror = () => reject(new Error('FileReader encountered an error'))
  })
}

export function createBase64Blob(base64String: string, mimeType: string): Blob {
  const byteCharacters = atob(base64String)
  const byteNumbers = Array.from(byteCharacters, (char) => char.charCodeAt(0))
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

export async function convertFileToDataURI(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const binary = new Uint8Array(buffer)

  let binaryString = ''
  for (let i = 0; i < binary.length; i++) {
    binaryString += String.fromCharCode(binary[i])
  }

  const base64String = btoa(binaryString)
  return `data:${file.type};base64,${base64String}`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
