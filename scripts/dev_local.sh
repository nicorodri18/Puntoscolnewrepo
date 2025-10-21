#!/bin/bash
# 🚀 Script para iniciar entorno local completo

echo "🧩 Iniciando Firebase Emulators..."
firebase emulators:start --only auth,firestore,storage &

# Espera que arranquen
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

echo "✅ Usuarios cargados correctamente."
echo "📱 Iniciando Expo..."
npx expo start -c
