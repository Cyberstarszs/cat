import React, { useState, useEffect } from 'react';
import { sessionService } from '../../services';
import { formatWIBDate, formatWIBTimeRange } from '../../utils/date';
import { Clock, Calendar, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/cat-governance-logo.png';
import fakultasImg from '../../assets/fakultas.jpeg';
import certRefImg from '../../assets/referensi_sertifikat.jpg';
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
    ? 'Buka Panel Administrator'
    : 'Buka Dashboard Ujian';
  const [publicSessions, setPublicSessions] = useState<any[]>([]);
  const [publicLoading, setPublicLoading] = useState(true);

  useEffect(() => {
    sessionService
      .getPublicSessions()
      .then((data) => setPublicSessions(data || []))
      .catch(() => setPublicSessions([]))
      .finally(() => setPublicLoading(false));
  }, []);

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
            Tata kelola yang bersih bermula dari kejujuran yang diuji. Di Fakultas Ilmu Administrasi
            Universitas Madura, sistem ini memastikan setiap mahasiswa dinilai murni berdasarkan kecakapannya
            secara terbuka, terukur, dan tanpa kompromi.
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
              Lihat Jadwal Ujian
            </button>
          </div>
        </div>
      </section>

      {/* 2. Solusi & Nilai Manfaat Nyata (Tentang CAT GOVERNANCE) */}
      <section className="lp-quick lp-section" id="tentang">
        <div className="lp-section-heading">
          <div className="eyebrow">KOMITMEN MUTU FIA</div>
          <h2>
            Tata Kelola Nyata Dimulai dari Penilaian yang Jujur
          </h2>
          <p>
            Ilmu Administrasi mengajarkan tanggung jawab publik, dan kami memulainya dari cara kami menguji.
            Di laboratorium komputer FIA UNIRA, setiap peserta berhadapan dengan standar yang setara: materi yang sama,
            alokasi waktu yang tegas, dan penilaian otomatis tanpa campur tangan subjektif.
          </p>
        </div>
        <div className="lp-quick-list">
          {[
            [
              'target',
              'Penilaian Mandiri & Terbuka',
              'Jawaban diperiksa langsung oleh sistem begitu Anda menekan tombol selesai. Nilai yang muncul adalah cermin murni lembar kerja Anda tanpa rekayasa.',
            ],
            [
              'shield',
              'Tertib Laboratorium',
              'Ujian berlangsung di laboratorium komputer terpadu gedung FIA Panglegur. Setiap sesi dijadwalkan teratur dan diawasi langsung demi menjaga suasana tenang.',
            ],
            [
              'award',
              'Legitimasi Fakultas',
              'Peserta yang memenuhi batas kelulusan berhak menerima sertifikat resmi bertanda tangan Dekan dengan kode QR unik yang tercatat di arsip fakultas.',
            ],
          ].map((item) => (
            <article key={item[1]}>
              <FigmaIcon name={item[0] as IconName} />
              <h3>{item[1]}</h3>
              <p>{item[2]}</p>
            </article>
          ))}
        </div>
      </section>

      {/* 2b. Jadwal Sesi Ujian Publik */}
      <section className="lp-section max-w-[1280px] mx-auto px-6 py-12" id="jadwal-publik">
        <div className="lp-section-heading">
          <div className="eyebrow">AGENDA EVALUASI</div>
          <h2>
            Jadwal Pelaksanaan Ujian
          </h2>
          <p>
            Setiap sesi memiliki pembagian waktu dan kuota perangkat di laboratorium kampus. Pastikan Anda hadir sebelum sesi dibuka untuk persiapan teknis dan verifikasi tempat duduk.
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
            Belum ada jadwal sesi yang dibuka untuk umum saat ini. Agenda evaluasi berikutnya akan diperbarui secara berkala melalui pangkalan data akademik FIA.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {publicSessions.map((sess) => (
              <article key={sess.id} className="course-exam-card">
                <div className="course-exam-card__visual">
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
          <div className="eyebrow">STANDAR OPERASIONAL</div>
          <h2>
            Lima Tahap Menempuh Ujian
          </h2>
        </div>
        <div className="lp-process-line">
          {[
            [
              'Autentikasi Akun',
              'Mahasiswa masuk menggunakan NIM terdaftar, sementara peserta jalur khusus menggunakan Nomor Registrasi yang diterbitkan panitia fakultas.',
            ],
            [
              'Pemeriksaan Sesi & Lab',
              'Periksa jam sesi dan letak ruangan laboratorium komputer gedung FIA sebelum hitung mundur pengerjaan dimulai.',
            ],
            [
              'Pengerjaan Mandiri',
              'Selesaikan butir soal tata kelola dan administrasi melalui komputer laboratorium sebelum batas waktu habis.',
            ],
            [
              'Transparansi Nilai Seketika',
              'Skor akhir dan rincian capaian kompetensi langsung tampil di layar sesaat setelah Anda mengonfirmasi ujian selesai.',
            ],
            [
              'Penerbitan Sertifikat Resmi',
              'Peserta yang melampaui nilai ambang batas langsung memperoleh akses unduhan sertifikat digital berstempel Dekan FIA UNIRA.',
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

      {/* 4. Prinsip Integritas Akademik */}
      <section className="lp-benefits lp-section">
        <div className="lp-section-heading row">
          <div>
            <div className="eyebrow">PRINSIP KELOLA</div>
            <h2>Standar Pengujian yang Kami Pertahankan</h2>
          </div>
          <p>
            Di Fakultas Ilmu Administrasi Universitas Madura, kami tidak mendidik calon sarjana untuk mencari jalan pintas. Standar pengujian yang tertib adalah bentuk penghormatan kami terhadap masa depan tata kelola daerah dan bangsa.
          </p>
        </div>
        <div className="lp-benefit-list">
          {[
            [
              'Keadilan Waktu',
              'Durasi pengerjaan dikunci otomatis oleh server. Tidak ada peserta yang mendapat menit tambahan di luar hak yang sama.',
              '01',
            ],
            [
              'Materi Berorientasi Tata Kelola',
              'Soal dirumuskan oleh dosen pengampu untuk menguji kepekaan analitis regulasi, kebijakan publik, dan etika manajerial.',
              '02',
            ],
            [
              'Hasil yang Dapat Dipertanggungjawabkan',
              'Seluruh lembar pengerjaan dan log aktivitas tersimpan aman di pangkalan data terenkripsi untuk kebutuhan audit akademik.',
              '03',
            ],
            [
              'Pendampingan Resmi di Ruangan',
              'Pengawas ruangan dan teknisi fakultas bersiaga penuh di laboratorium memastikan perangkat dan jaringan berjalan tertib.',
              '04',
            ],
            [
              'Kredibilitas yang Diakui',
              'Lulusan yang memegang sertifikat FIA membawa bukti kompetensi yang kokoh dan dapat diverifikasi kapan pun oleh instansi kerja.',
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
            'Ujian Tanpa Kertas & Rapi',
            'Seluruh pengerjaan berlangsung di komputer lab kampus. Meniadakan risiko salah periksa atau lembar jawaban tercecer.',
          ],
          [
            'clock',
            'Kepastian Nilai Seketika',
            'Tidak ada waktu tunggu rekap manual. Skor akhir dan rincian capaian tersaji tuntas saat tombol selesai ditekan.',
          ],
          [
            'shield',
            'Verifikasi Arsip 24 Jam',
            'Pimpinan instansi dan mitra kerja dapat membuktikan keaslian dokumen kelulusan cukup dengan memindai kode QR sertifikat.',
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
          <div className="eyebrow">DOKUMEN KELAYAKAN</div>
          <h2>
            Sertifikat Resmi Fakultas Ilmu Administrasi
          </h2>
          <p>
            Kelulusan di CAT Governance bukan sekadar formalitas. Lembar sertifikat bertanda tangan Dekan FIA UNIRA
            ini membuktikan bahwa Anda telah menyelesaikan ujian berstandar tata kelola dengan hasil murni kerja keras sendiri.
          </p>
          <button
            type="button"
            className="button"
            onClick={() => navigate('/explore')}
          >
            <FigmaIcon name="calendar" />
            Jadwal Sesi Ujian
          </button>
        </div>
        <div className="lp-certificate-image-wrap">
          <img
            src={certRefImg}
            alt="Sertifikat Resmi Kelulusan FIA Universitas Madura"
          />
        </div>
      </section>

      {/* 8. Profil Institusi Penyelenggara */}
      <section className="lp-institution lp-section">
        <div className="lp-institution-visual rounded-[12px] overflow-hidden shadow-lg border border-[#e6e1eb] relative group">
          <img
            src={fakultasImg}
            alt="Gedung Fakultas Ilmu Administrasi Universitas Madura"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#21162d]/90 via-[#21162d]/20 to-transparent pointer-events-none z-1" />
          <div className="absolute bottom-6 left-6 right-6 z-10 text-white">
            <span className="text-[11px] font-bold tracking-widest uppercase bg-[#583682]/90 backdrop-blur-sm px-2.5 py-1 rounded inline-block mb-1.5 border border-white/20">
              KAMPUS PANGLEGUR
            </span>
            <div className="text-sm font-bold leading-snug">
              Fakultas Ilmu Administrasi · Universitas Madura
            </div>
            <div className="text-[11px] text-gray-200 mt-0.5">
              Jl. Raya Panglegur No. 3.5, Pamekasan, Madura
            </div>
          </div>
        </div>
        <div>
          <div className="eyebrow">TENTANG KAMI</div>
          <h2>
            Fakultas Ilmu Administrasi
          </h2>
          <h3>Universitas Madura</h3>
          <p>
            Berdiri di Pamekasan sebagai bagian dari Universitas Madura, Fakultas Ilmu Administrasi mengemban
            amanah melahirkan praktisi dan pemimpin tata kelola yang berintegritas tinggi. Kami meyakini bahwa perubahan
            birokrasi dan kemajuan administrasi bermula dari individu yang terbiasa bersikap jujur sejak bangku kuliah.
          </p>
          <div className="lp-institution-facts">
            <span>
              <b>FIA UNIRA</b> Pendidikan Tata Kelola Publik & Bisnis
            </span>
            <span>
              <b>LAB CAT</b> Uji Kompetensi Terstandar Panglegur
            </span>
          </div>
        </div>
      </section>

      {/* 10. Pusat Informasi & Pertanyaan Umum (FAQ) */}
      <section className="lp-section" id="bantuan">
        <div className="lp-section-heading">
          <div className="eyebrow">INFORMASI PRAKTIS</div>
          <h2>Pertanyaan yang Kerap Diajukan</h2>
          <p>
            Ketentuan praktis seputar akun peserta, pelaksanaan ujian di laboratorium kampus, hingga validitas sertifikat.
          </p>
        </div>
        <div className="lp-faq-grid">
          <article className="lp-faq-card">
            <h3>Siapa saja yang berhak mengikuti ujian melalui sistem ini?</h3>
            <p>
              Mahasiswa aktif Fakultas Ilmu Administrasi UNIRA yang menempuh mata kuliah atau uji sertifikasi,
              serta peserta kemitraan instansi yang terdaftar resmi pada agenda evaluasi fakultas.
            </p>
          </article>
          <article className="lp-faq-card">
            <h3>Bagaimana mahasiswa masuk ke ruang ujian?</h3>
            <p>
              Mahasiswa cukup masuk dengan NIM dan kata sandi yang telah terhubung ke pangkalan data akademik fakultas.
              Tidak diperlukan pendaftaran akun terpisah.
            </p>
          </article>
          <article className="lp-faq-card">
            <h3>Bagaimana bila terjadi kendala perangkat atau listrik saat ujian?</h3>
            <p>
              Setiap opsi jawaban otomatis tersimpan di server setiap detik. Teknisi dan pengawas ruangan akan membantu
              mengalihkan Anda ke komputer cadangan tanpa mengurangi sisa waktu maupun jawaban yang telah terisi.
            </p>
          </article>
          <article className="lp-faq-card">
            <h3>Mengapa sertifikat kelulusan ini dapat dipercaya oleh instansi kerja?</h3>
            <p>
              Sertifikat diterbitkan atas nama Dekan Fakultas Ilmu Administrasi Universitas Madura dan memuat kode QR
              yang terhubung langsung ke arsip kelulusan resmi, sehingga keasliannya dapat diverifikasi seketika.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
};
