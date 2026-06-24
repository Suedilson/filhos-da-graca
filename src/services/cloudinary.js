export const CLOUDINARY_CLOUD_NAME = 'ddtezaiwi'
export const CLOUDINARY_UPLOAD_PRESET = 'filhos_da_graca_unsigned'

export async function uploadArquivoCloudinary(file) {
  const formData = new FormData()

  formData.append('file', file)
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  formData.append('folder', 'filhos-da-graca/uploads')

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
    {
      method: 'POST',
      body: formData,
    },
  )

  if (!response.ok) {
    throw new Error('Erro ao enviar arquivo para o Cloudinary.')
  }

  const data = await response.json()

  return {
    url: data.secure_url,
    publicId: data.public_id,
    formato: data.format,
    tipo: data.resource_type,
  }
}