# Tagged: contexto del proyecto y normas de desarrollo

Este archivo (`.claude/CLAUDE.md`) sustituye al antiguo `AGENTS.md` de Codex. Las skills del proyecto viven en `.claude/skills/`. Sirve para entender el producto antes de modificarlo. El contexto funcional y las normas técnicas se aplican a todo el repositorio. Las reglas de frontend son obligatorias para cada cambio nuevo y para toda refactorización.

## Visión general del producto

### Qué es Tagged

Tagged es una aplicación web para construir y mantener una biblioteca personal de imágenes, GIFs y vídeos. Permite subir archivos, describirlos, encontrarlos de nuevo y agruparlos sin depender de la estructura de carpetas del sistema operativo. Cada usuario trabaja con su propia biblioteca y sus propios datos.

La unidad principal es la **media**: el archivo original, su miniatura y los datos que permiten reconocerlo y recuperarlo. El nombre visible de la media, el autor y las tags son datos de la biblioteca; no dependen del nombre físico del archivo. La galería reúne esas medias y sirve como punto de partida para explorarlas, editarlas y organizarlas.

### Por qué existe

Una colección de archivos pierde utilidad cuando solo se puede recorrer visualmente o recordar por su nombre de archivo. Tagged convierte esa colección en una biblioteca consultable. Su propósito es que subir material sea sencillo y que encontrarlo meses después también lo sea. La información introducida al subir o editar una media debe tener un efecto claro en la búsqueda, el filtrado y la organización.

La aplicación reúne en un mismo lugar el material, sus descripciones, las agrupaciones y las acciones habituales. El usuario debe poder pasar de una vista general a una media concreta, identificarla, modificarla y volver al contexto anterior sin perderse.

### Núcleo y modelo mental

- **Media:** imagen, GIF o vídeo perteneciente a un usuario. Tiene archivo original, vista previa, tipo, nombre visible, autor, tags y estado de favorito.
- **Tags:** vocabulario reutilizable del usuario. Una tag guardada puede tener color y tipo, incluido el tipo de copyright. Una tag nueva introducida en una media usa el estilo por defecto hasta que tenga una definición propia. Las tags permiten describir y filtrar contenido.
- **Favoritos:** marca de cada media para acceder rápidamente a una selección personal. Es independiente de los álbumes y de las tags.
- **Álbumes:** colecciones de referencias a medias de la biblioteca. Permiten reunir y ordenar material; quitar una media de un álbum no elimina su archivo de la galería.
- **Plantillas:** conjuntos reutilizables de nombre de media, autor y tags. También pueden indicar que la media se marque como favorita. Al aplicar una plantilla durante una subida o edición, sus valores sirven de base para ese formulario. Los cambios posteriores del formulario no modifican la plantilla guardada.
- **Metadatos gestionables:** nombres de media, autores y tags disponibles para reutilizar. Las sugerencias de los formularios ayudan a mantener consistencia en la biblioteca.

Estas piezas se complementan. Una media puede tener varias tags, aparecer en varios álbumes y ser favorita a la vez. La plantilla acelera la entrada de datos; la galería, los filtros, los álbumes y los favoritos permiten recuperar y recorrer el material después.

### Recorrido principal del usuario

1. El usuario entra en su cuenta y abre su biblioteca.
2. Sube una o varias imágenes o vídeos. Puede asignar nombre, autor y tags, y partir de una plantilla.
3. La aplicación guarda el archivo y genera una vista previa para navegar la colección.
4. En la galería, el usuario busca y filtra por los datos disponibles, cambia de vista y abre una media para verla con detalle.
5. Puede corregir sus datos, editar varias medias, marcar favoritos, descargar archivos o agrupar medias en álbumes.
6. Gestiona tags, autores, nombres y plantillas para que las siguientes subidas requieran menos trabajo y mantengan el mismo vocabulario.

### Funcionalidades actuales

- **Galería y detalle:** exploración de medias, vistas de tarjetas o lista, búsqueda, filtros, paginación, selección múltiple, edición, borrado y descarga. La vista de detalle permite recorrer y examinar una media.
- **Subida individual y múltiple:** archivos de imagen y vídeo con metadatos compartidos, sugerencias y plantillas; generación de miniaturas en el backend.
- **Organización:** favoritos, álbumes, portada y orden de medias en álbumes, además de filtros basados en tags.
- **Papelera:** las medias borradas pasan 30 días en `/trash`, desde donde se restauran (vuelven a sus álbumes) o se borran definitivamente.
- **Gestión de metadatos:** mantenimiento de nombres, autores y tags; color y tipo para tags.
- **Plantillas:** crear, buscar, editar, eliminar y aplicar datos reutilizables. La opción de favorito se aplica al guardar las medias que usan esa plantilla.
- **Panel de datos:** métricas y gráficos sobre la biblioteca, como actividad de subidas, tipos de media, autores y tags.
- **Cuenta y administración:** sesión y ajustes de cuenta. Según el rol, hay pantallas de usuarios, registros y acciones administrativas. Los permisos reales deben comprobarse en el backend.

### Esencia y decisiones de producto

- La media y su recuperación posterior son el centro de la experiencia. Cada pantalla debe ayudar a identificar, encontrar o organizar material con pocos pasos.
- Los metadatos son útiles cuando se mantienen coherentes. Reutilizar sugerencias, tags y plantillas debe ser más fácil que volver a escribir la misma información.
- Las acciones sobre una colección deben ser previsibles: editar una media no cambia una plantilla; quitar una media de un álbum conserva el archivo; aplicar una plantilla no impide ajustar sus valores antes de guardar.
- La interfaz debe dar contexto sobre qué media o conjunto se está modificando y comunicar el resultado de cada acción.
- La biblioteca debe resultar cómoda tanto para una colección pequeña como para muchas medias, en escritorio, tablet y móvil.
- El carácter visual de la app lo aporta el contenido del usuario. La interfaz debe ser sobria y dejar protagonismo a las imágenes y vídeos.

## Stack tecnológico

- **Frontend (`client/`):** React 19, Vite 7, React Router 7, Tailwind CSS 4 (plugin `@tailwindcss/vite`, sin `tailwind.config`; tokens en CSS), Axios, TanStack React Query 5, Font Awesome (`free-solid` y `free-regular` con `react-fontawesome`), Sonner (toasts), Recharts (gráficos), `react-selecto` (selección con marquesina), JSZip y `heic2any`. JavaScript con JSX; no hay TypeScript.
- **Backend (`server/`):** Node 22, Express 4 en CommonJS (`require`), MySQL con `mysql2`, JWT (acceso + refresh) con `bcrypt`, `multer` para subidas, `sharp`, `heic-convert` y `ffmpeg-static`/`fluent-ffmpeg` para miniaturas.
- **Infraestructura:** Docker Compose (app + MySQL + phpMyAdmin). Vite hace proxy de `/api` y `/uploads` al backend (puerto 3000); el frontend usa `VITE_API_URL=/api/v1`.
- **Calidad:** ESLint 9 en el cliente (`npm run lint --prefix client`) y `npm run build --prefix client`. No hay suite de pruebas automatizadas; verificar a mano y con lint/build.
- **Comandos útiles:** `npm run dev` (cliente y servidor), `npm run dev:client`, `npm run dev:server`, `docker compose up -d`.

## Mapa técnico del repositorio

- `client/`: frontend con React, Vite, React Router y Tailwind. Las pantallas están en `client/src/pages/`; los controles reutilizables, en `client/src/components/`.
- `client/src/api/` y `client/src/hooks/`: operaciones de API, configuración compartida, query keys y acceso a datos del frontend. Parte del código antiguo aún está en migración hacia Axios y TanStack React Query; seguir las reglas de migración de este documento.
- `server/`: API Express. Las rutas delegan en controladores, servicios y modelos. Los servicios validan y aplican reglas de negocio; los modelos ejecutan consultas SQL.
- `database.sql`: esquema inicial MySQL. Comprobar también cómo llegan los cambios de esquema a bases de datos ya creadas: el script inicial de Docker no se vuelve a ejecutar sobre un volumen existente.
- `server/uploads/`: archivos originales y miniaturas persistentes. La base de datos conserva sus rutas y relaciones.
- `docker-compose.yml`, `Dockerfile` y `scripts/`: entorno local con aplicación, MySQL y phpMyAdmin. El contenedor de la app ejecuta frontend y backend con recarga durante el desarrollo. `README.md` contiene los pasos de arranque y los puertos.

## Patrones de desarrollo

Estas reglas se aplican a todo el repositorio. Son obligatorias para cualquier cambio nuevo y para toda refactorización del frontend.

### Prioridad principal: consistencia y reutilización

- La consistencia visual y de código tiene prioridad sobre introducir variantes nuevas.
- Antes de crear un componente, hook, utilidad, patrón, clase o estilo, buscar si ya existe uno equivalente.
- Si existe, reutilizarlo. Si casi encaja, ampliarlo mediante props sencillas en vez de duplicarlo.
- Extraer un componente React cuando una misma estructura o comportamiento aparezca dos veces, o cuando sea evidente que se repetirá.
- Mantener los componentes pequeños, legibles y fáciles de mantener. No crear abstracciones complejas para casos hipotéticos.
- Una misma acción debe tener el mismo aspecto, icono, texto, estado y comportamiento en toda la aplicación.
- No copiar y pegar bloques de UI ni lógica que puedan compartirse.
- Seguir las convenciones ya adoptadas en el código nuevo. No introducir una segunda forma de resolver el mismo problema sin sustituir la anterior.

### Componentes y estructura React

- Priorizar componentes compartidos para botones, campos, modales, tarjetas, badges, estados vacíos, loaders, tooltips y controles repetidos.
- Se valora positivamente usar librerías externas de React, maduras y mantenidas, para componentes comunes como toasts, diálogos, tarjetas, tooltips o controles accesibles. El objetivo es reducir código propio y mantenimiento.
- Antes de instalar una librería, comprobar que encaja con React, Tailwind, el modo oscuro, la accesibilidad y el sistema visual existente.
- No añadir varias librerías que resuelvan el mismo problema. Una vez elegida una solución, reutilizarla en toda la aplicación.
- Personalizar los componentes externos mediante una capa compartida para que respeten la paleta, `rounded-xl`, estados y convenciones del proyecto. No consumirlos con estilos distintos directamente desde cada página.
- No desarrollar desde cero un componente común si una dependencia ya instalada lo resuelve correctamente y con menos mantenimiento.
- Las variantes de un componente deben ser explícitas y limitadas. No aceptar clases arbitrarias como sustituto de una API coherente.
- Separar la lógica reutilizable en hooks o utilidades cuando se repita, sin fragmentar código trivial.
- Mantener las páginas centradas en composición y obtención de datos; mover UI repetida a componentes.
- Conservar el comportamiento, permisos y accesibilidad durante el rediseño salvo que la tarea indique un cambio funcional.

### Comunicación con el backend y estado remoto

- Está prohibido usar `fetch` en cualquier parte de la aplicación, tanto directamente como envuelto en utilidades propias.
- Axios es el único cliente HTTP permitido.
- TanStack React Query es obligatorio para consultas, mutaciones, caché, reintentos, invalidaciones y estados de carga o error del servidor.
- Centralizar la configuración de Axios en un único cliente compartido: URL base, cabeceras, autenticación, interceptores, normalización de errores y cancelación.
- No crear instancias de Axios dentro de páginas, componentes o hooks concretos.
- Encapsular cada operación remota en funciones de API reutilizables y consumirlas mediante hooks de React Query.
- Centralizar y reutilizar las query keys. No escribir claves equivalentes de formas distintas.
- Tras una mutación, actualizar o invalidar únicamente las consultas afectadas. No recargar la página ni duplicar manualmente el estado remoto en estado local.
- No usar `useEffect` para solicitar datos al backend. Tampoco replicar en `useState` datos que pertenecen a la caché de React Query.
- Mantener estados locales solo para estado de interfaz o formularios que no representen directamente datos remotos.
- La migración desde el sistema actual afecta a toda la app y debe hacerse con especial cuidado. Antes de cambiar una operación, identificar todos sus consumidores, permisos, estados de carga, errores, efectos secundarios e invalidaciones.
- Migrar por flujos funcionales completos. Un flujo migrado no puede mezclar `fetch` con Axios ni peticiones manuales con React Query.
- Conservar durante la migración los contratos del backend y el comportamiento visible, salvo que la tarea indique expresamente lo contrario.
- El objetivo final es que no quede ningún uso de `fetch` ni ninguna gestión manual de estado remoto en toda la aplicación.

### Estructura y convenciones reales del código

**Frontend**

- Páginas en `client/src/pages/<nombre>page/<Nombre>Page.jsx`; componentes específicos de una página en `pages/<nombre>page/components/`. Componentes compartidos en `client/src/components/<kebab-case>/<PascalCase>.jsx`.
- Rutas declaradas en `App.jsx`; las protegidas cuelgan de `ProtectedLayout`. El control de acceso por rol está en `hooks/useAccessControl.js` (roles `admin`, `basic`, `dev`); el backend sigue siendo la autoridad real.
- Cliente HTTP único: `api/apiClient.js` (instancia Axios con token, refresh automático en 401 y toast de error; se desactiva por petición con `_skipErrorToast` / `_skipAuth`).
- Un archivo por dominio en `api/` (`galleryApi.js`, `templateApi.js`, `metadataApi.js`...) con el patrón `xxxApi = { async getAll() {...} }`, un helper `unwrap(response)` que valida `{ success, data, message }` y un objeto `xxxQueryKeys` exportado (`all`, `forUser(userId)`). Es el modelo a copiar (ver `templateApi.js` y `hooks/useTemplates.js`).
- Hooks de datos en `hooks/` envuelven `useQuery`/`useMutation`, con `enabled` según usuario y token. Contextos en `context/` (auth, filtro de tags, vista de rejilla, herramientas dev).
- Utilidades puras en `utils/` (estilo e icono de tag, formato de media, filtros por facetas, plantillas, descargas).
- Componentes con `export const Nombre = (...) =>` (exportación con nombre, funciones flecha), indentación de 4 espacios y comillas dobles. Modales con `createPortal`, `role="dialog"`, `aria-modal`, `aria-labelledby` y cierre con Escape (ver `MediaFormModal`).
- Idioma: el código, los identificadores y los textos de la interfaz están en **inglés** (etiquetas, toasts, placeholders). Documentación, README y comentarios de servidor están en español.

**Backend**

- Capas: `routes/api/v1/*.routes.js` → `controllers/*.controller.js` → `services/*.service.js` → `models/*.model.js`. Nombres en PascalCase con sufijo de capa. Clases con métodos estáticos.
- Respuesta uniforme: `{ success: true, data }` o `{ success: false, message }`. Los servicios devuelven `{ data }` o `{ error, status }` y el controlador lo traduce (`sendResult`). Un `handleError` por controlador para errores inesperados (`ER_DUP_ENTRY` → 409).
- Las rutas se protegen con `authenticate` (`middlewares/auth.middleware.js`); cada consulta se filtra por `req.user.id`, salvo lo permitido a `admin`. Los eventos relevantes se registran con `AuditService`.
- Cambios de esquema: además de `database.sql`, los modelos nuevos exponen `ensureTable()` (creación y `ALTER TABLE` idempotentes) que `server/index.js` ejecuta al arrancar, para que las bases ya creadas se actualicen.
- **Archivos privados:** `server/uploads` no es público. La base de datos guarda rutas internas `/uploads/...`, y el middleware `signUploadUrlsInResponses` (`server/utils/uploadUrls.js`) las sustituye en cada respuesta JSON por URLs firmadas y con caducidad de `/api/v1/files/...`. Solo se firman las claves `filepath`, `thumbpath`, `previewpath`, `albumcoverpath`, `albumthumbpath` y `avatar_path`. Un campo nuevo con ruta de archivo se añade a esa lista; nunca se vuelve a exponer `/uploads` con `express.static`. Una respuesta solo debe incluir rutas de archivos a los que el usuario tiene acceso.
- **Papelera:** borrar una media la envía a la papelera (`media.deleted_at`); sus archivos, tags y álbumes se conservan 30 días y después `TrashService` la borra definitivamente (al arrancar y cada hora). **Toda consulta nueva sobre `media` debe filtrar `deleted_at IS NULL`** salvo las de la propia papelera; en álbumes, las medias de la papelera se ocultan (también como portada) y conservan su posición. El borrado definitivo pasa siempre por `TrashService.purgeMedia`.
- **Tag de sistema "Google Drive":** toda media de Drive la lleva (`server/utils/driveTag.js`, `DRIVE_TAG_NAME`). El backend la añade al vincular, la conserva en cada edición, la quita si se intenta poner a una media local e impide renombrarla o borrarla. En el cliente se muestra bloqueada (`lockedTags`).
- **HEIC/HEIF:** se conserva el original (`filepath`, solo para descargar) y en la subida se genera un JPEG de visualización (`previewpath`, lado largo de 2560 px) en `uploads/previews/`. Para mostrar una media se usa siempre `previewpath || filepath`; no añadir comprobaciones de extensión HEIC en el frontend. Para generar los que falten: `npm run previews:heic --prefix server`. Las imágenes de Google Drive (salvo GIF y las que tienen transparencia) también guardan al vincularse un preview local sacado de la miniatura grande de Drive, para no pedir el original a Google al verlas; las vinculadas antes se completan con `npm run previews:drive --prefix server`.
- Variables de entorno en `server/.env` (ver `.env.example`) y `client/.env`. No versionar `.env`.

### Guía de diseño

La guía visual completa y obligatoria está en `.claude/DESIGN.md`. Incluye paleta y roles de color, tipografía, espaciado, alturas de control, radios, sombras, capas, movimiento, recetas de cada componente, diccionario de iconos, textos, accesibilidad, antipatrones y checklist. Se importa aquí para que se aplique siempre:

@DESIGN.md

### Deuda técnica conocida (no replicar)

Estos puntos incumplen las normas y deben corregirse al tocar la zona afectada; no se copian en código nuevo.

- **`fetch` restante:** `AuthContext.jsx` (`fetchWithAuth`, que `useAccessControl`, `LogsPage`, `ActionsPage`, `UsersPage`, `MetricsPage`, `AlbumPage`, `MediaDetailPage`, `GalleryPage` y `AlbumDetailPage` siguen consumiendo) y las descargas de archivo de `GalleryPage.jsx` y `AlbumDetailPage.jsx`. Sustituir por `apiClient` (con `responseType: "blob"` para descargas) y hooks de React Query, migrando cada flujo completo. Ojo al buscar: `refetch(` no es `fetch(`.
- **`useEffect` con datos remotos** en `AuthContext` y otros consumidores antiguos: migrar a `useQuery`/`useMutation`.
- **CSS legado por página/componente:** `LogsPage.css`, `ActionsPage.css`, `UsersPage.css`, `MetricsPage.css`, `GalleryPage.css`, `MediaDetailPage.css`, `AlbumPage.css`, `AlbumDetailPage.css`, `MediaCard.css`, `Input.css`. Se migran a Tailwind cuando se toque cada pantalla y se elimina el archivo.
- **Modificadores `!` y estilo global de `button`:** `styles/index.css` define en `@layer base` un estilo de `button` (ancho 100 %, borde de 2 px, fondo oscuro). Las utilidades de Tailwind ya lo sobrescriben, así que los `!` del código actual sobran: no usarlos en código nuevo y retirarlos al tocar cada componente. El objetivo final es eliminar ese estilo global y las variables `--tagged-button-*`.
- **Fondo decorativo:** `.tagged-shell-content` y `variables.css` contienen gradientes y orbes animados que contradicen la norma de sobriedad. No ampliarlos; retirarlos o simplificarlos al rediseñar el layout.
- **SVG inline** en `LogsPage.jsx` y variables de color heredadas (`--tagged-*`, acento `#643aff`, `LEGACY_DEFAULT_TAG_COLOR`) frente a la paleta `neutral-*`.
- **Excepciones de radio:** `rounded-none` en skeletons (`CollectionLoadingSkeleton`, `AlbumDetailPage`) y `rounded-lg` en `AlbumAddMediaModal`; pasar a `rounded-xl`.
- **Sin utilidad compartida de clases:** no existe `cn`/`clsx`; hoy se concatenan plantillas de texto. Al introducir clases condicionales nuevas, crear una única utilidad compartida (p. ej. en `client/src/utils/`) y usarla.
- **Archivos muy grandes:** `GalleryPage.jsx` y `AlbumDetailPage.jsx` (más de 3000 líneas) y `GalleryPage.jsx.bak` (eliminar, no debe versionarse). Extraer componentes y hooks al modificarlos.
- **Duplicación en servidor:** existen `server/middleware/` y `server/middlewares/`; nadie importa el primero, solo `middlewares/` (que además contiene `upload.middleware.js`).

## Normas de diseño e interacción

### Sistema visual

- El diseño debe ser minimalista, sobrio y coherente.
- Usar una paleta corta basada en grises neutros. Evitar azules oscuros y colores saturados como base de la interfaz.
- Reservar colores semánticos para estados que los necesiten: éxito, aviso, error e información.
- El modo oscuro es el tema predeterminado. La primera carga nunca debe mostrar brevemente el tema claro.
- Mantener una jerarquía clara mediante espaciado, tipografía, contraste y peso visual; no mediante adornos innecesarios.
- Evitar sombras fuertes, gradientes decorativos, bordes llamativos y ruido visual.

### Bordes y radio

- Se prohíben las esquinas rectas en elementos de interfaz como tarjetas, paneles, inputs, botones, menús, modales y avisos.
- Usar un único radio estándar: `rounded-xl` de Tailwind (`0.75rem`).
- No usar otros radios (`rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-2xl`, valores arbitrarios, etc.).
- `rounded-full` solo se permite cuando la forma circular tiene significado: avatar, indicador circular o badge tipo píldora. No usarlo como variante estética de botones o contenedores normales.
- Centralizar cualquier cambio futuro del radio estándar; no cambiar componentes uno a uno.

### CSS y Tailwind

- Tailwind CSS es el framework de estilos del frontend y la opción obligatoria para todo estilo nuevo.
- No crear nuevos archivos CSS por página o componente.
- El CSS global se limita a la configuración base, tokens, resets y casos que Tailwind no pueda expresar razonablemente.
- No usar estilos inline salvo valores realmente dinámicos que Tailwind no pueda representar.
- No introducir valores arbitrarios si existe un token o utilidad equivalente.
- Definir en la configuración de Tailwind los colores, espaciados y demás tokens compartidos. No repetir valores mágicos.
- Al modificar una pantalla antigua, migrar a Tailwind la parte afectada y eliminar el CSS legado que deje de utilizarse.
- No mezclar dos sistemas visuales dentro de un componente nuevo.
- Usar una utilidad de composición de clases compartida cuando haya clases condicionales; no concatenarlas de formas distintas en cada componente.

### Iconos

- Usar Font Awesome mediante sus paquetes oficiales para React (`@fortawesome/react-fontawesome` con `free-solid-svg-icons` y `free-regular-svg-icons`).
- No añadir, descargar ni cargar SVG de iconos desde `public`, `src/assets` u otras carpetas.
- Cuando se migre una pantalla, sustituir sus SVG locales por el icono equivalente de Font Awesome y retirar los recursos que hayan quedado sin uso.
- Usar iconos cuando mejoren la identificación rápida de una acción o estado.
- No añadir iconos puramente decorativos ni repetirlos sin aportar información.
- Reutilizar siempre el mismo icono para la misma acción en toda la app.
- Los botones que solo muestran un icono deben tener nombre accesible mediante `aria-label` y un tooltip cuando la acción no sea obvia.
- Importar únicamente los iconos utilizados; no cargar una librería completa ni usar el CDN global.

### Accesibilidad e interacción

- Usar HTML semántico y controles nativos siempre que sea posible.
- Toda interacción debe funcionar con teclado y mostrar un foco visible coherente.
- Mantener contraste suficiente en modo oscuro, incluidos estados deshabilitados y textos secundarios.
- Incluir estados coherentes de hover, focus, active, loading, disabled, error y vacío cuando correspondan.
- No comunicar información únicamente mediante color.

### Diseño responsive

- Todo lo desarrollado en el frontend debe ser responsive desde el primer cambio. No se acepta dejar la adaptación para una tarea posterior.
- Diseñar y verificar, como mínimo, estos cuatro contextos: PC de escritorio, laptop, iPad/tablet y smartphone.
- Usar un enfoque mobile-first con breakpoints consistentes de Tailwind. No crear media queries arbitrarias por componente.
- La interfaz debe adaptarse por composición, tamaño y densidad; no limitarse a reducir texto o esconder contenido importante.
- Evitar anchos y altos fijos que provoquen overflow. Priorizar `min-*`, `max-*`, grid, flex, `clamp()` y unidades relativas cuando correspondan.
- Mantener objetivos táctiles cómodos, navegación usable con una mano y separación suficiente entre acciones en tablet y smartphone.
- No depender de hover para revelar una acción esencial. Toda funcionalidad debe estar disponible en dispositivos táctiles.
- Comprobar que no existe scroll horizontal accidental y que modales, tablas, formularios, menús y estados vacíos funcionan en los cuatro contextos.

## Flujo de trabajo y decisiones

### Flujo de trabajo obligatorio

1. Revisar componentes, hooks, utilidades y patrones existentes antes de implementar.
2. Identificar qué se puede reutilizar o generalizar con una modificación pequeña.
3. Aplicar los tokens y componentes compartidos; no improvisar estilos locales.
4. Para cambios de datos, revisar el cliente Axios, las funciones de API, las query keys y los hooks de React Query existentes antes de añadir código.
5. Eliminar imports, clases, CSS, peticiones y recursos que queden obsoletos dentro del alcance del cambio.
6. Comprobar con una búsqueda global que el flujo migrado no conserve usos de `fetch` ni solicitudes desde `useEffect`.
7. Ejecutar lint, pruebas y build disponibles antes de dar el trabajo por terminado.
8. Revisar visualmente la pantalla en modo oscuro en PC, laptop, iPad/tablet y smartphone.
9. Cerrar cada cambio lógico terminado con un commit propio antes de comenzar el siguiente cambio solicitado.
10. Usar mensajes de commit breves y descriptivos que permitan identificar, revertir o recuperar el cambio de forma aislada.
11. No agrupar cambios independientes en un mismo commit ni reescribir commits ya publicados salvo petición expresa.

### Criterio ante dudas

Si hay varias soluciones válidas, elegir en este orden: reutilizar lo existente, mantener la consistencia, escribir menos código, facilitar el mantenimiento y solo después introducir algo nuevo.
