export const CLOUDINARY_CLOUD_NAME = 'ddtezaiwi'
export const CLOUDINARY_UPLOAD_PRESET = 'filhos_da_graca_unsigned'

function obterResourceType(file) {
  if (file.type === 'application/pdf') return 'raw'
  if (file.type.startsWith('video/')) return 'video'
  return 'auto'
}

function extrairMensagemErroCloudinary(response, data) {
  return (
    data?.error?.message ||
    data?.message ||
    `Erro ${response.status} ao enviar arquivo para o Cloudinary.`
  )
}

export async function uploadArquivoCloudinary(file, options = {}) {
  const { onProgress } = options
  const resourceType = obterResourceType(file)
  const formData = new FormData()

  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  formData.append('folder', 'filhos-da-graca/uploads')

  if (onProgress) {
    const data = await new Promise((resolve, reject) => {
      const request = new XMLHttpRequest()

      request.open(
        'POST',
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
      )

      request.upload.onprogress = (event) => {
        if (!event.lengthComputable) return

        onProgress(Math.round((event.loaded / event.total) * 100))
      }

      request.onload = () => {
        let responseData = {}

        try {
          responseData = JSON.parse(request.responseText || '{}')
        } catch {
          responseData = {}
        }

        if (request.status < 200 || request.status >= 300) {
          reject(
            new Error(
              extrairMensagemErroCloudinary(
                { status: request.status },
                responseData,
              ),
            ),
          )
          return
        }

        resolve(responseData)
      }

      request.onerror = () => {
        reject(new Error('Falha de conexão ao enviar arquivo para o Cloudinary.'))
      }

      request.send(formData)
    })

    return {
      url: data.secure_url,
      publicId: data.public_id,
      formato: data.format,
      tipo: data.resource_type,
    }
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
    {
      method: 'POST',
      body: formData,
    },
  )

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(extrairMensagemErroCloudinary(response, data))
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
    formato: data.format,
    tipo: data.resource_type,
  }
}
