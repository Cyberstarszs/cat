import React, { useState, useEffect } from 'react';
import { sessionService } from '../../services';
import { formatWIBDate, formatWIBTimeRange } from '../../utils/date';
import { Clock, Calendar, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/cat-governance-logo.png';
import { FigmaIcon, IconName } from '../../components/common/FigmaIcon';

export const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const handlePrimaryCta = () => {
    if (!isAuthenticated) {
      navigate('/login');
    } else if (user?.role === 'admin') {
      navigate('/admin/dashboard');
    } else {
      navigate('/dashboard');
    }
  };

  const primaryCtaLabel = !isAuthenticated
    ? 'Masuk ke Ruang Ujian'
    : user?.role === 'admin'
    ? 'Buka Portal Administrator'
    : 'Buka Dashboard Ujian';
  const [verifyCertNumber, setVerifyCertNumber] = useState('');
  const [publicSessions, setPublicSessions] = useState<any[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);

  useEffect(() => {
    sessionService
      .getPublicSessions()
      .then((data) => setPublicSessions(data || []))
      .catch(() => setPublicSessions([]))
      .finally(() => setPublicLoading(false));
  }, []);

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyCertNumber.trim()) {
      navigate(`/verify?number=${encodeURIComponent(verifyCertNumber.trim())}`);
    } else {
      navigate('/verify');
    }
  };

  return (
    <div className="landing">
      {/* 1. Minimal Orbit Hero */}
      <section className="lp-hero lp-hero--minimal">
        <div className="minimal-orbit" aria-hidden="true">
          <div className="orbit-line orbit-line--outer" />
          <div className="orbit-line orbit-line--middle" />
          <div className="orbit-line orbit-line--inner" />
          <span className="orbit-icon orbit-icon--document">
            <FigmaIcon name="file" size={32} />
            <i>
              <FigmaIcon name="check" size={13} />
            </i>
          </span>
          <span className="orbit-icon orbit-icon--monitor">
            <FigmaIcon name="monitor" size={26} />
          </span>
          <span className="orbit-icon orbit-icon--chart">
            <FigmaIcon name="chart" size={25} />
          </span>
          <span className="orbit-icon orbit-icon--shield">
            <FigmaIcon name="shield" size={26} />
          </span>
          <span className="orbit-icon orbit-icon--database">
            <FigmaIcon name="award" size={24} />
          </span>
          <span className="orbit-dot orbit-dot--one" />
          <span className="orbit-dot orbit-dot--two" />
          <span className="orbit-dot orbit-dot--three" />
        </div>
        <div className="minimal-hero-copy">
          <div className="eyebrow">FAKULTAS ILMU ADMINISTRASI · UNIVERSITAS MADURA</div>
          <h1>CAT GOVERNANCE</h1>
          <p>
            Sistem evaluasi akademik dan uji kompetensi berbasis Computer Assisted Test (CAT) mandiri
            di lingkungan Fakultas Ilmu Administrasi, Universitas Madura.
          </p>
          <div className="minimal-hero-actions">
            <button
              type="button"
              className="button button--light"
              onClick={handlePrimaryCta}
            >
              {primaryCtaLabel}
            </button>
            <button
              type="button"
              className="button button--secondary"
              onClick={() => {
                const el = document.getElementById('jadwal-publik');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
                else navigate('/explore');
              }}
            >
              Jadwal Sesi Ujian
            </button>
          </div>
        </div>
      </section>

      {/* 2. Solusi & Nilai Manfaat Nyata (Tentang CAT GOVERNANCE) */}
      <section className="lp-quick lp-section" id="tentang">
        <div className="lp-section-heading">
          <div className="eyebrow">TENTANG PLATFORM</div>
          <h2>
            Standar Asesmen Akademik yang
            <br />
            Objektif dan Akuntabel
          </h2>
          <p>
            Sistem Computer Assisted Test (CAT) mandiri di lingkungan Fakultas Ilmu Administrasi
            Universitas Madura. Menyelenggarakan evaluasi kompetensi terukur dengan pengolahan hasil
            otomatis, adil, dan transparan bagi mahasiswa internal maupun peserta eksternal.
          </p>
        </div>
        <div className="lp-quick-list">
          {[
            [
              '01',
              'target',
              'Penilaian Objektif',
              'Hasil evaluasi diproses otomatis oleh sistem berdasarkan standar kunci jawaban baku tanpa intervensi subjektif.',
            ],
            [
              '02',
              'shield',
              'Pelaksanaan Terjadwal',
              'Sesi ujian diselenggarakan dalam lingkungan terkendali guna menjamin ketertiban, ketepatan waktu, dan integritas akademik.',
            ],
            [
              '03',
              'award',
              'Sertifikasi Kompetensi',
              'Peserta yang memenuhi standar kelulusan memperoleh sertifikat resmi beridentitas unik yang dapat diverifikasi langsung oleh publik.',
            ],
          ].map((item) => (
            <article key={item[0]}>
              <span>{item[0]}</span>
              <FigmaIcon name={item[1] as IconName} />
              <h3>{item[2]}</h3>
              <p>{item[3]}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 2b. Jadwal Sesi Ujian Publik */}
      <section className="lp-section max-w-[1280px] mx-auto px-6 py-12" id="jadwal-publik">
        <div className="lp-section-heading">
          <div className="eyebrow">JADWAL SESI UJIAN</div>
          <h2>
            Jadwal Sesi Ujian yang Sedang
            <br />
            dan Akan Berlangsung
          </h2>
          <p>
            Pilih sesi ujian kompetensi yang tersedia di bawah ini untuk mengikuti asesmen mandiri.
          </p>
        </div>

        {publicLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            <div className="h-48 bg-white border border-[#e6e1eb] rounded-[8px] animate-pulse" />
            <div className="h-48 bg-white border border-[#e6e1eb] rounded-[8px] animate-pulse" />
            <div className="h-48 bg-white border border-[#e6e1eb] rounded-[8px] animate-pulse" />
          </div>
        ) : publicSessions.length === 0 ? (
          <div className="text-center py-12 text-xs text-[#595562] bg-white border border-[#e6e1eb] rounded-[8px] mt-6">
            Saat ini belum ada sesi ujian publik yang dibuka. Silakan periksa kembali nanti.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {publicSessions.map((sess, idx) => (
              <article key={sess.id} className="course-exam-card">
                <div className="course-exam-card__visual">
                  <span>0{idx + 1}</span>
                  <FigmaIcon name="book" size={24} />
                  <small>SESI UJIAN</small>
                </div>

                <div className="course-exam-card__body">
                  <div className="mb-2">
                    <span className={`status-pill ${sess.status === 'active' ? 'passed' : 'waiting'}`}>
                      {sess.status === 'active' ? 'Sedang Berlangsung' : 'Akan Datang'}
                    </span>
                  </div>
                  <h3>{sess.name}</h3>
                  <p>{sess.exam_title || 'Uji Kompetensi CAT'}</p>

                  <div className="course-exam-card__facts">
                    <span>
                      <Clock className="w-3.5 h-3.5 text-[#583682]" />
                      <b>{sess.duration_minutes || 90} menit</b>
                    </span>
                    <span>
                      <Shield className="w-3.5 h-3.5 text-[#583682]" />
                      <b>Batas: {Math.round(sess.passing_score || 70)}</b>
                    </span>
                  </div>

                  <div className="course-exam-card__schedule">
                    <Calendar className="w-4 h-4 text-[#583682]" />
                    <span>
                      <small>JADWAL (WIB)</small>
                      <b>{formatWIBDate(sess.starts_at)}</b>
                      <em>{formatWIBTimeRange(sess.starts_at, sess.ends_at)}</em>
                    </span>
                  </div>
                </div>

                <button
                  className="course-exam-card__action cursor-pointer"
                  onClick={() => {
                    if (!isAuthenticated) {
                      navigate(`/login?redirect=${encodeURIComponent(`/instructions?sessionId=${sess.id}`)}`);
                    } else {
                      navigate(`/instructions?sessionId=${sess.id}`);
                    }
                  }}
                >
                  <span>Ikuti Ujian</span>
                  <span aria-hidden="true">→</span>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* 3. Panduan Alur Peserta (5 Langkah Terarah) */}
      <section className="lp-process" id="cara-kerja">
        <div className="lp-section-heading light">
          <div className="eyebrow">ALUR ASESMEN / PANDUAN PESERTA</div>
          <h2>
            Tahapan Pelaksanaan
            <br />
            Ujian Mandiri
          </h2>
        </div>
        <div className="lp-process-line">
          {[
            [
              'Akses Akun Peserta',
              'Masuk menggunakan NIM bagi mahasiswa internal atau ID Peserta resmi bagi pendaftar dari luar kampus.',
            ],
            [
              'Konfirmasi Jadwal',
              'Periksa waktu sesi, alokasi durasi, dan nomor ruang laboratorium pelaksanaan asesmen.',
            ],
            [
              'Pengerjaan Soal',
              'Selesaikan materi asesmen pilihan ganda melalui antarmuka komputer dalam alokasi waktu yang ditentukan.',
            ],
            [
              'Transparansi Nilai',
              'Perolehan skor akhir ditampilkan langsung secara terbuka sesaat setelah ujian dikonfirmasi selesai.',
            ],
            [
              'Penerbitan Sertifikat',
              'Peserta yang mencapai ambang batas kelulusan berhak mengunduh sertifikat kompetensi resmi ber-QR Code.',
            ],
          ].map((item, index) => (
            <article key={item[0]}>
              <span>0{index + 1}</span>
              <h3>{item[0]}</h3>
              <p>{item[1]}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 4. Pratinjau Tampilan Sistem (Kartu Peserta & Antarmuka Soal) */}
      <section className="lp-system-preview lp-section">
        <div className="lp-identity-demo">
          <div className="lp-section-heading">
            <div className="eyebrow">SISTEM ASESMEN TERPADU</div>
            <h2>Antarmuka Bersih dan Terstandarisasi</h2>
            <p>
              Lingkungan ujian dirancang fokus dan tertata agar mahasiswa internal maupun peserta eksternal
              dapat menjalani asesmen dengan nyaman dan optimal.
            </p>
          </div>
          <div className="lp-id-card">
            <div className="lp-id-avatar">
              <div className="lp-id-avatar-circle">WH</div>
              <small>PESERTA UJIAN</small>
            </div>
            <div className="lp-id-content">
              <div className="eyebrow">KARTU PESERTA ASESMEN</div>
              <h3>Wahyu Hidayatullah</h3>
              <dl>
                <div>
                  <dt>Identitas Peserta</dt>
                  <dd>202412345 (NIM / No. Peserta)</dd>
                </div>
                <div>
                  <dt>Program / Kategori</dt>
                  <dd>Administrasi Publik / Terdaftar</dd>
                </div>
                <div className="full-col">
                  <dt>Nomor Registrasi Ujian</dt>
                  <dd>CAT-2026-001245</dd>
                </div>
              </dl>
              <div className="lp-id-footer">
                <span className="text-[11px] font-semibold text-[#583682] uppercase tracking-wider">
                  Status: Aktif
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="lp-cat-demo">
          <div className="lp-cat-head">
            <div className="brand brand--compact">
              <img
                className="brand__logo"
                src={logoImg}
                alt="CAT Governance"
              />
            </div>
            <span>SIMULASI UJIAN CAT</span>
            <strong>01:24:36</strong>
          </div>
          <div className="lp-cat-body">
            <div>
              <div className="eyebrow">SOAL 12 DARI 50</div>
              <h3>
                Salah satu prinsip utama dalam tata kelola pemerintahan yang
                baik (good governance) adalah...
              </h3>
              {[
                'Transparansi dan akuntabilitas pelayanan publik',
                'Pemusatan kewenangan secara mutlak tanpa pengawasan',
                'Pembatasan hak berpendapat dan informasi warga negara',
              ].map((x, i) => (
                <span className={i === 0 ? 'selected' : ''} key={x}>
                  <b>{String.fromCharCode(65 + i)}</b>
                  {x}
                </span>
              ))}
            </div>
            <aside>
              <div className="eyebrow">NAVIGASI SOAL</div>
              <div className="lp-nav-grid">
                {Array.from({ length: 15 }, (_, i) => (
                  <i
                    className={i === 11 ? 'active' : i < 8 ? 'done' : ''}
                    key={i}
                  >
                    {i + 1}
                  </i>
                ))}
              </div>
              <div className="lp-cat-progress-wrap">
                <small>Kemajuan pengerjaan 48%</small>
                <div className="lp-cat-progress-bar">
                  <i style={{ width: '48%' }} />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* 5. Prinsip Integritas Akademik */}
      <section className="lp-benefits lp-section">
        <div className="lp-section-heading row">
          <div>
            <div className="eyebrow">INTEGRITAS AKADEMIK</div>
            <h2>Prinsip Tata Kelola Asesmen</h2>
          </div>
          <p>
            Fakultas Ilmu Administrasi menerapkan standar mutu pengujian yang terpercaya guna menjamin
            setiap evaluasi mencerminkan kompetensi riil peserta secara adil.
          </p>
        </div>
        <div className="lp-benefit-list">
          {[
            [
              'Objektivitas Penilaian',
              'Skor akhir diproses independen oleh sistem komputer berdasarkan kunci jawaban yang telah divalidasi.',
              '01',
            ],
            [
              'Standarisasi Materi',
              'Paket soal disusun oleh akademisi ahli untuk menguji kompetensi tata kelola secara mendalam dan terukur.',
              '02',
            ],
            [
              'Ketertiban Waktu',
              'Pengendalian durasi per sesi berlangsung otomatis demi menjamin kesetaraan kesempatan bagi semua peserta.',
              '03',
            ],
            [
              'Arsip Terpusat',
              'Seluruh rekam jejak nilai tersimpan permanen di pangkalan data resmi fakultas untuk keabsahan jangka panjang.',
              '04',
            ],
            [
              'Pengawasan Laboratorium',
              'Pelaksanaan di laboratorium dipandu oleh pengawas dan tim teknis untuk menjamin ketertiban asesmen.',
              '05',
            ],
          ].map((x) => (
            <article key={x[0]}>
              <span>{x[2]}</span>
              <h3>{x[0]}</h3>
              <p>{x[1]}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 6. Fakta & Standar Layanan Akademik */}
      <section className="lp-statistics">
        {[
          [
            'monitor',
            'Berbasis Komputer (CAT)',
            'Pelaksanaan terpusat di laboratorium dengan sistem mandiri yang tertata dan terstandarisasi.',
          ],
          [
            'clock',
            'Hasil Nilai Langsung',
            'Skor evaluasi diketahui seketika saat ujian selesai, menjamin keterbukaan informasi bagi peserta.',
          ],
          [
            'shield',
            'Validasi Sertifikat Digital',
            'Keaslian sertifikat dapat diverifikasi kapan saja oleh pihak kampus, sekolah, maupun instansi kerja.',
          ],
        ].map((item) => (
          <div key={item[1]}>
            <FigmaIcon name={item[0] as IconName} size={26} />
            <strong>{item[1]}</strong>
            <span>{item[2]}</span>
          </div>
        ))}
      </section>

      {/* 7. Sertifikat Kompetensi Resmi */}
      <section className="lp-certificate-section lp-section">
        <div className="lp-certificate-copy">
          <div className="eyebrow">DOKUMEN KELULUSAN</div>
          <h2>
            Sertifikat Kompetensi
            <br />
            <em>Fakultas Ilmu Administrasi</em>
          </h2>
          <p>
            Bukti kompetensi resmi yang diterbitkan oleh Fakultas Ilmu Administrasi Universitas Madura.
            Dilengkapi nomor registrasi unik dan kode QR untuk validasi keaslian dokumen oleh instansi luar.
          </p>
          <button
            type="button"
            className="button"
            onClick={() => navigate('/verify')}
          >
            <FigmaIcon name="shield" />
            Periksa Keabsahan Sertifikat
          </button>
        </div>
        <div className="lp-certificate">
          <div className="lp-certificate-top">
            <span>UNIVERSITAS MADURA · FAKULTAS ILMU ADMINISTRASI</span>
            <span>FAKULTAS ILMU ADMINISTRASI</span>
          </div>
          <div className="lp-certificate-body">
            <span className="lp-certificate-badge">SERTIFIKAT KOMPETENSI</span>
            <h3 className="lp-certificate-name">WAHYU HIDAYATULLAH</h3>
            <p className="lp-certificate-intro">Diberikan atas pemenuhan standar kompetensi bidang</p>
            <h4 className="lp-certificate-title">TATA KELOLA DAN ADMINISTRASI PUBLIK</h4>
          </div>
          <div className="lp-certificate-footer">
            <div className="lp-cert-metric">
              <small>NILAI KELULUSAN</small>
              <b>86 / 100</b>
            </div>
            <div className="lp-cert-metric">
              <small>NOMOR REGISTRASI</small>
              <b>CAT-2026-001245</b>
            </div>
            <div className="lp-cert-qr-wrap">
              <div className="lp-qr">
                CG
                <br />
                26
              </div>
              <small>VALID</small>
            </div>
          </div>
        </div>
      </section>

      {/* 8. Layanan Verifikasi Terbuka */}
      <section className="lp-verify-strip">
        <div>
          <div className="eyebrow">LAYANAN VALIDASI PUBLIK</div>
          <h2>Verifikasi Keaslian Sertifikat</h2>
          <p>
            Fasilitas pemeriksaan keabsahan sertifikat kelulusan yang diterbitkan oleh
            Fakultas Ilmu Administrasi Universitas Madura untuk menjamin keaslian dokumen akademik.
          </p>
        </div>
        <form onSubmit={handleVerifySubmit}>
          <label>
            <span>Nomor Registrasi Sertifikat</span>
            <input
              id="verify-cert-input"
              name="verifyCertNumber"
              value={verifyCertNumber}
              onChange={(e) => setVerifyCertNumber(e.target.value)}
              placeholder="Contoh: CAT-2026-001245…"
              spellCheck={false}
              autoComplete="off"
            />
          </label>
          <button type="submit" className="button button--light">
            Periksa Sertifikat
          </button>
          <small>
            <FigmaIcon name="check" size={14} /> Terhubung langsung dengan pangkalan data sertifikat FIA
          </small>
        </form>
      </section>

      {/* 9. Profil Institusi Penyelenggara */}
      <section className="lp-institution lp-section">
        <div className="lp-institution-visual">
          <div className="institution-seal">
            <span>FIA</span>
            <FigmaIcon name="book" size={34} />
          </div>
          <div className="institution-grid" aria-hidden="true">
            {Array.from({ length: 24 }, (_, index) => (
              <i key={index}>
                {index % 6 === 0
                  ? String(index / 6 + 1).padStart(2, '0')
                  : ''}
              </i>
            ))}
          </div>
          <small>FAKULTAS ILMU ADMINISTRASI / UNIVERSITAS MADURA</small>
        </div>
        <div>
          <div className="eyebrow">LEMBAGA PENYELENGGARA</div>
          <h2>
            Fakultas Ilmu
            <br />
            Administrasi
          </h2>
          <h3>Universitas Madura</h3>
          <p>
            Institusi pendidikan tinggi yang berfokus membentuk lulusan sarjana berkompeten, berintegritas tinggi,
            serta menguasai keilmuan tata kelola pemerintahan dan administrasi organisasi modern.
          </p>
          <div className="lp-institution-facts">
            <span>
              <b>FIA</b> Universitas Madura
            </span>
            <span>
              <b>CAT</b> Laboratorium Komputer Terpadu
            </span>
          </div>
        </div>
      </section>

      {/* 10. Pusat Informasi & Pertanyaan Umum (FAQ) */}
      <section className="lp-section" id="bantuan">
        <div className="lp-section-heading">
          <div className="eyebrow">PUSAT INFORMASI & PANDUAN</div>
          <h2>Pertanyaan yang Sering Diajukan</h2>
          <p>
            Informasi resmi mengenai keikutsertaan, teknis pelaksanaan, dan sertifikasi bagi mahasiswa
            maupun peserta eksternal.
          </p>
        </div>
        <div className="lp-faq-grid">
          <article className="lp-faq-card">
            <h3>Bagaimana ketentuan bagi peserta eksternal (siswa atau mahasiswa luar kampus)?</h3>
            <p>
              Peserta dari luar kampus dapat mengikuti uji kompetensi melalui jalur pendaftaran resmi yang dibuka fakultas.
              Setelah terverifikasi, panitia akan menerbitkan ID Peserta resmi beserta jadwal sesi ujian di laboratorium.
            </p>
          </article>
          <article className="lp-faq-card">
            <h3>Bagaimana mahasiswa internal FIA Universitas Madura mengakses ruang ujian?</h3>
            <p>
              Mahasiswa internal dapat langsung masuk menggunakan Nomor Induk Mahasiswa (NIM) aktif dan kata sandi
              yang telah disinkronkan dengan pangkalan data akademik fakultas.
            </p>
          </article>
          <article className="lp-faq-card">
            <h3>Bagaimana jika terjadi kendala teknis atau jaringan saat ujian berlangsung?</h3>
            <p>
              Setiap lembar jawaban tersimpan secara berkala pada peladen pusat. Pengawas ruang akan membantu peserta
              melakukan login ulang tanpa kehilangan jawaban yang telah diisi sebelumnya.
            </p>
          </article>
          <article className="lp-faq-card">
            <h3>Apakah sertifikat kompetensi ini diakui secara resmi oleh pihak luar?</h3>
            <p>
              Ya. Sertifikat diterbitkan resmi oleh Fakultas Ilmu Administrasi Universitas Madura dan tercatat dalam sistem
              verifikasi publik, sehingga dapat divalidasi keabsahannya oleh institusi pendidikan maupun instansi kerja.
            </p>
          </article>
        </div>
      </section>

      {/* 11. Final CTA Banner */}
      <section className="lp-final-cta">
        <div>
          <div className="eyebrow">PORTAL ASESMEN KOMPETENSI</div>
          <h2>
            Akses Ruang
            <br />
            Ujian Mandiri
          </h2>
          <p>
            Silakan masuk menggunakan identitas peserta terdaftar untuk memeriksa jadwal ruang laboratorium
            atau memulai asesmen kompetensi Anda.
          </p>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="button button--light"
            onClick={handlePrimaryCta}
          >
            {primaryCtaLabel}
          </button>
          <button
            type="button"
            className="button button--secondary"
            onClick={() => navigate('/explore')}
          >
            Jadwal & Informasi Ujian
          </button>
        </div>
      </section>
    </div>
  );
};
