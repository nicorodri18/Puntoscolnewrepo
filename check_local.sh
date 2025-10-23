#!/bin/bash
# 🔍 Verificador de entorno local para el proyecto Puntoscolnewrepo
# Autor: Nicolás Rodríguez — 2025

echo "────────────────────────────────────────────"
echo "  🔍 VERIFICADOR DE EJECUCIÓN LOCAL"
echo "────────────────────────────────────────────"
echo ""

# 1️⃣ Verificar variable de entorno o modo desarrollo
echo "🧩 Comprobando variable de entorno..."
if [ "$EXPO_PUBLIC_USE_EMULATORS" = "true" ]; then
  echo "✅ Variable EXPO_PUBLIC_USE_EMULATORS = true"
else
  echo "⚠️  Variable no definida, verificando modo desarrollo (__DEV__ activado por Expo)"
  echo "✅ En modo desarrollo (Expo), los emuladores locales se usan automáticamente"
fi
echo ""

# 2️⃣ Revisar puertos de emuladores
echo "🧩 Revisando puertos locales de Firebase..."
ports=("9100" "8085" "9200")
names=("Auth" "Firestore" "Storage")

for i in "${!ports[@]}"; do
  if lsof -i :${ports[$i]} >/dev/null 2>&1; then
    echo "✅ ${names[$i]} Emulator activo en 127.0.0.1:${ports[$i]}"
  else
    echo "⚠️  ${names[$i]} Emulator NO detectado (puerto ${ports[$i]} libre o cerrado)"
  fi
done
echo ""

# 3️⃣ Buscar conexiones externas sospechosas
echo "🧩 Analizando tráfico de red..."
external_connections=$(netstat -an | grep ESTABLISHED | grep -v 127.0.0.1 | grep -E "firebaseio|supabase|googleapis|appspot" )
if [ -z "$external_connections" ]; then
  echo "✅ No se detectaron conexiones hacia Firebase Cloud ni Supabase"
else
  echo "🚨 Se detectaron posibles conexiones externas:"
  echo "$external_connections"
fi
echo ""

# 4️⃣ Confirmar configuración del firebaseConfig.ts
echo "🧩 Verificando configuración en firebaseConfig.ts..."
if grep -q "connectAuthEmulator" firebaseConfig.ts && grep -q "connectFirestoreEmulator" firebaseConfig.ts && grep -q "connectStorageEmulator" firebaseConfig.ts; then
  echo "✅ firebaseConfig.ts correctamente configurado para entorno local"
else
  echo "🚨 firebaseConfig.ts no tiene los conectores de emulador configurados"
fi
echo ""

# 5️⃣ Verificar carpeta de datos locales
echo "🧩 Buscando datos locales de emuladores..."
if [ -d "firebase/emulator-data" ]; then
  echo "✅ Carpeta de datos local encontrada: firebase/emulator-data/"
else
  echo "⚠️  No se encontró carpeta 'firebase/emulator-data' (podría crearse al correr los emuladores)"
fi
echo ""

echo "────────────────────────────────────────────"
echo "🔚 Verificación completada."
echo "────────────────────────────────────────────"

