#!/bin/bash
# 🚀 Script para iniciar entorno local completo con Firebase y Expo

# --- Verificar que Firebase CLI esté instalada ---
if ! command -v firebase &> /dev/null
then
  echo "❌ Firebase CLI no encontrada."
  echo "👉 Ejecuta: npm install -g firebase-tools"
  exit 1
fi

# --- Verificar que Java esté instalado ---
if ! command -v java &> /dev/null
then
  echo "☕ Java no detectado. Instala OpenJDK 17 antes de continuar."
  echo "👉 Ejemplo (Homebrew): brew install openjdk@17"
  exit 1
fi

echo "🧩 Iniciando Firebase Emulators (Auth, Firestore, Storage)..."
firebase emulators:start --import=./emulator-data --export-on-exit --only auth,firestore,storage &

# Esperar unos segundos a que levanten los emuladores
sleep 10

echo "🌱 Creando usuarios de prueba (Auth)..."

# --- Crear usuario administrador ---
curl -s -X POST "http://127.0.0.1:9100/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gmail.com","password":"adminpass","returnSecureToken":true}' > /dev/null

# --- Crear usuario cliente ---
curl -s -X POST "http://127.0.0.1:9100/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key" \
  -H "Content-Type: application/json" \
  -d '{"email":"cliente@gmail.com","password":"clientepass","returnSecureToken":true}' > /dev/null

echo "🗄️ Agregando documentos en Firestore..."

# --- Crear documento del administrador ---
curl -s -X PATCH "http://127.0.0.1:8085/v1/projects/chat-gpt-e2de9/databases/(default)/documents/users/admin_local" \
-H "Content-Type: application/json" \
-d '{
  "fields": {
    "approved": { "booleanValue": true },
    "email": { "stringValue": "admin@gmail.com" },
    "name": { "stringValue": "Administrador local" },
    "points": { "integerValue": 9999 },
    "role": { "stringValue": "admin" }
  }
}' > /dev/null

# --- Crear documento del cliente ---
curl -s -X PATCH "http://127.0.0.1:8085/v1/projects/chat-gpt-e2de9/databases/(default)/documents/users/cliente_local" \
-H "Content-Type: application/json" \
-d '{
  "fields": {
    "approved": { "booleanValue": true },
    "email": { "stringValue": "cliente@gmail.com" },
    "name": { "stringValue": "Cliente local" },
    "points": { "integerValue": 500 },
    "role": { "stringValue": "user" }
  }
}' > /dev/null

# --- Crear productos predeterminados ---
echo "🛒 Cargando productos predeterminados..."

curl -s -X PATCH "http://127.0.0.1:8085/v1/projects/chat-gpt-e2de9/databases/(default)/documents/products/arepa_clasica" \
-H "Content-Type: application/json" \
-d '{
  "fields": {
    "name": { "stringValue": "Arepa Clásica" },
    "price": { "integerValue": 8000 },
    "category": { "stringValue": "Comida" },
    "available": { "booleanValue": true },
    "description": { "stringValue": "Arepa tradicional con queso y mantequilla." }
  }
}' > /dev/null

curl -s -X PATCH "http://127.0.0.1:8085/v1/projects/chat-gpt-e2de9/databases/(default)/documents/products/empanada_carne" \
-H "Content-Type: application/json" \
-d '{
  "fields": {
    "name": { "stringValue": "Empanada de Carne" },
    "price": { "integerValue": 2500 },
    "category": { "stringValue": "Comida" },
    "available": { "booleanValue": true },
    "description": { "stringValue": "Empanada artesanal rellena de carne sazonada." }
  }
}' > /dev/null

curl -s -X PATCH "http://127.0.0.1:8085/v1/projects/chat-gpt-e2de9/databases/(default)/documents/products/jugo_naranja" \
-H "Content-Type: application/json" \
-d '{
  "fields": {
    "name": { "stringValue": "Jugo de Naranja" },
    "price": { "integerValue": 4000 },
    "category": { "stringValue": "Bebidas" },
    "available": { "booleanValue": true },
    "description": { "stringValue": "Jugo natural de naranja recién exprimido." }
  }
}' > /dev/null

echo "✅ Usuarios y productos locales cargados correctamente."
echo "📱 Iniciando Expo (modo local)..."
npx expo start -c
