import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Navbar } from './Navbar';
import { Footer } from './Footer';

export const AppLayout: React.FC = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Halaman privat portal peserta ujian (hanya ketika user sudah login)
  const isPrivatePortalRoute = [
    '/dashboard',
    '/instructions',
    '/results',
    '/history',
    '/certificates',
    '/certificate',
    '/profile',
    '/settings',
  ].some((prefix) => location.pathname.startsWith(prefix));

  // Tampilkan footer portal minimalis hanya untuk peserta yang sudah login di halaman portal privatnya.
  // Halaman publik (Beranda '/', Jadwal Ujian '/explore', Detail '/detail', Verifikasi '/verify', 404)
  // serta seluruh pengunjung publik menampilkan footer publik resmi FIA Universitas Madura.
  const showMinimalFooter = isAuthenticated && isPrivatePortalRoute;

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9fc] text-[#24212b]">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
      <Footer minimal={showMinimalFooter} />
    </div>
  );
};
