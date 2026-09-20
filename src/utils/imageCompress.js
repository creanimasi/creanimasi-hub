// Kompres gambar di browser sebelum diunggah. Hasilnya data URL yang ukurannya dijaga di bawah
// batas request (nginx default 1 MB) dengan mengecilkan dimensi bertahap.
// keepAlpha: pertahankan transparansi (maskot PNG) — dikodekan WebP (fallback PNG di browser tanpa dukungan encode WebP).

const MAKS_CHAR = 900_000;

function muatGambar(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith('image/')) return reject(new Error('File bukan gambar'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Gagal membaca gambar')); };
    img.src = url;
  });
}

function gambarKeDataUrl(img, sisiMaks, kualitas, keepAlpha) {
  const skala = Math.min(1, sisiMaks / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * skala));
  const h = Math.max(1, Math.round(img.height * skala));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!keepAlpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
  ctx.drawImage(img, 0, 0, w, h);
  return keepAlpha ? canvas.toDataURL('image/webp', kualitas) : canvas.toDataURL('image/jpeg', kualitas);
}

export async function compressImage(file, { sisiMaks = 1400, kualitas = 0.82, keepAlpha = false } = {}) {
  const img = await muatGambar(file);
  let sisi = sisiMaks;
  let q = kualitas;
  for (let i = 0; i < 6; i++) {
    const out = gambarKeDataUrl(img, sisi, q, keepAlpha);
    if (out.length <= MAKS_CHAR) return out;
    sisi = Math.round(sisi * 0.8);
    q = Math.max(0.6, q - 0.05);
  }
  throw new Error('Gambar terlalu besar, coba gambar yang lebih kecil');
}
