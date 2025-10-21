#!/bin/bash
# Inicializa usuarios del emulador Firestore local

echo "🌱 Creando usuario cliente..."
curl -s -X PATCH "http://127.0.0.1:8085/v1/projects/chat-gpt-e2de9/databases/(default)/documents/users/aMde009vFSkF2ehY9U7loevbzSRt" \
-H "Content-Type: application/json" \
-d '{
  "fields": {
    "approved": { "booleanValue": true },
    "email": { "stringValue": "cliente@gmail.com" },
    "name": { "stringValue": "cliente" },
    "points": { "integerValue": 500 },
    "role": { "stringValue": "user" }
  }
}'

echo "🌱 Creando usuario administrador..."
curl -s -X PATCH "http://127.0.0.1:8085/v1/projects/chat-gpt-e2de9/databases/(default)/documents/users/fnAwRQfmRkZrSzUWmQwlWU8VxVis" \
-H "Content-Type: application/json" \
-d '{
  "fields": {
    "approved": { "booleanValue": true },
    "email": { "stringValue": "admin@gmail.com" },
    "name": { "stringValue": "Administrador" },
    "points": { "integerValue": 9999 },
    "role": { "stringValue": "admin" }
  }
}'

echo "✅ Usuarios cargados correctamente en Firestore Emulator."
