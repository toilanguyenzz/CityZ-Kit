export const uploadToCloudinary = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      reject(new Error('Chưa cấu hình NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME hoặc NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET trong file .env.local'));
      return;
    }

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    xhr.open('POST', url, true);

    // Track upload progress
    if (xhr.upload && onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({
              type: file.type.startsWith('video/') ? 'video' : 'image',
              url: response.secure_url || response.url,
            });
          } catch (err) {
            reject(new Error('Không thể đọc phản hồi từ Cloudinary.'));
          }
        } else {
          try {
            const errRes = JSON.parse(xhr.responseText);
            reject(new Error(errRes.error?.message || 'Tải tệp lên Cloudinary thất bại.'));
          } catch (e) {
            reject(new Error(`Tải lên thất bại với mã lỗi ${xhr.status}`));
          }
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Lỗi kết nối mạng khi tải lên Cloudinary.'));
    };

    xhr.send(formData);
  });
};
