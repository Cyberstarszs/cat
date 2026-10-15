================================================================================
SPESIFIKASI KEBUTUHAN PERANGKAT LUNAK (SRS)
CAT GOVERNANCE - Sistem Uji Kompetensi Umum Fakultas Ilmu Administrasi (FIA)
================================================================================

Versi dokumen   : 1.1 (revisi uji kompetensi umum)
Tanggal         : 14 Oktober 2026
Status          : DRAF. Menyesuaikan lingkup uji kompetensi umum terbuka.
Bahasa          : Indonesia
Dokumen terkait : (a) Rancangan Data CAT GOVERNANCE: CRUD, CDM, PDM (23 tabel,
                      keputusan D-01..D-13, invarian INV-01..INV-22)
                  (b) Ringkasan audit awal prototipe Figma Make

PENTING - BATAS JAMINAN DOKUMEN INI
  1. Dokumen ini dirancang agar tim pembangun tidak perlu menebak. Dokumen ini
     TIDAK menjamin kode bebas bug. Bug kode hanya bisa ditangkap lewat tes dan
     review saat pembangunan (lihat Bagian 10 dan 11).
  2. Kode prototipe (App.tsx, AdminPortal.tsx, examData.ts) belum dibaca langsung
     oleh penyusun. Nama kolom dan tipe soal adalah PERKIRAAN sampai dicocokkan
     dengan examData.ts (tugas M0-T01, Bagian 11).
  3. Tidak ada klaim eksternal (versi paket, harga, pasal hukum) yang diperiksa
     ke sumbernya. Semua nama teknologi bersifat REKOMENDASI dan versinya wajib
     diverifikasi pada Milestone 0.

DAFTAR ISI
  1.  Pendahuluan
  2.  Deskripsi Umum
  3.  Kebutuhan Fungsional (per modul)
  4.  Antarmuka Eksternal (UI, API, perangkat)
  5.  Model Data (kamus data 23 tabel)
  6.  Aturan Bisnis, Mesin Status, dan Invarian
  7.  Kebutuhan Non-Fungsional
  8.  Arsitektur dan Teknologi
  9.  Penerapan Lokal dan Operasional
  10. Rencana Pengujian
  11. Rencana Pembangunan (Milestone)
  12. Risiko, Hal Belum Terverifikasi, dan Pertanyaan Terbuka
  Lampiran A. Daftar Endpoint
  Lampiran B. Format Berkas Impor
  Lampiran C. Kode Galat
  Lampiran D. Glosarium
  Lampiran E. Keterlacakan Ringkas


================================================================================
1. PENDAHULUAN
================================================================================

1.1 Tujuan Dokumen
------------------
Dokumen ini menetapkan apa yang HARUS dilakukan sistem CAT GOVERNANCE, dengan
cukup tepat agar (a) tim pembangun dapat membangun tanpa menebak, (b) pemilik
sistem dapat memeriksa apakah hasilnya sesuai, dan (c) penguji dapat menurunkan
kasus uji. Pembaca utama: pengelola ujian (Fakultas Ilmu Administrasi / FIA),
pengembang backend dan frontend, penguji, dan admin sistem.

1.2 Lingkup Produk
------------------
CAT GOVERNANCE adalah aplikasi web untuk menyelenggarakan uji kompetensi umum
berbasis komputer di lingkungan Fakultas Ilmu Administrasi (FIA) / Administrasi
Publik. Ujian bersifat terbuka untuk mahasiswa internal FIA maupun peserta dari
luar (siswa sekolah, mahasiswa universitas lain, atau peserta umum). Karena
bersifat uji kompetensi umum lintas instansi, sistem TIDAK menggunakan hierarki
program studi (prodi). Sistem mengelola akun peserta, bank soal, konfigurasi
ujian, penjadwalan sesi, pelaksanaan ujian, penilaian otomatis, publikasi hasil,
sertifikat kelulusan, laporan, dan jejak audit.

Termasuk dalam versi 1:
  - Dua peran: ADMIN dan PESERTA (Mahasiswa / Siswa Luar / Umum).
  - Soal pilihan ganda, satu jawaban benar, teks saja, berbobot dan berversi.
  - Ujian dalam SESI dengan jendela waktu dan kapasitas.
  - Penilaian otomatis berbobot, publikasi hasil per sesi.
  - Koreksi kunci soal dengan nilai ulang, tambah waktu, pembatalan percobaan.
  - Sertifikat PDF dengan verifikasi publik aman.
  - Laporan dan ekspor CSV (aman dari formula injection), pantauan sesi, log audit.
  - Penerapan pada server lokal kampus dengan akses verifikasi publik.

Tidak termasuk dalam versi 1 (WON'T):
  - Pendaftaran akun mandiri langsung saat hari ujian dan pemilihan sesi mandiri.
    (Akun dibuat/diimpor oleh admin dari data pendaftar).
  - Soal esai, soal bergambar/berlampiran, soal multi-jawaban.
  - Pengelolaan program studi (prodi ditiadakan; peserta dicatat berdasarkan
    nomor identitas dan instansi/sekolah asal).
  - Integrasi otomatis dengan sistem akademik internal (SIAKAD); data peserta masuk
    fleksibel lewat impor CSV.
  - Pengawasan kamera (proctoring AI), pengiriman surel atau WhatsApp.
  - Aplikasi seluler asli; pengerjaan ujian difokuskan pada desktop / lab.
  - Penerapan di multi-cloud publik.

1.3 Definisi dan Singkatan
--------------------------
  Admin        Pengguna yang mengelola seluruh sistem dan sesi ujian.
  Peserta      Pengguna yang mengikuti ujian (mahasiswa FIA, siswa, peserta luar).
  Ujian        Definisi ujian: durasi, jumlah soal, nilai lulus, komposisi soal.
  Sesi         Jadwal pelaksanaan satu ujian dengan jam buka, jam tutup, kapasitas.
  Pendaftaran  Penugasan satu peserta ke satu sesi.
  Percobaan    Satu kali peserta mengerjakan ujian dalam satu pendaftaran.
  Batas waktu  Waktu server saat percobaan harus berhenti (deadline).
  Void         Percobaan dibatalkan admin; tidak dihitung sebagai kesempatan.
  Snapshot     Salinan soal yang benar-benar diterima peserta pada percobaan.
  CDM, PDM     Model data konseptual, model data fisik.
  FR, NFR      Kebutuhan fungsional, kebutuhan non-fungsional.
  BR, INV, TC  Aturan bisnis, invarian, kasus uji.
  LAN          Jaringan lokal kampus.

1.4 Konvensi Dokumen
--------------------
  Awalan ID:
    FR-xnn   kebutuhan fungsional (x = huruf modul, nn = nomor)
    NFR-nn   kebutuhan non-fungsional
    BR-nn    aturan bisnis
    D-nn     keputusan desain tetap
    A-nn     asumsi
    INV-nn   invarian (selalu benar)
    TC-nn    kasus uji
    M-nn     milestone, T-nn tugas
  Prioritas (MoSCoW):
    M = Must (wajib ada di versi 1), S = Should (sangat disarankan, versi 1 bila
    waktu cukup), C = Could (bila mudah), W = Won't (bukan versi 1).
  Kata kunci: HARUS = wajib; SEBAIKNYA = disarankan; DAPAT = opsional.
  Label asumsi: ASSUMED = tebakan penyusun, dampak dicatat; USULAN = nilai target
  yang disarankan dan wajib divalidasi; UNVERIFIED = belum diperiksa ke sumber.
  Semua waktu di dokumen = zona WIB kecuali dinyatakan UTC.


================================================================================
2. DESKRIPSI UMUM
================================================================================

2.1 Latar Belakang dan Masalah yang Diselesaikan
------------------------------------------------
Prototipe di Figma Make menunjukkan alur ujian yang cukup lengkap, tetapi hasil
audit awal menemukan bahwa prototipe BELUM dapat dipakai sebagai sistem ujian:
  (1) Login mahasiswa tidak memverifikasi akun.
  (2) Kredensial admin tertulis di kode frontend.
  (3) Semua data (soal, sesi, jawaban, hasil, log) disimpan di localStorage
      browser, sehingga tidak dibagi antar perangkat dan bisa diubah pengguna.
  (4) Waktu ujian dan penilaian dikendalikan browser.
  (5) Rumus nilai tidak memakai bobot soal yang ada di data.
  (6) Sertifikat dan verifikasinya masih demonstrasi.
SRS ini mendefinisikan sistem produksi yang menyelesaikan keenam masalah itu
dengan backend dan database terpusat.

2.2 Perspektif Produk
---------------------
Arsitektur tingkat tinggi (dijelaskan rinci di Bagian 8):

   [Browser mahasiswa]     [Browser admin]
            \                    /
             \   HTTPS (LAN)    /
              v                v
        +------------------------------+
        | Reverse proxy (HTTPS)        |
        +------------------------------+
                     |
        +------------------------------+      +--------------------------+
        | Aplikasi Backend (API)       |----->| PostgreSQL (database)    |
        |  - autentikasi, otorisasi    |      +--------------------------+
        |  - aturan ujian, penilaian   |
        |  - pekerjaan terjadwal       |      +--------------------------+
        +------------------------------+----->| Penyimpanan berkas       |
                     |                         | (PDF sertifikat, cadangan)|
        Frontend statis (React, dari Figma     +--------------------------+
        Make) dilayani oleh reverse proxy

Prinsip: BROWSER TIDAK DIPERCAYA. Semua keputusan (waktu, nilai, hak akses,
kapasitas, kuota percobaan) dibuat dan diperiksa di server dan database.

2.3 Karakteristik Pengguna
--------------------------
ADMIN
  - Staf fakultas atau operator ujian. Mengelola akun, soal, ujian, sesi, hasil,
    koreksi. Bertindak juga sebagai pemantau sesi (peran pengawas belum ada).
  - Kemampuan teknis menengah. Memerlukan antarmuka yang jelas dan konfirmasi
    untuk tindakan yang tidak bisa dibatalkan.
  - Jumlah: minimal 2 akun aktif (agar tidak bergantung pada satu orang).
PESERTA (Mahasiswa Internal FIA / Siswa Luar / Umum)
  - Peserta uji kompetensi umum. Mengerjakan ujian pada komputer lab kampus atau
    perangkat terstandarisasi (ASSUMED A-08).
  - Berasal dari beragam latar belakang (mahasiswa FIA, siswa SMA/SMK, mahasiswa
    luar, atau umum). Antarmuka ujian harus intuitif, sederhana, tidak memberi ruang
    salah klik yang merugikan, dan jelas menampilkan sisa waktu.
SISTEM (aktor otomatis)
  - Pekerjaan terjadwal: kumpul otomatis, rekonsiliasi, penandaan absen,
    pembersihan sesi login kedaluwarsa, pencadangan.
PUBLIK (tanpa login)
  - Pemeriksa keabsahan sertifikat (sekolah asal, universitas luar, calon
    pemberi kerja, masyarakat umum). Mengakses halaman verifikasi publik.

2.4 Lingkungan Operasi
----------------------
  - Server: satu komputer server di ruang terkunci pada jaringan kampus (A-02),
    dengan akses reverse proxy/gateway aman untuk verifikasi sertifikat publik.
  - Klien: browser modern pada komputer lab. Daftar browser yang didukung
    ditetapkan pada M0 (UNVERIFIED).
  - Jaringan: LAN kampus untuk pengerjaan ujian demi stabilitas dan keamanan.
    Semua aset aplikasi (pustaka, font, ikon) HARUS dikemas lokal.

2.5 Batasan
-----------
  B-01 Pelaksanaan ujian HARUS dapat berjalan penuh tanpa koneksi internet luar.
  B-02 Database HARUS PostgreSQL (A-03) karena aturan integritas bergantung pada
       indeks unik parsial, FK komposit, kunci baris, dan transaksi.
  B-03 Frontend dasar berasal dari Figma Make (React + TypeScript). Seluruh
       pemanggilan data diganti ke API; tidak ada data bisnis di localStorage.
  B-04 Antarmuka dan pesan dalam bahasa Indonesia.
  B-05 Data pribadi peserta dibatasi pada daftar A-04 (tanpa pembagian prodi internal).

2.6 Asumsi dan Ketergantungan
-----------------------------
  A-01 Entitas dan kolom disesuaikan untuk kompetensi umum terbuka FIA.
  A-02 Pelaksanaan ujian berpusat di server lokal kampus FIA; verifikasi sertifikat
       dapat diakses oleh publik luar melalui reverse proxy/portal verifikasi terisolasi.
  A-03 Database PostgreSQL.
  A-04 Profil peserta minimal: Nomor Identitas (NIM/NISN/NIK/ID Peserta), nama lengkap,
       instansi/sekolah asal (opsional), telepon. Data prodi internal ditiadakan.
  A-05 Waktu disimpan UTC, ditampilkan WIB.
  A-06 Hanya dua peran: admin dan peserta. Tidak ada admin prodi karena uji kompetensi
       bersifat umum dan dikelola terpusat oleh panitia/fakultas.
  A-07 Frontend Figma Make dipakai sebagai dasar tampilan; backend dibangun baru.
  A-08 Peserta mengerjakan ujian di komputer lab dengan layar desktop.
       Halaman hasil dan verifikasi sertifikat tetap responsif untuk ponsel.
  A-09 Skala dasar desain (ASSUMED): 300 peserta mengerjakan bersamaan, 3000 akun
       peserta total, 50 sesi per bulan.
  A-10 Data peserta diimpor dari CSV oleh panitia/admin, fleksibel untuk peserta luar
       maupun internal tanpa ketergantungan SIAKAD kaku.
  A-11 Antarmuka hanya Bahasa Indonesia.
  A-12 FIA/Panitia menetapkan nilai lulus, durasi, jumlah soal, dan komposisi tiap ujian.

2.7 Keputusan Desain Tetap
--------------------------
Keputusan ini sudah diambil dan TIDAK boleh diubah pembangun tanpa persetujuan
tertulis pemilik sistem.

  D-01 NILAI. Skor = ROUND(total poin berbobot / poin maksimum x 100, 2).
       Bobot bawaan 1. Soal kosong atau salah = 0 poin, tanpa pengurangan.
       Lulus bila skor >= nilai lulus ujian. Pembulatan setengah ke atas.
  D-02 SESI. Tidak ada batas jumlah sesi. Yang ada: kapasitas per sesi, dan satu
       peserta tidak boleh terdaftar di dua sesi yang waktunya beririsan.
  D-03 KESEMPATAN. Satu pendaftaran = satu percobaan. Maksimal 3 percobaan per
       peserta per ujian (parameter). Sudah lulus = tidak boleh daftar lagi.
       Pendaftaran berikutnya baru boleh setelah hasil sebelumnya dipublikasikan.
       Percobaan void dan ketidakhadiran tidak dihitung.
  D-04 AKUN. Admin membuat akun peserta (impor CSV per Nomor Identitas) dan menugaskan
       ke sesi. Sandi awal sementara, wajib diganti saat login pertama. Tidak ada
       daftar mandiri di hari H. Admin pertama dibuat lewat skrip dengan rahasia dari
       variabel lingkungan, bukan di kode.
  D-05 PERAN. Admin dan peserta.
  D-06 SERTIFIKAT. Tanpa masa berlaku. Verifikasi publik menampilkan nama,
       nama ujian, instansi/sekolah asal (bila ada), tanggal terbit, dan status.
       Tanpa nomor identitas pribadi dan tanpa nilai demi privasi.
  D-07 PERISTIWA UJIAN. Pindah tab, putus koneksi, keluar layar penuh dicatat
       untuk ditinjau admin. Tidak ada kegagalan otomatis.
  D-08 SOAL. Pilihan ganda satu jawaban benar, teks saja, berbobot dan berversi.
       Urutan soal dan opsi diacak per peserta dengan komposisi kategori dan tingkat
       yang sama. Kunci dan pembahasan tidak ditampilkan ke peserta (parameter
       allow_review, bawaan mati).
  D-09 WAKTU. Jam database satu-satunya acuan. Mulai ujian paling lambat pada
       (akhir sesi - durasi). Batas waktu = mulai + durasi + tambahan admin.
       Jawaban yang tiba paling lambat 5 detik setelah batas masih diterima.
  D-10 KONEKSI. Putus koneksi tidak menghentikan waktu. Peserta bisa lanjut di
       percobaan yang sama sampai batas. Login baru mencabut sesi login lain.
  D-11 PUBLIKASI. Admin mempublikasikan hasil per sesi, hanya setelah sesi
       berakhir dan tidak ada percobaan yang masih berjalan.
  D-12 KOREKSI SOAL. Kunci salah dikoreksi lewat mekanisme bercatat:
       key_changed, also_accept, atau annulled, dengan pratinjau dampak dan nilai
       ulang otomatis. Disarankan also_accept atau annulled.
  D-13 GANGGUAN. Admin dapat menambah waktu per percobaan atau massal per sesi,
       alasan wajib.

2.8 Penyesuaian Model Data Fisik
--------------------------------
Penyesuaian skema tabel untuk uji kompetensi umum terbuka FIA:
  P-01 Tabel study_programs DIHILANGKAN karena uji kompetensi bersifat umum terbuka
       lintas instansi (tanpa sekat program studi internal).
  P-02 Tabel student_profiles disesuaikan menjadi profil peserta:
       kolom study_program_id diganti dengan institution varchar(150) (instansi/
       sekolah asal, opsional), dan nim disesuaikan menjadi identifier (nomor identitas
       unik: NIM, NISN, NIK, atau nomor pendaftaran).
  P-03 Kolom baru exam_sessions.access_code_hash (kode akses sesi, FR-S06).
  P-04 Tabel baru appeals (sanggah peserta, FR-R07), prioritas Should.
  P-05 Kolom baru users.password_changed_at (untuk kedaluwarsa token lama).
  Total tabel: 22 tabel inti + 1 tabel appeals = 23 tabel.

================================================================================
3. KEBUTUHAN FUNGSIONAL (PER MODUL)
================================================================================

Format tiap kebutuhan:
  Aktor, Deskripsi, Aturan, Penerimaan (kriteria yang bisa diuji), Galat
  (perilaku saat gagal), lalu rujukan Endpoint, Tabel, dan Uji (TC).
Kode galat lengkap ada di Lampiran C. Daftar endpoint lengkap di Lampiran A.
Nilai bertanda USULAN adalah target awal yang wajib divalidasi fakultas.

--------------------------------------------------------------------------------
MODUL A. AUTENTIKASI DAN OTORISASI
--------------------------------------------------------------------------------

FR-A01  Login                                                          [M]
  Aktor      : Admin, Mahasiswa
  Deskripsi  : Pengguna masuk dengan email dan sandi.
  Aturan     :
    - Server memverifikasi sandi terhadap password_hash. Tidak ada kredensial
      tetap di kode, tidak ada login "berhasil karena sembarang input".
    - Respons gagal SAMA untuk email tidak dikenal dan sandi salah (tidak
      membocorkan keberadaan akun).
    - Akun suspended atau terhapus ditolak dengan pesan umum yang sama.
    - Sukses: buat baris auth_sessions; token disimpan di cookie httpOnly,
      Secure, SameSite=Strict. Yang disimpan di database hanya hash token.
    - Kedaluwarsa sesi (USULAN): admin tidak aktif 30 menit; mahasiswa 8 jam
      absolut dan TIDAK kedaluwarsa karena tidak aktif selama ada percobaan
      in_progress (agar mahasiswa tidak keluar di tengah ujian).
    - Pembatasan laju: maksimal 10 percobaan login per menit per alamat IP
      (USULAN), selebihnya 429.
  Penerimaan :
    [ ] Email + sandi benar -> 200, cookie terpasang, halaman sesuai peran.
    [ ] Sandi salah dan email tidak dikenal -> 401, teks pesan identik.
    [ ] Akun suspended -> 401 dengan pesan yang sama; tidak ada sesi dibuat.
    [ ] Tidak ada sandi atau token di respons JSON maupun log.
    [ ] Percobaan ke-11 dalam semenit dari IP sama -> 429.
  Galat      : AUTH_INVALID_CREDENTIALS (401), AUTH_LOCKED (423), RATE_LIMITED.
  Endpoint   : POST /auth/login | Tabel: users, auth_sessions, audit_logs
  Uji        : TC-23, TC-24

FR-A02  Logout dan kedaluwarsa sesi                                    [M]
  Aktor      : Admin, Mahasiswa, Sistem
  Aturan     :
    - Logout mencabut sesi (revoked_at) dan menghapus cookie.
    - Token yang dicabut atau kedaluwarsa ditolak dengan 401.
    - Pekerjaan terjadwal menghapus sesi kedaluwarsa lebih dari 30 hari.
  Penerimaan :
    [ ] Setelah logout, permintaan dengan token lama -> 401.
    [ ] Mengganti sandi mencabut semua sesi lain milik akun itu.
  Endpoint   : POST /auth/logout, POST /auth/refresh | Tabel: auth_sessions
  Uji        : TC-22, TC-23

FR-A03  Ganti sandi                                                    [M]
  Aktor      : Admin, Mahasiswa
  Deskripsi  : Wajib saat login pertama (must_change_password = true) dan
               tersedia kapan saja dari profil.
  Aturan     :
    - Selama must_change_password = true, SEMUA endpoint selain ganti sandi dan
      logout menjawab 403 AUTH_PASSWORD_CHANGE_REQUIRED.
    - Kebijakan sandi (USULAN): minimal 10 karakter, tidak sama dengan sandi
      lama, tidak mengandung NIM atau bagian depan email.
    - Mengganti sandi memerlukan sandi lama (kecuali login pertama).
    - Sandi disimpan sebagai hash lambat bersalt (Argon2, versi diverifikasi M0).
  Penerimaan :
    [ ] Akun baru tidak bisa membuka halaman apa pun sebelum ganti sandi.
    [ ] Sandi baru yang melanggar kebijakan -> 422 dengan alasan per aturan.
    [ ] Setelah sukses, must_change_password = false dan sesi lain dicabut.
  Endpoint   : POST /me/password | Tabel: users, auth_sessions
  Uji        : TC-25

FR-A04  Reset sandi oleh admin                                         [M]
  Aktor      : Admin
  Deskripsi  : Karena tidak ada surel (lingkungan lokal), admin mengatur ulang
               sandi mahasiswa yang lupa.
  Aturan     :
    - Sistem membuat sandi sementara acak (12 karakter, USULAN) dan
      menampilkannya SEKALI di layar; tidak disimpan dalam bentuk asli.
    - must_change_password = true; semua sesi akun itu dicabut.
    - Admin tidak dapat memakai fitur ini untuk akunnya sendiri.
    - Tindakan masuk audit_logs dengan alasan.
  Penerimaan :
    [ ] Sandi sementara tampil sekali; membuka ulang halaman tidak menampilkannya.
    [ ] Mahasiswa yang sedang login dikeluarkan.
    [ ] Admin A tidak bisa mereset sandi Admin A lewat endpoint ini (403).
  Endpoint   : POST /users/{id}/reset-password | Tabel: users, audit_logs
  Uji        : TC-26

FR-A05  Penguncian akun                                                [M]
  Aktor      : Sistem
  Aturan     :
    - 5 kegagalan login berturut-turut (USULAN) -> locked_until = sekarang + 15
      menit (USULAN). Berhasil login mengatur failed_login_count ke 0.
    - Saat terkunci, respons 423 tanpa menyebut sisa percobaan.
    - Admin dapat membuka kunci akun manual (setara reset penghitung).
  Penerimaan :
    [ ] Percobaan ke-5 yang salah mengunci akun; login benar saat terkunci
        tetap ditolak sampai locked_until lewat.
  Endpoint   : POST /auth/login, POST /users/{id}/unlock
  Uji        : TC-24

FR-A06  Sesi login tunggal                                             [M]
  Aktor      : Sistem
  Aturan     : Login baru oleh akun yang sama mencabut sesi lain milik akun itu
               (D-10, INV-22). Perangkat lama menerima 401 pada permintaan
               berikutnya dan menampilkan pesan bahwa akun dipakai di perangkat
               lain.
  Penerimaan :
    [ ] Login di perangkat kedua -> perangkat pertama 401 pada permintaan berikut.
    [ ] Percobaan in_progress TIDAK terhapus; bisa dilanjutkan dari perangkat kedua.
  Uji        : TC-22

FR-A07  Otorisasi berbasis peran                                       [M]
  Aktor      : Sistem
  Aturan     :
    - Setiap endpoint memiliki daftar peran yang diizinkan, diperiksa di server
      (middleware). Menyembunyikan menu di UI BUKAN kontrol keamanan.
    - Tidak login -> 401. Peran salah -> 403. Objek milik orang lain yang
      diakses mahasiswa -> 404 (tidak membocorkan keberadaan).
    - Mahasiswa hanya dapat membaca data miliknya.
  Penerimaan :
    [ ] Untuk SETIAP sel "-" pada matriks CRUD (Lampiran A), ada tes yang
        memastikan permintaan ditolak.
    [ ] Mahasiswa A meminta ID percobaan/hasil mahasiswa B -> 404.
  Uji        : TC-14, TC-20

FR-A08  Penyemaian admin pertama                                       [M]
  Aktor      : Admin sistem (operator server)
  Aturan     :
    - Perintah baris-perintah seed-admin membuat admin pertama dari variabel
      lingkungan ADMIN_EMAIL dan ADMIN_PASSWORD (tidak ada di repositori kode).
    - Idempoten: bila sudah ada admin, perintah menolak kecuali diberi opsi eksplisit.
    - must_change_password = true untuk admin hasil semai.
  Penerimaan :
    [ ] Repositori kode tidak mengandung email atau sandi admin apa pun.
    [ ] Menjalankan dua kali tidak membuat admin ganda.
  Uji        : TC-39

--------------------------------------------------------------------------------
MODUL U. PENGGUNA DAN REFERENSI
--------------------------------------------------------------------------------

FR-U01  Daftar dan pencarian akun                                      [M]
  Aktor      : Admin
  Aturan     : Daftar berhalaman (USULAN 25 per halaman), cari berdasarkan Nomor
               Identitas (NIM/NISN/ID), nama, email; filter instansi asal, status, peran.
  Penerimaan :
    [ ] Pencarian dengan 0 hasil menampilkan status kosong, bukan galat.
    [ ] Hasil 3000 akun tetap tampil per halaman tanpa memuat semuanya.
  Endpoint   : GET /users, GET /students

FR-U02  Kelola akun admin                                              [M]
  Aktor      : Admin
  Aturan     : Buat, ubah, nonaktifkan admin. Admin aktif terakhir TIDAK boleh
               dinonaktifkan atau dihapus (409 LAST_ADMIN). Sistem menyarankan
               minimal 2 admin aktif (peringatan di dashboard bila hanya 1).
  Penerimaan :
    [ ] Menonaktifkan admin aktif terakhir ditolak.
    [ ] Email unik tanpa membedakan huruf besar/kecil.
  Endpoint   : POST/GET/PATCH /users

FR-U03  Kelola peserta                                                 [M]
  Aktor      : Admin
  Aturan     :
    - Buat/ubah peserta: Nomor Identitas (NIM/NISN/NIK/ID Peserta, unik), nama,
      email (unik), instansi/sekolah asal (opsional), telepon. Nomor Identitas
      hanya dapat diubah admin.
    - Nonaktifkan = status suspended; riwayat ujian tetap utuh. TIDAK ada hapus
      permanen akun yang punya percobaan.
    - Akun suspended tidak bisa login dan token lamanya ditolak.
  Penerimaan :
    [ ] Nomor Identitas kembar -> 422/409 dengan pesan jelas.
    [ ] Peserta suspended yang punya percobaan in_progress: percobaan tidak
        otomatis hilang; admin memutuskan void atau tidak.
  Endpoint   : POST/GET/PATCH /students, /students/{id}

FR-U04  Impor peserta dari CSV                                         [M]
  Aktor      : Admin
  Deskripsi  : Memasukkan banyak peserta sekaligus dari pendaftaran (format Lampiran B).
  Aturan     :
    - Dua langkah: (1) pratinjau/validasi tanpa menyimpan, (2) simpan.
    - Validasi per baris: kolom wajib, format nomor identitas, email unik, instansi asal.
      Baris gagal dilaporkan dengan nomor baris dan alasan.
    - Idempoten per Nomor Identitas: nomor identitas sudah ada -> data profil diperbarui;
      sandi TIDAK diubah; pengguna tidak diduplikasi.
    - Untuk akun BARU, sistem membuat sandi sementara acak dan menyediakan
      berkas "daftar kredensial awal" yang dapat diunduh SEKALI (tidak
      tersimpan dalam bentuk asli). must_change_password = true.
    - Batas ukuran berkas (USULAN 5 MB) dan jumlah baris (USULAN 5000).
    - Seluruh simpan dalam satu transaksi; gagal di tengah = tidak ada yang tersimpan.
    - Sel yang diawali = + - @ diperlakukan sebagai teks (cegah injeksi rumus
      pada ekspor berikutnya).
  Penerimaan :
    [ ] CSV 100 baris dengan 3 baris salah: pratinjau menunjukkan 3 galat
        berikut nomor barisnya; admin dapat memperbaiki lalu unggah ulang.
    [ ] Mengunggah CSV yang sama dua kali tidak membuat akun ganda.
    [ ] Berkas kredensial awal tidak dapat diunduh untuk kedua kalinya.
  Endpoint   : POST /students/import/preview, POST /students/import/commit
  Uji        : TC-27

FR-U05  Aktif/nonaktifkan akun                                         [M]
  Aktor      : Admin
  Aturan     : Perubahan status mencabut semua sesi login akun tersebut; masuk
               audit_logs dengan alasan.
  Uji        : TC-22

FR-U06  Profil dan pengaturan mandiri                                  [S]
  Aktor      : Admin, Peserta
  Aturan     : Peserta hanya dapat mengubah nomor telepon dan preferensi; nama,
               nomor identitas, dan instansi diubah oleh admin. Admin dapat mengubah
               nama sendiri.
  Endpoint   : GET/PATCH /me/profile, /me/settings

--------------------------------------------------------------------------------
MODUL Q. BANK SOAL
--------------------------------------------------------------------------------

FR-Q01  Kategori soal                                                  [M]
  Aktor      : Admin
  Aturan     : Nama unik. Hapus hanya bila tidak ada soal di dalamnya.
  Endpoint   : /question-categories

FR-Q02  Membuat soal                                                   [M]
  Aktor      : Admin
  Aturan     :
    - Isian: kategori, teks soal, tingkat 1-3, bobot (> 0, bawaan 1), 2 sampai 6
      opsi (USULAN), tepat SATU opsi benar, pembahasan (opsional).
    - Sistem membuat questions + question_versions (version_no 1) +
      question_options dalam satu transaksi. Status awal draft.
    - Teks diperlakukan sebagai TEKS POLOS. Tidak ada HTML. Tampilan di browser
      selalu di-escape (cegah XSS).
  Penerimaan :
    [ ] Soal tanpa opsi benar, dengan dua opsi benar, atau dengan opsi kosong
        ditolak dengan pesan yang menyebut kolomnya.
    [ ] Teks berisi <script> tampil sebagai teks biasa, tidak dieksekusi.
  Endpoint   : POST /questions | Tabel: questions, question_versions, question_options
  Uji        : TC-28

FR-Q03  Mengedit soal = versi baru                                     [M]
  Aktor      : Admin
  Aturan     :
    - Menyimpan perubahan TIDAK mengubah versi lama; sistem membuat versi baru
      (version_no + 1) dan memindahkan questions.current_version_id.
    - Ujian yang dimulai SESUDAH itu memakai versi baru. Percobaan yang sudah
      berjalan tetap memakai versi yang disalin ke snapshot-nya (INV-06).
    - Versi dan opsi lama tidak dapat diubah atau dihapus, termasuk oleh admin.
  Penerimaan :
    [ ] Edit soal saat 10 mahasiswa mengerjakan: soal di layar mereka tetap sama.
    [ ] Riwayat versi soal dapat dilihat admin (siapa, kapan).
  Endpoint   : POST /questions/{id}/versions, GET /questions/{id}/versions
  Uji        : TC-06, TC-28

FR-Q04  Aktif/arsip soal                                               [M]
  Aktor      : Admin
  Aturan     : Hanya soal berstatus active yang masuk pengundian ujian. Arsip
               tidak menghapus apa pun. Soal tidak dihapus permanen bila pernah
               dipakai.
  Penerimaan :
    [ ] Mengarsipkan soal tidak mengubah hasil lama.
    [ ] Mengarsipkan soal sehingga pool kategori kurang dari kebutuhan ujian yang
        sudah dijadwalkan: sistem memberi peringatan dampak (daftar sesi terdampak).
  Endpoint   : PATCH /questions/{id}

FR-Q05  Daftar dan pencarian soal                                      [M]
  Aktor      : Admin
  Aturan     : Filter kategori, tingkat, status, teks. Tampilkan jumlah ujian
               yang memakai kategori itu.

FR-Q06  Impor soal dari CSV                                            [S]
  Aktor      : Admin
  Aturan     : Pratinjau lalu simpan, validasi seperti FR-Q02, atomik. Format di
               Lampiran B. Kunci jawaban pada kolom khusus (A-F).

FR-Q07  Pratinjau soal                                                 [S]
  Aktor      : Admin
  Aturan     : Admin melihat soal persis seperti tampilan mahasiswa tanpa membuat
               percobaan atau tercatat sebagai peserta.

FR-Q08  Koreksi kunci atau anulir soal                                 [M]
  Aktor      : Admin
  Deskripsi  : Cara SATU-SATUNYA untuk memperbaiki kunci soal yang sudah dipakai
               ujian (D-12). Mencegah pelanggaran aturan "versi tidak boleh diubah".
  Aturan     :
    - Jenis koreksi:
        key_changed  kunci diganti; yang menjawab kunci lama kehilangan poin.
        also_accept  opsi tambahan juga dinilai benar; tidak ada yang berkurang.
        annulled     soal dikeluarkan dari poin dan poin maksimum semua orang.
    - Alasan wajib.
    - Langkah wajib: pilih versi soal -> pilih jenis -> isi alasan -> PRATINJAU
      DAMPAK -> konfirmasi eksplisit -> terapkan.
    - Pratinjau menampilkan: jumlah percobaan terdampak, jumlah hasil yang
      berubah skor, daftar yang berubah dari tidak lulus menjadi lulus dan
      sebaliknya, sertifikat yang akan terbit dan yang akan dicabut.
    - Penerapan = SATU transaksi: catat question_corrections, hitung ulang
      is_correct dan points_awarded, perbarui results (revision_no + 1), terbit
      atau cabut sertifikat otomatis (revoke_source = regrade), buat notifikasi,
      tulis audit_logs.
    - Aturan kunci berlaku: opsi benar asli + semua also_accept, diganti oleh
      key_changed terakhir. Bila ada annulled, soal keluar dari poin dan maksimum.
    - Bila poin maksimum menjadi 0 setelah anulir: koreksi ditolak (409).
    - Tidak ada edit atau hapus pada baris koreksi.
  Penerimaan :
    [ ] Skenario S-03 (Bagian 6.5) menghasilkan angka persis seperti tertulis.
    [ ] Tanpa pratinjau, tombol terapkan tidak aktif.
    [ ] Koreksi gagal di tengah -> tidak ada hasil yang berubah.
    [ ] Menjalankan penerapan yang sama dua kali tidak menaikkan revision_no dua kali.
  Endpoint   : POST /question-versions/{id}/corrections/preview,
               POST /question-versions/{id}/corrections
  Uji        : TC-16, TC-17, TC-29

--------------------------------------------------------------------------------
MODUL E. KONFIGURASI UJIAN
--------------------------------------------------------------------------------

FR-E01  Membuat dan mengubah ujian                                     [M]
  Aktor      : Admin
  Aturan     :
    - Isian: kode unik, judul, deskripsi, durasi menit (> 0), jumlah soal (> 0),
      nilai lulus (0-100, dua desimal), acak soal, acak opsi, maks percobaan
      per mahasiswa (bawaan 3), allow_review (bawaan mati).
    - Status draft -> active -> archived. Hanya ujian active yang bisa
      dijadwalkan.
  Penerimaan :
    [ ] Durasi 0 atau negatif, nilai lulus 101 ditolak.
  Endpoint   : /exams

FR-E02  Aturan komposisi soal                                          [M]
  Aktor      : Admin
  Aturan     :
    - Setiap aturan: kategori, tingkat (opsional), jumlah. Unik per
      (ujian, kategori, tingkat).
    - Jumlah seluruh aturan HARUS sama dengan jumlah soal ujian (diperiksa saat
      sesi dipublikasikan dan ditampilkan sebagai indikator saat menyusun).
  Endpoint   : /exams/{id}/rules

FR-E03  Penguncian konfigurasi                                         [M]
  Aktor      : Sistem
  Aturan     : Setelah ada sesi berstatus published untuk ujian itu, durasi, jumlah
               soal, nilai lulus, dan aturan komposisi TIDAK dapat diubah (409
               CONFIG_LOCKED). Untuk mengubah, admin menyalin ujian (FR-E04).
               Parameter yang aman diubah: judul, deskripsi, acak, allow_review.
  Penerimaan :
    [ ] Mengubah durasi ujian yang sudah dijadwalkan -> 409.
  Uji        : TC-21

FR-E04  Salin dan arsip ujian                                          [S]
  Aktor      : Admin
  Aturan     : Salin membuat ujian baru (draft) beserta aturan komposisinya, kode
               baru. Arsip menyembunyikan dari daftar aktif tanpa menghapus.

--------------------------------------------------------------------------------
MODUL S. PENJADWALAN SESI DAN PENDAFTARAN
--------------------------------------------------------------------------------

FR-S01  Membuat dan mengubah sesi                                      [M]
  Aktor      : Admin
  Aturan     :
    - Isian: ujian (harus active), kode unik, nama, waktu buka (starts_at),
      waktu tutup (ends_at), kapasitas (opsional).
    - ends_at harus > starts_at. Sesi baru berstatus draft.
    - Sesi draft bebas diubah. Sesi published hanya dapat diubah SEBELUM
      starts_at dan selama belum ada percobaan; perubahan jadwal memicu
      notifikasi ke semua mahasiswa terdaftar.
  Penerimaan :
    [ ] ends_at <= starts_at ditolak.
    [ ] Mengubah jadwal sesi yang sudah ada percobaan -> 409 SESSION_LOCKED.
  Endpoint   : POST/GET/PATCH /sessions

FR-S02  Mempublikasikan sesi (dengan validasi)                         [M]
  Aktor      : Admin
  Aturan     : Publikasi ditolak bila salah satu kondisi ini terjadi:
    (a) ujian tidak berstatus active;
    (b) (ends_at - starts_at) < durasi ujian;
    (c) jumlah aturan komposisi tidak sama dengan jumlah soal ujian;
    (d) untuk suatu aturan, soal aktif versi terkini yang cocok kurang dari
        jumlah yang dibutuhkan (INV-08).
    Sistem memberi PERINGATAN (tidak memblokir) bila pool soal suatu aturan
    kurang dari 1,5 kali kebutuhan, karena variasi soal antar mahasiswa kecil
    (USULAN).
  Penerimaan :
    [ ] Sesi 08:00-09:00 dengan durasi 90 menit ditolak (alasan b).
    [ ] Mengosongkan satu kategori lalu mempublikasikan -> ditolak (alasan d),
        pesan menyebut kategori dan selisihnya.
  Endpoint   : POST /sessions/{id}/publish
  Uji        : TC-08, TC-21

FR-S03  Membatalkan sesi                                               [M]
  Aktor      : Admin
  Aturan     : Hanya bila belum ada percobaan (selain void). Semua pendaftaran
               menjadi cancelled dan mahasiswa menerima notifikasi. Alasan wajib.
               Sesi yang sudah ada percobaan TIDAK dapat dibatalkan; admin memakai
               void per percobaan atau tambah waktu.
  Penerimaan :
    [ ] Membatalkan sesi yang sudah punya percobaan -> 409.
  Endpoint   : POST /sessions/{id}/cancel
  Uji        : TC-43

FR-S04  Menugaskan peserta ke sesi                                     [M]
  Aktor      : Admin
  Deskripsi  : Menugaskan satu peserta, sekelompok (filter instansi asal/status), atau
               daftar Nomor Identitas dari CSV.
  Aturan     : Setiap penugasan HARUS lolos SEMUA pemeriksaan (BR-04, BR-05, D-03):
    (a) akun mahasiswa aktif;
    (b) sesi published dan belum berakhir;
    (c) tidak ada pendaftaran lain pada sesi yang waktunya beririsan;
    (d) kapasitas sesi belum penuh;
    (e) mahasiswa belum lulus ujian itu;
    (f) jumlah percobaan non-void mahasiswa pada ujian itu < batas (bawaan 3);
    (g) semua percobaan sebelumnya pada ujian itu sudah berstatus published;
    (h) belum terdaftar di sesi yang sama.
    - Pemeriksaan dan penyimpanan dalam SATU transaksi dengan kunci per sesi
      (kapasitas) dan per mahasiswa (irisan jadwal), supaya dua admin yang
      menugaskan kursi terakhir bersamaan tidak sama-sama berhasil (INV-09).
    - Massal: pratinjau dahulu; baris yang gagal dilaporkan dengan kode alasan;
      baris yang lolos tersimpan.
  Penerimaan :
    [ ] Dua admin menugaskan mahasiswa berbeda ke kursi terakhir bersamaan:
        tepat satu berhasil, satu menerima 409 CAPACITY_FULL.
    [ ] Mahasiswa di sesi 08:00-10:00 ditugaskan ke sesi 09:30-11:30 -> 409
        SCHEDULE_OVERLAP.
    [ ] Mahasiswa yang sudah lulus -> 409 ALREADY_PASSED.
    [ ] Mahasiswa dengan 3 percobaan non-void -> 409 QUOTA_EXCEEDED.
    [ ] Mahasiswa yang hasil sebelumnya belum dipublikasikan -> 409 PREVIOUS_RESULT_PENDING.
  Endpoint   : POST /sessions/{id}/enrollments,
               POST /sessions/{id}/enrollments/preview
  Uji        : TC-09, TC-44

FR-S05  Membatalkan pendaftaran                                        [M]
  Aktor      : Admin
  Aturan     : Hanya sebelum starts_at dan tanpa percobaan. Mahasiswa dinotifikasi.
  Endpoint   : DELETE /sessions/{id}/enrollments/{enrollmentId}

FR-S06  Kode akses sesi                                                [S]
  Aktor      : Admin, Mahasiswa
  Deskripsi  : Memastikan mahasiswa memulai ujian di ruang yang ditentukan: kode
               dibagikan pengawas di ruangan.
  Aturan     :
    - Admin mengaktifkan kode pada sesi; sistem membuat kode acak 8 karakter
      (USULAN) dan menampilkannya ke admin; yang disimpan hanya hash
      (exam_sessions.access_code_hash, perubahan P-01).
    - Mahasiswa memasukkan kode saat menekan Mulai. Kode salah -> 403 dan dihitung
      ke pembatasan laju (5 salah per 5 menit per akun, USULAN).
    - Mengubah kode tidak memengaruhi percobaan yang sudah berjalan.
  Penerimaan :
    [ ] Tanpa kode benar, percobaan tidak dibuat.
    [ ] Kode tidak tampil di respons untuk mahasiswa dan tidak ada di log.
  Endpoint   : POST /sessions/{id}/access-code, POST /sessions/{id}/start
  Uji        : TC-41

FR-S07  Memperpanjang akhir sesi                                       [S]
  Aktor      : Admin
  Aturan     : ends_at hanya boleh bertambah, alasan wajib, tercatat di audit_logs.
               Pemendekan ditolak.

--------------------------------------------------------------------------------
MODUL T. PELAKSANAAN UJIAN (SISI MAHASISWA DAN PEMANTAUAN)
--------------------------------------------------------------------------------

FR-T01  Dasbor mahasiswa                                               [M]
  Aktor      : Mahasiswa
  Aturan     :
    - Menampilkan sesi yang ditugaskan beserta status EFEKTIF yang dihitung dari
      waktu server: belum dibuka, dibuka, sedang dikerjakan, selesai.
    - Tombol Mulai aktif hanya dalam jendela [starts_at, ends_at - durasi].
      Sebelum itu menampilkan hitung mundur; sesudah itu menampilkan pesan.
    - Menampilkan riwayat: sesi lalu, status hasil (menunggu / terbit), skor bila
      sudah terbit.
  Penerimaan :
    [ ] Mengubah jam komputer lab tidak membuat tombol Mulai aktif lebih awal
        (server tetap menolak, INV-02).
    [ ] Status kosong (belum ada sesi) tampil dengan pesan jelas.
  Endpoint   : GET /me/sessions

FR-T02  Halaman instruksi dan konfirmasi                               [M]
  Aktor      : Mahasiswa
  Aturan     : Menampilkan durasi, jumlah soal, cara kerja simpan otomatis, aturan
               pelanggaran yang dicatat (D-07), dan peringatan bahwa waktu tidak
               berhenti saat koneksi putus. Mahasiswa harus mencentang
               persetujuan; bila sesi memakai kode akses, kolom kode ditampilkan.

FR-T03  Memulai ujian                                                  [M]
  Aktor      : Mahasiswa
  Deskripsi  : Tindakan paling kritis. Dikerjakan dalam SATU transaksi database.
  Aturan     : Langkah berurutan; gagal di langkah mana pun membatalkan semuanya:
    1. Kunci baris pendaftaran. Bila sudah ada percobaan in_progress, kembalikan
       percobaan itu (idempoten, tidak membuat yang kedua) lalu berhenti.
    2. Periksa INV-07: sesi published; sekarang dalam [starts_at, ends_at -
       durasi]; pendaftaran milik mahasiswa itu dan akun aktif; belum ada
       percobaan non-void pada pendaftaran itu; kuota percobaan ujian tersisa;
       belum lulus; kode akses benar bila diwajibkan.
    3. Pilih soal sesuai aturan komposisi: untuk tiap aturan, undi acak
       (generator acak aman secara kriptografis) dari soal aktif versi terkini
       pada kategori/tingkat itu. Jumlah kurang -> 409
       QUESTION_POOL_INSUFFICIENT, TIDAK ada soal cadangan diam-diam (INV-08)
       dan admin dinotifikasi.
    4. Acak urutan soal dan urutan opsi bila diatur (shuffle).
    5. started_at = jam database; deadline_at = started_at + durasi.
    6. Simpan attempts, attempt_questions (snapshot: question_version_id, posisi,
       option_order), ubah pendaftaran menjadi attended.
  Penerimaan :
    [ ] Dua permintaan Mulai bersamaan menghasilkan SATU percobaan; yang kedua
        menerima percobaan yang sama (TC-01).
    [ ] Mulai pada (ends_at - durasi + 1 detik) -> 409 SESSION_ENDING_SOON.
    [ ] Dua mahasiswa di sesi yang sama memperoleh komposisi kategori/tingkat
        yang sama tetapi kombinasi soal dan urutan bisa berbeda.
    [ ] Respons tidak memuat is_correct maupun pembahasan.
  Endpoint   : POST /sessions/{id}/start
  Uji        : TC-01, TC-07, TC-08, TC-30

FR-T04  Tampilan soal dan navigasi                                     [M]
  Aktor      : Mahasiswa
  Aturan     :
    - Satu soal per layar, teks soal dan opsi tanpa kunci; opsi tampil sesuai
      option_order. Navigasi bebas maju-mundur dan lompat nomor (USULAN).
    - Navigator nomor menunjukkan: belum dijawab, dijawab, ragu-ragu, sedang dibuka.
    - Mahasiswa dapat memilih lalu mengubah jawaban, dan menghapus pilihan.
    - Antarmuka dapat dipakai dengan papan ketik (Tab, Enter, tombol angka) dan
      kontras warna memadai.
  Penerimaan :
    [ ] Semua soal dapat dijangkau hanya dengan papan ketik.
    [ ] Tidak ada tombol yang dapat memicu pengumpulan tanpa konfirmasi.

FR-T05  Simpan jawaban otomatis                                        [M]
  Aktor      : Mahasiswa, Sistem
  Aturan     :
    - Setiap perubahan jawaban dikirim segera: nomor soal, opsi (atau kosong),
      penanda ragu-ragu, client_seq (bilangan naik per percobaan).
    - Server menerima hanya bila percobaan in_progress dan sekarang <= deadline_at
      + 5 detik (INV-03), opsi milik soal itu (INV-05), dan client_seq lebih besar
      daripada yang tersimpan (INV-04, update bersyarat).
    - Respons memuat sisa waktu menurut server dan status simpan.
    - UI menampilkan indikator "tersimpan / menyimpan / gagal" per soal. Gagal ->
      coba ulang otomatis dengan jeda bertambah; jawaban yang belum tersimpan
      ditahan di memori halaman saja (BUKAN localStorage) dan tidak dianggap
      tersimpan.
  Penerimaan :
    [ ] Jawaban dengan seq 5 lalu seq 3: yang tersimpan seq 5.
    [ ] Jawaban pada batas + 6 detik -> 409 ATTEMPT_EXPIRED; pada batas + 4 detik
        diterima.
    [ ] Opsi milik soal lain ditolak (database juga menolak lewat FK komposit).
  Endpoint   : PUT /attempts/{id}/answers/{position}
  Uji        : TC-03, TC-04, TC-05

FR-T06  Tanda ragu-ragu dan ringkasan                                  [M]
  Aktor      : Mahasiswa
  Aturan     : Halaman ringkasan sebelum kumpul memuat jumlah dijawab, belum
               dijawab, ragu-ragu, dengan tautan ke tiap nomor. Data diambil dari
               server (bukan dari ingatan halaman).

FR-T07  Penghitung waktu sinkron server                                [M]
  Aktor      : Mahasiswa, Sistem
  Aturan     :
    - Server menghitung sisa waktu = deadline_at - jam database. Itu satu-satunya
      kebenaran.
    - Klien menampilkan hitung mundur lokal dan MENYINKRONKAN ulang tiap respons
      API dan paling tidak tiap 30 detik (USULAN). Selisih > 2 detik dikoreksi.
    - Peringatan di 10 menit dan 1 menit terakhir (USULAN).
    - Klien tidak pernah memutuskan bahwa waktu habis: saat hitung mundur 0,
      klien meminta kumpul dan server menentukan.
  Penerimaan :
    [ ] Mengubah jam perangkat tidak mengubah sisa waktu setelah sinkronisasi
        (TC-02).
    [ ] Penambahan waktu oleh admin tampil di layar mahasiswa pada sinkronisasi
        berikutnya.
  Endpoint   : GET /attempts/{id}/state
  Uji        : TC-02, TC-36

FR-T08  Melanjutkan setelah terputus                                   [M]
  Aktor      : Mahasiswa
  Aturan     : Peramban tertutup, listrik padam sesaat, atau pindah perangkat:
               mahasiswa masuk kembali dan menekan Mulai -> mendapat percobaan yang
               sama dengan semua jawaban tersimpan dan sisa waktu terkini. Bila
               batas sudah lewat, percobaan dikumpulkan otomatis dan mahasiswa
               melihat status terkumpul.
  Penerimaan :
    [ ] Menutup tab lalu membuka lagi 2 menit kemudian: jawaban utuh, sisa waktu
        berkurang 2 menit.
  Uji        : TC-31

FR-T09  Mengumpulkan jawaban                                           [M]
  Aktor      : Mahasiswa
  Aturan     :
    - Dialog konfirmasi menampilkan jumlah soal yang belum dijawab.
    - Server mengubah status in_progress -> submitted dengan UPDATE bersyarat
      (WHERE status = 'in_progress') sehingga kumpul manual dan otomatis tidak
      berebut (INV-10). Permintaan kedua bersifat idempoten (mengembalikan status
      yang sama).
    - Sesudah terkumpul tidak ada perubahan jawaban. Halaman menyatakan hasil
      akan diumumkan admin; skor TIDAK ditampilkan.
  Penerimaan :
    [ ] Dua permintaan kumpul serentak -> tepat satu penilaian.
    [ ] Menutup tab tepat setelah menekan Kumpul: percobaan berstatus submitted bila
        permintaan tiba, bila tidak dikumpulkan otomatis oleh batas waktu.
  Endpoint   : POST /attempts/{id}/submit
  Uji        : TC-10

FR-T10  Kumpul otomatis                                                [M]
  Aktor      : Sistem
  Aturan     : Dua lapis supaya percobaan tidak menggantung:
    (a) SAAT DIAKSES: setiap permintaan ke percobaan memeriksa batas; bila
        sekarang > deadline_at + 5 detik, percobaan dikumpulkan otomatis
        (auto_submitted, submit_reason = timeout) sebelum menjawab permintaan.
    (b) PEKERJAAN TERJADWAL: berjalan tiap menit (USULAN) memakai indeks
        attempts(status, deadline_at) untuk mengumpulkan yang terlewat.
    Alarm bila ada percobaan in_progress melewati batas lebih dari 5 menit.
  Penerimaan :
    [ ] Mematikan pekerjaan terjadwal lalu membiarkan waktu habis: percobaan tetap
        terkumpul saat mahasiswa atau admin membukanya.
  Uji        : TC-32

FR-T11  Pencatatan peristiwa ujian                                     [M]
  Aktor      : Mahasiswa (klien), Sistem
  Aturan     : Klien mengirim peristiwa tab_hidden, tab_visible, window_blur,
               offline, online, fullscreen_exit beserta client_time. Server
               menambahkan occurred_at dari jam database. Dibatasi 60 peristiwa per
               menit per percobaan (USULAN). Peristiwa TIDAK memengaruhi nilai atau
               status (D-07); hanya ditampilkan ke admin. Tabel hanya ditambah.
  Endpoint   : POST /attempts/{id}/events

FR-T12  Pantauan sesi                                                  [M]
  Aktor      : Admin
  Deskripsi  : Pengganti sementara peran pengawas: admin memantau jalannya sesi.
  Aturan     :
    - Tabel langsung (pembaruan tiap 10 detik, USULAN): per mahasiswa terdaftar
      -> status (belum mulai, mengerjakan, terkumpul, absen), jumlah dijawab dari
      total, sisa waktu, jumlah peristiwa, aktivitas terakhir.
    - Ringkasan: terdaftar, hadir, mengerjakan, terkumpul, belum mulai.
    - Tindakan cepat: tambah waktu (FR-R05), void (FR-R05), lihat peristiwa.
    - Admin TIDAK melihat isi jawaban mahasiswa di layar ini (cegah kebocoran).
  Penerimaan :
    [ ] Mahasiswa yang menutup browser tampak dengan aktivitas terakhir yang makin
        lama dan sisa waktu tetap berjalan.
  Endpoint   : GET /sessions/{id}/monitor
  Uji        : TC-42

--------------------------------------------------------------------------------
MODUL R. PENILAIAN, PUBLIKASI, DAN KOREKSI HASIL
--------------------------------------------------------------------------------

FR-R01  Penilaian otomatis                                             [M]
  Aktor      : Sistem
  Aturan     :
    - Dipicu segera setelah percobaan submitted/auto_submitted.
    - Untuk tiap soal percobaan: tentukan kunci berlaku (opsi benar asli + also_accept
      - diganti key_changed terakhir); is_correct; points_awarded = bobot soal bila
      benar, selain itu 0. Soal yang dianulir keluar dari poin dan maksimum.
    - raw_score = jumlah points_awarded; max_score = jumlah bobot soal yang tidak
      dianulir; score = ROUND(raw_score / max_score x 100, 2) pembulatan setengah
      ke atas; passed = (score >= passing_score yang disalin ke hasil).
    - Satu fungsi hitung tunggal dipakai di semua tempat (penilaian, nilai ulang,
      pratinjau koreksi) agar tidak ada dua rumus berbeda.
    - Idempoten: results.attempt_id unik, hasil dibuat dengan upsert; menilai dua
      kali menghasilkan hasil identik (INV-11).
    - Penilaian = satu transaksi. Gagal -> status tetap submitted; pekerjaan
      penilaian mengulang; alarm bila berulang gagal.
    - Hasil berstatus pending_publication, tidak terlihat mahasiswa.
  Penerimaan :
    [ ] Skenario S-01, S-02 (Bagian 6.5) menghasilkan skor persis sama.
    [ ] Soal kosong dihitung 0 poin dan tetap masuk poin maksimum.
  Uji        : TC-11, TC-12

FR-R02  Publikasi hasil per sesi                                       [M]
  Aktor      : Admin
  Aturan     :
    - Syarat (INV-13): sesi sudah berakhir (sekarang > ends_at) DAN tidak ada
      percobaan in_progress pada sesi itu DAN semua percobaan non-void sudah graded.
    - Layar pratinjau: jumlah lulus, tidak lulus, belum dinilai. Konfirmasi eksplisit.
    - SATU transaksi: results -> published (published_at, published_by);
      sertifikat untuk yang lulus (FR-C01); notifikasi per mahasiswa; audit_logs.
    - Idempoten: mengulang tidak membuat sertifikat/notifikasi ganda (nomor unik,
      indeks unik notifikasi).
  Penerimaan :
    [ ] Publikasi saat ada yang masih mengerjakan -> 409 SESSION_NOT_FINISHED.
    [ ] Publikasi dua kali: tidak ada perubahan pada kali kedua.
  Endpoint   : POST /sessions/{id}/publish-results
  Uji        : TC-13, TC-33

FR-R03  Mahasiswa melihat hasil dan riwayat                            [M]
  Aktor      : Mahasiswa
  Aturan     : Hanya hasil milik sendiri dan hanya yang published (INV-14).
               Menampilkan skor, nilai lulus, status lulus, tanggal, nomor revisi
               bila pernah dikoreksi. Kunci dan pembahasan tidak ditampilkan kecuali
               allow_review menyala (INV-15). Skor per kategori [C].
  Penerimaan :
    [ ] Mahasiswa A meminta ID hasil B -> 404.
    [ ] Hasil pending_publication tidak muncul sama sekali di API mahasiswa.
  Endpoint   : GET /me/results, GET /me/results/{id}
  Uji        : TC-14, TC-15

FR-R04  Nilai ulang                                                    [M]
  Aktor      : Admin
  Aturan     : Admin dapat memicu nilai ulang untuk satu percobaan atau satu sesi
               (mis. setelah perbaikan rumus atau data). Pratinjau perubahan
               wajib. Hasil yang berubah: revision_no + 1, notifikasi, sertifikat
               terbit/cabut otomatis, alasan dan data sebelum/sesudah di audit_logs.
               Hasil yang tidak berubah tidak menaikkan revision_no.
  Endpoint   : POST /sessions/{id}/regrade/preview, POST /sessions/{id}/regrade
  Uji        : TC-16, TC-17

FR-R05  Void percobaan dan tambah waktu per percobaan                  [M]
  Aktor      : Admin
  Aturan     :
    - VOID: alasan wajib. Boleh dari in_progress, submitted, auto_submitted, atau
      graded (untuk graded hanya bila hasil belum published). Void tidak dihitung
      sebagai kesempatan. Admin dapat membuat percobaan baru pada pendaftaran yang
      sama (attempt_no + 1); satu percobaan non-void per pendaftaran tetap terjaga.
    - TAMBAH WAKTU: untuk percobaan in_progress; alasan wajib; extra_seconds
      bertambah dan deadline_at bergeser sama besar. Batas satu tindakan 60 menit
      (USULAN).
    - Keduanya masuk audit_logs beserta pelaku dan alasan.
  Penerimaan :
    [ ] Tambah waktu 600 detik pada percobaan berbatas 09:40:00 -> 09:50:00.
    [ ] Void tanpa alasan ditolak.
  Endpoint   : POST /attempts/{id}/void, POST /attempts/{id}/extend
  Uji        : TC-16, TC-36

FR-R06  Tambah waktu massal per sesi                                   [M]
  Aktor      : Admin
  Deskripsi  : Untuk gangguan yang memengaruhi banyak orang (listrik/jaringan lab).
  Aturan     : Menambah waktu ke SEMUA percobaan in_progress pada sesi itu (opsional
               filter ruangan/kelompok tidak ada di v1). Menampilkan jumlah
               percobaan terdampak sebelum konfirmasi. Satu transaksi; catatan
               audit_logs per percobaan dengan alasan yang sama.
  Penerimaan :
    [ ] Setelah tambah waktu massal 10 menit, seluruh percobaan in_progress
        bergeser 600 detik, yang sudah terkumpul tidak berubah.
  Endpoint   : POST /sessions/{id}/extend-all
  Uji        : TC-36

FR-R07  Sanggah mahasiswa                                              [S]
  Aktor      : Mahasiswa, Admin
  Deskripsi  : Jalur resmi bagi mahasiswa yang menduga soal atau kunci bermasalah.
  Aturan     :
    - Hanya pada hasil published milik sendiri, dalam 7 hari sejak publikasi
      (USULAN). Isi: nomor soal terkait (opsional) dan uraian (maks 1000
      karakter, teks polos).
    - Status open -> accepted atau rejected, dengan tanggapan admin. Menerima
      sanggah TIDAK mengubah nilai otomatis; admin menindaklanjuti lewat FR-Q08.
    - Memakai tabel baru appeals (perubahan P-02).
  Penerimaan :
    [ ] Sanggah di hari ke-8 ditolak 409 APPEAL_WINDOW_CLOSED.
    [ ] Mahasiswa hanya melihat sanggahnya sendiri.
  Endpoint   : POST /me/results/{id}/appeals, GET /appeals, PATCH /appeals/{id}
  Uji        : TC-37

--------------------------------------------------------------------------------
MODUL C. SERTIFIKAT
--------------------------------------------------------------------------------

FR-C01  Penerbitan sertifikat                                          [M]
  Aktor      : Sistem
  Aturan     :
    - Terbit otomatis dalam transaksi publikasi/koreksi untuk hasil lulus dan
      published. Satu sertifikat per hasil (result_id unik).
    - Nomor sertifikat = tahun + urutan, diambil dengan mengunci baris tahun pada
      certificate_counters di dalam transaksi (INV-18). Celah nomor boleh, nomor
      kembar tidak.
    - verification_code acak, tidak dapat ditebak (>= 128 bit entropi, USULAN).
    - Nilai ulang yang mengubah hasil: tidak lulus -> lulus menerbitkan; lulus ->
      tidak lulus mencabut (revoke_source = regrade); bila kemudian lulus lagi dan
      dicabut karena regrade, status kembali valid.
  Penerimaan :
    [ ] Menerbitkan 50 sertifikat paralel: tidak ada nomor kembar (TC-18).
  Uji        : TC-17, TC-18, TC-33

FR-C02  Mengunduh sertifikat PDF                                       [M]
  Aktor      : Mahasiswa (milik sendiri), Admin
  Aturan     : PDF dibuat server dari data basis data (bukan dari tampilan layar):
               nama, nama ujian, tanggal terbit, nomor sertifikat, kode QR berisi
               alamat verifikasi. Tidak memuat nilai. Sertifikat berstatus revoked
               tidak dapat diunduh mahasiswa dan diberi tanda DICABUT pada
               tampilan admin. Desain/tata letak resmi disediakan fakultas.
  Endpoint   : GET /certificates/{id}/pdf

FR-C03  Verifikasi sertifikat publik                                   [M]
  Aktor      : Publik (dapat diakses dari luar/lintas instansi)
  Aturan     :
    - Mengisi nomor atau kode verifikasi (atau pindai QR code); hasil hanya:
      nama peserta, nama ujian, instansi asal (bila ada), tanggal terbit,
      dan status keabsahan (valid/dicabut) (D-06). Tanpa nomor identitas pribadi
      dan tanpa nilai demi pelindungan data pribadi.
    - Kode tidak dikenal -> respons generik "tidak ditemukan".
    - Pembatasan laju: 30 permintaan per menit per IP (USULAN).
    - Endpoint verifikasi publik (/verify/{code}) bersifat read-only dan terisolasi,
      dapat dibuka ke publik via reverse proxy aman tanpa membuka API inti ujian.
  Penerimaan :
    [ ] Respons tidak memuat Nomor Identitas atau skor (TC-34).
  Endpoint   : GET /verify/{code}
  Uji        : TC-34

FR-C04  Mencabut sertifikat                                            [M]
  Aktor      : Admin
  Aturan     : Alasan wajib; revoke_source = manual; pencabutan manual bersifat
               tetap (tidak otomatis kembali valid). Masuk audit_logs.
  Endpoint   : POST /certificates/{id}/revoke

--------------------------------------------------------------------------------
MODUL L. DASBOR, LAPORAN, DAN EKSPOR
--------------------------------------------------------------------------------

FR-L01  Dasbor admin                                                   [M]
  Aktor      : Admin
  Aturan     : Menampilkan: sesi hari ini dan mendatang, percobaan sedang berjalan,
               hasil menunggu publikasi, kecukupan soal per kategori dibanding
               kebutuhan ujian terjadwal, dan PERINGATAN OPERASIONAL: hanya satu
               admin aktif, ada percobaan melewati batas > 5 menit, cadangan
               terakhir lebih tua dari 24 jam (USULAN), jam server menyimpang.

FR-L02  Laporan hasil                                                  [M]
  Aktor      : Admin
  Aturan     : Per sesi, per ujian, per instansi asal: jumlah terdaftar, hadir,
               lulus, tidak lulus, rata-rata, minimum, maksimum, sebaran nilai
               (rentang 10 poin). Hanya menghitung hasil published. Percobaan void
               dan revisi dinyatakan terpisah.
  Endpoint   : GET /reports/sessions/{id}, /reports/exams/{id}, /reports/institutions

FR-L03  Ekspor                                                         [M]
  Aktor      : Admin
  Aturan     :
    - CSV (UTF-8) untuk daftar hasil per sesi/ujian/instansi. XLSX dan PDF [S].
    - Sel yang diawali = + - @ diberi awalan tanda kutip tunggal agar tidak
      dieksekusi sebagai rumus saat dibuka di spreadsheet (CSV injection).
    - Setiap ekspor tercatat di audit_logs (siapa, apa, kapan).
  Penerimaan :
    [ ] Nama berisi =HYPERLINK(...) muncul sebagai teks biasa di hasil ekspor (TC-35).
  Endpoint   : GET /reports/.../export
  Uji        : TC-35

FR-L04  Analisis butir soal sederhana                                  [C]
  Aktor      : Admin
  Aturan     : Per versi soal: persentase menjawab benar (tingkat kesukaran),
               sebaran pilihan opsi, jumlah menjawab. Membantu memilih soal yang
               layak dikoreksi atau direvisi.

--------------------------------------------------------------------------------
MODUL N. NOTIFIKASI, AUDIT, DAN CATATAN
--------------------------------------------------------------------------------

FR-N01  Notifikasi dalam aplikasi                                      [M]
  Aktor      : Admin, Mahasiswa, Sistem
  Aturan     :
    - Jenis: sesi ditugaskan, jadwal berubah, sesi dibatalkan, hasil terbit, hasil
      direvisi, sertifikat terbit, sertifikat dicabut, sanggah ditanggapi; untuk
      admin: soal kurang, percobaan melewati batas, penilaian gagal.
    - Satu baris per penerima; tandai dibaca; jumlah belum dibaca di header.
    - Tidak terkirim ganda: notifikasi "hasil terbit" memakai kunci dedupe_key
      (id hasil + nomor revisi) dengan indeks unik.
    - Versi 1 tidak mengirim surel atau pesan luar. Bila nanti ditambah, memakai
      antrean keluar (outbox) agar kegagalan kirim tidak membatalkan hasil.
  Endpoint   : GET /notifications, PATCH /notifications/{id}/read

FR-N02  Log audit                                                      [M]
  Aktor      : Admin (baca), Sistem (tulis)
  Aturan     :
    - Dicatat: login berhasil dan gagal, perubahan akun, reset sandi, pembuatan dan
      publikasi sesi, penugasan, void, tambah waktu, koreksi soal, nilai ulang,
      publikasi hasil, terbit/cabut sertifikat, ekspor, perubahan konfigurasi.
    - Setiap baris: pelaku, peran, aksi, jenis dan id objek, alasan, data sebelum,
      data sesudah, IP, waktu.
    - Hanya tambah; hak UPDATE dan DELETE dicabut dari akun aplikasi (INV-19).
    - Tidak mencatat sandi, token, atau kode akses dalam bentuk asli.
  Endpoint   : GET /audit-logs
  Uji        : TC-19

FR-N03  Catatan insiden sesi                                           [C]
  Aktor      : Admin
  Aturan     : Admin menulis catatan insiden (mis. listrik padam 09:10, 10 menit) pada
               sesi atau percobaan. Disimpan sebagai entri audit_logs dengan aksi
               session.incident dan tampil pada laporan sesi sebagai pengganti
               berita acara sederhana.



================================================================================
4. ANTARMUKA EKSTERNAL
================================================================================

4.1 Antarmuka Pengguna (UI)
---------------------------
Aturan umum UI (berlaku untuk SEMUA halaman):
  U-01 Setiap halaman yang memuat data HARUS memiliki empat keadaan terdefinisi:
       memuat (kerangka/indikator), kosong (pesan dan langkah berikutnya), galat
       (pesan yang bisa dipahami + tombol coba lagi), tanpa izin (pesan, bukan
       halaman kosong).
  U-02 Tindakan yang tidak bisa dibatalkan (void, publikasi hasil, cabut
       sertifikat, terapkan koreksi, kumpulkan jawaban) HARUS memakai dialog
       konfirmasi yang menyebut akibatnya dan jumlah data yang terdampak.
  U-03 Pesan galat menyebut apa yang salah dan apa yang harus dilakukan. Tidak
       pernah menampilkan jejak tumpukan, SQL, atau pesan mentah server.
  U-04 Tanggal dan jam tampil dalam WIB dengan format tetap (contoh: 14 Okt 2026,
       08:00 WIB). Jam di layar ujian bersumber dari server.
  U-05 Tidak ada data bisnis, token, atau sandi di localStorage atau sessionStorage.
       Status UI sementara disimpan di memori halaman.
  U-06 Semua aset (pustaka, font, ikon, gambar) dikemas lokal; tidak ada permintaan
       ke domain luar (B-01).
  U-07 Tombol yang memicu permintaan ke server dinonaktifkan selama permintaan
       berjalan (cegah klik ganda); server tetap idempoten (INV-01, INV-10).
  U-08 Aksesibilitas: dapat dioperasikan dengan papan ketik, fokus terlihat,
       kontras warna memadai, label pada kolom isian, ukuran teks dapat diperbesar.
  U-09 Layar ujian: tidak ada tautan keluar; menutup tab memunculkan peringatan
       browser; pelanggaran dicatat, tidak dihukum otomatis (D-07).

Daftar halaman:

  PUBLIK
    P01 Login                          P02 Ganti sandi (wajib/sukarela)
    P03 Verifikasi sertifikat

  PESERTA
    M01 Dasbor sesi dan riwayat        M02 Instruksi dan konfirmasi mulai
    M03 Layar ujian (soal + navigator) M04 Ringkasan sebelum kumpul
    M05 Layar terkumpul                M06 Daftar dan detail hasil
    M07 Sertifikat (lihat/unduh)       M08 Notifikasi
    M09 Profil dan pengaturan          M10 Sanggah [S]

  ADMIN
    A01 Dasbor                         A02 Akun admin
    A03 Peserta (+ impor CSV)          A04 Kategori soal
    A05 Bank soal (+ versi, koreksi)   A06 Ujian (+ aturan komposisi)
    A07 Sesi (+ pendaftaran)           A08 Pantauan sesi
    A09 Publikasi dan nilai ulang      A10 Hasil dan laporan
    A11 Sertifikat                     A12 Sanggah [S]
    A13 Log audit                      A14 Notifikasi
    A15 Profil

Layar ujian M03 (paling kritis) HARUS menyediakan:
  - Header tetap: nama ujian, sisa waktu (disinkronkan server), indikator simpan.
  - Area soal: nomor/total, teks soal, opsi (radio), tombol ragu-ragu, tombol
    sebelumnya/berikutnya.
  - Navigator nomor: warna/penanda untuk belum, dijawab, ragu-ragu, aktif.
  - Tombol Kumpulkan -> M04 (bukan langsung kumpul).
  - Indikator koneksi: tampil peringatan bila gagal menyimpan; jawaban yang
    belum tersimpan ditandai jelas.
  - Banner pengumuman waktu tambahan saat admin menambah waktu.

4.2 Antarmuka Program Aplikasi (API)
------------------------------------
  - Gaya: REST JSON (UTF-8), awalan /api/v1. Daftar endpoint: Lampiran A.
  - Origin tunggal: frontend dilayani oleh reverse proxy yang sama dengan API,
    sehingga tidak ada CORS lintas origin.
  - Autentikasi: cookie httpOnly + Secure + SameSite=Strict. Permintaan yang
    mengubah data memerlukan token CSRF di header (USULAN: X-CSRF-Token).
  - Format waktu: ISO 8601 UTC (mis. 2026-10-14T01:00:00Z). Tampilan WIB oleh UI.
  - ID: UUID. Daftar berhalaman: ?page=1&per_page=25 (maksimum 100).
  - Format galat tunggal:
      { "error": { "code": "CAPACITY_FULL",
                   "message": "Kapasitas sesi sudah penuh.",
                   "details": { } },
        "request_id": "..." }
    Kode HTTP: 400 permintaan rusak, 401 belum login, 403 dilarang, 404 tidak
    ditemukan, 409 konflik aturan bisnis, 422 validasi gagal, 423 akun terkunci,
    429 terlalu banyak permintaan, 500 galat server (tanpa detail internal).
  - Setiap respons membawa X-Request-Id yang juga ada di log server.
  - Endpoint yang mengubah data bersifat IDEMPOTEN bila diulang (mulai ujian,
    kumpul, publikasi, penilaian) atau dilindungi constraint database.
  - Semua masukan divalidasi dengan skema (tipe, panjang, rentang). Semua query
    memakai parameter terikat (tidak ada penyambungan string SQL).
  - Respons untuk mahasiswa memakai serializer tersendiri yang TIDAK memuat
    is_correct, pembahasan, atau data mahasiswa lain (INV-15).

4.3 Antarmuka Perangkat Keras
-----------------------------
  - Komputer lab klien (spesifikasi minimum ditetapkan pada M0 berdasarkan
    browser yang didukung; UNVERIFIED).
  - Server lokal (Bagian 9), UPS, perangkat jaringan LAN.
  - Printer opsional untuk mencetak sertifikat dari PDF.

4.4 Antarmuka Perangkat Lunak dan Komunikasi
--------------------------------------------
  - Sistem operasi server Linux (ASSUMED; ditetapkan M0).
  - PostgreSQL (A-03). Reverse proxy dengan HTTPS internal (Bagian 9).
  - Sinkronisasi waktu server ke sumber waktu lokal yang disetujui.
  - Tidak ada layanan pihak ketiga yang dibutuhkan saat berjalan (B-01).


================================================================================
5. MODEL DATA (KAMUS DATA)
================================================================================

Ringkasan: 22 tabel inti + tabel appeals [S] = 23. Konvensi: PK = primary key;
FK = foreign key; NN = NOT NULL; UQ = unik; DEF = nilai bawaan. Semua PK bertipe
uuid kecuali dinyatakan lain. Semua waktu timestamptz (UTC). Nama tabel jamak,
snake_case. Waktu yang dipakai aturan ujian = jam database (now()).

5.1 Tipe enum
-------------
  user_role         admin, student
  user_status       active, suspended
  publish_state     draft, active, archived          (ujian dan soal)
  session_state     draft, published, cancelled
  enrollment_state  registered, attended, absent, cancelled
  attempt_state     in_progress, submitted, auto_submitted, graded, void
  result_state      pending_publication, published
  cert_state        valid, revoked
  correction_type   key_changed, also_accept, annulled
  appeal_state      open, accepted, rejected         (hanya bila FR-R07 dibangun)

5.2 Tabel
---------
TABEL users
  id PK
  email varchar(254) NN, UQ pada lower(email)
  password_hash text NN                       (hash lambat bersalt)
  role user_role NN
  status user_status NN DEF active
  must_change_password bool NN DEF true
  failed_login_count int NN DEF 0
  locked_until timestamptz
  last_login_at timestamptz
  password_changed_at timestamptz             (P-05)
  created_at, updated_at timestamptz NN DEF now()
  deleted_at timestamptz                      (soft delete)

TABEL student_profiles                        (Profil Peserta)
  user_id PK, FK users | identifier varchar(50) NN UQ | full_name varchar(150) NN
  institution varchar(150) | phone varchar(30)
  created_at, updated_at NN
  Catatan: identifier menampung Nomor Identitas unik peserta (NIM mahasiswa FIA,
  NISN siswa sekolah, NIM kampus luar, atau nomor registrasi peserta).

TABEL user_settings
  user_id PK, FK users | preferences jsonb NN DEF '{}' | updated_at NN

TABEL auth_sessions
  id PK | user_id FK users NN | refresh_token_hash text NN UQ
  user_agent text | ip_address inet | created_at, expires_at NN | revoked_at

TABEL exams
  id PK | code varchar(30) NN UQ | title varchar(200) NN | description text
  duration_minutes int NN CHECK > 0 | question_count int NN CHECK > 0
  passing_score numeric(5,2) NN CHECK 0..100
  shuffle_questions bool NN DEF true | shuffle_options bool NN DEF true
  max_attempts_per_student smallint NN DEF 3 CHECK >= 1
  allow_review bool NN DEF false | status publish_state NN DEF draft
  created_by FK users NN | created_at, updated_at NN

TABEL question_categories
  id PK | name varchar(120) NN UQ | description text

TABEL exam_question_rules
  id PK | exam_id FK exams NN | category_id FK question_categories NN
  difficulty smallint CHECK 1..3 (boleh kosong) | question_count int NN CHECK > 0
  UQ (exam_id, category_id, difficulty)

TABEL questions
  id PK | category_id FK NN | status publish_state NN DEF draft
  current_version_id FK question_versions DEFERRABLE | created_by FK users NN
  created_at NN | deleted_at

TABEL question_versions                       (tidak boleh diubah/dihapus)
  id PK | question_id FK questions NN | version_no int NN, UQ (question_id, version_no)
  stem text NN | difficulty smallint NN CHECK 1..3
  weight numeric(5,2) NN DEF 1 CHECK > 0 | explanation text
  created_by FK users NN | created_at NN

TABEL question_options
  id PK | question_version_id FK NN | position smallint NN
  option_text text NN | is_correct bool NN DEF false
  UQ (question_version_id, position); UQ (question_version_id, id) untuk FK komposit
  UQ parsial: satu is_correct = true per question_version_id

TABEL question_corrections                    (hanya tambah)
  id PK | question_version_id FK NN | type correction_type NN
  old_option_id, new_option_id (FK komposit ke opsi versi yang sama)
    key_changed: keduanya terisi dan berbeda; also_accept: new_option_id terisi;
    annulled: keduanya kosong
  reason text NN | created_by FK users NN | created_at NN

TABEL exam_sessions
  id PK | exam_id FK exams NN | code varchar(30) NN UQ | name varchar(200) NN
  starts_at, ends_at timestamptz NN CHECK ends_at > starts_at
  capacity int CHECK > 0 (kosong = tanpa batas)
  access_code_hash text                       (P-01, kode akses FR-S06)
  status session_state NN DEF draft | created_by FK users NN
  created_at, updated_at NN
  Catatan: status "belum mulai / berlangsung / selesai" DIHITUNG dari waktu,
  tidak disimpan.

TABEL session_enrollments
  id PK | session_id FK exam_sessions NN | student_id FK users NN
  status enrollment_state NN DEF registered | registered_by FK users
  registered_at NN | UQ (session_id, student_id)

TABEL attempts
  id PK | enrollment_id FK session_enrollments NN
  attempt_no int NN DEF 1, UQ (enrollment_id, attempt_no)
  status attempt_state NN DEF in_progress
  started_at timestamptz NN                   (jam database)
  deadline_at timestamptz NN                  (= started_at + durasi + extra_seconds)
  extra_seconds int NN DEF 0 CHECK >= 0 | extension_reason text (wajib bila > 0)
  submitted_at | submit_reason varchar(20): manual, timeout, forced
  void_reason text (wajib bila void) | created_at NN
  UQ PARSIAL (enrollment_id) WHERE status <> 'void'   -> INV-01

TABEL attempt_questions                       (snapshot; tidak boleh diubah)
  id PK | attempt_id FK attempts NN | question_version_id FK NN
  position smallint NN, UQ (attempt_id, position)
  option_order jsonb NN (urutan id opsi yang ditampilkan)
  UQ (attempt_id, question_version_id); UQ (id, question_version_id)

TABEL attempt_answers
  attempt_question_id PK | question_version_id NN (salinan untuk FK komposit)
  selected_option_id (kosong = dikosongkan) | is_flagged bool NN DEF false
  client_seq int NN DEF 0 | answered_at, updated_at NN
  is_correct bool | points_awarded numeric(6,2)    (diisi saat penilaian)
  FK komposit (attempt_question_id, question_version_id) ->
        attempt_questions(id, question_version_id)
  FK komposit (question_version_id, selected_option_id) ->
        question_options(question_version_id, id)                -> INV-05

TABEL attempt_events                          (hanya tambah)
  id bigint identity PK | attempt_id FK NN
  event_type varchar(30) NN | occurred_at NN (jam database)
  client_time timestamptz (informasi saja) | detail jsonb

TABEL results
  id PK | attempt_id FK NN UQ
  raw_score numeric(7,2) NN CHECK >= 0 | max_score numeric(7,2) NN CHECK > 0
  score numeric(5,2) NN CHECK 0..100
  passing_score numeric(5,2) NN                (salinan nilai lulus saat penilaian)
  passed bool NN | formula_version varchar(20) NN DEF 'v1'
  revision_no int NN DEF 0 | status result_state NN DEF pending_publication
  graded_at NN | published_at | published_by FK users
  CHECK raw_score <= max_score
  CHECK status = published -> published_at dan published_by terisi

TABEL certificates
  id PK | result_id FK NN UQ | certificate_no varchar(40) NN UQ
  verification_code varchar(64) NN UQ | issued_at NN | expires_at (kosong)
  status cert_state NN DEF valid | revoked_at
  revoke_source varchar(10): manual, regrade | revoked_reason text
  issued_by FK users (kosong = sistem)

TABEL certificate_counters
  year smallint PK | last_seq int NN DEF 0

TABEL notifications
  id PK | recipient_id FK users NN | type varchar(40) NN | title varchar(200) NN
  body text | entity_type varchar(40) | entity_id uuid | created_at NN | read_at
  dedupe_key varchar(100); UQ PARSIAL (recipient_id, dedupe_key) bila terisi

TABEL audit_logs                              (hanya tambah)
  id bigint identity PK | actor_id FK users (kosong = sistem) | actor_role user_role
  action varchar(60) NN | entity_type varchar(40) NN | entity_id uuid
  reason text | before_data jsonb | after_data jsonb | ip_address inet
  created_at NN DEF now()

TABEL appeals [S]                             (perubahan P-02)
  id PK | result_id FK results NN | student_id FK users NN
  question_version_id FK (boleh kosong) | message text NN CHECK panjang <= 1000
  status appeal_state NN DEF open | response text | responded_by FK users
  created_at NN | responded_at

5.3 Indeks
----------
  users(lower(email)) UQ; exam_sessions(starts_at, ends_at);
  exam_sessions(exam_id, status); session_enrollments(student_id);
  attempts(status, deadline_at)  [kumpul otomatis];
  attempt_questions(attempt_id); attempt_events(attempt_id, occurred_at);
  results(status); certificates(verification_code) UQ;
  notifications(recipient_id, read_at, created_at DESC);
  audit_logs(entity_type, entity_id, created_at); audit_logs(actor_id, created_at);
  appeals(result_id), appeals(status).

5.4 Kebijakan hapus dan hak akses database
------------------------------------------
  - Soft delete: users, questions.
  - RESTRICT (tidak boleh dihapus bila dirujuk): versi soal, sesi yang punya
    pendaftaran, ujian yang punya sesi.
  - Tidak boleh dihapus sama sekali: percobaan, jawaban, peristiwa ujian, hasil,
    sertifikat, koreksi soal, log audit. Pembatalan memakai status (void, revoked,
    annulled).
  - Dua peran database: (1) pemilik migrasi, hanya dipakai saat migrasi;
    (2) akun aplikasi dengan hak terbatas: tanpa DDL; TANPA UPDATE dan DELETE pada
    audit_logs, attempt_events, question_corrections; question_versions dan
    attempt_questions dilindungi trigger terhadap UPDATE/DELETE; question_options
    hanya dapat berubah lewat jalur koreksi.


================================================================================
6. ATURAN BISNIS, MESIN STATUS, DAN INVARIAN
================================================================================

6.1 Aturan Bisnis
-----------------
BR-01 Rumus nilai (D-01)
      raw_score  = jumlah points_awarded (bobot soal bila benar, 0 bila salah/kosong)
      max_score  = jumlah bobot semua soal percobaan yang tidak dianulir
      score      = ROUND(raw_score / max_score x 100, 2), setengah ke atas
      passed     = (score >= passing_score yang disalin ke baris hasil)
      Perbandingan memakai skor yang SUDAH dibulatkan (lihat S-06 dan catatan
      keputusan fakultas pada Bagian 12).

BR-02 Kunci berlaku suatu soal
      Himpunan jawaban benar = opsi is_correct asli + semua opsi also_accept;
      bila ada key_changed, opsi benar asli diganti new_option_id dari
      key_changed TERAKHIR. Bila ada annulled: soal keluar dari raw dan max.

BR-03 Jendela waktu dan batas waktu (D-09)
      Mulai ujian diperbolehkan bila  starts_at <= sekarang <= ends_at - durasi.
      deadline_at = started_at + durasi + extra_seconds.
      Jawaban/kumpul diterima sampai deadline_at + 5 detik.
      Sesi hanya valid bila (ends_at - starts_at) >= durasi ujian.

BR-04 Kesempatan (D-03)
      Satu pendaftaran = satu percobaan non-void. Maksimal max_attempts_per_student
      (bawaan 3) percobaan non-void per mahasiswa per ujian. Sudah lulus pada
      ujian itu = tidak boleh didaftarkan lagi. Pendaftaran berikutnya hanya
      bila semua percobaan sebelumnya pada ujian itu sudah published. Ketidakhadiran
      dan percobaan void tidak dihitung.

BR-05 Jadwal dan kapasitas (D-02)
      Tidak ada dua pendaftaran aktif satu mahasiswa pada sesi yang rentang
      waktunya beririsan. Jumlah pendaftaran aktif sesi <= capacity bila diisi.

BR-06 Snapshot soal
      Soal yang diterima mahasiswa dikunci pada question_version_id saat mulai.
      Perubahan bank soal sesudahnya tidak memengaruhi percobaan itu.

BR-07 Publikasi (D-11)
      Hasil dipublikasikan per sesi hanya setelah sesi berakhir dan tidak ada
      percobaan in_progress; semua percobaan non-void sudah graded.

BR-08 Koreksi (D-12)
      Perubahan kunci atau anulir hanya lewat question_corrections dengan alasan,
      pratinjau dampak, konfirmasi, dan nilai ulang dalam satu transaksi.
      Hasil published yang berubah menaikkan revision_no dan dinotifikasi.

BR-09 Sertifikat (D-06)
      Terbit otomatis untuk hasil lulus yang published. Nilai ulang menerbitkan
      atau mencabut sesuai hasil baru (revoke_source = regrade); pencabutan
      manual bersifat tetap. Verifikasi publik hanya memuat nama, nama ujian,
      tanggal terbit, status.

BR-10 Percobaan void
      Alasan wajib. Tidak dihitung sebagai kesempatan. Tidak tampil sebagai
      hasil mahasiswa. Hasil yang sudah published tidak dapat di-void; harus
      lewat koreksi bercatat.

BR-11 Penandaan absen
      Setelah sesi berakhir, pendaftaran berstatus registered tanpa percobaan
      menjadi absent oleh pekerjaan terjadwal (idempoten).

BR-12 Penguncian konfigurasi (INV-21)
      Setelah ada sesi published, durasi, jumlah soal, nilai lulus, dan aturan
      komposisi ujian terkunci.

BR-13 Hak lihat data
      Mahasiswa hanya melihat data miliknya dan hanya hasil published. Admin
      melihat semua data, kecuali isi jawaban pada layar pantauan.

BR-14 Retensi
      Data ujian, hasil, sertifikat, dan log audit tidak dihapus otomatis. Masa
      simpan resmi ditetapkan fakultas (pertanyaan terbuka Q-05, Bagian 12).

6.2 Mesin Status
----------------
Transisi yang tidak tercantum DILARANG dan ditolak server (409 INVALID_TRANSITION).
Status akhir (terminal): cancelled, archived, void, revoked (manual).

SESI (disimpan): draft -> published -> cancelled
  draft -> published      admin; lolos FR-S02                          idempoten
  draft/published -> cancelled  admin; belum ada percobaan; alasan     idempoten
  (status "belum mulai / berlangsung / selesai" DIHITUNG dari waktu, tidak disimpan)

PENDAFTARAN: registered -> attended | absent | cancelled
  registered -> attended   sistem saat percobaan dibuat
  registered -> absent     sistem setelah sesi berakhir tanpa percobaan
  registered -> cancelled  admin sebelum starts_at tanpa percobaan

PERCOBAAN: in_progress -> submitted | auto_submitted -> graded ; in_progress,
           submitted, auto_submitted, graded -> void
  in_progress -> submitted        mahasiswa; sekarang <= deadline_at + 5 dtk
  in_progress -> auto_submitted   sistem; sekarang > deadline_at + 5 dtk
  submitted/auto_submitted -> graded   sistem segera setelah kumpul
  * -> void                       admin; alasan wajib; graded hanya bila hasil
                                  belum published
  Semua transisi dilakukan dengan UPDATE bersyarat pada status asal.

HASIL: pending_publication -> published
  pending_publication -> published   admin per sesi; BR-07
  published -> published (revisi)    admin lewat koreksi/nilai ulang; revision_no + 1

SERTIFIKAT: valid -> revoked ; revoked -> valid
  valid -> revoked    admin (manual, tetap) atau sistem (nilai ulang jadi tidak lulus)
  revoked -> valid    sistem saja, hanya bila revoke_source = regrade dan hasil
                      kembali lulus

UJIAN dan SOAL: draft -> active -> archived
SANGGAH [S]: open -> accepted | rejected
PENGGUNA: active <-> suspended

6.3 Invarian dan Tes
--------------------
Invarian = pernyataan yang HARUS benar kapan pun, termasuk saat dua permintaan
datang bersamaan atau satu langkah gagal. Tiap baris punya tempat penegakan dan
satu tes yang HARUS lulus sebelum fitur dianggap selesai.

  ID      Invarian                                      Ditegakkan di      Tes
  ------  --------------------------------------------  -----------------  -----
  INV-01  Satu pendaftaran punya paling banyak satu     indeks unik        TC-01
          percobaan non-void                            parsial
  INV-02  Waktu mulai dan batas dari jam database       backend            TC-02
  INV-03  Jawaban hanya saat in_progress dan            backend, update    TC-03
          sekarang <= deadline_at + 5 detik             bersyarat
  INV-04  Jawaban lama tidak menimpa yang baru          update bersyarat   TC-04
                                                        client_seq
  INV-05  Opsi terpilih milik soal itu                  FK komposit        TC-05
  INV-06  Soal yang diterima tidak berubah; versi dan   trigger / hak     TC-06
          opsi tak bisa diubah kecuali lewat koreksi    akses database
  INV-07  Mulai ujian hanya bila semua syarat BR-03,    backend, satu      TC-07
          BR-04 terpenuhi                               transaksi
  INV-08  Ujian tidak dimulai dan sesi tidak            backend            TC-08
          dipublikasikan bila soal tidak cukup
  INV-09  Tidak ada irisan jadwal; kapasitas tidak      kunci transaksi    TC-09
          terlampaui; syarat BR-04 saat menugaskan
  INV-10  Kumpul manual dan otomatis tidak berebut      UPDATE ... WHERE   TC-10
                                                        status='in_progress'
  INV-11  Penilaian idempoten, murni dari jawaban dan   unik attempt_id    TC-11
          kunci berlaku                                 + upsert
  INV-12  Skor = BR-01; lulus sesuai salinan nilai      satu fungsi hitung TC-12
          lulus
  INV-13  Publikasi hanya setelah sesi berakhir dan     backend, satu      TC-13
          tanpa percobaan in_progress                   transaksi
  INV-14  Mahasiswa hanya melihat hasil miliknya yang   backend, filter    TC-14
          published                                     pemilik
  INV-15  Kunci dan pembahasan tidak ada di respons     serializer per     TC-15
          mahasiswa (kecuali allow_review)              peran
  INV-16  Hasil published berubah hanya lewat koreksi   backend + audit    TC-16
          bercatat                                      log
  INV-17  Sertifikat hanya untuk hasil lulus dan        backend, satu      TC-17
          published; nilai ulang terbit/cabut otomatis  transaksi
  INV-18  Nomor sertifikat unik tanpa balapan           kunci baris        TC-18
                                                        certificate_counters
  INV-19  Log audit dan peristiwa ujian hanya tambah    hak akses DB       TC-19
  INV-20  Peran diperiksa di server pada setiap         middleware         TC-20
          endpoint
  INV-21  Konfigurasi ujian terkunci setelah ada sesi   backend            TC-21
          published
  INV-22  Login baru mencabut sesi lain; akun suspended backend            TC-22
          tidak bisa login atau memakai token lama

6.4 Alur Utama End-to-End
-------------------------
  1. Persiapan: admin membuat kategori soal, bank soal (berbobot dan berversi),
     konfigurasi ujian, dan aturan komposisi.
  2. Akun: admin impor CSV peserta (nomor identitas dan instansi asal), unduh kredensial awal (sekali).
  3. Jadwal: admin membuat sesi, mempublikasikan (validasi FR-S02), menugaskan
     peserta (validasi FR-S04).
  4. Hari ujian: admin membuka Pantauan sesi. Peserta login, ganti sandi (bila
     pertama kali), membuka dasbor, instruksi, memasukkan kode akses bila ada,
     menekan Mulai.
  5. Mengerjakan: jawaban tersimpan otomatis, waktu dari server; bila terputus
     lanjut di percobaan yang sama; bila ada gangguan admin menambah waktu.
  6. Kumpul: manual atau otomatis; penilaian segera, hasil tersimpan menunggu
     publikasi.
  7. Setelah sesi berakhir: admin meninjau peristiwa dan catatan insiden,
     lalu publikasi hasil per sesi; sertifikat terbit untuk yang lulus; mahasiswa
     dinotifikasi.
  8. Pascapublikasi: mahasiswa melihat hasil/sertifikat; sanggah [S]; admin
     menindaklanjuti dengan koreksi soal bila perlu; verifikasi sertifikat publik.
  9. Laporan dan ekspor oleh admin; semua tindakan tercatat di log audit.

6.5 Skenario Hitungan
---------------------
S-01 Kasus biasa
  Ujian 40 soal bobot 1, nilai lulus 70. Mahasiswa: benar 29, salah 8, kosong 3.
  raw = 29; max = 40; skor = 29/40 x 100 = 72,50 -> 72,50 >= 70 -> LULUS.

S-02 Bobot berbeda
  30 soal: 20 soal bobot 1 dan 10 soal bobot 2 -> max = 20 + 20 = 40.
  Mahasiswa benar 15 soal bobot 1 dan 6 soal bobot 2: raw = 15 + 12 = 27.
  skor = 27/40 x 100 = 67,50 -> TIDAK LULUS (nilai lulus 70).
  Catatan: 21 dari 30 soal benar (70%) terlihat lulus bila bobot diabaikan; itu
  sebabnya D-01 menetapkan bobot dipakai.

S-03 Koreksi kunci setelah publikasi (also_accept)
  Ujian S-01. Soal 17 (bobot 1) ternyata punya dua jawaban benar; admin memilih
  also_accept. Pratinjau: mahasiswa yang menjawab opsi tambahan +1, tidak ada yang
  berkurang. Mahasiswa P (raw 27, skor 67,50, tidak lulus) menjawab opsi tambahan:
  raw 28 -> skor 28/40 x 100 = 70,00 -> 70,00 >= 70 -> LULUS. revision_no = 1,
  notifikasi terkirim, sertifikat terbit, audit_logs tercatat.
  Bila admin memilih key_changed: mahasiswa yang menjawab kunci lama kehilangan 1
  poin; yang tadinya lulus di batas dapat menjadi tidak lulus dan sertifikatnya
  dicabut otomatis (revoke_source = regrade). Karena itu pratinjau wajib.

S-04 Batas waktu dan mulai terlambat
  Sesi 08:00-10:00, durasi 90 menit. Mulai terakhir = 10:00 - 90 menit = 08:30.
  Mulai 08:30:00 -> deadline 10:00:00 (diterima). Mulai 08:31:00 -> ditolak
  SESSION_ENDING_SOON. Sesi 08:00-09:00 dengan durasi 90 menit ditolak saat
  dipublikasikan.

S-05 Tambah waktu
  Listrik padam 10 menit pukul 09:10. Admin memakai tambah waktu massal 600 detik.
  Percobaan berbatas 09:40:00 menjadi 09:50:00; extra_seconds = 600; alasan,
  pelaku, dan jumlah percobaan terdampak tercatat. Percobaan yang sudah terkumpul
  tidak berubah.

S-06 Pembulatan di batas lulus
  Ujian bobot desimal, max = 200,00, nilai lulus 70,00. Mahasiswa raw = 139,99.
  Skor tanpa pembulatan = 69,995; ROUND 2 desimal setengah ke atas = 70,00 ->
  LULUS menurut BR-01. Tanpa pembulatan sebelum perbandingan hasilnya TIDAK LULUS.
  Aturan ini harus disetujui fakultas (Q-04).

S-07 Kesempatan ujian (D-03)
  Mahasiswa T: percobaan 1 tidak lulus (published), didaftarkan sesi 2; percobaan
  2 tidak lulus (published), didaftarkan sesi 3; percobaan 3 tidak lulus. Pendaftaran
  ke sesi 4 -> 409 QUOTA_EXCEEDED. Bila percobaan 2 di-void karena gangguan teknis,
  hitungan non-void = 2 sehingga masih boleh mendaftar ke sesi 4.
  Mahasiswa yang lulus pada percobaan 1 -> 409 ALREADY_PASSED untuk semua sesi
  ujian itu.


================================================================================
7. KEBUTUHAN NON-FUNGSIONAL
================================================================================

Semua angka bertanda USULAN adalah target awal berdasarkan asumsi A-09 (300
mahasiswa mengerjakan bersamaan) dan WAJIB divalidasi lewat uji beban (TC-38).

NFR-01 Kinerja (USULAN, pada beban A-09, di LAN)
  - Simpan jawaban: p95 <= 500 ms; p99 <= 1500 ms.
  - Muat satu soal: p95 <= 1 detik.
  - Mulai ujian saat 300 mahasiswa menekan Mulai dalam 60 detik: p95 <= 3 detik,
    tidak ada kegagalan karena batas koneksi atau kunci.
  - Penilaian satu percobaan <= 1 detik. Publikasi 300 hasil <= 30 detik.
  - Halaman admin biasa p95 <= 2 detik. Ekspor 3000 baris <= 10 detik.
  - Pantauan sesi 300 mahasiswa memuat <= 2 detik tiap 10 detik tanpa
    menurunkan kinerja simpan jawaban.

NFR-02 Kapasitas data
  Baris jawaban per bulan <= (percobaan per bulan) x (soal per ujian). Dengan A-09
  batas atas = 50 sesi x 300 percobaan x 40 soal = 600.000 baris per bulan (angka
  hipotetis; ganti dengan data fakultas). Disk server dirancang >= 3 kali
  proyeksi tiga tahun, ditetapkan setelah data fakultas diketahui.

NFR-03 Ketersediaan, pemulihan, dan cadangan
  - Tidak ada pemeliharaan terencana pada jendela sesi.
  - RTO (waktu pemulihan) <= 60 menit; RPO (data hilang maksimum) <= 15 menit
    (USULAN). Memerlukan arsip log transaksi PostgreSQL kontinu (konfigurasi
    rinci UNVERIFIED, diperiksa M0).
  - Cadangan penuh harian, arsip transaksi kontinu, dan cadangan tambahan
    SEBELUM setiap sesi. Salinan disimpan pada perangkat/lokasi berbeda dari
    server utama.
  - Uji pemulihan dilakukan sebelum semester dan tiap bulan (TC-40). Cadangan
    yang belum pernah diuji pulih dianggap TIDAK ADA.

NFR-04 Keamanan (berlaku untuk seluruh sistem)
  SEC-01 HTTPS wajib walau di LAN; HTTP polos dialihkan atau ditolak.
  SEC-02 Sandi di-hash dengan algoritma hash lambat bersalt (Argon2); tidak ada
         sandi di log, respons, atau repositori.
  SEC-03 Cookie sesi httpOnly, Secure, SameSite=Strict; token CSRF untuk
         permintaan yang mengubah data.
  SEC-04 Otorisasi di server untuk setiap endpoint dan setiap objek (INV-20,
         INV-14); objek milik orang lain dijawab 404.
  SEC-05 Seluruh masukan divalidasi; query memakai parameter terikat; keluaran
         di-escape; header keamanan standar dan kebijakan konten (CSP) yang
         melarang skrip dari luar origin.
  SEC-06 Pembatasan laju: login, verifikasi sertifikat, kode akses, peristiwa
         ujian, unggah CSV.
  SEC-07 Rahasia (sandi database, kunci) hanya di variabel lingkungan atau berkas
         terproteksi di server; tidak di kode atau repositori.
  SEC-08 Akun database aplikasi berhak minimal (Bagian 5.4).
  SEC-09 Unggah berkas hanya CSV, batas ukuran, tidak dieksekusi, tidak disajikan
         kembali dari folder publik.
  SEC-10 Ekspor menetralkan injeksi rumus (FR-L03).
  SEC-11 Dependensi diperiksa kerentanan sebelum tiap rilis; pembaruan keamanan
         server dilakukan terjadwal (tanpa internet: paket diunduh dan dipasang
         manual, Bagian 9).
  SEC-12 Log audit mencatat tindakan sensitif dan tidak dapat diubah (INV-19).
  SEC-13 Autentikasi dua faktor untuk admin [C].
  SEC-14 Uji keamanan independen (penetrasi) SEBELUM dipakai untuk ujian
         berisiko tinggi (TC-39).

  Ringkasan model ancaman:
  Ancaman                          Dampak                    Kontrol utama
  -------------------------------  ------------------------  ----------------------
  Mengubah jam perangkat           Waktu lebih panjang       INV-02, FR-T07
  Mengubah data lewat konsol       Nilai/jawaban dipalsukan  Logika di server
  Berbagi akun / dua perangkat     Joki, kecurangan          FR-A06, FR-T11
  Menebak ID (IDOR)                Data mahasiswa lain       404 + filter pemilik
  Kebocoran bank soal              Ujian tak valid           Akses admin saja,
                                                             INV-15, log ekspor
  Tebak sandi (brute force)        Pengambilalihan akun      FR-A05, SEC-06
  SQL injection                    Seluruh data bocor        Parameter terikat
  XSS lewat teks soal/nama         Pencurian sesi            Escape + CSP, teks polos
  Admin salah klik / berbuat salah Hasil rusak               Pratinjau, konfirmasi,
                                                             audit, tak ada hapus
  Server mati / disk rusak         Data hilang               NFR-03
  Jam server menyimpang            Aturan waktu salah        Sinkron waktu lokal,
                                                             alarm selisih
  Kecurangan kolaboratif           Nilai tidak valid         Soal acak; peristiwa
                                                             sebagai bukti
                                                             (di luar kendali penuh)

NFR-05 Keandalan
  Operasi multi-langkah memakai transaksi atau idempoten; tidak ada keadaan
  setengah jadi. Pekerjaan terjadwal bersifat idempoten dan dapat diulang.
  Kegagalan di tengah jalan: tabel pemulihan pada Bagian 9.5.

NFR-06 Kemudahan penggunaan
  - Mahasiswa baru dapat dari login sampai menekan Mulai tanpa bantuan dalam
    <= 2 menit pada UAT (USULAN, minimal 90% dari penguji).
  - Admin dapat membuat satu sesi lengkap dari data yang sudah ada dalam <= 10
    menit pada UAT (USULAN).
  - Semua teks Bahasa Indonesia; istilah konsisten dengan Glosarium.

NFR-07 Aksesibilitas: lihat U-08.

NFR-08 Kompatibilitas
  Browser yang didukung ditetapkan pada M0 (UNVERIFIED) dan diuji pada komputer
  lab asli. Layar ujian dirancang untuk desktop (A-08); halaman hasil dan
  sertifikat responsif.

NFR-09 Pemeliharaan dan kualitas kode
  TypeScript ketat, lint dan format otomatis, tes otomatis di CI lokal, migrasi
  database berversi dan dapat diulang, konfigurasi lewat variabel lingkungan,
  dokumentasi pemasangan dan runbook. Tiap tugas dianggap selesai hanya bila tes
  terkait lulus (Bagian 11).

NFR-10 Observabilitas
  Log terstruktur (JSON) dengan request_id, tanpa rahasia. Metrik minimal: jumlah
  percobaan berjalan, latensi dan laju galat, tertunggaknya pekerjaan terjadwal,
  ukuran database, selisih jam server, umur cadangan terakhir. Peringatan
  ditampilkan di dasbor admin (FR-L01) dan berkas log, karena tidak ada layanan
  alarm eksternal.

NFR-11 Privasi dan kepatuhan
  Data pribadi diminimalkan (A-04). Akses menurut peran, ekspor tercatat. Ketentuan
  hukum pelindungan data pribadi yang berlaku bagi kampus HARUS ditinjau
  profesional hukum sebelum peluncuran (UNVERIFIED). Masa simpan data ditetapkan
  fakultas (BR-14).

NFR-12 Portabilitas dan pemasangan ulang
  Aplikasi dikemas agar dapat dipasang ulang pada server pengganti mengikuti
  satu panduan tertulis; target <= 1 jam di luar waktu pemulihan data (USULAN).
  Tidak ada ketergantungan pada layanan internet saat berjalan.

NFR-13 Retensi log
  Log audit: seumur sistem. Log aplikasi: 90 hari (USULAN). Peristiwa ujian
  mengikuti retensi hasil.


================================================================================
8. ARSITEKTUR DAN TEKNOLOGI
================================================================================

8.1 Komponen
------------
  K-01 Reverse proxy   : menghentikan HTTPS, melayani frontend statis, meneruskan
                         /api ke aplikasi backend, menambah header keamanan,
                         membatasi ukuran permintaan.
  K-02 Backend API     : seluruh logika bisnis, autentikasi, otorisasi, penilaian.
  K-03 Pekerja terjadwal: kumpul otomatis, penilaian ulang gagal, penandaan absen,
                         pembersihan sesi, pemeriksaan kesehatan (jam, cadangan).
                         Berjalan sebagai proses terpisah atau modul di backend
                         (diputuskan M0), memakai antrean di PostgreSQL.
  K-04 Database        : PostgreSQL, sumber kebenaran tunggal.
  K-05 Frontend        : aplikasi React + TypeScript dasar dari Figma Make,
                         dibangun menjadi berkas statis.
  K-06 Penyimpanan berkas: folder terlindung untuk PDF yang di-cache (opsional),
                         berkas cadangan.
  K-07 Skrip operasi   : pemasangan, migrasi, semai admin, cadangan, pemulihan,
                         pemeriksaan kesehatan.

8.2 Teknologi yang Direkomendasikan
-----------------------------------
Semua nama di bawah adalah REKOMENDASI dari pengetahuan penyusun. Versi, status
pemeliharaan, dan kemampuan HARUS diverifikasi ke dokumentasi resmi pada M0
(label UNVERIFIED) sebelum kode yang bergantung padanya ditulis.

  Bahasa/runtime  : TypeScript pada Node.js LTS (satu bahasa dengan frontend).
  Server API      : Fastify.
  Database        : PostgreSQL.
  Akses data      : query builder bertipe (mis. Kysely) atau klien pg langsung;
                    SQL tulisan tangan untuk operasi kritis. Hindari lapisan yang
                    menyembunyikan indeks unik parsial, FK komposit, kunci baris.
  Migrasi         : berkas SQL berurutan dan berversi.
  Validasi        : skema (mis. Zod) untuk validasi dan tipe.
  Hash sandi      : Argon2.
  Pekerjaan       : pustaka antrean berbasis PostgreSQL (mis. pg-boss), tanpa Redis.
  Proxy           : Nginx atau Caddy.
  Proses          : systemd (hidup otomatis setelah listrik pulih) atau pengelola
                    proses setara.
  Pengujian       : Vitest (unit/integrasi) dengan PostgreSQL ASLI; alat uji
                    browser untuk end-to-end; alat uji beban.
  PDF             : pustaka pembuat PDF di sisi server (dipilih M0, UNVERIFIED).
  Frontend        : React + TypeScript (hasil Figma Make), Tailwind bila sudah
                    dipakai prototipe.

Syarat keputusan: bila tim IT kampus yang akan merawat sistem lebih menguasai PHP
(Laravel) atau Python (Django), rekomendasi stack backend diganti. Seluruh
Bagian 3-7 tidak berubah; yang berubah hanya Bagian 8.2 dan 8.3. Kemampuan tim
perawat lebih menentukan daripada kerangka kerjanya.

8.3 Struktur Kode Backend yang Disarankan
-----------------------------------------
  src/
    modules/
      auth/  users/  questions/  exams/  sessions/
      attempts/  grading/  results/  certificates/  reports/
      notifications/  audit/  appeals/
      (tiap modul: routes -> service -> repository; skema validasi; tes)
    db/
      migrations/       berkas SQL berurutan
      schema-notes.md   catatan constraint dan alasan
    jobs/               pekerjaan terjadwal
    lib/
      time.ts           SATU-SATUNYA sumber waktu (jam database)
      grading.ts        SATU fungsi hitung nilai (BR-01, BR-02), murni
      errors.ts         kode galat dan pemetaan HTTP
      authz.ts          pemeriksaan peran dan kepemilikan
    config/             pembacaan variabel lingkungan dengan validasi
  tests/
    unit/  integration/  e2e/  load/  security/

Aturan kode (wajib):
  C-01 Logika bisnis HANYA di service backend. Frontend tidak menghitung nilai,
       sisa waktu final, atau hak akses.
  C-02 Transaksi dibuka di lapisan service; operasi multi-langkah (mulai ujian,
       penilaian, publikasi, koreksi, penugasan) satu transaksi.
  C-03 Semua pembacaan waktu untuk aturan ujian memakai lib/time (jam database).
  C-04 Fungsi hitung nilai satu-satunya (lib/grading); dipakai penilaian, nilai
       ulang, dan pratinjau koreksi.
  C-05 Transisi status lewat UPDATE bersyarat pada status asal; hasil 0 baris =
       transisi tidak sah atau sudah dilakukan (diperlakukan idempoten).
  C-06 Respons mahasiswa melalui serializer terpisah.
  C-07 Tidak ada rahasia di kode, log, atau pesan galat.
  C-08 Setiap endpoint punya daftar peran yang diizinkan yang dideklarasikan
       eksplisit; endpoint tanpa deklarasi gagal saat startup.

8.4 Pekerjaan Terjadwal
-----------------------
  Nama                        Jadwal (USULAN)        Fungsi
  --------------------------  ---------------------  ---------------------------
  sweep-expired-attempts      tiap 1 menit           kumpulkan otomatis percobaan
                                                     melewati batas (FR-T10)
  retry-grading               tiap 1 menit           nilai ulang yang gagal
  mark-absent                 tiap 5 menit           BR-11
  cleanup-sessions            harian                 hapus sesi login > 30 hari
  health-check                tiap 1 menit           selisih jam, umur cadangan,
                                                     percobaan melewati batas > 5
                                                     menit, jumlah pekerjaan
                                                     tertunggak -> tampil di dasbor
  backup-full                 harian + sebelum sesi  Bagian 9.4
  Semua pekerjaan IDEMPOTEN dan aman dijalankan ganda.

8.5 Konfigurasi (variabel lingkungan dan parameter)
----------------------------------------------------
  Rahasia/lingkungan (tidak di repositori): DATABASE_URL, APP_SECRET, BASE_URL,
  ADMIN_EMAIL dan ADMIN_PASSWORD (hanya dipakai skrip semai).

  Parameter bawaan (USULAN; dapat diubah admin sistem tanpa mengubah kode):
    ANSWER_GRACE_SECONDS            5
    LOGIN_MAX_FAILS                 5
    LOGIN_LOCK_MINUTES              15
    LOGIN_RATE_PER_MINUTE_PER_IP    10
    ACCESS_CODE_MAX_FAILS_PER_5MIN  5
    ADMIN_IDLE_TIMEOUT_MINUTES      30
    STUDENT_SESSION_MAX_HOURS       8
    PASSWORD_MIN_LENGTH             10
    DEFAULT_MAX_ATTEMPTS            3
    APPEAL_WINDOW_DAYS              7
    MAX_EXTEND_PER_ACTION_MINUTES   60
    CSV_MAX_ROWS                    5000
    CSV_MAX_BYTES                   5242880
    TIMER_RESYNC_SECONDS            30
    MONITOR_REFRESH_SECONDS         10
    EVENTS_MAX_PER_MINUTE           60

8.6 Penyesuaian Frontend (dari prototipe Figma Make)
----------------------------------------------------
  F-01 Hapus seluruh pemakaian localStorage/sessionStorage untuk data bisnis,
       sesi login, kredensial, atau soal.
  F-02 Ganti login tiruan dan kredensial admin tetap dengan pemanggilan POST
       /auth/login; halaman terlindungi berdasarkan respons server.
  F-03 Ganti data contoh/fallback soal dengan data dari API; tidak ada soal
       cadangan di frontend.
  F-04 Layar ujian: timer dari server (FR-T07), simpan jawaban otomatis (FR-T05),
       lanjut setelah putus (FR-T08), pencatat peristiwa (FR-T11).
  F-05 Hapus perhitungan nilai di frontend; tampilkan hasil dari API.
  F-06 Tambahkan layar: ganti sandi, pantauan sesi, koreksi soal (pratinjau
       dampak), tambah waktu, publikasi hasil (pratinjau), laporan, log audit.
  F-07 Kemas semua aset secara lokal (U-06).
  F-08 Tambahkan keadaan memuat/kosong/galat/tanpa izin pada setiap halaman (U-01).

8.7 Data Awal dari Prototipe
----------------------------
Bank soal di prototipe (examData.ts) diekspor sekali sebagai berkas, dikonversi ke
format impor (Lampiran B) lewat skrip sekali pakai, lalu DITINJAU admin sebelum
dipakai (kunci jawaban diperiksa manual). Tidak ada data peserta/hasil dari
prototipe yang dimigrasikan karena tidak diverifikasi.


================================================================================
9. PENERAPAN LOKAL DAN OPERASIONAL
================================================================================

9.1 Topologi
------------
  - Satu server di ruang terkunci, terhubung ke LAN kampus. Komputer lab dan
    perangkat admin mengakses lewat nama host internal berprotokol HTTPS.
  - Tidak ada akses masuk dari internet. Akses internet keluar tidak dibutuhkan
    saat berjalan.
  - Jaringan lab diprioritaskan; bila memungkinkan segmen jaringan ujian terpisah.

9.2 Server dan Infrastruktur
----------------------------
  - Spesifikasi (CPU, RAM, SSD) DITETAPKAN setelah uji beban TC-38 berdasarkan
    jumlah mahasiswa bersamaan dari fakultas; tidak ditebak di dokumen ini.
  - Penyimpanan: database pada disk berbeda dari disk cadangan lokal.
  - UPS yang cukup untuk shutdown bersih dan melewati padam singkat; server
    dikonfigurasi hidup otomatis dan layanan pulih otomatis setelah daya kembali.
  - Satu titik gagal (server tunggal) DITERIMA dan dikelola lewat cadangan,
    prosedur pemulihan, dan server cadangan dingin bila anggaran memungkinkan.

9.3 Waktu Server
----------------
  - Semua aturan waktu bertumpu pada jam server (INV-02). Jam disinkronkan ke
    sumber waktu lokal yang disetujui.
  - Hanya admin sistem yang dapat mengubah jam server. Selisih terhadap sumber
    waktu dipantau; selisih > 2 detik (USULAN) memunculkan peringatan di dasbor.
  - Setelah server hidup dari mati total, pemeriksaan jam dilakukan SEBELUM
    sesi dibuka kembali.

9.4 Cadangan dan Pemulihan
--------------------------
  - Cadangan penuh harian; arsip transaksi kontinu; cadangan tambahan tepat
    sebelum tiap sesi; salinan di perangkat/lokasi terpisah; cadangan dienkripsi
    bila meninggalkan server (USULAN).
  - Prosedur pemulihan tertulis, diuji pada server uji tiap bulan dan sebelum
    semester (TC-40): hasil uji dicatat (tanggal, durasi, data terverifikasi).
  - Setelah pemulihan: jalankan pemeriksaan konsistensi (percobaan in_progress
    melewati batas -> kumpul otomatis; hasil tanpa percobaan; nomor sertifikat).

9.5 Kegagalan dan Pemulihan
---------------------------
  Kegagalan                         Keadaan data              Pemulihan
  --------------------------------  ------------------------  ------------------------
  Mulai ujian gagal di tengah       Tidak ada percobaan       Mahasiswa coba lagi;
  (soal kurang, server mati)                                  admin diberi peringatan
  Server mati/browser tertutup      Percobaan dan jawaban     Masuk lagi, lanjut;
  saat ujian                        tersimpan                 sisa waktu dari server
  Listrik padam seluruh lab         Percobaan berjalan; waktu Setelah pulih: tambah
                                    server terus berjalan     waktu massal (FR-R06);
                                    (bila server hidup) atau  bila server mati,
                                    berhenti (bila server     waktu yang hilang
                                    mati)                     dikompensasi tambah
                                                              waktu sebesar durasi
                                                              mati, dicatat
  Pekerjaan kumpul otomatis mati    Percobaan menggantung     Pemeriksaan saat diakses,
                                                              pekerjaan rekonsiliasi,
                                                              alarm > 5 menit
  Penilaian gagal di tengah         Status tetap submitted    Pekerjaan retry; alarm
  Publikasi/koreksi gagal sebagian  Tidak ada (satu           Ulangi; aman diulang
                                    transaksi)
  Disk server rusak                 Data hilang sejak         Pulihkan dari cadangan +
                                    cadangan terakhir         arsip transaksi (RPO)
  Jam server menyimpang             Aturan waktu salah        Koreksi jam, tinjau
                                                              percobaan terdampak,
                                                              tambah waktu bila perlu

9.6 Runbook Hari Ujian
----------------------
  H-7  : konfirmasi parameter ujian; sesi dipublikasikan; peserta ditugaskan;
         uji pemulihan cadangan terbaru berhasil.
  H-3  : uji coba login dan layar ujian dari satu komputer lab; periksa kecukupan
         soal per kategori; periksa jam server dan UPS.
  H-1  : cadangan penuh; periksa disk kosong; periksa log galat; pastikan
         minimal dua admin aktif dan dapat login; cetak/siapkan kode akses sesi.
  H (T-60 menit): periksa dasbor kesehatan (jam, cadangan, pekerjaan terjadwal),
         buka Pantauan sesi, pastikan komputer lab terhubung.
  H (T-0 sampai selesai): admin memantau; catat insiden; tambah waktu hanya bila
         perlu dengan alasan; JANGAN mengubah konfigurasi ujian.
  H (selesai): pastikan tidak ada percobaan in_progress; tinjau peristiwa dan
         catatan insiden; cadangan; publikasi hasil bila sesi sudah berakhir.
  H+1  : periksa laporan; tindak lanjut sanggah; arsip catatan sesi.

9.7 Pembaruan dan Pemeliharaan (tanpa internet)
-----------------------------------------------
  - Paket pembaruan diunduh di komputer ber-internet, diperiksa, lalu dipasang
    manual ke server pada jendela yang TIDAK bersinggungan dengan sesi ujian.
  - Setiap pembaruan: cadangan -> pasang di server uji -> jalankan tes regresi
    -> pasang di server utama -> pemeriksaan kesehatan.
  - Migrasi database selalu didahului cadangan dan dapat diulang.

9.8 Keamanan Fisik dan Akses Sistem
-----------------------------------
  - Ruang server terkunci, akses dicatat. Akses administrator sistem operasi
    dibatasi pada orang yang ditunjuk, memakai kunci/akun pribadi (bukan akun
    bersama).
  - Akun aplikasi admin dipisahkan dari akun admin sistem operasi.

9.9 Verifikasi Sertifikat untuk Peserta Eksternal & Publik
-----------------------------------------------------------
Karena peserta uji kompetensi mencakup siswa dan peserta dari luar kampus FIA,
keabsahan sertifikat HARUS dapat diverifikasi oleh pihak luar (sekolah asal,
instansi, masyarakat umum) yang memindai kode QR pada sertifikat.
Arsitektur verifikasi publik diatur sebagai berikut:
  - Endpoint GET /verify/{code} dirancang terisolasi (stateless dan read-only),
    hanya menampilkan metadata publik (nama peserta, nama ujian, instansi/sekolah
    asal bila ada, tanggal terbit, dan status keabsahan).
  - Reverse proxy server kampus dapat mengekspos jalur khusus /verify/* ke
    domain/IP publik kampus secara aman (dilengkapi pembatasan laju 30 req/menit/IP),
    sementara seluruh endpoint ujian (/api/v1/exams, /sessions, /attempts, dll.)
    dan antarmuka administrasi TETAP tertutup rapat hanya di jaringan LAN lokal.
  - Alternatif cadangan: Sinkronisasi berkala data verifikasi hash minimal ke portal
    web statis publik kampus FIA.


================================================================================
10. RENCANA PENGUJIAN
================================================================================

10.1 Strategi
-------------
  Lapisan uji:
    L1 Unit          fungsi hitung nilai, aturan waktu, kunci berlaku, pembulatan.
    L2 Integrasi     API + PostgreSQL ASLI (bukan tiruan): constraint, transaksi,
                     konkurensi. Constraint yang diuji di database tiruan tidak
                     membuktikan apa pun.
    L3 End-to-end    alur lengkap lewat browser: admin dan mahasiswa di dua
                     browser/perangkat terpisah.
    L4 Beban         TC-38 pada angka dari fakultas dikali 2.
    L5 Keamanan      TC-39: uji otorisasi per sel matriks, injeksi, XSS, brute
                     force; uji penetrasi independen sebelum ujian berisiko tinggi.
    L6 Pemulihan     TC-40.
    L7 UAT           dua sesi percobaan dengan admin dan mahasiswa sungguhan.
  Aturan: tes ditulis SEBELUM fitur; fitur selesai hanya bila tes terkait lulus
  dan seluruh tes lama tetap lulus.

10.2 Kasus Uji
--------------
  TC-01  Dua permintaan Mulai bersamaan pada satu pendaftaran.
         Harapan: satu percobaan; permintaan kedua menerima percobaan yang sama.
  TC-02  Ubah jam perangkat mahasiswa saat ujian.
         Harapan: sisa waktu setelah sinkronisasi mengikuti server.
  TC-03  Kirim jawaban pada batas + 4 detik dan batas + 6 detik.
         Harapan: yang pertama diterima, yang kedua 409 ATTEMPT_EXPIRED.
  TC-04  Kirim jawaban dengan client_seq 5 lalu 3.
         Harapan: tersimpan yang seq 5.
  TC-05  Kirim opsi milik soal lain.
         Harapan: ditolak (juga ditolak langsung di database).
  TC-06  Edit soal saat 10 mahasiswa mengerjakan.
         Harapan: soal di percobaan mereka tidak berubah; versi baru terbentuk.
  TC-07  Mulai ujian dengan masing-masing syarat INV-07 dilanggar satu per satu
         (sesi bukan published, di luar jendela, tidak terdaftar, akun suspended,
         sudah punya percobaan non-void, kuota habis, sudah lulus, kode akses
         salah, mulai pada akhir - durasi + 1 detik).
         Harapan: tiap pelanggaran ditolak dengan kode galat yang sesuai.
  TC-08  Kosongkan satu kategori lalu publikasi sesi dan mulai ujian.
         Harapan: publikasi ditolak; tidak ada soal cadangan; mulai ditolak.
  TC-09  Dua admin menugaskan mahasiswa berbeda ke kursi terakhir; tugaskan
         mahasiswa ke dua sesi beririsan.
         Harapan: satu berhasil, satu CAPACITY_FULL; irisan SCHEDULE_OVERLAP.
  TC-10  Dua permintaan kumpul serentak, dan kumpul manual bersamaan dengan
         kumpul otomatis.
         Harapan: satu penilaian; hasil identik.
  TC-11  Nilai satu percobaan dua kali.
         Harapan: hasil identik; tidak ada duplikasi.
  TC-12  Jalankan S-01 sampai S-07 dengan data persis seperti Bagian 6.5.
         Harapan: skor dan status sama persis.
  TC-13  Publikasi saat ada percobaan in_progress; publikasi dua kali.
         Harapan: yang pertama 409; yang kedua tanpa perubahan.
  TC-14  Mahasiswa A meminta ID percobaan dan hasil milik mahasiswa B.
         Harapan: 404.
  TC-15  Telusuri seluruh respons API mahasiswa.
         Harapan: tidak ada is_correct, pembahasan (kecuali allow_review).
  TC-16  Ubah hasil published tanpa alasan; dengan alasan.
         Harapan: ditolak; lalu revision_no naik dan audit tercatat.
  TC-17  Koreksi yang mengubah lulus <-> tidak lulus (S-03).
         Harapan: sertifikat terbit/dicabut otomatis dan konsisten.
  TC-18  Terbitkan 50 sertifikat paralel.
         Harapan: tidak ada nomor kembar.
  TC-19  Coba UPDATE dan DELETE pada audit_logs, attempt_events,
         question_corrections dengan akun aplikasi.
         Harapan: ditolak database.
  TC-20  Untuk SETIAP sel "-" pada matriks hak akses (Lampiran A), kirim
         permintaan dengan peran terlarang.
         Harapan: 401/403/404 sesuai aturan; tidak ada pengecualian.
  TC-21  Ubah durasi, jumlah soal, nilai lulus, aturan ujian yang sudah dijadwalkan.
         Harapan: 409 CONFIG_LOCKED.
  TC-22  Login di perangkat kedua; nonaktifkan akun yang sedang login.
         Harapan: perangkat pertama 401; percobaan tetap ada; akun suspended
         ditolak di semua endpoint.
  TC-23  Login berhasil dan gagal (sandi salah, email tidak dikenal, suspended).
         Harapan: pesan gagal identik; tidak ada kebocoran keberadaan akun.
  TC-24  Lima kali gagal login berturut-turut; login benar saat terkunci.
         Harapan: terkunci 15 menit; login benar saat terkunci tetap ditolak.
  TC-25  Akun baru mengakses halaman selain ganti sandi.
         Harapan: 403 AUTH_PASSWORD_CHANGE_REQUIRED sampai sandi diganti.
  TC-26  Reset sandi oleh admin; admin mereset dirinya sendiri.
         Harapan: sandi sementara tampil sekali, sesi dicabut; reset diri 403.
  TC-27  Impor CSV: 3 baris salah dari 100; unggah dua kali; sel berawalan "=".
         Harapan: galat per baris; tidak ada akun ganda; kredensial awal hanya
         sekali unduh; sel dinetralkan.
  TC-28  Buat soal tanpa/dengan dua opsi benar; teks berisi skrip.
         Harapan: ditolak jelas; skrip tampil sebagai teks.
  TC-29  Koreksi soal: pratinjau, terapkan, gagal di tengah, terapkan ulang.
         Harapan: angka sesuai S-03; kegagalan tidak mengubah apa pun; terapkan
         ulang tidak menaikkan revision_no dua kali.
  TC-30  Mulai ujian pada dua mahasiswa dengan aturan komposisi yang sama.
         Harapan: komposisi kategori/tingkat sama; soal/urutan dapat berbeda;
         jumlah soal sesuai.
  TC-31  Tutup tab lalu buka lagi 2 menit kemudian; pindah perangkat.
         Harapan: jawaban utuh; sisa waktu berkurang 2 menit.
  TC-32  Matikan pekerjaan terjadwal; biarkan waktu habis.
         Harapan: percobaan tetap terkumpul saat diakses; alarm muncul > 5 menit.
  TC-33  Publikasi sesi dengan campuran lulus/tidak lulus.
         Harapan: sertifikat hanya untuk yang lulus; notifikasi sekali per
         mahasiswa; publikasi ulang tidak menggandakan.
  TC-34  Verifikasi sertifikat dengan kode benar, salah, dicabut.
         Harapan: data minimum; "tidak ditemukan" generik; status dicabut tampil;
         tidak ada NIM/skor; pembatasan laju bekerja.
  TC-35  Ekspor CSV dengan nama berawalan =, +, -, @.
         Harapan: dinetralkan; ekspor tercatat di audit.
  TC-36  Tambah waktu per percobaan dan massal.
         Harapan: batas bergeser sesuai; yang sudah terkumpul tidak berubah; layar
         mahasiswa memperbarui; audit tercatat; batas 60 menit per tindakan.
  TC-37  Sanggah di hari ke-7 dan ke-8 [S].
         Harapan: ke-7 diterima, ke-8 APPEAL_WINDOW_CLOSED.
  TC-38  Uji beban: 300 (atau angka fakultas x 2) mahasiswa mulai dalam 60 detik,
         menyimpan jawaban selama 90 menit, lalu kumpul; admin membuka Pantauan
         sesi dan publikasi.
         Harapan: memenuhi NFR-01; tidak ada percobaan hilang atau ganda.
  TC-39  Uji keamanan: seluruh SEC-01..SEC-12; semai admin tanpa rahasia di
         repositori; IDOR; XSS; SQL injection; brute force; header keamanan.
         Harapan: tidak ada temuan tingkat tinggi/kritis terbuka.
  TC-40  Pulihkan cadangan ke server uji, jalankan pemeriksaan konsistensi.
         Harapan: data utuh sampai RPO; prosedur selesai dalam RTO.
  TC-41  Mulai ujian dengan kode akses benar, salah, kosong, berulang salah.
         Harapan: hanya yang benar berhasil; pembatasan laju bekerja; kode tidak
         bocor di respons/log.
  TC-42  Pantauan sesi saat ada yang menutup browser, mengumpulkan, belum mulai.
         Harapan: status akurat; isi jawaban tidak tampil.
  TC-43  Batalkan sesi tanpa dan dengan percobaan; batalkan pendaftaran.
         Harapan: tanpa percobaan berhasil dan mahasiswa dinotifikasi; dengan
         percobaan 409.
  TC-44  Penugasan dengan setiap pelanggaran BR-04 (sudah lulus, kuota habis,
         hasil sebelumnya belum published, sudah terdaftar).
         Harapan: kode galat sesuai; tidak ada pendaftaran tersimpan.

10.3 Kriteria Lulus Rilis (Definition of Done)
----------------------------------------------
Sistem boleh dipakai ujian sungguhan hanya bila SEMUA terpenuhi:
  [ ] Semua FR berprioritas M terimplementasi dan tes terkaitnya lulus.
  [ ] TC-01 sampai TC-22 lulus (invarian).
  [ ] TC-38 (beban) memenuhi NFR-01 pada angka fakultas.
  [ ] TC-39 (keamanan) tanpa temuan tinggi/kritis terbuka.
  [ ] TC-40 (pemulihan) lulus dan terdokumentasi.
  [ ] UAT: sedikitnya satu sesi percobaan penuh dengan admin dan mahasiswa
      sungguhan, termasuk satu skenario gangguan (tambah waktu).
  [ ] Tidak ada cacat tingkat 1 (data salah/hilang) atau 2 (fungsi utama gagal)
      yang terbuka.
  [ ] Runbook (9.6) dan prosedur pemulihan (9.4) dipegang minimal dua orang.
  [ ] Pemilik sistem menyetujui parameter fakultas dan keputusan terbuka (12.3).


================================================================================
11. RENCANA PEMBANGUNAN (MILESTONE)
================================================================================

Estimasi waktu TIDAK diberikan di sini karena bergantung pada ukuran dan
pengalaman tim; tim menetapkannya setelah M0. Urutan di bawah adalah urutan
ketergantungan. Setiap tugas selesai hanya bila kriteria selesainya terpenuhi.

Aturan kerja pembangun (wajib, per tugas):
  1. Jelaskan rencana singkat dan daftar berkas yang akan disentuh.
  2. Tulis tes terkait dari Bagian 10 lebih dulu.
  3. Implementasikan hanya tugas itu; jangan menambah fitur di luar SRS.
  4. Jalankan seluruh tes, lint, dan pemeriksaan tipe; jangan menyatakan selesai
     sebelum semuanya lulus.
  5. Laporkan hasil, yang diuji, dan asumsi/masalah baru. Bila SRS bertentangan
     atau ambigu, HENTIKAN dan tanyakan; jangan menebak.
  6. Perbarui status tugas; jangan mengubah keputusan D-xx tanpa persetujuan.
  7. Jangan mengarang nama fungsi, parameter, atau versi; baca dokumentasi resmi
     versi yang dipakai.

M0. VERIFIKASI DAN PONDASI
  T-001 Cocokkan Bagian 5 dengan examData.ts dan AdminPortal.tsx; perbarui
        kamus data dan catat selisihnya.
  T-002 Verifikasi semua teknologi Bagian 8.2 ke dokumentasi resmi (versi, status
        pemeliharaan, kemampuan: indeks unik parsial, FK komposit, kunci baris,
        arsip transaksi, exclusion constraint, UUID). Perbarui Bagian 8.
  T-003 Tetapkan browser dan versi minimum yang didukung; uji pada komputer lab.
  T-004 Kumpulkan parameter FIA/panitia (Bagian 12.3): nilai lulus, durasi, jumlah
        soal, komposisi, estimasi jumlah peserta bersamaan.
  T-005 Siapkan server pengembangan/uji, HTTPS internal, sinkron waktu.
  T-006 Spike konkurensi: buktikan indeks unik parsial, kunci kapasitas, dan
        FK komposit berperilaku seperti Bagian 5 dengan beban paralel.
  T-007 Spike PDF sertifikat dan QR; tetapkan pustaka.
  Selesai bila: semua UNVERIFIED terkait diperbarui dengan hasil, parameter
  fakultas terkumpul atau tercatat sebagai pertanyaan terbuka.

M1. FONDASI BACKEND DAN AUTENTIKASI
  Cakupan: repositori, struktur Bagian 8.3, migrasi 23 tabel + hak akses DB
  (5.4), konfigurasi, log terstruktur, format galat, health check, FR-A01..A08.
  Selesai bila: TC-19, TC-22 sampai TC-26, TC-39 (bagian autentikasi) lulus;
  tidak ada rahasia di repositori.

M2. PENGGUNA DAN PESERTA
  Cakupan: FR-U01..U06 (profil peserta dengan nomor identitas dan instansi asal).
  Selesai bila: TC-20 (modul ini), TC-27 lulus; impor 3000 baris berjalan
  dalam batas NFR-01.

M3. BANK SOAL DAN UJIAN
  Cakupan: FR-Q01..Q05, Q07, E01..E04.
  Selesai bila: TC-06 (bagian versi), TC-21, TC-28 lulus.

M4. SESI DAN PENUGASAN
  Cakupan: FR-S01..S07.
  Selesai bila: TC-08 (bagian publikasi), TC-09, TC-41, TC-43, TC-44 lulus.

M5. PELAKSANAAN UJIAN (backend + layar ujian)
  Cakupan: FR-T01..T11 dan penyesuaian frontend F-01..F-05, F-07, F-08.
  Selesai bila: TC-01 sampai TC-07, TC-10, TC-30, TC-31, TC-32 lulus; satu sesi
  uji dengan 20 pengguna nyata berjalan tanpa percobaan hilang.

M6. PENILAIAN, PUBLIKASI, KOREKSI, PANTAUAN
  Cakupan: FR-R01..R06, FR-Q08, FR-T12.
  Selesai bila: TC-11 sampai TC-17, TC-29, TC-33, TC-36, TC-42 lulus; S-01 sampai
  S-07 menghasilkan angka persis.

M7. SERTIFIKAT, LAPORAN, NOTIFIKASI, AUDIT
  Cakupan: FR-C01..C04, FR-L01..L03 (L04 bila waktu), FR-N01..N02 (N03 bila
  waktu), FR-R07 dan FR-Q06 [S].
  Selesai bila: TC-18, TC-19, TC-34, TC-35, TC-37 lulus.

M8. PENGERASAN DAN VERIFIKASI
  Cakupan: uji beban (TC-38), uji keamanan (TC-39), uji pemulihan (TC-40),
  UAT, dokumentasi pemasangan, runbook, pelatihan admin.
  Selesai bila: Kriteria Lulus Rilis 10.3 terpenuhi.

M9. PELUNCURAN BERTAHAP
  - Pilot: satu sesi kecil dengan pengawasan penuh; evaluasi insiden.
  - Rilis: sesi sungguhan bertahap; pantau; peninjauan pascarilis.
  Selesai bila: pilot tanpa cacat tingkat 1/2 dan semua temuan pilot ditutup atau
  diterima tertulis oleh pemilik sistem.


================================================================================
12. RISIKO, HAL BELUM TERVERIFIKASI, DAN PERTANYAAN TERBUKA
================================================================================

12.1 Risiko
-----------
  ID    Risiko                                    Dampak   Mitigasi
  ----  ----------------------------------------  -------  ---------------------
  R-01  Kode prototipe berbeda dari asumsi        Sedang   T-001 di M0
        (A-01); kolom/tipe soal tidak cocok
  R-02  Jumlah mahasiswa bersamaan jauh lebih    Tinggi   Validasi A-09; uji beban
        besar dari A-09                                   TC-38; spesifikasi
                                                          server setelahnya
  R-03  Server tunggal gagal saat ujian          Tinggi   UPS, cadangan, runbook,
                                                          server cadangan dingin
  R-04  Admin tunggal/kunci akses dipegang satu  Sedang   Minimal 2 admin;
        orang                                             peringatan dasbor
  R-05  Parameter fakultas belum jelas           Sedang   Daftar 12.3; blokir
        (nilai lulus, retensi, pembulatan)                rilis sampai disetujui
  R-06  Verifikasi sertifikat tidak dapat        Rendah   Diterima v1; 9.9
        diakses dari luar kampus
  R-07  Kecurangan kolaboratif tidak terdeteksi  Sedang   Soal acak, peristiwa
                                                          ujian, pemantauan;
                                                          ditegaskan sebagai
                                                          batas sistem
  R-08  Pemahaman admin rendah -> salah           Sedang   Pelatihan, pratinjau
        tindakan (publikasi/koreksi)                      dan konfirmasi, audit
  R-09  Cadangan ada tetapi tidak pernah diuji   Tinggi   Uji pemulihan terjadwal
  R-10  Ketergantungan paket/pustaka rentan      Sedang   Pemeriksaan sebelum
        atau tidak terpelihara                            rilis; versi dikunci;
                                                          verifikasi M0
  R-11  Cakupan membengkak (fitur di luar        Sedang   Daftar Won't (1.2);
        SRS)                                              persetujuan perubahan
  R-12  Data pribadi/ketentuan hukum tidak       Tinggi   Tinjauan hukum
        ditinjau                                          sebelum peluncuran

12.2 Hal Belum Terverifikasi (UNVERIFIED) -- tugas awal M0
-----------------------------------------------------------
  U-01 Versi, status pemeliharaan, dan kemampuan semua teknologi Bagian 8.2.
  U-02 Exclusion constraint PostgreSQL untuk mencegah sesi beririsan dan ekstensi
       yang dibutuhkan; bila tidak dipakai, INV-09 dijaga lewat kunci transaksi.
  U-03 Fungsi pembuat UUID bawaan pada versi PostgreSQL yang dipilih; alternatif:
       UUID dibuat aplikasi.
  U-04 Konfigurasi arsip transaksi kontinu dan pencapaian RPO 15 menit.
  U-05 Browser dan versi minimum pada komputer lab fakultas.
  U-06 Ketentuan hukum pelindungan data pribadi yang berlaku (profesional hukum).
  U-07 Pustaka pembuat PDF dan pembuat QR yang akan dipakai.
  U-08 Spesifikasi server yang memadai (setelah TC-38).

12.3 Pertanyaan Terbuka dan Parameter yang Hanya Fakultas yang Tahu
--------------------------------------------------------------------
Berikut TIDAK memblokir pembangunan (nilai bawaan ada), tetapi HARUS dijawab
sebelum peluncuran:
  Q-01 Nilai lulus, durasi, jumlah soal, dan komposisi kategori/tingkat tiap ujian.
  Q-02 Format data peserta pendaftaran (kolom CSV: nomor identitas, nama, email, instansi asal, telepon).
  Q-03 Jumlah peserta terbanyak yang mengerjakan bersamaan; jumlah peserta total;
       jumlah sesi per bulan (menguji A-09).
  Q-04 Pembulatan di batas lulus (S-06): dibulatkan 2 desimal sebelum
       dibandingkan (bawaan, BR-01), atau dibandingkan tanpa pembulatan?
  Q-05 Masa simpan resmi data ujian, hasil, sertifikat, log (BR-14).
  Q-06 Tata letak, tanda tangan, dan logo sertifikat resmi FIA.
  Q-07 Kebijakan remedial resmi (jumlah kesempatan, jeda antar percobaan).
  Q-08 Apakah perlu peran pengawas ruangan terpisah dari admin panitia di versi berikutnya?
  Q-09 Mekanisme ekspos verifikasi sertifikat publik (9.9): reverse proxy domain publik
       kampus atau sinkronisasi berkala ke portal statis FIA?
  Q-10 Kebijakan sanksi atas pelanggaran yang tercatat (D-07): di luar sistem
       atau diotomatisasi kelak?


================================================================================
LAMPIRAN A. DAFTAR ENDPOINT DAN HAK AKSES
================================================================================

Legenda peran: A = Admin, M = Mahasiswa (hanya data miliknya), P = Publik (tanpa
login), S = Sistem/operator. Awalan semua jalur: /api/v1. Peran yang tidak
tercantum DITOLAK (INV-20, TC-20).

A.1 Endpoint
------------
  AUTENTIKASI
    POST   /auth/login                              P      FR-A01
    POST   /auth/logout                             A,M    FR-A02
    POST   /auth/refresh                            A,M    FR-A02
    POST   /me/password                             A,M    FR-A03

  AKUN
    GET    /users                                   A      FR-U01
    POST   /users                                   A      FR-U02
    GET    /users/{id}                              A      FR-U01
    PATCH  /users/{id}                              A      FR-U02, U05
    POST   /users/{id}/reset-password               A      FR-A04
    POST   /users/{id}/unlock                       A      FR-A05
    GET    /students                                A      FR-U01
    POST   /students                                A      FR-U03
    GET    /students/{id}                           A      FR-U03
    PATCH  /students/{id}                           A      FR-U03
    POST   /students/import/preview                 A      FR-U04
    POST   /students/import/commit                  A      FR-U04
    GET    /students/import/{importId}/credentials  A      FR-U04 (sekali unduh)

  SAYA (pengguna yang login)
    GET    /me                                      A,M    FR-A07
    GET    /me/profile                              A,M    FR-U06
    PATCH  /me/profile                              A,M    FR-U06
    GET    /me/settings                             A,M    FR-U06
    PATCH  /me/settings                             A,M    FR-U06
    GET    /me/sessions                             M      FR-T01
    GET    /me/results                              M      FR-R03
    GET    /me/results/{id}                         M      FR-R03
    POST   /me/results/{id}/appeals                 M      FR-R07 [S]
    GET    /me/certificates                         M      FR-C02

  BANK SOAL
    GET    /question-categories                     A      FR-Q01
    POST   /question-categories                     A      FR-Q01
    PATCH  /question-categories/{id}                A      FR-Q01
    DELETE /question-categories/{id}                A      FR-Q01 (bila kosong)
    GET    /questions                               A      FR-Q05
    POST   /questions                               A      FR-Q02
    GET    /questions/{id}                          A      FR-Q05
    PATCH  /questions/{id}                          A      FR-Q04
    GET    /questions/{id}/versions                 A      FR-Q03
    POST   /questions/{id}/versions                 A      FR-Q03
    GET    /questions/{id}/preview                  A      FR-Q07 [S]
    POST   /questions/import/preview                A      FR-Q06 [S]
    POST   /questions/import/commit                 A      FR-Q06 [S]
    GET    /question-versions/{id}/corrections      A      FR-Q08
    POST   /question-versions/{id}/corrections/preview  A  FR-Q08
    POST   /question-versions/{id}/corrections      A      FR-Q08

  UJIAN
    GET    /exams                                   A,M(terbatas)  FR-E01
    POST   /exams                                   A      FR-E01
    GET    /exams/{id}                              A      FR-E01
    PATCH  /exams/{id}                              A      FR-E01, E03
    POST   /exams/{id}/copy                         A      FR-E04
    GET    /exams/{id}/rules                        A      FR-E02
    POST   /exams/{id}/rules                        A      FR-E02
    PATCH  /exams/{id}/rules/{ruleId}               A      FR-E02
    DELETE /exams/{id}/rules/{ruleId}               A      FR-E02

  SESI
    GET    /sessions                                A      FR-S01
    POST   /sessions                                A      FR-S01
    GET    /sessions/{id}                           A      FR-S01
    PATCH  /sessions/{id}                           A      FR-S01
    POST   /sessions/{id}/publish                   A      FR-S02
    POST   /sessions/{id}/cancel                    A      FR-S03
    POST   /sessions/{id}/access-code               A      FR-S06
    POST   /sessions/{id}/extend-end                A      FR-S07 [S]
    GET    /sessions/{id}/enrollments               A      FR-S04
    POST   /sessions/{id}/enrollments/preview       A      FR-S04
    POST   /sessions/{id}/enrollments               A      FR-S04
    DELETE /sessions/{id}/enrollments/{enrollmentId} A     FR-S05
    GET    /sessions/{id}/monitor                   A      FR-T12
    POST   /sessions/{id}/extend-all                A      FR-R06
    POST   /sessions/{id}/publish-results           A      FR-R02
    POST   /sessions/{id}/regrade/preview           A      FR-R04
    POST   /sessions/{id}/regrade                   A      FR-R04
    POST   /sessions/{id}/start                     M      FR-T03

  PERCOBAAN
    GET    /attempts/{id}/state                     M      FR-T07, T08
    GET    /attempts/{id}/questions                 M      FR-T04
    PUT    /attempts/{id}/answers/{position}        M      FR-T05
    POST   /attempts/{id}/submit                    M      FR-T09
    POST   /attempts/{id}/events                    M      FR-T11
    GET    /attempts/{id}                           A      FR-T12
    GET    /attempts/{id}/events                    A      FR-T11
    POST   /attempts/{id}/void                      A      FR-R05
    POST   /attempts/{id}/extend                    A      FR-R05

  HASIL, SERTIFIKAT
    GET    /results                                 A      FR-L02
    GET    /results/{id}                            A      FR-L02
    GET    /certificates                            A      FR-C01
    GET    /certificates/{id}/pdf                   A,M    FR-C02
    POST   /certificates/{id}/revoke                A      FR-C04
    GET    /verify/{code}                           P      FR-C03

  LAPORAN, NOTIFIKASI, AUDIT, SANGGAH, OPERASI
    GET    /dashboard                               A      FR-L01
    GET    /reports/sessions/{id}                   A      FR-L02
    GET    /reports/exams/{id}                      A      FR-L02
    GET    /reports/institutions                    A      FR-L02
    GET    /reports/.../export                      A      FR-L03
    GET    /reports/items/{questionVersionId}       A      FR-L04 [C]
    GET    /notifications                           A,M    FR-N01
    PATCH  /notifications/{id}/read                 A,M    FR-N01
    POST   /notifications/read-all                  A,M    FR-N01
    GET    /audit-logs                              A      FR-N02
    GET    /appeals                                 A      FR-R07 [S]
    PATCH  /appeals/{id}                            A      FR-R07 [S]
    GET    /health                                  S      NFR-10 (tanpa data sensitif)

A.2 Matriks CRUD per entitas
----------------------------
  C = create, R = read, U = update, D = delete, "-" = tidak boleh.
  Entitas                    Admin                  Peserta / Mahasiswa    Sistem
  -------------------------  ---------------------  ---------------------  --------
  users                      C R U, D=nonaktifkan   R, U (sandi sendiri)   -
  student_profiles           C R U                  R, U terbatas (sendiri) -
  user_settings              R                      R, U (sendiri)         C
  auth_sessions              R, D=cabut             R, D (milik sendiri)   C U D
  exams                      C R U, D=arsip         R (aktif, terbatas)    -
  exam_question_rules        C R U D                -                      -
  question_categories        C R U, D bila kosong   -                      -
  questions/versions/options C R U(versi baru) D=arsip -                   C (versi)
  question_corrections       C R                    -                      U(nilai ulang)
  exam_sessions              C R U, D=batalkan      R (yang diikuti)       -
  session_enrollments        C R U D (sebelum mulai) R (milik sendiri)     U
  attempts                   R, U (void/tambah waktu) C,R,U (milik sendiri) C U
  attempt_questions          R                      R (tanpa kunci)        C
  attempt_answers            R                      C U saat in_progress   U (nilai)
  attempt_events             R                      C                      C
  results                    R, U (publikasi/koreksi) R (milik, published) C
  certificates               R, U (cabut)           R (milik sendiri)      C U
  certificate_counters       -                      -                      C U
  notifications              C R                    R, U (baca) milik      C
  audit_logs                 R                      -                      C
  appeals [S]                R, U (tanggapan)       C, R (milik sendiri)   -
  Tidak ada D pada: percobaan, jawaban, peristiwa, hasil, sertifikat, koreksi,
  audit. Tidak ada U pada: question_versions, attempt_questions, audit_logs,
  attempt_events, question_corrections.


================================================================================
LAMPIRAN B. FORMAT BERKAS IMPOR DAN EKSPOR
================================================================================

Aturan umum: CSV UTF-8, pemisah koma, baris pertama = judul kolom (huruf kecil,
persis seperti di bawah), nilai berkoma dibungkus tanda kutip ganda. Sel yang
diawali = + - @ diperlakukan sebagai teks.

B.1 Impor peserta
  nomor_identitas,nama,email,instansi,telepon
  (nomor_identitas unik: NIM mahasiswa FIA, NISN siswa sekolah, NIM kampus luar,
   atau nomor peserta registrasi; email unik; instansi opsional; telepon opsional)
  Contoh:
    nomor_identitas,nama,email,instansi,telepon
    2024001001,"Siti Rahma",siti.rahma@contoh.ac.id,"FIA Internal",081200000000
    2024099002,"Budi Santoso",budi.santoso@sekolah.sch.id,"SMA Negeri 1",081300000001

B.2 Berkas kredensial awal (hasil impor; sekali unduh)
  nomor_identitas,nama,email,sandi_sementara
  Sandi sementara TIDAK tersimpan dalam bentuk asli setelah berkas diunduh.

B.3 Impor soal [S]
  kategori,tingkat,bobot,soal,opsi_a,opsi_b,opsi_c,opsi_d,opsi_e,opsi_f,kunci,pembahasan
  Aturan: kategori harus ada; tingkat 1-3; bobot > 0 (kosong = 1); minimal opsi_a
  dan opsi_b terisi; kunci = salah satu huruf opsi yang terisi (tepat satu).

B.4 Daftar Nomor Identitas untuk penugasan massal
  nomor_identitas
  (satu nomor identitas per baris)

B.5 Ekspor hasil (CSV)
  sesi,ujian,nomor_identitas,nama,instansi,kehadiran,skor,lulus,nomor_revisi,tanggal_publikasi
  Hanya hasil published. Setiap ekspor tercatat di audit_logs.


================================================================================
LAMPIRAN C. KODE GALAT
================================================================================

  Kode                          HTTP  Arti
  ----------------------------  ----  ----------------------------------------
  AUTH_INVALID_CREDENTIALS      401   Email atau sandi salah / akun tidak aktif
  AUTH_REQUIRED                 401   Belum login atau sesi tidak berlaku
  AUTH_LOCKED                   423   Akun terkunci sementara
  AUTH_PASSWORD_CHANGE_REQUIRED 403   Wajib ganti sandi dulu
  FORBIDDEN                     403   Peran tidak berhak
  NOT_FOUND                     404   Tidak ditemukan (termasuk milik orang lain)
  VALIDATION_FAILED             422   Masukan tidak valid (rincian per kolom)
  RATE_LIMITED                  429   Terlalu banyak permintaan
  INVALID_TRANSITION            409   Perubahan status tidak diizinkan
  CONFIG_LOCKED                 409   Konfigurasi ujian terkunci
  SESSION_LOCKED                409   Sesi tidak dapat diubah (sudah ada percobaan)
  SESSION_NOT_OPEN              409   Sesi belum/tidak dalam jendela mulai
  SESSION_ENDING_SOON           409   Sisa waktu sesi kurang dari durasi ujian
  SESSION_NOT_FINISHED          409   Sesi belum berakhir / masih ada yang mengerjakan
  QUESTION_POOL_INSUFFICIENT    409   Soal aktif tidak cukup untuk aturan komposisi
  CAPACITY_FULL                 409   Kapasitas sesi penuh
  SCHEDULE_OVERLAP              409   Jadwal beririsan dengan sesi lain
  ALREADY_PASSED                409   Mahasiswa sudah lulus ujian ini
  QUOTA_EXCEEDED                409   Kesempatan percobaan habis
  PREVIOUS_RESULT_PENDING       409   Hasil percobaan sebelumnya belum terbit
  ALREADY_ENROLLED              409   Sudah terdaftar di sesi ini
  ATTEMPT_EXPIRED               409   Batas waktu percobaan sudah lewat
  ATTEMPT_NOT_ACTIVE            409   Percobaan tidak berstatus berjalan
  ACCESS_CODE_INVALID           403   Kode akses sesi salah
  LAST_ADMIN                    409   Admin aktif terakhir tidak boleh dinonaktifkan
  CORRECTION_INVALID            409   Koreksi tidak valid (mis. poin maksimum 0)
  APPEAL_WINDOW_CLOSED          409   Masa sanggah sudah lewat
  INTERNAL_ERROR                500   Galat server (tanpa detail; ada request_id)

================================================================================
LAMPIRAN D. GLOSARIUM
================================================================================

  Anulir          Soal dikeluarkan dari perhitungan poin dan poin maksimum.
  Audit log       Catatan tindakan penting yang hanya dapat ditambah.
  Deadline/batas  Waktu server saat percobaan harus berhenti.
  Idempoten       Mengulang operasi yang sama tidak mengubah hasil akhir.
  INV             Invarian: pernyataan yang selalu benar.
  IDOR            Kelemahan: mengakses data orang lain dengan menebak ID.
  CSRF, XSS       Serangan pemalsuan permintaan lintas situs; penyisipan skrip.
  RPO, RTO        Data maksimum yang boleh hilang; waktu maksimum pemulihan.
  Snapshot        Salinan soal yang diterima mahasiswa, dikunci per percobaan.
  Soft delete     Data ditandai terhapus tetapi tidak dihapus fisik.
  Transaksi       Sekumpulan langkah database yang berhasil semua atau batal semua.
  Void            Percobaan dibatalkan admin; tidak dihitung sebagai kesempatan.
  Sesi (ujian)    Jadwal pelaksanaan ujian; BUKAN sesi login. Sesi login disebut
                  "sesi login" (auth_sessions).

================================================================================
LAMPIRAN E. KETERLACAKAN RINGKAS
================================================================================

  Modul / Kebutuhan          Tabel utama                         Aturan   Tes
  -------------------------  ----------------------------------  -------  ----------
  A  Autentikasi (A01-A08)   users, auth_sessions, audit_logs    D-04,    TC-14,20,22-26,
                                                                 D-10     39
  U  Pengguna (U01-U06)      users, student_profiles,            D-04,    TC-20,22,27
                             user_settings                       D-05
  Q  Bank soal (Q01-Q08)     questions, question_versions,       D-08,    TC-06,16,17,
                             question_options,                   D-12     28,29
                             question_corrections
  E  Ujian (E01-E04)         exams, exam_question_rules          D-01,    TC-21
                                                                 BR-12
  S  Sesi (S01-S07)          exam_sessions, session_enrollments  D-02,    TC-08,09,41,
                                                                 D-03     43,44
  T  Pelaksanaan (T01-T12)   attempts, attempt_questions,        D-07,    TC-01-07,10,30,
                             attempt_answers, attempt_events     D-09,    31,32,42
                                                                 D-10
  R  Hasil/Koreksi (R01-R07) results, attempts, appeals          D-01,    TC-11-17,29,33,
                                                                 D-11,    36,37
                                                                 D-13
  C  Sertifikat (C01-C04)    certificates, certificate_counters  D-06     TC-17,18,33,34
  L  Laporan (L01-L04)       results, attempts (baca)            BR-13    TC-35
  N  Notifikasi/Audit        notifications, audit_logs           INV-19   TC-19
  Operasi/Non-fungsional     -                                   NFR-01.. TC-38,39,40
                                                                 NFR-13

================================================================================
AKHIR DOKUMEN
================================================================================
Dokumen ini DRAF. Sebelum pembangunan dimulai: (1) pemilik sistem meninjau dan
menyetujui Bagian 2.7 dan 12.3; (2) tim pembangun menjalankan M0 (verifikasi
teknologi dan pencocokan dengan examData.ts); (3) dokumen rancangan data
diperbarui sesuai Bagian 2.8.