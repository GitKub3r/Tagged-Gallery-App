# Plan: integración con Google Drive (medias vinculadas, sin copia local)

> Plan vigente. Sustituye a la versión anterior de este documento, que incluía importar copias locales.

## Contexto

Queremos que el usuario conecte su Google Drive desde una **pestaña nueva de la sidebar**, elija fotos y vídeos y los añada a su biblioteca de Tagged. Una vez añadidos, esas medias deben funcionar como cualquier otra: tags, álbumes, favoritos, plantillas, búsqueda, detalle, montaje, descargas y métricas.

**El archivo original no se copia a `server/uploads`.** Tagged guarda una referencia al archivo de Drive y aprovecha lo que Drive ya ofrece:
- sus miniaturas (`thumbnailLink`);
- su checksum MD5, para detectar duplicados;
- su streaming con `Range`, para reproducir vídeo.

Decisiones tomadas con el usuario:
- **Selección con Google Picker** y permiso `drive.file`: la app solo accede a los archivos que el usuario elige, y Google no exige verificación de la app.
- **Duplicados:** un archivo de Drive no se vincula dos veces. Si una media local tiene el mismo MD5, se ofrece convertirla en referencia de Drive, conservando su id, tags, álbumes y favorito, y borrando la copia local.
- Queda fuera el modo "importar copia" y la tabla de jobs del plan anterior.

La API se autentica con un Bearer en la cabecera, que `<img>` y `<video>` no pueden enviar. Por eso todos los archivos, incluidos los de Drive, se sirven mediante **URLs firmadas de corta duración** que genera el backend (fase 0).

---

## Fase 0: archivos privados (hecha)

- `server/uploads` ya no es público. `signUploadUrlsInResponses` (`server/utils/uploadUrls.js`) sustituye en cada respuesta JSON las rutas internas `/uploads/...` de `filepath`, `thumbpath`, `previewpath`, `albumcoverpath`, `albumthumbpath` y `avatar_path` por URLs de `/api/v1/files/...` firmadas con HMAC y con caducidad (franjas de 12 h, al menos 6 h de margen).
- La firma se hace **por ruta de archivo**, no por id de media. Por eso no hacen falta `cover_media_id` ni cambios de serialización en cada servicio.
- Las medias de Drive guardarán en `filepath` una ruta interna propia, y `/api/v1/files` hará de proxy hacia Drive en lugar de leer del disco (hito 4).
- HEIC: el original se conserva y se genera `previewpath` (JPEG de 2560 px). El cliente muestra siempre `previewpath || filepath`.

## Arquitectura

```
Pestaña Drive (React) ──Picker (token de acceso corto, solo drive.file)──> Google
        │ fileIds elegidos
        ▼
apiClient ─> /api/v1/google-drive/*  ─> GoogleDrive.service ─> Drive API (refresh token cifrado)
<img>/<video> ─> /api/v1/files/drive/<mediaId>?exp&sig ─> proxy en streaming con Range desde Drive
Miniatura: se descarga de Drive una sola vez (thumbnailLink=s640) → /uploads/thumbnails/drive-<id>.jpg
```

- **OAuth:** flujo de *authorization code* con Google Identity Services en ventana emergente (`initCodeClient`, `redirect_uri: "postmessage"`). El frontend obtiene un `code` y lo envía al backend, que lo canjea, guarda el refresh token **cifrado** y nunca lo devuelve.
  - No hace falta una ruta de callback ni un `state` propio.
  - Limitación: Google solo acepta como orígenes `localhost` o dominios `https`. La conexión se hace desde `http://localhost:5173`, no desde la IP de la LAN. Una vez conectada, la cuenta funciona desde cualquier dispositivo.
- **Picker:** el backend emite un access token de corta duración con alcance `drive.file` (endpoint `picker-token`). Es la única excepción a "no exponer tokens": nunca se expone el refresh token.
  - El Picker se configura con `setAppId` (número del proyecto de Google Cloud), para que la selección conceda acceso al backend con el mismo cliente.
  - Vista `DocsView` con tipos `image/*,video/*`, multiselección y navegación por carpetas. No se permite seleccionar carpetas: con `drive.file`, elegir una carpeta no da acceso a su contenido.

---

## Base de datos (`database.sql` + `ensure*()` al arrancar)

1. **`media`**: columnas nuevas. Se añaden en `database.sql` y con un `MediaModel.ensureColumns()` idempotente, llamado desde `server/index.js` igual que `TemplateModel.ensureTable()` (`server/models/Template.model.js:26`).
   - `storage_provider ENUM('local','google_drive') NOT NULL DEFAULT 'local'`
   - `storage_status ENUM('available','missing','revoked','error') NOT NULL DEFAULT 'available'`
   - `source_file_id VARCHAR(255) NULL`, `source_mime_type VARCHAR(255) NULL`, `source_modified_time DATETIME NULL`, `last_synced_at DATETIME NULL`
   - `checksum_md5 CHAR(32) NULL`: se calcula para toda subida local nueva y también se guarda el MD5 de Drive.
   - `UNIQUE KEY uq_media_user_source (user_id, storage_provider, source_file_id)` para impedir dobles vinculaciones.
   - `INDEX idx_media_user_checksum (user_id, checksum_md5)`
2. **`google_drive_connections`** (nuevo `GoogleDriveConnection.model.js` con `ensureTable()`): `user_id UNIQUE`, `google_account_email`, `refresh_token_encrypted`, `scopes`, `status ENUM('connected','revoked','error')`, fechas.
3. **Acciones de auditoría** en la tabla `actions`: `GOOGLE_DRIVE_CONNECT`, `GOOGLE_DRIVE_DISCONNECT`, `GOOGLE_DRIVE_LINK`, `GOOGLE_DRIVE_CONVERT`, `GOOGLE_DRIVE_SYNC_ERROR`. Se insertan en `database.sql` y con un `INSERT IGNORE` al arrancar.
4. **Rellenar MD5 de medias locales existentes:** script `server/scripts/backfillMediaChecksums.js`, que calcula el MD5 de cada `uploads/media/<filename>` con `checksum_md5 IS NULL`. Es idempotente y se ejecuta a mano. Documentarlo en el README.

`MediaModel` (todas las `SELECT`, que hoy repiten la lista de columnas en `server/models/Media.model.js:34-150`, y la `create` de la línea 395) pasa a usar una constante `MEDIA_COLUMNS` compartida que incluye los campos nuevos.

---

## Backend

**Dependencias:** `@googleapis/drive` y `google-auth-library` (en `server/`), más ligeras que `googleapis` completo.

**Variables de entorno** (`server/.env.example` y `docker-compose.yml`):
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY`: 32 bytes en base64.
- `MEDIA_URL_SIGNING_SECRET`

El cliente no tiene variables propias: `GET /google-drive/status` le devuelve `clientId`, `apiKey`, `appId` y `scopes` desde `GOOGLE_CLIENT_ID`, `GOOGLE_API_KEY` y `GOOGLE_APP_ID` del servidor.

**Archivos nuevos** (capas y estilo de `Template.*`):
- `server/utils/crypto.js`: `encrypt` y `decrypt` con AES-256-GCM para el refresh token. La firma HMAC de las URLs ya vive en `server/utils/uploadUrls.js` (fase 0).
- `server/models/GoogleDriveConnection.model.js`
- `server/services/GoogleDrive.service.js`:
  - `getDriveClient(userId)`: crea un OAuth2 client con el refresh token descifrado. Si recibe `invalid_grant`, marca la conexión como `revoked`.
  - `connect(code, user)`: canjea el código, lee `about.get(user.emailAddress)`, guarda la conexión y audita.
  - `getStatus`, `disconnect`: `disconnect` revoca el token en Google, borra la conexión y marca las medias de Drive del usuario como `revoked`, sin borrarlas.
  - `getPickerToken(user)`: access token actual (lo renueva si hace falta) y su caducidad.
  - `linkFiles(fileIds, payload, user)`. Máximo 50 ids por petición, igual que `upload/multiple`. Para cada id:
    - Lee con `files.get` los campos `id,name,mimeType,size,md5Checksum,modifiedTime,thumbnailLink,imageMediaMetadata,videoMediaMetadata`.
    - Si el tipo no está soportado, lo marca como omitido.
    - Si ya estaba vinculado, lo marca como `already_linked`.
    - Si hay una media local con el mismo MD5, lo marca como `local_duplicate` con el id de esa media y no lo vincula todavía.
    - Si no, crea la media: `storage_provider='google_drive'`, `filename=name`, `size`, `mediatype` (con `detectMediaType` de `server/utils/media.js`, añadiendo `gif` por mime), `filepath='/uploads/drive/<id>'`, ruta interna virtual que se firma como las demás (se actualiza tras el insert) y la miniatura cacheada.
    - Aplica nombre, autor, tags y favorito (plantilla incluida) con los helpers ya existentes `getOrCreateTagIdsForUser` y `attachTagsToMedia` de `Media.service.js`.
    - Devuelve `{ linked: [], alreadyLinked: [], duplicates: [{ driveFile, media }], skipped: [] }`.
  - `convertLocalToDrive(mediaId, fileId, user)`: comprueba que los MD5 coinciden, actualiza la fila (conserva id, relaciones y portada de álbum), borra el original local, regenera la miniatura desde Drive y audita.
  - `cacheThumbnail(media, driveFile)`: descarga `thumbnailLink` con `=s640` y la autorización, y la convierte con `sharp` a `/uploads/thumbnails/drive-<id>.jpg`. Si Drive aún no tiene miniatura (vídeo recién subido), deja `thumbpath` a null y lo reintenta en la comprobación de estado.
  - `checkHealth(user)`: repasa las medias de Drive del usuario con `files.get`. Un 404 o 403 las marca como `missing`; `invalid_grant`, como `revoked`; si todo va bien, `available`, y reintenta las miniaturas pendientes.
- `server/controllers/GoogleDrive.controller.js` y `server/routes/api/v1/googleDrive.routes.js`. Todas las rutas llevan `authenticate`; se registran en `routes/api/v1/index.js`:
  - `GET /google-drive/status`
  - `POST /google-drive/connect { code }`
  - `POST /google-drive/disconnect`
  - `GET /google-drive/picker-token`
  - `POST /google-drive/link { fileIds, displayname, author, tag_names, is_favourite }`
  - `POST /google-drive/convert { mediaId, fileId }`
  - `POST /google-drive/check`

**Cambios en media existentes:**
- `/api/v1/files` acepta la carpeta virtual `drive/<mediaId>` (`RELATIVE_PATH_PATTERN` en `uploadUrls.js`) y, en lugar de leer del disco, carga la media, comprueba que es de Drive y hace proxy de `files.get({alt:'media'}, {responseType:'stream'})` reenviando `Range`. Responde `206`, `Content-Range`, `Accept-Ranges`, `Content-Length` y `Content-Type`. Si Drive falla, se actualiza `storage_status` y se devuelve 404 o 410.
- `storage_provider`, `storage_status` y `source_file_id` ya se devuelven en todas las consultas (`server/models/mediaColumns.js`). **El frontend sigue leyendo `filepath` y `thumbpath` sin cambios de contrato.**
- `uploadSingle` y `uploadMany`: calculan `checksum_md5` del archivo subido.
- `delete` y `deleteMany` (`Media.service.js:776-858`): con `storage_provider='google_drive'` solo borran la fila y la miniatura cacheada. **Nunca se borra nada en Drive.**
- Álbumes: las portadas de Drive funcionan sin más gracias a `cover_media_id` (fase 0).
- `Metrics.model.js`: los totales se separan en `local_bytes` y `drive_bytes`, y los recuentos por proveedor.

---

## Frontend

Siguiendo `.claude/CLAUDE.md`, `.claude/DESIGN.md` y las skills `migrate-to-axios-query` y `new-frontend-component`.

- **Datos:**
  - `client/src/api/googleDriveApi.js` con `googleDriveQueryKeys` (`status(userId)`) y funciones `getStatus`, `connect`, `disconnect`, `getPickerToken`, `linkFiles`, `convert` y `check`, todas sobre `apiClient`.
  - Hooks en `client/src/hooks/useGoogleDrive.js`: `useGoogleDriveStatus` y mutaciones.
  - Centralizar la query key de la galería (hoy inline en `GalleryPage.jsx:2562`) como `galleryQueryKeys` en `galleryApi.js`, para invalidarla después de vincular o convertir, junto con `metadataQueryKeys.all`.
- **Carga de scripts de Google:** `client/src/utils/loadScript.js` (etiqueta `<script>` con promesa y caché; no usa `fetch`) para `https://accounts.google.com/gsi/client` y `https://apis.google.com/js/api.js` (Picker).
  - `hooks/useGoogleCodeClient.js` abre la ventana emergente y llama a `connect`.
  - `hooks/useDrivePicker.js` pide `picker-token` y abre el Picker; devuelve los documentos elegidos.
- **Pestaña y ruta:**
  - Ítem "Google Drive" en `navItems` (`components/sidebar/Sidebar.jsx:36`) con `faGoogleDrive`. Requiere el paquete oficial `@fortawesome/free-brands-svg-icons`, importando solo ese icono.
  - Ruta `/drive` en `App.jsx` y en `BASIC_ROUTES` y `DEV_ROUTES` de `hooks/useAccessControl.js`.
- **`pages/drivepage/DrivePage.jsx`** (solo composición) con componentes en `pages/drivepage/components/`:
  - Cabecera canónica: eyebrow "Integrations", título "Google Drive" y acción principal. Si no hay conexión, "Connect Google Drive"; si la hay, "Select from Drive".
  - `DriveConnectionCard`: tarjeta de gestión con el estado (cuenta conectada, email, "Check files", "Disconnect" con `DeleteConfirmationModal`, que explica que las medias quedan sin acceso pero no se borran). Muestra `EmptyState` cuando no hay conexión.
  - `DriveSelectionReview`: después del Picker, lista los archivos elegidos (miniatura con el `thumbnailUrl` del Picker, nombre, tamaño con `formatMediaSize`) y el formulario común `MediaMetadataFields` con `TemplateSelector` (`components/media-form-modal/MediaFormModal.jsx`), igual que en la subida. Botón "Add to library". Los lotes se envían de 50 en 50, con progreso mediante `useAppToast`.
  - `DriveLinkResult`: resumen de vinculados, ya existentes y omitidos. Para cada duplicado local muestra la media local y la de Drive con la acción "Use Drive file instead" (llama a `convert`, pasa por el modal de confirmación y explica que se borra la copia local).
  - Resumen: número de medias de Drive y de medias con problemas, con enlace a la galería.
- **Marca de Drive en las medias:**
  - `MediaCard.jsx` y la vista de lista de `GalleryPage`: badge neutro con `faGoogleDrive` cuando `storage_provider === "google_drive"`.
  - Si `storage_status !== "available"`, indicador de estado con icono y texto ("Missing in Drive", "Drive disconnected"). No se comunica solo con color.
- **Detalle** (`MediaDetailPage.jsx`, bloque de metadatos `MediaFileMeta`): "Storage: Google Drive", enlace "Open in Drive" y, si la conexión está revocada, "Reconnect Google Drive" hacia `/drive`.
- **Extensión y descargas:** resueltas en la fase 0. Con `filename` y `apiClient`, las medias de Drive se descargan igual que las locales.
- **Métricas** (`MetricsPage.jsx`): tarjetas de almacenamiento local frente a Drive.
- **Documentación:**
  - `.claude/DESIGN.md`: `faGoogleDrive` en el diccionario de iconos y receta del badge de origen o estado.
  - `.claude/CLAUDE.md`: funcionalidad "Google Drive" en el modelo mental y el mapa.
  - `README.md`: configuración de Google Cloud (APIs Drive y Picker, orígenes JS `http://localhost:5173`, clave de API restringida, número de proyecto) y script de backfill.

---

## Hitos (un commit por cambio lógico)

0. ✅ **Acceso privado a archivos (fase 0).** Commits `d205db8` y `8f01e2c` (preview HEIC).

   Resumen original del hito:
   - a) firma, endpoints `content`/`thumbnail`/`avatar` y serialización en backend;
   - b) `utils/assetUrl.js`, extensión desde `filename` y descargas con `apiClient` en frontend;
   - c) `cover_media_id` en álbumes;
   - d) eliminar `express.static` y el proxy de Vite.

   *La app sigue funcionando igual, pero ningún archivo es accesible sin una URL firmada válida.*
1. ✅ **Base de datos de Drive:** columnas y `ensureColumns`, `MEDIA_COLUMNS`, MD5 en subidas y script de backfill. Este documento sustituye al plan antiguo.
2. ✅ **Conexión OAuth:** utilidades de cifrado, modelo, servicio y rutas `status`/`connect`/`disconnect`; página `/drive` con conectar y desconectar, y la pestaña en la sidebar.
3. ✅ **Picker y vinculación:** `picker-token`, `linkFiles` con miniatura cacheada y deduplicación; `DriveSelectionReview` y `DriveLinkResult`.
4. **Streaming:** proxy de Drive con `Range` en `/content`; detalle, montaje y portadas de álbum con medias de Drive.
5. **Conversión de duplicados locales:** endpoint `convert` y su UI.
6. **Borrado, descargas y métricas:** borrado seguro, migración de descargas a `apiClient` y métricas separadas.
7. **Estado de los archivos:** `check`, badges de estado, reconexión y documentación.

---

## Verificación

- `npm run lint --prefix client` y `npm run build --prefix client` en cada hito. Arrancar el backend con `npm run dev:server` o Docker y comprobar que `ensure*()` migra una base existente sin errores.
- **Fase 0, seguridad:**
  - `curl http://localhost:3000/uploads/media/<archivo>` y `http://localhost:5173/uploads/...` responden 404.
  - `/api/v1/files/...` sin firma, con la firma alterada, caducada o con la firma de otro archivo responde 403.
  - Una URL firmada del usuario A no funciona después de borrar esa media.
  - Un usuario `basic` no puede usar la firma emitida a otro.
  - Un `admin` ve medias y avatares ajenos donde hoy los ve.
- **Fase 0, regresión:**
  - Galería, detalle (imagen, GIF, vídeo con saltos y HEIC), montaje, portadas de álbum (incluido el reencuadre), avatares en cuenta, logs y usuarios, y métricas se ven igual.
  - La descarga individual y en ZIP funciona.
  - Con la pestaña de red se comprueba que las imágenes vienen de la caché al volver a una página.
  - Dejar el detalle abierto con una firma caducada fuerza la renovación y el vídeo continúa.
- **Flujo completo en `http://localhost:5173`:**
  - Conectar la cuenta y comprobar que `status` muestra el email y que ninguna respuesta contiene el refresh token.
  - Abrir el Picker, elegir 2 fotos, 1 GIF, 1 vídeo y 1 HEIC, y aplicar una plantilla con favorito.
  - Las medias aparecen en la galería con badge, tags y favorito; no se crea nada en `server/uploads/media`, solo miniaturas `drive-*.jpg`.
  - El detalle de imagen carga. El vídeo se reproduce y se puede saltar a otro punto (comprobar en la pestaña de red: `206` con `Content-Range`).
  - Añadirlas a un álbum y usarlas como portada.
- **Duplicados:**
  - Volver a elegir los mismos archivos: todos salen como `alreadyLinked`.
  - Subir en local una foto y vincular esa misma foto desde Drive: aparece como duplicado. Al convertirla se conservan id, tags y álbumes, y desaparece el archivo local.
- **Borrado:** borrar una media de Drive la quita de Tagged y el archivo sigue en Drive.
- **Descargas:** ZIP mixto (local y Drive) desde galería y álbum.
- **Fallos:**
  - Borrar el archivo en Drive y pulsar "Check files": la media queda como "Missing in Drive".
  - Revocar el acceso en la cuenta de Google: "Drive disconnected" y enlace para reconectar.
  - Desconectar desde Tagged: las medias se conservan como revocadas.
- **Revisión visual** de `/drive`, la tarjeta con badge y el detalle en modo oscuro y en móvil, tablet, laptop y escritorio (checklist de DESIGN.md §12).
