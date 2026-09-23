# Tagged

Guía de instalación y ejecución para el entorno de desarrollo de Tagged.

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y abierto.
- Node.js (se recomienda la versión LTS) y npm solo si vas a ejecutar los servicios fuera de Docker.

El backend incluye `ffmpeg-static`, por lo que no es necesario instalar FFmpeg por separado para el uso habitual.

## 1. Preparar Docker una sola vez

Con Docker Desktop abierto, ejecuta una vez desde la raíz:

```bash
docker compose up -d --build
```

Después, abre [http://localhost:5173](http://localhost:5173). Docker Desktop mostrará el grupo `tagged-gallery-app` con la aplicación, MySQL y phpMyAdmin. Para los siguientes usos, inicia el grupo desde Docker Desktop. Los servicios tienen reinicio automático al arrancar Docker Desktop, salvo si los detuviste manualmente; en ese caso, pulsa **Start** en el grupo.

Si prefieres iniciar el grupo desde la terminal, usa:

```bash
docker compose up -d
```

Esto levanta en contenedores:

- Aplicación completa: [http://localhost:5173](http://localhost:5173)
- API directa: [http://localhost:3000/api/v1](http://localhost:3000/api/v1)
- MySQL: `localhost:3306`
- phpMyAdmin: [http://localhost:8080](http://localhost:8080)

El contenedor `app` arranca frontend y backend juntos. Vite expone el frontend en la red y redirige `/api` al backend (los archivos subidos se sirven con URLs firmadas bajo `/api/v1/files`), así que no hace falta editar IPs en `client/.env` ni `server/.env`.

Los cambios en el código se reflejan automáticamente: Vite actualiza el frontend y nodemon reinicia el backend. Al añadir o cambiar dependencias en `package.json` y `package-lock.json`, reinicia `app` desde Docker Desktop. El arranque detecta el cambio y sincroniza las dependencias con los volúmenes de `node_modules`; no hace falta reconstruir la imagen. Los cambios en `Dockerfile` o `docker-compose.yml` sí requieren `docker compose up -d --build`.

Los archivos subidos se conservan en `server/uploads`, de modo que Docker usa las mismas imágenes, vídeos, miniaturas y avatares que el entorno manual. La base de datos se conserva en el volumen `mysql_data` existente.

Para entrar desde un móvil en la misma Wi-Fi, abre:

```text
Mobile: http://IP_DETECTADA:5173
```

No hay que cambiar `VITE_API_URL` ni `CORS_ORIGIN`; las llamadas usan rutas relativas como `/api/v1`.

## 2. Instalar dependencias para ejecución manual

Desde la raíz del proyecto:

```bash
npm install
npm install --prefix client
npm install --prefix server
```

## 3. Configurar las variables de entorno para ejecución manual

Crea los archivos locales a partir de los ejemplos:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Para conectar el backend con la base de datos del Compose, deja `server/.env` así (mantén o sustituye los secretos JWT antes de producción):

```dotenv
PORT=3000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=3306
DB_NAME=media_app
DB_USER=appuser
DB_PASSWORD=apppassword

JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_in_production
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGIN=http://localhost:5173
```

Para desarrollo manual, configura `client/.env`:

```dotenv
VITE_API_URL=/api/v1
```

## 4. Iniciar la aplicación fuera de Docker

Desde la raíz, inicia backend y frontend en una sola terminal:

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). La API estará disponible por el proxy de Vite en `/api/v1`.

## 5. Configurar Google Drive (opcional)

La pestaña **Google Drive** permite añadir fotos y vídeos de Drive sin copiarlos al servidor. Toda la configuración vive en `server/.env`; el cliente la recibe del backend.

1. **Proyecto.** En [Google Cloud Console](https://console.cloud.google.com/) crea o elige un proyecto. Anota su **número de proyecto** (Panel del proyecto → *Project info*). Es `GOOGLE_APP_ID`.
2. **APIs.** En *APIs & Services → Library* habilita **Google Drive API** y **Google Picker API**.
3. **Pantalla de consentimiento** (*Google Auth Platform*):
   - *Branding*: nombre `Tagged` y email de soporte.
   - *Audience*: tipo **External**.
   - *Data access*: añade los scopes `.../auth/drive.file`, `openid` y `.../auth/userinfo.email`. `drive.file` no es sensible: la app solo ve los archivos que el usuario elige.
   - **Publica la app (*In production*).** En modo *Testing*, Google caduca los refresh tokens a los 7 días y habría que reconectar cada semana. Con solo scopes no sensibles no hace falta verificación.
4. **Cliente OAuth.** En *Clients* (o *Credentials → Create credentials → OAuth client ID*), tipo **Web application**:
   - *Authorized JavaScript origins*: `http://localhost:5173`.
   - *Authorized redirect URIs*: no hace falta ninguno (el flujo usa ventana emergente).
   - Copia el **Client ID** (`GOOGLE_CLIENT_ID`) y el **Client secret** (`GOOGLE_CLIENT_SECRET`).
5. **Clave de API** para el Picker. En *Credentials → Create credentials → API key*, y después edítala:
   - *Application restrictions*: **Websites**, con `http://localhost:5173/*`.
   - *API restrictions*: solo **Google Picker API**.
   - Es `GOOGLE_API_KEY`.
6. **Variables.** Rellena en `server/.env`:

   ```env
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_API_KEY=...
   GOOGLE_APP_ID=...
   GOOGLE_TOKEN_ENCRYPTION_KEY=...
   ```

   Genera la clave de cifrado con `openssl rand -base64 32`. No la cambies después: los tokens guardados dejarían de poder descifrarse y habría que reconectar.
7. **Permiso sobre Drive (opcional).** Por defecto (`GOOGLE_DRIVE_ACCESS=file`) Tagged solo accede a los archivos que eliges, y el selector de Google no muestra miniaturas. Con `GOOGLE_DRIVE_ACCESS=readonly` puede leer todo tu Drive: es un permiso **restringido**, así que añade `.../auth/drive.readonly` en *Acceso a los datos* y deja la app en modo *Prueba* con tus usuarios de prueba (publicarla exigiría la verificación y la auditoría de seguridad de Google). Tras cambiarlo, pulsa **Reconnect** en `/drive`.
8. **Reinicia el backend** (`docker compose restart app`), porque `.env` solo se lee al arrancar.

Limitación: Google solo acepta como orígenes `localhost` o dominios `https`, así que la cuenta se conecta desde `http://localhost:5173` y no desde la IP de la red local. Una vez conectada, se usa desde cualquier dispositivo.

## Solución rápida de problemas

- **`failed to connect to the docker API`**: abre Docker Desktop y espera a que indique que el motor está en ejecución; luego repite `docker compose up -d`.
- **El backend no conecta a MySQL**: confirma que `docker compose ps` muestra `media_mysql` en ejecución y que las variables `DB_*` coinciden con las anteriores.
- **Cambiaste `database.sql` y no se refleja**: el script solo se ejecuta cuando se crea el volumen. Para reinicializar la base de datos (esto borra todos los datos locales), ejecuta `docker compose down -v` y después `docker compose up -d`.
- **Fotos HEIC antiguas sin vista previa**: las fotos HEIC subidas antes de existir `previewpath` se ven en baja resolución. Genera sus vistas previas JPEG con `docker compose exec app npm run previews:heic --prefix server` (o `npm run previews:heic --prefix server` fuera de Docker). Se puede repetir sin riesgo.
- **Medias antiguas sin checksum**: para detectar duplicados con Google Drive, las medias subidas antes de existir `checksum_md5` necesitan su MD5. Calcúlalo con `docker compose exec app npm run checksums:backfill --prefix server`. Se puede repetir sin riesgo.
- **El móvil muestra `Load failed`**: si usas Docker, entra siempre por `http://IP_DEL_PC:5173` y evita abrir la URL `localhost` desde el móvil. Si ejecutas fuera de Docker, asegúrate de iniciar Vite con `host: 0.0.0.0`.
