# Memasang Karsa Circle di VPS

1. Login ke VPS sebagai `root` (Web console Hostinger atau `ssh root@<IP>`).
2. Jalankan (±10–15 menit):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/bykathya/management-dashboard-karsa/main/deploy/pasang-karsa.sh -o pasang.sh
   EMAIL_SSL=email@anda.com bash pasang.sh
   ```
3. Buat Super Admin pertama (kata sandi diketik sendiri, tidak tampil):
   ```bash
   cd /opt/karsa/management-dashboard/server
   read -rp "Email admin: " E; read -rp "Nama: " N; read -rsp "Password (min 12): " P; echo
   sudo -u karsa env ADMIN_EMAIL="$E" ADMIN_NAMA="$N" ADMIN_PASSWORD="$P" node prisma/seed.js; unset P
   ```
4. Masuk ke `https://pusat.<domain>`, buat circle "Karsa Circle" dan studionya, lalu isi slug circle:
   ```bash
   sudo -u postgres psql karsa_md -c "UPDATE \"Circle\" SET slug='karsa' WHERE nama='Karsa Circle';"
   ```
5. Memperbarui setelah ada perubahan kode: jalankan lagi `bash pasang.sh` (langkah yang sudah ada dilewati,
   kode ditarik ulang, database dimigrasi, tampilan dibangun ulang, server dimulai ulang).

Satu web kerja harian (`kerja.<domain>`) untuk semua studio di circle; studio dipilih di dalam web.
