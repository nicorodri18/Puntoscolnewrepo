@echo off
echo ────────────────────────────────────────────
echo 🚀 Instalador automático — Arepabuelas Local
echo ────────────────────────────────────────────
echo.

:: Verificar Node
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ❌ Node.js no encontrado. Instálalo antes de continuar.
  echo 👉 https://nodejs.org/en/download/
  exit /b
) else (
  for /f "delims=" %%v in ('node -v') do echo ✅ Node.js detectado: %%v
)

:: Verificar npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
  echo ❌ npm no encontrado.
  exit /b
) else (
  for /f "delims=" %%v in ('npm -v') do echo ✅ npm detectado: %%v
)

:: Verificar Firebase CLI
where firebase >nul 2>nul
if %errorlevel% neq 0 (
  echo ⚙️ Instalando Firebase CLI globalmente...
  npm install -g firebase-tools
) else (
  for /f "delims=" %%v in ('firebase --version') do echo ✅ Firebase CLI detectada: %%v
)

echo.
echo 📦 Instalando dependencias...
call npm install --legacy-peer-deps

echo.
echo 🧩 Iniciando entorno local (emuladores + Expo)...
call npm run dev:local
pause
