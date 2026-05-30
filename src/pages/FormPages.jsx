import { useState } from 'react';
import FormJurnal from '../components/FormJurnal';
import FormProfiling from '../components/FormProfiling';

export function PageFormJurnal() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="alert alert-green" style={{ marginBottom: 16 }}>
        <span>📓</span>
        <div>Isi jurnal ini setiap <strong>Jumat</strong>. Butuh waktu sekitar 10 menit — tapi dampaknya bisa bertahan seminggu penuh.</div>
      </div>
      {submitted && (
        <div className="alert alert-green" style={{ marginBottom: 16 }}>
          <span>✅</span>
          <div>Jurnal minggu ini sudah tersimpan. Sampai Jumat depan!</div>
        </div>
      )}
      <FormJurnal onSuccess={() => setSubmitted(true)} />
    </div>
  );
}

export function PageFormProfiling() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="alert alert-green" style={{ marginBottom: 16 }}>
        <span>👤</span>
        <div>Form ini diisi <strong>sekali</strong> saat bergabung, lalu diperbarui setiap 3 bulan. Jawab sejujurnya — tidak ada jawaban yang salah.</div>
      </div>
      {submitted && (
        <div className="alert alert-green" style={{ marginBottom: 16 }}>
          <span>🎉</span>
          <div>Profiling berhasil! Data kamu sudah masuk ke sistem Creanimasi.</div>
        </div>
      )}
      <FormProfiling onSuccess={() => setSubmitted(true)} />
    </div>
  );
}
