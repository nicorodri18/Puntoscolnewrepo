# Proyecto: Arepabuelas de la Esquina  



---

## Descripción General
Este proyecto representa la digitalización del negocio tradicional **"Arepabuelas de la Esquina"**, buscando ofrecer una experiencia de comercio electrónico completamente segura, local y sin dependencia de servicios en la nube.  

El sistema fue diseñado para que tanto el **entorno de desarrollo** como el de **demostración en máquinas virtuales** funcionen **100 % de manera local** utilizando **Firebase Emulators** (Auth, Firestore y Storage), sin enviar información ni tráfico a servidores externos.

---

## Objetivo del Sistema
Desarrollar un **e-commerce seguro y funcional** que permita:

1. Registro y autenticación de usuarios con nombre, correo, contraseña y foto.  
2. Validación manual de usuarios por parte del administrador antes de otorgar acceso.  
3. Gestión de productos (creación, eliminación, actualización e imágenes de referencia).  
4. Visualización de lista de productos, detalle, precio y comentarios.  
5. Emisión y manejo de cupones de descuento (incluido uno de bienvenida).  
6. Simulación de compras y almacenamiento de historial por usuario.  
7. Simulación de pagos con tarjeta de crédito (sin usar datos reales).  
8. Total independencia de servicios cloud: todos los datos y procesos se ejecutan localmente.

---

## Arquitectura Técnica

### Componentes principales

| Componente | Descripción |
|-------------|--------------|
| **Frontend (Expo/React Native Web)** | Interfaz del e-commerce para clientes y administradores. Puede ejecutarse como app móvil (Expo Go) o build web estática. |
| **Firebase Emulators** | Simulan los servicios de Firebase Auth, Firestore y Storage en el entorno local. Todos los datos se almacenan dentro del equipo, sin salir a Internet. |
| **Configuración Local (`firebaseConfig.ts`)** | Conecta la app a los emuladores mediante `connectAuthEmulator`, `connectFirestoreEmulator` y `connectStorageEmulator`. |
| **Scripts de desarrollo** | Automatizan el inicio de los emuladores y la carga de datos de prueba (usuarios, productos, cupones). |
| **Verificador de entorno local (`check_local.sh`)** | Confirma que el sistema se ejecuta en modo totalmente local, verificando puertos, tráfico y configuración. |

---

## Ejecución Local (modo desarrollo)

### Requisitos
- macOS, Linux o Windows con soporte para **Node.js 18+**
- **npm** o **yarn**
- **Firebase CLI** (`npm install -g firebase-tools`)
- **Expo CLI** (`npm install -g expo-cli`)

### Comandos básicos

1. **Instalar dependencias:**
   ```bash
   npm install


  ## 2 Iniciar los emuladores y la app local:
  npm run dev:local

  Este script ejecuta:
	•	Los emuladores de Firebase (Auth, Firestore, Storage).
	•	La carga automática de usuarios y datos de prueba.
	•	El inicio del entorno Expo en modo desarrollo.

  ## Verificar que todo está local:
  ./check_local.sh


  •	Que los puertos 9100, 8085 y 9200 estén activos en 127.0.0.1.
	•	Que no existan conexiones hacia Firebase Cloud ni Supabase.
	•	Que firebaseConfig.ts esté configurado correctamente para emuladores.


# Estructura del Proyecto

Puntoscolnewrepo/
├── app/                       # Pantallas principales (Admin, Cliente, Login)
├── assets/                    # Imágenes, íconos y recursos estáticos
├── firebaseConfig.ts          # Configuración local de Firebase
├── firebase.json              # Configuración de los emuladores
├── firebase/                  # Carpeta con datos exportados del emulador
├── scripts/                   # Scripts automatizados (setup, check_local, etc.)
├── package.json               # Scripts npm y dependencias
└── README.md                  # Este documento



## Variables de Entorno

| Variable | Descripción | Valor por defecto |
|-----------|--------------|------------------|
| `EXPO_PUBLIC_USE_EMULATORS` | Indica si la app debe usar emuladores locales | `true` |
| `NODE_ENV` | Define el modo de ejecución (`development` o `production`) | `development` |

---

## Funcionalidades Principales

### Administrador
- Validar nuevos usuarios (aprobado / pendiente).  
- Crear, editar y eliminar productos.  
- Asignar puntos manualmente a usuarios.  
- Crear y administrar cupones de descuento.

### Usuario
- Registrarse y esperar aprobación del administrador.  
- Navegar productos y ver detalles.  
- Aplicar cupones de descuento.  
- Simular pagos con tarjeta (sin conexión real).  
- Consultar historial de compras.

---

## Persistencia de Datos
Los datos se guardan localmente en los emuladores:

| Servicio | Propósito |
|-----------|------------|
| **Firestore Emulator** | Base de datos de usuarios, productos, cupones e historial de compras. |
| **Auth Emulator** | Manejo de credenciales y aprobación de usuarios. |
| **Storage Emulator** | Almacenamiento de imágenes de productos. |

Para conservar los datos entre sesiones, el directorio `firebase/emulator-data` actúa como volumen local.  
Si no existe, se genera automáticamente al ejecutar por primera vez.

---

## Seguridad y Buenas Prácticas Implementadas

1. Autenticación controlada con aprobación del administrador.  
2. Validación estricta de formularios y entradas del usuario.  
3. Simulación segura de transacciones sin almacenar datos reales.  
4. Deshabilitación completa de conexiones hacia servicios externos.  
5. Comunicación interna mediante los emuladores locales.  
6. Verificador de ejecución local para auditorías de seguridad.

---

## Virtualización y Entregas

El proyecto puede ejecutarse de las siguientes formas:

1. **Modo Local (actual):**
   - Se ejecuta mediante `npm run dev:local`.
   - Todos los servicios y datos se alojan en el entorno local.

2. **Modo Contenerizado (en desarrollo):**
   - El proyecto podrá empaquetarse con **Docker Compose** para facilitar la ejecución en máquinas virtuales de cualquier compañero o profesor sin instalación manual.  
   - Este modo incluirá imágenes multi-arquitectura compatibles con Intel y Apple Silicon (M1/M2).

---

---

## Próximos pasos (para documentación futura)
- Agregar instrucciones completas para empaquetar y distribuir el entorno mediante Docker.  
- Incluir el script `run_local.sh` y archivos `Dockerfile` dentro del repositorio.  
- Exportar datos iniciales de los emuladores (`firebase emulators:export firebase/emulator-data`) para asegurar la reproducción exacta en cada VM.

   
