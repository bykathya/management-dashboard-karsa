#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────────────────────────
# PASANG KARSA CIRCLE di VPS Ubuntu baru (26 Nov 2026). Jalankan sebagai root:
#   curl -fsSL https://raw.githubusercontent.com/bykathya/management-dashboard-karsa/main/deploy/pasang-karsa.sh -o pasang.sh && bash pasang.sh
# Aman diulang: langkah yang sudah selesai dilewati. Tidak ada rahasia di berkas ini — kata sandi database & kunci JWT
# dibuat acak di server dan hanya disimpan di /opt/karsa/management-dashboard/server/.env (izin 600).
#
# Hasil:
#   https://pusat.DOMAIN  → web pusat (Management Dashboard, Express di 127.0.0.1:3001, header X-Unit-Web: app)
#   https://kerja.DOMAIN  → web kerja harian (Unit Operations Dashboard, berkas statis; /api → 3001, X-Unit-Web: SLUG)
#   https://DOMAIN        → dialihkan ke pusat.DOMAIN
# Aplikasi berjalan sebagai pengguna sistem `karsa` (bukan root) lewat systemd: karsa-server.service
# ─────────────────────────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${DOMAIN:-karsa.network}"
SLUG="${SLUG:-karsa}"                       # harus sama dengan kolom slug Circle "Karsa Circle" (diisi setelah circle dibuat)
EMAIL_SSL="${EMAIL_SSL:-}"                  # email untuk pemberitahuan sertifikat HTTPS (Let's Encrypt)
DASAR=/opt/karsa
MD=$DASAR/management-dashboard
UOD=$DASAR/unit-operations-dashboard
WEB=/var/www/karsa-kerja
REPO_MD=https://github.com/bykathya/management-dashboard-karsa.git
REPO_UOD=https://github.com/bykathya/unit-operations-dashboard-karsa.git

langkah() { echo; echo "════ $* ════"; }
[ "$(id -u)" = 0 ] || { echo "Jalankan sebagai root."; exit 1; }
export DEBIAN_FRONTEND=noninteractive

langkah "1/9 Memperbarui sistem & memasang paket"
apt-get update -y
apt-get upgrade -y
apt-get install -y nginx postgresql git curl ufw certbot python3-certbot-nginx ca-certificates gnupg rsync openssl

langkah "2/9 Memasang Node.js 22 LTS"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v; npm -v

langkah "3/9 Pengguna sistem & folder"
id karsa >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/karsa --shell /usr/sbin/nologin karsa
mkdir -p $DASAR $WEB
chown karsa:karsa $DASAR

langkah "4/9 Database PostgreSQL"
systemctl enable --now postgresql
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='karsa'" | grep -q 1; then
  DB_PASS=$(openssl rand -hex 24)
  sudo -u postgres psql -c "CREATE ROLE karsa LOGIN PASSWORD '$DB_PASS';"
  echo "$DB_PASS" > /root/.karsa-db-pass && chmod 600 /root/.karsa-db-pass
fi
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='karsa_md'" | grep -q 1 || sudo -u postgres createdb -O karsa karsa_md

langkah "5/9 Mengambil kode dari GitHub"
for pasang in "$REPO_MD $MD" "$REPO_UOD $UOD"; do
  set -- $pasang
  if [ -d "$2/.git" ]; then sudo -u karsa git -C "$2" pull --ff-only; else sudo -u karsa git clone "$1" "$2"; fi
done

langkah "6/9 Pengaturan server (.env)"
ENV=$MD/server/.env
if [ ! -f "$ENV" ]; then
  [ -f /root/.karsa-db-pass ] || { echo "Kata sandi database tidak ditemukan (/root/.karsa-db-pass)."; exit 1; }
  cat > "$ENV" <<EOF
PORT=3001
HOST=127.0.0.1
NODE_ENV=production
DATABASE_URL=postgresql://karsa:$(cat /root/.karsa-db-pass)@localhost:5432/karsa_md
JWT_SECRET=$(openssl rand -hex 32)
REFRESH_TOKEN_SECRET=$(openssl rand -hex 32)
CLIENT_URL=https://pusat.$DOMAIN
DASHBOARD_URL=https://pusat.$DOMAIN
ECOSYSTEM_NAME=Karsa
ECOSYSTEM_NAME_FULL=Karsa Circle
DANA_TENGAH_PER_BULAN=500000
AKSES_DASHBOARD_MIN_ROLE=KOORDINATOR
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
GEMINI_API_KEY=
VOKASI_RAHASIA=
EOF
  chown karsa:karsa "$ENV"; chmod 600 "$ENV"
fi

langkah "7/9 Memasang dependensi, database, dan membangun tampilan"
cd $MD
sudo -u karsa npm run install:all
sudo -u karsa bash -c 'cd server && npx prisma migrate deploy && npx prisma generate'
sudo -u karsa npm run build
cd $UOD
sudo -u karsa npm install
sudo -u karsa npm run build
rsync -a --delete $UOD/dist/ $WEB/dist/
chown -R www-data:www-data $WEB

cat > /etc/systemd/system/karsa-server.service <<EOF
[Unit]
Description=Karsa Circle — server Management Dashboard
After=network.target postgresql.service

[Service]
User=karsa
WorkingDirectory=$MD
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server/src/app.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable karsa-server
systemctl restart karsa-server

langkah "8/9 nginx & firewall"
cat > /etc/nginx/snippets/karsa-headers.conf <<'EOF'
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
EOF
# Konfigurasi nginx hanya ditulis SEKALI: setelah certbot menambah blok HTTPS, menulis ulang akan menghapusnya.
if [ ! -f /etc/nginx/sites-available/karsa ]; then
cat > /etc/nginx/sites-available/karsa <<EOF
# Web pusat — semua permintaan ke Express (yang juga menyajikan client/dist)
server {
    listen 80;
    server_name pusat.$DOMAIN;
    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Unit-Web app;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 120s;
        include /etc/nginx/snippets/karsa-headers.conf;
    }
}
# Web kerja harian — berkas statis; /api diteruskan dengan header slug yang SELALU ditimpa nginx
server {
    listen 80;
    server_name kerja.$DOMAIN;
    root $WEB/dist;
    index index.html;
    client_max_body_size 5m;
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Unit-Web $SLUG;
        proxy_buffering off;
        proxy_read_timeout 3600s;
    }
    location /assets/ { expires 7d; add_header Cache-Control "public"; include /etc/nginx/snippets/karsa-headers.conf; try_files \$uri =404; }
    location / { try_files \$uri /index.html; add_header Cache-Control "no-cache"; include /etc/nginx/snippets/karsa-headers.conf; }
}
# Domain utama → web pusat
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    return 301 https://pusat.$DOMAIN\$request_uri;
}
EOF
fi
ln -sf /etc/nginx/sites-available/karsa /etc/nginx/sites-enabled/karsa
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable

langkah "9/9 HTTPS (gembok)"
if [ -d /etc/letsencrypt/live/pusat.$DOMAIN ]; then
  echo "HTTPS sudah terpasang."
elif [ -n "$EMAIL_SSL" ]; then
  certbot --nginx --non-interactive --agree-tos --redirect -m "$EMAIL_SSL" -d pusat.$DOMAIN -d kerja.$DOMAIN -d $DOMAIN -d www.$DOMAIN \
    || echo "!! HTTPS belum berhasil (DNS mungkin belum menyebar). Ulangi nanti: certbot --nginx --redirect -d pusat.$DOMAIN -d kerja.$DOMAIN -d $DOMAIN -d www.$DOMAIN"
else
  echo "EMAIL_SSL kosong — HTTPS dilewati. Jalankan nanti: certbot --nginx --redirect -d pusat.$DOMAIN -d kerja.$DOMAIN -d $DOMAIN -d www.$DOMAIN"
fi

sleep 2
langkah "SELESAI"
systemctl is-active karsa-server && curl -s -o /dev/null -w "Server menjawab: HTTP %{http_code}\n" http://127.0.0.1:3001/ || true
echo "Web pusat       : http://pusat.$DOMAIN"
echo "Web kerja harian: http://kerja.$DOMAIN"
echo "Langkah berikut : buat akun Super Admin pertama (lihat deploy/PASANG.md)."
