# Tagged

Guía de instalación y ejecución en macOS para el entorno de desarrollo de Tagged.

## Requisitos

- macOS con [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y abierto.
- Node.js (se recomienda la versión LTS) y npm. Compruébalos con `node -v` y `npm -v`.

El backend incluye `ffmpeg-static`, por lo que no es necesario instalar FFmpeg por separado para el uso habitual.

## 1. Instalar dependencias

Desde la raíz del proyecto:

```bash
npm install
npm install --prefix client
npm install --prefix server
```

## 2. Iniciar MySQL y phpMyAdmin con Docker

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

## 3. Configurar las variables de entorno

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

Para desarrollo únicamente en el Mac, configura `client/.env`:

```dotenv
VITE_API_URL=http://localhost:3000/api/v1
```

## 4. Iniciar la aplicación

Desde la raíz, inicia backend y frontend en una sola terminal:

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173). La API estará en `http://localhost:3000/api/v1`.

## Acceso desde un móvil en la misma red

Obtén la IP Wi-Fi del Mac:

```bash
ipconfig getifaddr en0
```

Si el resultado fuera `192.168.1.131`, usa estos valores y reinicia los servidores:

```dotenv
# server/.env
CORS_ORIGIN=http://192.168.1.131:5173
```

```dotenv
# client/.env
VITE_API_URL=http://192.168.1.131:3000/api/v1
```

En dos terminales distintas, inicia el backend y Vite exponiéndolo en la red:

```bash
# Terminal 1
npm run dev:server
```

```bash
# Terminal 2
npm run dev:client -- --host 0.0.0.0 --port 5173 --strictPort
```

Después abre `http://192.168.1.131:5173` desde el móvil. Ambos dispositivos deben estar en la misma red Wi-Fi.

## Solución rápida de problemas

- **`failed to connect to the docker API`**: abre Docker Desktop y espera a que indique que el motor está en ejecución; luego repite `docker compose up -d`.
- **Advertencia sobre `version` en Compose**: no impide el arranque. El campo `version` de `docker-compose.yml` está obsoleto y puede eliminarse cuando se actualice el archivo.
- **El backend no conecta a MySQL**: confirma que `docker compose ps` muestra `media_mysql` en ejecución y que las variables `DB_*` coinciden con las anteriores.
- **Cambiaste `database.sql` y no se refleja**: el script solo se ejecuta cuando se crea el volumen. Para reinicializar la base de datos (esto borra todos los datos locales), ejecuta `docker compose down -v` y después `docker compose up -d`.
- **El móvil muestra `Load failed`**: comprueba que `VITE_API_URL` y `CORS_ORIGIN` usan la IP del Mac, no `localhost`, y reinicia el frontend tras editar `.env`.
