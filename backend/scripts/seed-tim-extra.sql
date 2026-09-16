-- Anggota tambahan di tabel `tim` (ditemukan di production, belum ada di schema.sql seed)
INSERT INTO tim (id, nama, divisi, level, status, tipe, kriteria, kepuasan, skill, komunikasi, entitas, memimpin)
VALUES
  (23, 'Andini Dyah Paramastri', 'Admin', 'Senior', 'Aktif', 'At Risk', 4, 6, 0, 0, 'Shuyou', 'Belum tertarik saat ini'),
  (24, 'Elenesya Sasmariza', 'Admin', 'Junior', 'Aktif', 'Rising Star', 5, 9, 4, 4, 'Flip Studio', 'Belum tertarik saat ini'),
  (25, 'Risma Wulandari', 'Admin', 'Junior', 'Aktif', 'High Potential', 3, 8, 3, 3, 'Flip Studio', 'Belum tertarik saat ini'),
  (26, 'Maheswara Artha Kumara Gautama', 'PM', 'Senior', 'Aktif', 'Rising Star', 5, 9, 5, 5, 'Shuyou', 'Belum tertarik saat ini'),
  (27, 'Rizky Himawan Aria Wicaksa', '3D Modeler', 'Senior', 'Aktif', '', 3, 7, 3, 3, 'Shuyou', 'Belum tertarik saat ini'),
  (28, 'davian', 'Admin', 'Magang / Probation', 'Aktif', 'Rising Star', 4, 8, 4, 4, 'Creanimasi Studio', 'Belum tertarik saat ini'),
  (29, 'nindi', 'Admin', 'Magang / Probation', 'Aktif', '', 3, 7, 3, 3, 'Creanimasi Studio', 'Belum tertarik saat ini'),
  (30, 'Vitto Ramadani', 'Desainer', 'Junior', 'Aktif', '', 3, 7, 3, 3, 'Creanimasi Studio', 'Belum tertarik saat ini'),
  (31, 'Azzahra Nadienta', 'PM', 'Senior', 'Aktif', '', 3, 7, 3, 3, 'Creanimasi Studio', 'Belum tertarik saat ini'),
  (32, 'Sigit Setyawan', '3D Modeler', 'Magang / Probation', 'Aktif', 'Rising Star', 3, 9, 4, 4, 'Creanimasi Studio', 'Belum tertarik saat ini'),
  (33, 'Aryo Cahyono', '3D Modeler', 'Senior', 'Aktif', '', 3, 7, 3, 3, 'Creanimasi Studio', 'Belum tertarik saat ini')
ON CONFLICT (id) DO NOTHING;

-- Samakan sequence id supaya INSERT berikutnya (tambah anggota baru lewat UI) tidak bentrok
SELECT setval('tim_id_seq', (SELECT MAX(id) FROM tim));
