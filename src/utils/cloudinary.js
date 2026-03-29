export async function uploadToCloudinary(file) {
  const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;

  console.log('CLOUDINARY_UPLOAD_PRESET', CLOUDINARY_UPLOAD_PRESET);
  console.log('CLOUDINARY_CLOUD_NAME', CLOUDINARY_CLOUD_NAME);

  
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(url, { method: 'POST', body: formData });
  const data = await res.json();
  console.log('Cloudinary response:', data);
  if (data.secure_url) return data.secure_url;
  throw new Error(data.error?.message || 'Upload thất bại');
} 