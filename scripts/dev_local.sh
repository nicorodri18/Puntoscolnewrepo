#!/bin/bash
# 🚀 Script para iniciar entorno local Arepabuelas

echo "🧩 Iniciando Firebase Emulators..."
firebase emulators:start --only auth,firestore,storage &

# Espera unos segundos para que arranquen los emuladores
sleep 8

echo "🌱 Cargando usuarios de prueba..."
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
}'

curl -s -X PATCH "http://127.0.0.1:8085/v1/projects/chat-gpt-e2de9/databases/(default)/documents/users/cliente_local" \
-H "Content-Type: application/json" \
-d '{
  "fields": {
    "approved": { "booleanValue": true },
    "email": { "stringValue": "cliente@gmail.com" },
    "name": { "stringValue": "Cliente de prueba" },
    "points": { "integerValue": 500 },
    "role": { "stringValue": "user" }
  }
}'

echo "✅ Usuarios cargados correctamente."
echo "📱 Iniciando app Expo..."
npx expo start -c
