#!/bin/bash
echo "────────────────────────────────────────────"
echo " 🚀 Instalador automático — Arepabuelas Local"
echo "────────────────────────────────────────────"
echo ""

# 1️⃣ Verificar Node
if ! command -v node &> /dev/null
then
    echo "❌ Node.js no encontrado. Instálalo antes de continuar:"
    echo "   👉 https://nodejs.org/en/download/"
    exit 1
else
    echo "✅ Node.js detectado: $(node -v)"
fi

# 2️⃣ Verificar npm
if ! command -v npm &> /dev/null
then
    echo "❌ npm no encontrado. Instálalo con Node.js."
    exit 1
else
    echo "✅ npm detectado: $(npm -v)"
fi

# 3️⃣ Verificar Firebase CLI
if ! command -v firebase &> /dev/null
then
    echo "⚙️  Instalando Firebase CLI globalmente..."
    npm install -g firebase-tools
else
    echo "✅ Firebase CLI detectada: $(firebase --version)"
fi

# 4️⃣ Instalar dependencias del proyecto
echo ""
echo "📦 Instalando dependencias..."
npm install --legacy-peer-deps

# 5️⃣ Iniciar emuladores y Expo
echo ""
echo "🧩 Iniciando entorno local (emuladores + Expo)..."
npm run dev:local
