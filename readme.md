# ALINOS.NET - Dashboard Monitor & Manajemen Jaringan

![Versi Aplikasi](https://img.shields.io/badge/version-1.0.0-blue) ![Status Pembangunan](https://img.shields.io/badge/status-aktif%20dikembangkan-green) ![Lisensi](https://img.shields.io/badge/license-MIT-purple)

Selamat datang di ALINOS.NET Dashboard! Proyek ini adalah solusi komprehensif berbasis web untuk memantau dan mengelola berbagai aspek jaringan ISP kamu, dengan fokus pada integrasi dengan perangkat Mikrotik dan manajemen pelanggan.

## 🌟 Fitur Unggulan

Dashboard ini dirancang untuk memberikan kemudahan dan kontrol penuh bagi administrator jaringan:

* **📊 Dashboard Utama Informatif:**
    * **Live Traffic Monitoring:** Grafik _real-time_ untuk _upload_ dan _download_ pada beberapa _interface_ Mikrotik secara bersamaan menggunakan WebSocket.
    * **Informasi Perangkat Mikrotik:** Menampilkan _uptime_, nama perangkat, versi RouterOS, dan model _board_.
    * **Statistik Pengguna Ringkas:** Jumlah pelanggan PPPoE aktif (ON), pelanggan PPPoE non-aktif (OFF), dan _user hotspot_ aktif.

* **👤 Manajemen Pelanggan PPPoE (`customer.html`):**
    * Menampilkan daftar lengkap semua _user_ (_secret_) PPPoE dari Mikrotik.
    * Informasi detail per pelanggan: Nama, Profil, Komentar, dan status _Last Logged Out_.
    * Fitur sortir data berdasarkan kolom (Nama, Profil, Komentar, _Last Logged Out_).
    * Tabel dengan _scroll_ untuk data yang banyak.

* **📡 Manajemen Hotspot (`hotspot.html`):**
    * **Pembuatan User Hotspot Baru:** _Interface_ untuk menambah _user hotspot_ dengan pilihan profil dari Mikrotik, batas waktu, batas kuota, dan komentar.
    * **QR Code Voucher:** Membuat QR Code secara otomatis setelah _user hotspot_ baru berhasil ditambahkan untuk kemudahan _login_ pelanggan.
    * **Daftar User Hotspot:** Menampilkan semua _user hotspot_ yang terdaftar di Mikrotik dengan detailnya.
        * Aksi: Edit dan Hapus _user hotspot_.
    * **User Hotspot Aktif:** Menampilkan daftar _user_ yang sedang aktif/login di jaringan _hotspot_.
        * Detail: User, Alamat IP, MAC Address, Waktu Aktif, Sisa Waktu, Penggunaan Data.
        * Aksi: Disconnect _user_, _Make Cookie/Binding_ (placeholder).
    * **Detail Penggunaan Bandwidth User:** Fitur untuk melihat statistik penggunaan _bandwidth_ sesi aktif per _user hotspot_ terpilih.

* **🗺️ Manajemen ODP/ODC (`odp_odc.html`):**
    * **Peta Interaktif:** Menggunakan Leaflet.js dan OpenStreetMap untuk visualisasi lokasi perangkat jaringan (ODP, ODC, JB, Tiang, dll.).
    * **Input Data Perangkat Jaringan:** Form untuk memasukkan nama perangkat, tipe, koordinat (bisa dipilih dari peta atau input manual), kapasitas _splitter_ (khusus ODP/ODC), dan komentar.
    * **Penyimpanan Data ke Database:** Data perangkat disimpan ke _database_ PostgreSQL.
    * **Tampilan Marker Berwarna:** _Marker_ di peta memiliki warna berbeda berdasarkan tipe perangkat (menggunakan Leaflet.Awesome-Markers).
    * **Popup Detail Perangkat:** Menampilkan informasi lengkap perangkat saat _marker_ atau item di daftar diklik.
    * **Manajemen Slot Splitter:**
        * Menampilkan status pengisian _slot splitter_ di _popup_ detail (terisi oleh siapa atau kosong).
        * Menghitung dan menampilkan total _slot_ terpakai dan tersedia.
        * Fitur untuk mengedit pengisian _slot_ (menetapkan atau mengosongkan _user_ PPPoE) melalui _dropdown_ di _popup_ terpisah.

* **💰 Manajemen Keuangan (`management.html`):**
    * **Manajemen Pemasukan:**
        * Menampilkan daftar pelanggan PPPoE dengan detail keuangan: Nominal tagihan, Tanggal Tagihan, dan Komentar.
        * Nominal tagihan secara cerdas diambil berdasarkan prioritas: data edit manual dari _database_, parsing dari _comment secret_ PPPoE, atau _default_ dari profil PPPoE.
        * Fitur "Edit Data" per pelanggan untuk mengubah Nominal, Tanggal Tagihan, dan Komentar, yang disimpan ke _database_ PostgreSQL.
    * **Manajemen Pengeluaran:**
        * Tombol "Tambah Pengeluaran" untuk mencatat pengeluaran operasional.
        * Menampilkan "Detail Pengeluaran" yang sudah diinput.
        * Fitur "Edit Data" untuk setiap entri pengeluaran.
    * **Ringkasan Keuangan:** Panel yang menampilkan Total Pemasukan, Total Pengeluaran, dan Saldo.

* **⚙️ Pengaturan Akun (`settings.html`):**
    * Pengguna yang login dapat mengubah informasi akun mereka: Nama Lengkap, Email, dan Nomor WhatsApp.
    * Fitur untuk mengubah _password_ (memerlukan _password_ lama).
    * Semua perubahan disimpan ke _database_ pengguna.

* **🔐 Sistem Autentikasi Aman:**
    * Halaman _Login_ (`login.html`) untuk akses ke _dashboard_.
    * Menggunakan JSON Web Tokens (JWT) untuk autentikasi dan proteksi _endpoint_ API.
    * _Middleware_ autentikasi di sisi _backend_.
    * (Opsional/Dikembangkan) Halaman Registrasi (`register.html`) dengan verifikasi OTP WhatsApp menggunakan Baileys.

* **🛠️ Pengaturan Router (`router.html`):**
    * Halaman untuk menginput dan menyimpan (saat ini di `localStorage` _browser_, idealnya ke _backend_) konfigurasi koneksi ke perangkat Mikrotik (Host, User, Password, Port API).

* **📱 Desain Responsif:** Tampilan _dashboard_ dioptimalkan untuk berbagai ukuran layar, termasuk _desktop_ dan _mobile_.

* **🎨 Tema Warna Ungu Modern:** Antarmuka pengguna yang konsisten dengan skema warna ungu yang menarik.

* **🔔 Notifikasi Interaktif:** Menggunakan SweetAlert2 untuk pesan sukses, _error_, dan konfirmasi aksi pengguna.

## 🚀 Teknologi yang Digunakan

* **Frontend:**
    * HTML5
    * CSS3 (styling manual, dengan inspirasi atau penggunaan kelas utilitas)
    * JavaScript (ES6+)
    * [Chart.js](https://www.chartjs.org/): Untuk grafik _live traffic_.
    * [Leaflet.js](https://leafletjs.com/): Untuk peta interaktif ODP/ODC.
    * [OpenStreetMap](https://www.openstreetmap.org/): Sebagai _tile server_ untuk Leaflet.
    * [Leaflet.Awesome-Markers](https://github.com/lvoogdt/Leaflet.awesome-markers): Untuk ikon _marker_ peta yang bisa dikustomisasi.
    * [Font Awesome](https://fontawesome.com/): Untuk ikon di _marker_ dan UI.
    * [SweetAlert2](https://sweetalert2.github.io/): Untuk _popup_ notifikasi yang interaktif.
    * [QRious](https://github.com/neocotic/qrious): Untuk membuat QR Code _voucher hotspot_.

* **Backend:**
    * Node.js
    * Express.js
    * [node-routeros](https://github.com/SONIKROUTO/node-routeros) (atau `routeros-api`): Untuk berinteraksi dengan API Mikrotik.
    * PostgreSQL: Sebagai _database_ untuk menyimpan data pengguna, konfigurasi, data keuangan, dan data ODP/ODC.
    * [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken): Untuk implementasi JWT.
    * [bcryptjs](https://github.com/dcodeIO/bcrypt.js): Untuk _hashing password_.
    * [cors](https://github.com/expressjs/cors): Untuk menangani Cross-Origin Resource Sharing.
    * [dotenv](https://github.com/motdotla/dotenv): Untuk manajemen variabel lingkungan.
    * (Opsional untuk OTP WhatsApp) [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys): Untuk interaksi dengan WhatsApp.
    * (Opsional untuk OTP) `otp-generator`.

* **Tools Pengembangan:**
    * Nodemon: Untuk me-_restart_ server secara otomatis saat ada perubahan kode di _backend_.
    * Visual Studio Code (atau IDE pilihanmu).
    * Git & GitHub (direkomendasikan untuk kontrol versi).

## 🛠️ Instalasi dan Setup (Contoh Umum)

1.  **Clone Repository (Jika Sudah Ada):**
    ```bash
    git clone [URL_REPOSITORY_ANDA]
    cd [NAMA_FOLDER_PROYEK]
    ```

2.  **Setup Backend:**
    * Masuk ke direktori _backend_.
    * Install dependensi:
        ```bash
        npm install
        ```
    * Buat file `.env` di _root_ direktori _backend_ dan isi dengan konfigurasi yang diperlukan (kredensial _database_, info Mikrotik, `JWT_SECRET`, dll.). Contoh `.env.example` bisa disertakan.
    * Pastikan PostgreSQL sudah berjalan dan _database_ sudah dibuat. Jalankan migrasi tabel jika ada.
    * Jalankan server _backend_:
        ```bash
        npm start 
        ```
        atau
        ```bash
        nodemon server.js
        ```

3.  **Frontend:**
    * File HTML, CSS, dan JS _frontend_ berada di folder `public`.
    * Akses melalui _browser_ di `http://localhost:[PORT_BACKEND]` (misalnya, `http://localhost:3000`).

4.  **(Khusus Baileys untuk OTP WhatsApp - Jika Diaktifkan):**
    * Saat _backend_ pertama kali dijalankan dengan Baileys aktif, pindai QR Code yang muncul di terminal _backend_ menggunakan aplikasi WhatsApp di HP yang akan digunakan sebagai pengirim OTP. Folder sesi (misalnya `baileys_auth_info`) akan dibuat.

## 📝 Kontribusi

Kontribusi, _bug report_, dan permintaan fitur selalu diterima! Silakan buat _issue_ atau _pull request_.

## 📜 Lisensi

Proyek ini dilisensikan di bawah [Lisensi MIT](LICENSE.md).

---
