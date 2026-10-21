import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ArrowLeft, HelpCircle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-16 h-16 rounded-full bg-[#f6f2fa] text-[#583682] flex items-center justify-center mb-6" aria-hidden="true">
        <HelpCircle className="w-8 h-8" />
      </div>
      <div className="eyebrow mb-2">GALAT RUTE SISTEM</div>
      <h1 className="font-display font-extrabold text-3xl md:text-5xl text-[#24212b] mb-3">
        404 — Halaman Tidak Ditemukan
      </h1>
      <p className="text-xs md:text-sm text-[#595562] max-w-md mb-8 leading-relaxed">
        Halaman atau rute yang Anda tuju tidak ditemukan atau telah dipindahkan.
      </p>
      <Link to="/">
        <Button variant="primary" leftIcon={<ArrowLeft className="w-4 h-4" />}>
          Kembali ke Beranda
        </Button>
      </Link>
    </div>
  );
};
