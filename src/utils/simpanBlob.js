// Simpan Blob ke komputer pengguna sebagai berkas unduhan.
// URL objek dilepas tertunda — melepas seketika bisa memutus unduhan berkas besar di sebagian browser.
export function simpanBlob(blob, namaFile) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
