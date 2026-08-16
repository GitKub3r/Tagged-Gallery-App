# Tagged

Guía de instalación y ejecución para el entorno de desarrollo de Tagged.

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y abierto.
- Node.js (se recomienda la versión LTS) y npm solo si vas a ejecutar los servicios fuera de Docker.

El backend incluye `ffmpeg-static`, por lo que no es necesario instalar FFmpeg por separado para el uso habitual.

## 1. Iniciar todo con Docker

Con Docker Desktop ya iniciado, ejecuta desde la raíz:

```bash
npm run docker:up
```

El comando detecta la IPv4 LAN del PC, levanta Docker y muestra la URL exacta para abrir desde el móvil.

También puedes usar Compose directamente:

```bash
docker compose up -d --build
docker compose ps
```

Esto levanta en contenedores:

- Aplicación completa: [http://localhost:5173](http://localhost:5173)
- API directa: [http://localhost:3000/api/v1](http://localhost:3000/api/v1)
- MySQL: `localhost:3306`
- phpMyAdmin: [http://localhost:8080](http://localhost:8080)

El contenedor `app` arranca frontend y backend juntos. Vite expone el frontend en la red y redirige `/api` y `/uploads` al backend, así que no hace falta editar IPs en `client/.env` ni `server/.env`.

Los archivos subidos se montan desde `server/uploads`, de modo que Docker usa las mismas imágenes, vídeos, miniaturas y avatares que el entorno manual.

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

## 3. Iniciar solo MySQL y phpMyAdmin con Docker

Con Docker Desktop ya iniciado, ejecuta:

```bash
docker compose up -d
docker compose ps
```

El primer inicio descarga las imágenes y crea el volumen de MySQL. El archivo `database.sql` se importa automáticamente al crear ese volumen por primera vez.

Servicios disponibles:

- MySQL: `localhost:3306`
- phpMyAdmin: [http://localhost:8080](http://localhost:8080)

En phpMyAdmin usa `mysql` como servidor y las credenciales definidas en `docker-compose.yml`:

```text
Usuario: appuser
Contraseña: apppassword
Base de datos: media_app
```

> En equipos Apple Silicon puede aparecer un aviso de que phpMyAdmin usa `linux/amd64` mientras el equipo es `arm64`. Docker Desktop lo ejecuta mediante emulación y el servicio sigue siendo utilizable.

## 4. Configurar las variables de entorno para ejecución manual

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

## 5. Iniciar la aplicación fuera de Docker

Desde la raíz, inicia backend y frontend en una sola terminal:

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). La API estará disponible por el proxy de Vite en `/api/v1`.

## Solución rápida de problemas

- **`failed to connect to the docker API`**: abre Docker Desktop y espera a que indique que el motor está en ejecución; luego repite `docker compose up -d`.
- **Advertencia sobre `version` en Compose**: no impide el arranque. El campo `version` de `docker-compose.yml` está obsoleto y puede eliminarse cuando se actualice el archivo.
- **El backend no conecta a MySQL**: confirma que `docker compose ps` muestra `media_mysql` en ejecución y que las variables `DB_*` coinciden con las anteriores.
- **Cambiaste `database.sql` y no se refleja**: el script solo se ejecuta cuando se crea el volumen. Para reinicializar la base de datos (esto borra todos los datos locales), ejecuta `docker compose down -v` y después `docker compose up -d`.
- **El móvil muestra `Load failed`**: si usas Docker, entra siempre por `http://IP_DEL_PC:5173` y evita abrir la URL `localhost` desde el móvil. Si ejecutas fuera de Docker, asegúrate de iniciar Vite con `host: 0.0.0.0`.
