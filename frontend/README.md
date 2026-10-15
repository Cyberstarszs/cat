# CAT GOVERNANCE - Frontend Application
Sistem Uji Kompetensi Mahasiswa Fakultas Ilmu Administrasi (FIA)

Frontend antarmuka pengguna berbasis **React 19, Vite, TypeScript, dan Tailwind CSS v4** yang terintegrasi penuh (*pixel-faithful*) dengan desain Figma dan API backend CAT GOVERNANCE.

---

## 1. Stack Teknologi & Desain
- **Core**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS v4 + Design Tokens Figma (`Manrope` untuk heading/eyebrow & `Plus Jakarta Sans` untuk body/UI)
- **Palette Warna Resmi FIA**:
  - Ungu Utama: `#583682` (`--purple`)
  - Ungu Royal: `#754ead` (`--royal`)
  - Gelap Editorial: `#352148` (`--dark`)
  - Aksen Lavender: `#eae2f5` (`--lavender`)
  - Latar Ivory: `#faf9fc` (`--ivory`)
  - Tinta Teks: `#24212b` (`--ink`)
- **Routing**: React Router DOM v7 dengan *route-level code splitting* (`React.lazy` & `Suspense`)
- **Icons**: Lucide React
- **HTTP Client**: Axios dengan interseptor Bearer token otomatis dan penanganan 401 terpusat.

---

## 2. Struktur Direktori `frontend/`

```text
frontend/
├── index.html                  # Entry HTML + Google Fonts Manrope & Plus Jakarta Sans
├── package.json
├── tsconfig.json
├── vite.config.ts              # Konfigurasi Vite + React + Tailwind v4 + Proxy API
├── .env & .env.example         # Variabel lingkungan URL backend
└── src/
    ├── assets/                 # Logo resmi CAT GOVERNANCE
    ├── styles/                 # index.css (Design tokens, utilitas shadow, scrollbar)
    ├── types/                  # Kontrak tipe TypeScript seragam dengan backend
    ├── services/               # Client API terpusat (Axios + modular service calls)
    ├── context/                # AuthContext (state autentikasi) & ToastContext (notifikasi)
    ├── components/
    │   ├── ui/                 # Komponen reusable (Button, Input, Select, Badge, Card, Modal, Skeleton, EmptyState)
    │   ├── layout/             # Navbar, Footer, AdminSidebar, AdminHeader, AppLayout, AdminLayout
    │   └── common/             # ProtectedRoute, RoleGuard, ForcePasswordModal
    ├── pages/
    │   ├── public/             # HomePage, ExplorePage, DetailPage, VerifyPage, NotFoundPage
    │   ├── auth/               # LoginPage (Peserta), AdminLoginPage (Admin)
    │   ├── student/            # DashboardPage, InstructionsPage, ExamRoomPage, ResultPage, HistoryPage, CertificatePage, ProfilePage
    │   └── admin/              # AdminDashboardPage, AdminSubtestsPage, AdminExamsPage, AdminQuestionsPage, AdminImportQuestionsPage, AdminSchedulesPage, AdminParticipantsPage, AdminResultsPage, AdminAuditLogsPage, AdminNotificationsPage, AdminUsersPage, AdminSettingsPage
    ├── routes/                 # AppRoutes.tsx (Routing terpusat dengan lazy-loading)
    ├── App.tsx
    └── main.tsx
```

---

## 3. Pemetaan Halaman ke Endpoint Backend

| Halaman | Rute Frontend | Endpoint Backend Terkait |
| :--- | :--- | :--- |
| **Beranda** | `/` | `GET /categories`, `GET /health` |
| **Katalog Ujian** | `/explore` | `GET /exams` |
| **Detail Ujian** | `/assessment-lg/detail` | `GET /exams/:id` |
| **Verifikasi Sertifikat** | `/verify`, `/verify/:code` | `GET /verify/:code` |
| **Login Peserta** | `/login` | `POST /auth/login` |
| **Login Administrator** | `/admin/login` | `POST /auth/login` |
| **Dashboard Peserta** | `/dashboard` | `GET /me/sessions`, `GET /me/results`, `GET /me/notifications` |
| **Instruksi Ujian** | `/assessment-lg/instructions` | `GET /sessions/:id`, `POST /sessions/:id/start-attempt` |
| **Ruang Ujian CAT** | `/assessment-lg/start` | `GET /attempts/:id`, `PUT /attempts/:id/answers`, `POST /attempts/:id/events`, `POST /attempts/:id/finish` |
| **Hasil Penilaian** | `/results/latest` | `GET /results/:id`, `GET /certificates/:id/pdf`, `POST /results/:id/appeals` |
| **Riwayat Ujian** | `/history` | `GET /me/results` |
| **Sertifikat Kelulusan** | `/certificates/latest` | `GET /certificates/:id`, `GET /certificates/:id/pdf` |
| **Profil & Ganti Sandi** | `/profile` | `GET /me`, `PATCH /me/profile`, `POST /auth/change-password` |
| **Admin: Dashboard** | `/admin/dashboard` | `GET /students`, `GET /exams`, `GET /questions`, `GET /sessions`, `GET /audit-logs` |
| **Admin: Subtes / Kategori** | `/admin/subtests` | `GET, POST, PATCH, DELETE /categories` |
| **Admin: Daftar Ujian** | `/admin/exams` | `GET, POST, PATCH, DELETE /exams`, `POST, DELETE /exams/:id/rules` |
| **Admin: Bank Soal** | `/admin/questions` | `GET, POST /questions`, `GET /questions/:id/preview`, `POST /question-versions/:id/corrections` |
| **Admin: Impor Soal CSV** | `/admin/questions/import` | `POST /questions/import/preview`, `POST /questions/import/commit` |
| **Admin: Jadwal & Sesi** | `/admin/schedules` | `GET, POST /sessions`, `POST /sessions/:id/enrollments`, `POST /sessions/:id/finalize` |
| **Admin: Peserta** | `/admin/participants` | `GET, POST /students`, `POST /students/import` |
| **Admin: Hasil & Sanggahan**| `/admin/results` | `GET /results`, `POST /results/:id/publish`, `GET /appeals`, `PATCH /appeals/:id` |
| **Admin: Log Audit** | `/admin/activity-log` | `GET /audit-logs` |
| **Admin: Notifikasi** | `/admin/notifications` | `GET /me/notifications`, `PATCH /me/notifications/:id/read` |
| **Admin: Pengguna** | `/admin/users` | `GET /users`, `PATCH /users/:id`, `POST /users/:id/reset-password` |
| **Admin: Pengaturan** | `/admin/settings` | `GET /health`, `POST /auth/change-password` |

---

## 4. Cara Menjalankan

### A. Dari Root Folder Proyek (`GOVERNANCE/`)
```bash
# 1. Jalankan server backend (Terminal 1)
npm run dev

# 2. Jalankan server frontend (Terminal 2)
npm run frontend:dev
```
Akses antarmuka di: **`http://localhost:5173`**

### B. Dari Dalam Folder `frontend/`
```bash
cd frontend
npm install
npm run dev
```

### C. Build Produksi
```bash
npm run frontend:build
```
Hasil build optimal akan dibuat di `frontend/dist/`.
