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

El contenedor `app` arranca frontend y backend juntos. Vite expone el frontend en la red y redirige `/api` y `/uploads` al backend, así que no hace falta editar IPs en `client/.env` ni `server/.env`.

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

## Solución rápida de problemas

- **`failed to connect to the docker API`**: abre Docker Desktop y espera a que indique que el motor está en ejecución; luego repite `docker compose up -d`.
- **El backend no conecta a MySQL**: confirma que `docker compose ps` muestra `media_mysql` en ejecución y que las variables `DB_*` coinciden con las anteriores.
- **Cambiaste `database.sql` y no se refleja**: el script solo se ejecuta cuando se crea el volumen. Para reinicializar la base de datos (esto borra todos los datos locales), ejecuta `docker compose down -v` y después `docker compose up -d`.
- **Fotos HEIC antiguas sin vista previa**: las fotos HEIC subidas antes de existir `previewpath` se ven en baja resolución. Genera sus vistas previas JPEG con `docker compose exec app npm run previews:heic --prefix server` (o `npm run previews:heic --prefix server` fuera de Docker). Se puede repetir sin riesgo.
- **Medias antiguas sin checksum**: para detectar duplicados con Google Drive, las medias subidas antes de existir `checksum_md5` necesitan su MD5. Calcúlalo con `docker compose exec app npm run checksums:backfill --prefix server`. Se puede repetir sin riesgo.
- **El móvil muestra `Load failed`**: si usas Docker, entra siempre por `http://IP_DEL_PC:5173` y evita abrir la URL `localhost` desde el móvil. Si ejecutas fuera de Docker, asegúrate de iniciar Vite con `host: 0.0.0.0`.
