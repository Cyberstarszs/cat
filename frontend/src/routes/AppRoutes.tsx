import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts & Guards (Static)
import { AppLayout } from '../components/layout/AppLayout';
import { AdminLayout } from '../components/layout/AdminLayout';
import { ProtectedRoute } from '../components/common/ProtectedRoute';
import { Skeleton } from '../components/ui/Skeleton';

// Page Loader Fallback
const PageLoadingFallback: React.FC = () => (
  <div className="min-h-[50vh] flex items-center justify-center p-8">
    <div className="w-full max-w-md space-y-4">
      <Skeleton className="h-8 w-1/3 mx-auto" />
      <Skeleton className="h-4 w-1/2 mx-auto" />
      <Skeleton className="h-40 w-full rounded-[8px]" />
    </div>
  </div>
);

// Public Pages (Lazy Loaded)
const HomePage = lazy(() => import('../pages/public/HomePage').then((m) => ({ default: m.HomePage })));
const ExplorePage = lazy(() => import('../pages/public/ExplorePage').then((m) => ({ default: m.ExplorePage })));
const DetailPage = lazy(() => import('../pages/public/DetailPage').then((m) => ({ default: m.DetailPage })));
const NotFoundPage = lazy(() => import('../pages/public/NotFoundPage').then((m) => ({ default: m.NotFoundPage })));

// Auth Pages (Lazy Loaded)
const LoginPage = lazy(() => import('../pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));

// Student Pages (Lazy Loaded)
const DashboardPage = lazy(() => import('../pages/student/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const InstructionsPage = lazy(() => import('../pages/student/InstructionsPage').then((m) => ({ default: m.InstructionsPage })));
const ExamRoomPage = lazy(() => import('../pages/student/ExamRoomPage').then((m) => ({ default: m.ExamRoomPage })));
const ResultPage = lazy(() => import('../pages/student/ResultPage').then((m) => ({ default: m.ResultPage })));
const HistoryPage = lazy(() => import('../pages/student/HistoryPage').then((m) => ({ default: m.HistoryPage })));
const CertificatePage = lazy(() => import('../pages/student/CertificatePage').then((m) => ({ default: m.CertificatePage })));
const ProfilePage = lazy(() => import('../pages/student/ProfilePage').then((m) => ({ default: m.ProfilePage })));

// Admin Pages (Lazy Loaded)
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })));
const AdminExamsPage = lazy(() => import('../pages/admin/AdminExamsPage').then((m) => ({ default: m.AdminExamsPage })));
const AdminQuestionsPage = lazy(() => import('../pages/admin/AdminQuestionsPage').then((m) => ({ default: m.AdminQuestionsPage })));
const AdminSchedulesPage = lazy(() => import('../pages/admin/AdminSchedulesPage').then((m) => ({ default: m.AdminSchedulesPage })));
const AdminParticipantsPage = lazy(() => import('../pages/admin/AdminParticipantsPage').then((m) => ({ default: m.AdminParticipantsPage })));
const AdminResultsPage = lazy(() => import('../pages/admin/AdminResultsPage').then((m) => ({ default: m.AdminResultsPage })));
const AdminAuditLogsPage = lazy(() => import('../pages/admin/AdminAuditLogsPage').then((m) => ({ default: m.AdminAuditLogsPage })));
const AdminUsersPage = lazy(() => import('../pages/admin/AdminUsersPage').then((m) => ({ default: m.AdminUsersPage })));
const AdminSettingsPage = lazy(() => import('../pages/admin/AdminSettingsPage').then((m) => ({ default: m.AdminSettingsPage })));

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Standalone Exam Taking Screen (Full Screen Focus) */}
        <Route element={<ProtectedRoute requiredRole="student" />}>
          <Route path="/assessment-lg/start" element={<ExamRoomPage />} />
          <Route path="/exam" element={<ExamRoomPage />} />
        </Route>

        {/* Redirect /admin/login to unified /login (Single Door) */}
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />

        {/* Standalone Fullscreen Auth Page (Matching Figma) */}
        <Route path="/login" element={<LoginPage />} />

        {/* Public & Student Routes (AppLayout with Navbar & Footer) */}
        <Route element={<AppLayout />}>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/assessment-lg" element={<Navigate to="/explore" replace />} />
          <Route path="/assessment-lg/detail" element={<DetailPage />} />
          <Route path="/detail" element={<DetailPage />} />

          {/* Student Protected Routes */}
          <Route element={<ProtectedRoute requiredRole="student" />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/instructions" element={<InstructionsPage />} />
            <Route path="/assessment-lg/instructions" element={<InstructionsPage />} />
            <Route path="/results/latest" element={<ResultPage />} />
            <Route path="/results" element={<ResultPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/certificates/latest" element={<CertificatePage />} />
            <Route path="/certificates" element={<CertificatePage />} />
            <Route path="/certificate" element={<CertificatePage />} />
            <Route path="/certificates/:id" element={<CertificatePage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<ProfilePage />} />
          </Route>

          {/* 404 Catch-All within AppLayout */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Admin Portal Protected Routes (AdminLayout with Sidebar & Header) */}
        <Route element={<ProtectedRoute requiredRole="admin" />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />

            {/* Menu Terpadu: Kategori & Paket Ujian */}
            <Route path="/admin/exams" element={<AdminExamsPage />} />
            <Route path="/admin/assessment-lg" element={<AdminExamsPage />} />
            {/* Backward-compatible redirects ke Tab Subtes */}
            <Route path="/admin/subtests" element={<Navigate to="/admin/exams?tab=subtests" replace />} />
            <Route path="/admin/categories" element={<Navigate to="/admin/exams?tab=subtests" replace />} />

            {/* Menu Terpadu: Bank & Fitur Impor Soal */}
            <Route path="/admin/questions" element={<AdminQuestionsPage />} />
            <Route path="/admin/questions/library" element={<AdminQuestionsPage />} />
            {/* Backward-compatible redirect ke Tab Impor Soal */}
            <Route path="/admin/questions/import" element={<Navigate to="/admin/questions?tab=import" replace />} />

            {/* Pelaksanaan Ujian: Jadwal & Peserta */}
            <Route path="/admin/schedules" element={<AdminSchedulesPage />} />
            <Route path="/admin/assessment-lg/schedule" element={<AdminSchedulesPage />} />
            <Route path="/admin/participants" element={<AdminParticipantsPage />} />

            {/* Hasil Ujian & Penilaian */}
            <Route path="/admin/results" element={<AdminResultsPage />} />

            {/* Menu Terpadu: Audit Trail & Pusat Notifikasi */}
            <Route path="/admin/activity-log" element={<AdminAuditLogsPage />} />
            {/* Backward-compatible redirect ke Tab Notifikasi */}
            <Route path="/admin/notifications" element={<Navigate to="/admin/activity-log?tab=notifications" replace />} />

            {/* Sistem: Pengguna & Pengaturan */}
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />

            <Route path="/admin/*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
};
