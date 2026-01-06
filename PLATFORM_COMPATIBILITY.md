# Platform Compatibility Guide

## Masalah Build Docker di Platform Berbeda

### Gejala Error
Jika Anda mengalami error seperti ini saat build Docker:

```
ERROR: Could not find a version that satisfies the requirement charset-normalizer<4,>=2 (from requests)
ERROR: No matching distribution found for charset-normalizer<4,>=2
```

### Penyebab
Error ini terjadi karena **perbedaan arsitektur CPU** antara mesin development dan mesin target:

1. **Apple Silicon (M1/M2/M3)** menggunakan arsitektur ARM64
2. **Intel/AMD** menggunakan arsitektur x86_64/amd64

Ketika Docker image di-build di satu platform dan dijalankan di platform lain, pip mungkin tidak dapat menemukan wheel yang kompatibel untuk beberapa package Python.

### Solusi Otomatis (Recommended)

**Setup script ([`setup.sh`](setup.sh:1)) sekarang otomatis mendeteksi arsitektur CPU Anda!**

Ketika Anda menjalankan:
```bash
./setup.sh
```

Script akan:
1. ✅ Mendeteksi OS (Linux/macOS)
2. ✅ Mendeteksi arsitektur CPU (x86_64/ARM64/ARMv7)
3. ✅ Otomatis build dengan platform yang sesuai
4. ✅ Menampilkan informasi platform yang digunakan

**Output contoh:**
```
Step 1/7: Detecting Operating System & Architecture
→  Analyzing system environment...
✓  Detected macOS
→  Detecting CPU architecture...
✓  Architecture: ARM64
ℹ  Docker build platform: linux/arm64
```

### Solusi Manual

Kami juga telah memperbarui [`Dockerfile.backend`](docker/Dockerfile.backend:18) dan [`Dockerfile.worker`](docker/Dockerfile.worker:17) dengan:

```dockerfile
# Upgrade pip to latest version for better platform support
RUN pip install --no-cache-dir --upgrade pip setuptools wheel
```

Ini memastikan pip versi terbaru digunakan, yang memiliki dukungan lebih baik untuk multi-platform.

### Cara Build Manual untuk Platform Spesifik

Jika Anda tidak menggunakan `setup.sh` atau ingin build manual, gunakan perintah berikut:

#### Build untuk x86_64/AMD64 (Intel/AMD):
```bash
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose build
DOCKER_DEFAULT_PLATFORM=linux/amd64 docker compose up -d
```

#### Build untuk ARM64 (Apple Silicon):
```bash
DOCKER_DEFAULT_PLATFORM=linux/arm64 docker compose build
DOCKER_DEFAULT_PLATFORM=linux/arm64 docker compose up -d
```

#### Build dengan flag --platform:
```bash
docker compose build --platform linux/amd64
docker compose up -d
```

#### Build Multi-Platform (Advanced):
```bash
# Install buildx jika belum ada
docker buildx create --use

# Build untuk kedua platform
docker buildx build --platform linux/amd64,linux/arm64 -t credentiallake:latest .
```

### Untuk Pengguna Baru

**Cara termudah:**
```bash
# Clone repository
git clone https://github.com/rdoix/CredentialLake.git
cd CredentialLake

# Jalankan setup script (otomatis mendeteksi platform)
chmod +x setup.sh
./setup.sh
```

Setup script akan otomatis:
- Mendeteksi arsitektur CPU Anda
- Build dengan platform yang sesuai
- Tidak perlu konfigurasi manual!

### Untuk Pengguna yang Sudah Install

Jika Anda sudah punya deployment dan mengalami error:

```bash
# Pull perubahan terbaru
git pull

# Jalankan setup script (akan detect existing deployment)
./setup.sh

# Atau rebuild manual dengan platform detection
DOCKER_DEFAULT_PLATFORM=$(uname -m | sed 's/x86_64/linux\/amd64/;s/aarch64/linux\/arm64/;s/arm64/linux\/arm64/') docker compose up -d --build
```

### Alternatif: Menggunakan Docker Hub

Jika Anda sering berpindah platform, pertimbangkan untuk:

1. Build image di CI/CD pipeline untuk multi-platform
2. Push ke Docker Hub atau registry pribadi
3. Pull image yang sudah di-build dari registry

### Troubleshooting Tambahan

#### 1. Clear Docker Cache
```bash
docker builder prune -a
docker compose build --no-cache
```

#### 2. Update Docker Desktop
Pastikan Docker Desktop Anda versi terbaru yang mendukung multi-platform build.

#### 3. Periksa Arsitektur
```bash
# Cek arsitektur host
uname -m

# Cek arsitektur Docker
docker version --format '{{.Server.Arch}}'
```

#### 4. Verifikasi Requirements
Pastikan semua package di [`requirements.txt`](backend/requirements.txt:1) memiliki wheel untuk platform target:

```bash
# Cek availability untuk platform tertentu
pip download --platform linux_x86_64 --only-binary=:all: -r backend/requirements.txt
```

### Catatan Penting

- **MacBook dengan Apple Silicon**: Secara default akan build untuk ARM64
- **Windows/Linux Intel/AMD**: Secara default akan build untuk x86_64
- Jika Anda share image Docker, pastikan build untuk platform yang sesuai dengan target deployment

### Referensi

- [Docker Multi-platform builds](https://docs.docker.com/build/building/multi-platform/)
- [Python Wheels](https://pythonwheels.com/)
- [Docker Buildx](https://docs.docker.com/buildx/working-with-buildx/)