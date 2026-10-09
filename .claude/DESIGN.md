# Tagged: guía de diseño de interfaz

Esta guía es la referencia visual de toda la app. Cualquier pantalla nueva, refactorización o pulido de UI debe ajustarse a ella. Los valores salen del código actual (plantillas, metadatos, formularios de media, sidebar, paginación y modales) y fijan una única opción cuando el código tenía variantes.

**Regla de oro:** si un elemento ya existe en la app, se copia su receta exacta o se reutiliza su componente. Si no aparece aquí, se construye con los tokens de esta guía y después se añade a la guía.

Etiquetas usadas en este documento:

- **Canónico:** la forma correcta para código nuevo.
- **Legado:** existe en el código, pero no se replica; se corrige al tocar esa zona.

---

## 1. Principios

1. **El contenido es el protagonista.** Imágenes y vídeos aportan el color; la interfaz es gris, plana y silenciosa.
2. **Una sola forma de hacer cada cosa.** Mismo aspecto, icono, texto y comportamiento para la misma acción en cualquier pantalla.
3. **Jerarquía por tipografía y espacio**, no por color, sombras ni adornos.
4. **Oscuro primero.** Se diseña en modo oscuro y se comprueba el claro. Cada color lleva su par `dark:`.
5. **Mobile-first y táctil.** Nada esencial depende del hover; los objetivos táctiles son cómodos.
6. **Contexto y feedback.** El usuario siempre sabe qué está editando y qué ha pasado tras cada acción.

---

## 2. Color

### 2.1 Paleta

- Base: **exclusivamente `neutral-*`** de Tailwind, más `white`, `black` y sus opacidades.
- Prohibido en código nuevo: `zinc`, `gray`, `slate`, `stone`, azules, violetas y otros colores de marca. El acento heredado `#643aff` (`--tagged-accent-color`) está en desuso.
- Semánticos, solo cuando hay un estado que comunicar:
  - **Error y peligro:** `red`. Texto `text-red-600 dark:text-red-400`. Botón `bg-red-600 hover:bg-red-500`. Fondo suave `bg-red-500/10`, borde `border-red-500/30`–`/50`.
  - **Éxito:** `green`. Borde de toast `border-green-500/50` y texto `text-green-600`.
  - **Aviso:** `amber`. Aviso en línea `border-amber-500/30 bg-amber-500/10` con icono `text-amber-600 dark:text-amber-400` (`InlineNotice`, tono `warning`); punto de estado `bg-amber-500`.
  - **Información:** hoy no se usa. Si hace falta, `sky` con la misma estructura.
- Los colores de las tags los elige el usuario. Solo se pintan mediante `utils/tagStyle.js` (sección 7.7).

### 2.2 Roles de color (canónico)

| Rol | Claro | Oscuro |
|---|---|---|
| Fondo de app (shell) | `bg-neutral-100` | `dark:bg-neutral-950` |
| Superficie de panel, modal o sidebar | `bg-neutral-50` | `dark:bg-neutral-900` |
| Superficie de tarjeta | `bg-white` | `dark:bg-neutral-900` |
| Superficie hundida (campo, bloque de dato, segmented) | `bg-white` / `bg-neutral-100` | `dark:bg-neutral-950` |
| Hover de elemento neutro | `hover:bg-neutral-100` | `dark:hover:bg-neutral-800` |
| Seleccionado / activo fuerte | `bg-neutral-950 text-white` | `dark:bg-white dark:text-neutral-950` (o `neutral-100`) |
| Borde de control (input, botón secundario, IconButton) | `border-neutral-300` | `dark:border-neutral-700` |
| Borde de tarjeta y divisor | `border-neutral-200` | `dark:border-neutral-800` |
| Borde de tarjeta en hover | `hover:border-neutral-300` | `dark:hover:border-neutral-700` |
| Texto principal | `text-neutral-950` | `dark:text-neutral-100` |
| Texto de etiqueta / secundario fuerte | `text-neutral-600` | `dark:text-neutral-300` |
| Texto secundario / descripción | `text-neutral-500` | `dark:text-neutral-400` |
| Texto terciario, placeholder, icono decorativo en campo | `text-neutral-400` | `dark:text-neutral-500` / `dark:text-neutral-600` |
| Esqueleto de carga | `bg-neutral-200` | `dark:bg-neutral-800` |
| Controles sobre imagen o vídeo | `bg-black/65 text-white`, hover `bg-black/80` | igual en ambos temas |

Reglas:

- Nunca se escribe un color sin su variante `dark:` salvo que sea idéntico en ambos temas (controles sobre media, `text-white` sobre `bg-red-600`).
- No usar hexadecimales ni `var(--tagged-*)` en JSX nuevo. La excepción son los estilos dinámicos de tags.
- El contraste mínimo del texto secundario es `neutral-500` en claro y `neutral-400` en oscuro. No usar tonos más tenues para texto que haya que leer.

### 2.3 Tema

- El atributo `data-theme` va en `<html>`. Lo fija el script de `index.html` antes de pintar, a partir de `localStorage["tagged:theme"]`, y por defecto es oscuro.
- La variante `dark:` de Tailwind depende de `[data-theme="dark"]` (`@custom-variant` en `styles/index.css`). No usar `prefers-color-scheme` ni `media` para el tema.

---

## 3. Tipografía

Fuente única: **Nunito Sans** (cargada en `styles/index.css`). No añadir otras familias; Dancing Script es legado de la pantalla de inicio.

| Uso | Clases |
|---|---|
| Sobretítulo de página (eyebrow) | `text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400` |
| Título de página (`h1`) | `text-3xl font-black tracking-tight sm:text-4xl` |
| Descripción de página | `mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400` |
| Título de modal (`h2`) | `text-xl font-semibold tracking-tight sm:text-2xl`; en modal de confirmación, `text-lg font-semibold tracking-tight` |
| Título de sección (`h2`) | `text-xl font-bold` |
| Título de tarjeta | `text-lg font-bold` (tarjeta de gestión) o `text-base font-bold` (tarjeta de media) con `truncate` |
| Título de bloque dentro de formulario | `text-sm font-semibold` + ayuda `mt-0.5 text-xs text-neutral-500 dark:text-neutral-400` |
| Cuerpo | `text-sm` |
| Etiqueta de campo | `text-xs font-semibold text-neutral-600 dark:text-neutral-300` |
| Metadato y contador | `text-xs font-semibold text-neutral-500 dark:text-neutral-400`; números con `tabular-nums` |
| Botón | `text-sm font-bold` (primario, navegación) o `font-semibold` (secundario) |
| Micro-etiqueta de grupo (sidebar) | `text-xs font-black uppercase tracking-widest text-neutral-500` |

Reglas:

- Pesos permitidos: `font-medium`, `font-semibold`, `font-bold` y `font-black`. `font-black` solo para `h1`, marca y avatar.
- Tracking: `tracking-tight` para títulos y `tracking-widest` para eyebrows. Nada de valores arbitrarios.
- Evitar `text-[0.xrem]`. El mínimo es `text-xs`; solo los iconos dentro de controles pequeños pueden bajar de ahí.
- Todo texto que pueda desbordar lleva `truncate` (o `line-clamp-*`), `min-w-0` en su contenedor flex y `title` con el valor completo.

---

## 4. Espaciado, tamaños y layout

### 4.1 Escala de espaciado

Se usa la escala de Tailwind con estos valores habituales:

- **gap:** `gap-1` y `gap-1.5` (iconos, chips y botones apilados), `gap-2` (por defecto entre controles), `gap-3` (campos de formulario y elementos de tarjeta), `gap-4`–`gap-6` (bloques y secciones).
- **Padding de contenedores:** tarjeta `p-4`; cabecera y cuerpo de modal `px-4 sm:px-6` / `p-4 sm:p-6`; modal de confirmación `px-5 py-4`; bloque de dato `px-3 py-2`.
- **Separación vertical entre secciones de página:** `mb-5` o `mb-6`. Divisores con `border-t` + `pt-3`/`pt-4`.

No usar valores arbitrarios (`p-[13px]`) si existe uno de la escala.

### 4.2 Alturas de control (canónico)

| Altura | Uso |
|---|---|
| `h-11` (44 px) | Control estándar: input, select, búsqueda, botón primario y secundario, ítem de navegación, contenedor segmented |
| `h-10` (40 px) | `IconButton`, paginación, botones de pie de un modal de confirmación, botones compactos |
| `h-9` | Opción dentro de un segmented control, icono de marca en cabeceras |
| `h-7` / `h-8` | Mini-botones dentro de otro control (limpiar búsqueda, incluir o excluir tag) |
| `min-h-14` / `min-h-16` | Opciones grandes seleccionables (checkbox en tarjeta, categorías de metadatos) |

En táctil, ningún objetivo interactivo baja de 40 px salvo los mini-botones que viven dentro de un control mayor.

### 4.3 Shell y página

- **Shell (`ProtectedLayout`):** `flex min-h-dvh`, sidebar a la izquierda y `<main className="... min-w-0 flex-1 px-4 pb-4 pt-20 xl:p-8">`. En móvil, el `pt-20` deja sitio al botón flotante del menú.
- **Página:** `<section className="tagged-app-page min-h-[calc(100dvh-5.2rem)] text-neutral-950 dark:text-neutral-100">`.
- **Cabecera de página (canónica):**

```jsx
<header className="mb-6 flex flex-col gap-5 border-b border-neutral-200 pb-6 dark:border-neutral-800 sm:flex-row sm:items-end sm:justify-between">
    <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Library settings</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Templates</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500 dark:text-neutral-400">Short description of the page.</p>
    </div>
    {/* Acción principal: botón primario, w-full en móvil y sm:w-auto */}
</header>
```

- **Página de perfil o integración** (Account, Google Drive): sin tarjeta envolvente. Cabecera grande con icono o avatar (`h-24 w-24`) y punto de estado, eyebrow, `h1` y, debajo, una línea `text-sm text-neutral-500` que integra el estado con su icono semántico y el dato principal ("✓ Connected as email"); sin píldoras de estado. Acción principal a la derecha; `border-b pb-8`. Debajo, `max-w-5xl` con secciones `py-8` separadas por `divide-y` (título `text-xl font-bold` y descripción), indicadores en rejilla `grid-cols-2 lg:grid-cols-4` y datos en filas `divide-y` con etiqueta en mayúsculas e icono (`w-44`) a la izquierda. Componentes: `IntegrationHero` (cabecera, con `statusLine` o descripción), `PageSection` (sección), `StatTile` (indicador), `DetailRow` (fila de datos dentro de un `<dl>`) y `FeatureList` ("How it works": icono en caja, título y texto, en `sm:grid-cols-3`).
  - En Account, los admin tienen la sección **Demo mode** (`DemoModeSection`) con las mismas filas: "Demo library" con `Switch`, punto de estado y resumen del contenido; mientras se prepara, un `faSpinner` con "Preparing the demo library…"; "Reset demo data" con botón secundario y confirmación (`DeleteConfirmationModal` con `faRotateLeft`); y, con la demo activa, enlaces secundarios a Dashboard y Gallery.
- **Barra de herramientas de colección:** `LibraryToolbar` (búsqueda a la izquierda, controles a la derecha, `max-w-[92rem]` centrado).
- **Fila buscador + contador:** `flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between`, con búsqueda `max-w-sm` y contador `text-sm text-neutral-500` con `aria-live="polite"`.
- **Layout con navegación lateral secundaria** (patrón de Metadata): `grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]`, con la navegación `sticky` desde `xl`.

### 4.4 Rejillas y breakpoints

- Breakpoints de Tailwind y nada más: `sm` (640), `md` (768), `lg` (1024), `xl` (1280) y `2xl` (1536). Sin media queries propias.
- Los cuatro contextos que se verifican:
  - Smartphone (< `sm`): 1 columna, botones `w-full`, pies de modal apilados.
  - Tablet (`sm`–`lg`): 2 columnas en listados y formularios, sidebar como drawer.
  - Laptop (`lg`–`xl`): toolbar en fila y rejillas de 2–3 columnas.
  - Escritorio (`xl`+): sidebar fija y plegable, padding `xl:p-8`, rejillas de media densas.
- Listados de tarjetas de gestión: `grid items-start gap-3 lg:grid-cols-2`.
- Resumen de una colección de gestión: `StatTile` (`components/stat-tile`: panel `rounded-xl border p-4`, etiqueta en mayúsculas con icono, valor `text-2xl font-black sm:text-3xl`) en `grid grid-cols-2 gap-3 lg:grid-cols-4`, encima del listado. Evita que la página sea solo una rejilla de elementos sueltos.
- **Tarjeta "blueprint" (plantillas):** tratamiento propio de `TemplatesPage.jsx` para una entidad que es, conceptualmente, un plano reutilizable. Panel `relative overflow-hidden rounded-xl border border-dashed border-neutral-300 bg-white dark:border-neutral-700 dark:bg-neutral-900` con textura de retícula (`bg-[linear-gradient(rgba(0,0,0,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.05)_1px,transparent_1px)] bg-[size:16px_16px]`, par `dark:` con `rgba(255,255,255,0.05)`) y cuatro marcas de registro en las esquinas (`absolute h-2.5 w-2.5` con dos bordes en L, `border-neutral-300`/`700`). Dentro: código de pieza (`TPL-01`, `text-xs font-bold uppercase tracking-widest tabular-nums text-neutral-400`) — es un identificador **estable ligado al orden de creación**, no a la posición actual en el grid: se calcula una vez sobre la lista ordenada por `created_at` y no cambia si el usuario reordena o filtra la vista —, título, una ficha de dos columnas separada por `border-dotted` con `SpecField` (icono + etiqueta en mayúsculas arriba, valor `text-sm font-semibold` debajo; sin dato, se muestra "Undefined" en `text-neutral-400` en vez de dejar el hueco vacío — media name con `faImage`, autor con `faUser`), y un cajetín inferior (`border-t border-dashed`, mismo eyebrow) con las acciones. Las tags se limitan a 4 visibles (`+N` en badge `rounded-full bg-neutral-200`) y cada chip lleva `max-w-[6.5rem] truncate`, con un contenedor `min-h-[1.75rem]` que muestra "No tags" si no hay ninguna: así todas las tarjetas de una fila miden lo mismo, sin que una plantilla con muchas tags rompa la simetría del grid.
- **Tarjeta "circuito" (reglas):** `RuleCard` trata cada regla como un módulo electrónico, igual que las plantillas son un plano; no se mezclan los dos lenguajes. Tarjeta de gestión con borde **continuo** (el discontinuo es del blueprint), `overflow-hidden`, y cuatro franjas: cabecera `p-4` con LED de estado (`h-2 w-2 rounded-full ring-4`: verde "Running", ámbar "Paused" si está activa pero incompleta, neutro "Off"; el texto va siempre junto al LED) en el eyebrow, título `text-lg font-black` y `Switch` a la derecha; esquema del workflow (`RuleSchematic`, `h-32`, fondo de puntos `bg-[radial-gradient(...)] bg-[size:12px_12px]` entre `border-y`), donde cada nodo es un chip con patillas y el icono de su tipo (disparador invertido, condición con contorno, acción rellena en gris) y las conexiones son pistas en ángulo recto con pads en los extremos; con la regla en marcha, una señal discontinua recorre las pistas (`animate-signal`, quieta con movimiento reducido). El esquema es `aria-hidden`: los mismos datos van en texto debajo, en tres lecturas `grid-cols-3 divide-x` ("Triggers", "Conditions", "Actions", eyebrow + número `text-xl font-black tabular-nums`). Pie `min-h-14 border-t` con la lectura de actividad ("Changed 41 media · Last on …") o el aviso ámbar de lo que falta, y el `IconButton` de borrar. Toda la tarjeta abre el editor. Rejilla `grid gap-4 sm:grid-cols-2 xl:grid-cols-3` y esqueleto `RuleCardSkeleton` con la misma forma.
- **Panel "hoja de contactos" (dashboard):** si las plantillas son un plano y las reglas un circuito, el panel es la hoja de contactos de un laboratorio fotográfico: el contenido del usuario es el protagonista. Cada sección es un fotograma numerado (`DashboardSection`: eyebrow "03 · Activity" con el número en `tabular-nums`, `h2 text-xl font-bold`, descripción y controles a la derecha, en un panel `rounded-xl border bg-white p-4 sm:p-6 dark:bg-neutral-900`). Orden: 01 Library, 02 Workspace, 03 Activity, 04 Formats y 05 Description (en dos columnas desde `lg`), 06 Vocabulary y 07 Highlights.
  - **Cabecera (01 · Library):** bloque compacto con una sola cifra protagonista (`text-5xl sm:text-6xl font-black`, cifras proporcionales) y "media since …", y a su lado una **ficha técnica** sin cajas (`SpecFigure`, compartido): cada dato lleva una línea fina a la izquierda (`border-l pl-3`), etiqueta en mayúsculas, valor `text-xl font-black` y ayuda `text-xs` (`grid-cols-2 sm:grid-cols-4 2xl:grid-cols-7`). Debajo, la **tira de película** con las últimas subidas: franja `bg-neutral-950 dark:bg-black` (oscura en los dos temas, como el visor), filas de perforaciones `h-2 w-3 rounded-xl` (`bg-white dark:bg-neutral-800`) arriba y abajo, fotogramas `aspect-[3/2] rounded-xl` con número "01" y nombre, y un rótulo de borde en mayúsculas ("Tagged ▸ Latest uploads"). Se desplaza sin barra (`scrollbar-none`, `snap-x`) con swipe o touchpad; con ratón (`pointer-fine:`) aparecen flechas superpuestas `bg-black/65` en cada extremo, solo si hay algo más en esa dirección. Cada fotograma abre la media; el último lleva a la galería.
  - **Espacio de trabajo (02):** tarjetas enlace (`WorkspaceTile`) a álbumes, favoritos, plantillas, reglas, Google Drive y papelera. Cada una lleva etiqueta con icono, cifra `text-2xl font-black` con unidad, una **vista previa de su contenido** y una línea de detalle tras `border-t`: cuatro miniaturas `aspect-square rounded-xl` (portadas de los álbumes más grandes, últimos favoritos, lo último de la papelera; los huecos quedan como marco vacío), una lista corta con número "01" (plantillas) o punto de estado y "Running"/"Off" (reglas), o pares etiqueta y valor (estado, cuenta y tamaño de Drive). El punto `h-2 w-2 rounded-full` (verde, ámbar o neutro) siempre va con su texto.
  - **Actividad (03):** mapa de puntos por día del año en SVG escalable (`min-w-[44rem]`, se desplaza en pantallas estrechas empezando por lo más reciente), escala secuencial de un solo tono neutral en cinco niveles logarítmicos con leyenda "Less … More". Las subidas por mes son un minigráfico de 12 barras junto al total del año (el mes activo o el de más subidas, invertido); la misma información va en texto para lectores de pantalla. Señalar un día o un mes actualiza una **lectura** bajo el mapa ("Wed, Apr 29 · 56 media") en lugar de un tooltip flotante, y un mes señalado atenúa los días de los demás. El año se cambia con dos `IconButton` y, mientras llegan sus datos, se conservan los anteriores al 50 % con `ResultsLoadingIndicator` en línea.
  - **Medidor del panel:** `DashboardMeter` (etiqueta de `4.5rem`, barra `h-1.5 rounded-full` y dato alineado a la derecha), con `tone="strong"` para la medida principal y `"soft"` para la secundaria.
  - **Formatos (04):** por tipo, dos medidores con el mismo significado en todas las filas: "Media" (fuerte) y "Space" (suave), con porcentaje y tamaño. Después, dónde se guarda (Tagged o Drive) y la orientación en tres bloques con su forma dibujada (3:2, 2:3, 1:1).
  - **Descripción (05):** indicadores circulares de cobertura (tags, nombre, autor) con el porcentaje en el centro y "N media missing" o "Every media" debajo; la distribución de tags por media en medidores (media y total en la cabecera) y el estado del vocabulario de tags (sin usar, usadas una vez, de copyright) con el enlace "Manage tags".
  - **Vocabulario (06):** clasificaciones con puesto "01", nombre (`TagChip` para las tags), recuento y barra `h-1` relativa al primero.
- **Papelera "línea de ruta":** si las plantillas son un plano, las reglas un circuito y el panel una hoja de contactos, la papelera es una línea de transporte. Las medias viajan hacia el final de la línea (hoy), donde se borran para siempre; cada día con medias es una **parada**. Los días se calculan por días de calendario desde `expires_at` (`trashTime.js`), y una parada es inminente con `URGENT_DAYS` días o menos (ámbar, siempre con texto).
  - **Cabecera de ruta** (`TrashRoute`): eyebrow "Next stop" (ámbar con `faTriangleExclamation` si es inminente), titular con cuándo llega (`text-3xl sm:text-4xl font-black`: "Today", "Tomorrow", "In 5 days") y la fecha con lo que se borra; a la derecha, la ficha técnica sin cajas (`SpecFigure`: media, espacio a liberar y número de paradas). Debajo, tras `border-t`, la línea:
    - **Desde `sm`, horizontal y a escala** (`h-40`): de "Today" (final de línea, trazo grueso `neutral-950`/`white`) a los días de retención, con marcas de semana y escala debajo. Cada parada es un punto `h-3 w-3 rounded-full` (`stopDotClasses`: ámbar si es inminente) con `ring-4` del color del panel. Las etiquetas (`w-28`: miniaturas solapadas `-space-x-5`, "In 13–14 days" y "7 media") se reparten en tramos de su mismo ancho y las paradas de un tramo comparten etiqueta, así nunca se solapan; cada etiqueta se une a sus puntos con pistas en ángulo recto, como en el esquema de una regla. Señalar o enfocar una etiqueta resalta sus pistas y sus puntos. Una señal discontinua (`animate-signal`) recorre la línea hacia "Today"; quieta con movimiento reducido.
    - **En móvil, vertical**: las primeras cuatro paradas en filas `min-h-16` ("Tomorrow", fecha, recuento y miniaturas) unidas por la línea, y "N more stops until …".
    - Pulsar una parada desplaza la ventana hasta su grupo con `window.scrollTo` (no `scrollIntoView`, que también movería `main`) y le pasa el foco a su título.
    - Aviso en línea ámbar si la próxima parada es inminente, con "Select them" para seleccionar sus medias.
  - **Paradas** (`TrashStop`): cuelgan de un raíl vertical `w-0.5` (la misma línea), con el punto de la parada separado del raíl como una estación. Eyebrow "Stop 01 · Tue, Sep 29" (el número sigue el orden de llegada, no el de la vista), título "Deleted forever in N days", recuento y tamaño, y "Select"/"Deselect" para la parada. Las tarjetas no repiten la cuenta atrás: solo llevan el botón de restaurar sobre la imagen (`mediaAction` con `faRotateLeft`). Orden con `SegmentedControl`: "Recently deleted" (`faClock`) o "Expiring first" (`faHourglassHalf`).
  - **Selección:** barra flotante fija abajo en la pantalla (`TrashSelectionBar`: recuento, limpiar, "Restore" primario y "Delete forever" `dangerOutline`), con los botones en dos columnas en móvil. Es `fixed bottom-4 z-30`, no `sticky`: `main` tiene `overflow-x: hidden` y un sticky se quedaría al final de la página. Se centra en el área de contenido: desde `xl` empieza tras la barra lateral (`xl:left-72`, o `5.5rem` si está plegada, con `body:has(#tagged-sidebar[data-collapsed=true])`). Al final de la lista deja un hueco para no tapar la última fila.
- **Orden de un listado de gestión con varios criterios** (plantillas): `<select>` con la receta de Select de §7.2 (`mediaFormInputClasses` + `appearance-none pr-10`, más `pl-9` si lleva icono a la izquierda) envuelto en un `<label>` de ancho fijo junto al contador de resultados. Icono `faArrowUpWideShort` para la acción de "ordenar / cambiar criterio". Solo neutrales y `border-dashed`/`border-dotted` para el lenguaje técnico — nunca azul ni otro color de marca. Reutilizar este panel (`BlueprintPanel`) para cualquier tratamiento futuro de plantillas antes de crear uno nuevo.
- Formularios: `grid grid-cols-1 gap-3 sm:grid-cols-2`.
- La sidebar es un drawer hasta `xl` y fija desde `xl` (`w-72`, plegable).
- Alturas de viewport con `dvh`, nunca `vh`.

---

## 5. Forma, bordes y elevación

### 5.1 Radio

- **`rounded-xl` en todo:** tarjetas, paneles, inputs, botones, menús, modales, chips de tag, toasts, skeletons, miniaturas y checkboxes.
- `rounded-full` solo para avatares, indicadores circulares (selección sobre media, puntos de pasos), interruptores, barras de progreso y chips de filtro tipo píldora.
- Prohibidos `rounded-none`, `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-2xl` y valores arbitrarios. Una imagen dentro de un contenedor redondeado se recorta con `overflow-hidden` en el contenedor, no quitando el radio.

### 5.2 Bordes

- Grosor único de `1px` (`border`). `border-2` solo en el indicador de selección sobre media.
- Los controles interactivos llevan borde de control (`neutral-300`/`700`). Las tarjetas y divisores llevan borde suave (`neutral-200`/`800`).
- Los botones primarios no llevan borde (`border-0`).

### 5.3 Sombras (canónico)

| Sombra | Uso exclusivo |
|---|---|
| ninguna (`shadow-none`) | Por defecto: botones, tarjetas, inputs y paneles |
| `shadow-2xl` | Caja de modal |
| `shadow-xl` | Menús desplegables, listas de sugerencias, tooltips y toasts |
| `shadow-lg` | Indicadores flotantes (`ResultsLoadingIndicator`) |
| `shadow-sm` / `shadow-md` | Botón flotante del menú móvil y controles sobre media |

Prohibidos los gradientes decorativos, los resplandores (`blur` decorativo) y las sombras de color. El fondo con orbes de `.tagged-shell-content` y de la pantalla de inicio es **legado**.

### 5.4 Capas (z-index)

Se usa siempre esta escala; no inventar valores intermedios:

| Capa | Valor |
|---|---|
| Elementos dentro de tarjeta o media (controles superpuestos) | `z-10` / `z-20` |
| Barra flotante de selección de una página (fija abajo) | `z-30` |
| Listas de sugerencias y desplegables en línea | `z-30` (dentro de modal) / `z-50` (en página) |
| Fondo del drawer de sidebar | `z-40` |
| Sidebar en drawer | `z-50` |
| Botón flotante de menú móvil | `z-70` |
| Indicador flotante de resultados | `z-[80]` |
| Modal principal (subida, edición, formulario) | `z-[1200]` |
| Modal abierto desde otro modal | `z-[1300]` |
| Confirmaciones y diálogos sobre cualquier modal | `z-[1400]` |
| Tooltips (`Tooltip`), por encima de cualquier modal | `z-[1500]` |
| Capa de selección con marquesina | `z-[2000]` |

### 5.5 Superposiciones

- **Fondo de modal:** `bg-black/70 backdrop-blur-sm`.
- **Fondo del drawer de sidebar:** `bg-black/60` sin blur.
- **Visor de media a pantalla completa:** `bg-black/90`.
- **Bloqueo de scroll:** todo modal, panel o widget superpuesto bloquea el scroll de la página con `useScrollLock(isOpen)` o `lockPageScroll()` (admite bloqueos anidados). No manipular `document.body.style.overflow` a mano.

---

## 6. Movimiento

- Transición por defecto: `transition-colors`. Usar `transition-transform` y `transition-opacity` cuando cambie solo eso. Evitar `transition-all`.
- Duración: por defecto (150 ms) o `duration-200`. Hasta `duration-500` solo en la pantalla de inicio.
- Microinteracciones permitidas:
  - `hover:scale-105` en la tarjeta de media.
  - Desplazamiento `group-hover:translate-x-1` de la flecha en acciones de estado vacío.
  - Latido del favorito.
  - Señal que recorre las pistas del esquema de una regla activa y la línea de ruta de la papelera (`animate-signal`).
  - Latido del punto de cambios sin guardar (`animate-heartbeat`, token de `styles/index.css`): dos pulsaciones y 2,5 s de reposo.
  - `animate-pulse` en skeletons.
  - `spin` en `faSpinner`.
- Todo movimiento que no sea un cambio de color lleva `motion-reduce:transition-none` / `motion-reduce:animate-none`.

---

## 7. Componentes

Antes de maquetar, se busca el componente en esta lista. Si existe, se usa; si no, se usa la receta.

### 7.1 Botones

**En código nuevo, usar `buttonClasses` (`components/button/buttonClasses.js`: `primary`, `secondary`, `dangerGhost`, `dangerOutline`, `text`, y `textCompact` para una acción de texto junto a la etiqueta de un campo) en lugar de copiar las recetas.** No hace falta `!`: el estilo global de `button` está en `@layer base` y las utilidades de Tailwind lo sobrescriben. Ese estilo global sí fija `width: 100%`, borde de 2 px y fondo oscuro, así que **todo botón declara siempre su ancho, borde, fondo y padding**. En código nuevo no se añaden `!` (el código existente los usa por inercia; son **legado**).

**Primario:** una sola acción principal por vista o modal.

```
inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border-0 bg-neutral-950 px-4 text-sm font-bold text-white shadow-none transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-white sm:w-auto
```

**Secundario:** cancelar, acciones alternativas.

```
inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-transparent px-4 text-sm font-semibold text-neutral-700 shadow-none transition-colors hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800 sm:w-auto
```

**Peligro:** confirmar un borrado. Siempre con `faTrash`.

```
inline-flex h-10 w-auto items-center gap-2 rounded-xl border-0 bg-red-600 px-4 text-sm font-semibold text-white shadow-none hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50
```

**Fantasma de peligro** (acción destructiva en menú o sidebar, p. ej. cerrar sesión): texto neutro con `hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500`.

**Contorno de peligro** (`dangerOutline`): acción de gran alcance que no debe pulsarse por error (p. ej. "Add all" en Google Drive o "Remove from all" en Metadata, que quita una tag, un nombre de media o un autor de todas las medias). Es roja desde el principio, va dentro de un aviso en línea rojo (`InlineNotice` con tono `danger`) y su confirmación muestra antes el alcance (número de archivos y tamaño) y usa `requireText`.

**Texto / enlace:** acción terciaria, p. ej. "Clear", "Retry" o "Create one". `w-auto border-0 bg-transparent p-0 text-xs font-semibold text-neutral-600 underline shadow-none dark:text-neutral-300`. Un enlace de navegación usa `<Link>`, no `<button>`.

**Solo icono:** siempre `IconButton` (`h-10 w-10 rounded-xl`, borde de control, `bg-neutral-50 dark:bg-neutral-900`), con `aria-label` y `title` si la acción no es obvia. Los iconos van con `aria-hidden="true"`. Si activa o desactiva un modo, lleva `aria-pressed` e `isActive`, que lo pinta en invertido mientras está activo.

**Segmented control / toggle de vista** (filtro de tipo, tarjetas o lista). En código nuevo, usar `SegmentedControl` (`components/segmented-control`, `labels="responsive"` o `"hidden"`, `disabled`); la galería aún lo tiene en línea (**legado**):

- Contenedor: `flex h-11 items-center gap-1 rounded-xl border border-neutral-300 bg-white p-1 dark:border-neutral-700 dark:bg-neutral-950`.
- Opción: `inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border-0 text-sm font-bold`.
- Opción activa: `bg-neutral-950 text-white dark:bg-white dark:text-neutral-950`.
- Opción inactiva: `bg-transparent text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800`.
- Cada opción lleva `aria-pressed`. En móvil muestra solo el icono (`title` y `aria-label`); el texto aparece con `hidden lg:inline`.

**Opción grande seleccionable** (categorías de Metadata): `flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left`. Activa en invertido (`neutral-950`/`neutral-100`) e inactiva con `border-neutral-200 bg-white/70 hover:bg-white dark:border-neutral-800 dark:bg-neutral-900/70`. Lleva un icono en caja `h-9 w-9 rounded-xl bg-neutral-500/10`.

Reglas de botón:

- Orden en pies y barras: secundario a la izquierda y primario a la derecha. En móvil se apilan con el primario arriba (`flex-col-reverse gap-2 sm:flex-row sm:justify-end`).
- Estado de carga: se desactiva el botón y el texto pasa a gerundio ("Saving...", "Deleting...", "Uploading..."), manteniendo el icono.
- Estado deshabilitado canónico: `disabled:cursor-not-allowed disabled:opacity-50`. **Legado:** `opacity-30`/`40` de paginación y sidebar.
- El texto de un botón es un verbo en inglés con mayúscula solo al inicio: "Save template", "Add to album", "Create".

### 7.2 Campos de formulario

**Input de texto / select:** usar siempre `mediaFormInputClasses` (`components/media-form-modal/mediaFormStyles.js`):

```
h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm text-neutral-950 outline-none transition-colors placeholder:text-neutral-400 focus:border-neutral-500 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-100 dark:placeholder:text-neutral-600 dark:focus:border-neutral-500
```

El foco de un campo se muestra cambiando el borde a `neutral-500`, porque el CSS global anula el `outline` de los inputs. **Pendiente:** mover esta constante a un módulo compartido de estilos de formulario (`components/form/...`) cuando se toque; no duplicarla con otro nombre.

**Estructura de campo:**

```jsx
<label className="min-w-0 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
    <span className="mb-1.5 block">Author</span>
    <input className={mediaFormInputClasses} ... />
    {/* Ayuda: <span className="mt-1 block font-medium text-neutral-500 dark:text-neutral-400">…</span> */}
</label>
```

- La etiqueta es siempre visible. Solo la búsqueda usa `sr-only`, porque el icono y el placeholder ya la explican.
- Un contador a la derecha de la etiqueta usa `flex items-center justify-between` y `tabular-nums text-neutral-400 dark:text-neutral-500`.
- Los errores de formulario se muestran como toast (`ErrorToast`). Si un error es de un campo concreto, se pone debajo con `mt-1 text-xs font-semibold text-red-600 dark:text-red-400`, se añade `aria-invalid` y el borde pasa a `border-red-500/50`.
- `maxLength` coherente con la base de datos: nombre 255, autor y tag 100, plantilla 100.

**Búsqueda:** `SearchField`: lupa a la izquierda (`pl-9`), botón de limpiar `h-8 w-8` a la derecha y `h-11`. Dentro de paneles densos (sidebar, paleta de nodos) se usa `size="compact"` (`h-10`).

**Select:** `SelectField` (`components/select-field`, con `label`, `options` y `placeholder` opcional): `mediaFormInputClasses` + `appearance-none pr-10`, con icono `faChevronDown` en `absolute right-3.5 text-xs text-neutral-500`.

**Nombre, autor y tags con sugerencias:** `MetadataSuggestionField` y `MediaTagsField` (exportados desde `MediaFormModal.jsx`) con el estado de `useMediaMetadataForm`. `MediaMetadataFields` los compone; se usan sueltos cuando solo hace falta uno.

**Lista de valores:** `ChipListField` (en `MediaFormModal.jsx`): input con sugerencias que añade con Enter y chips que se quitan con un clic, con contador "N selected". `MediaTagsField` es un `ChipListField` con chips de tag; para otras listas (varios autores o nombres de media en una regla) los chips son neutros y llevan el icono de la entidad. `headerAction` añade una acción breve (`buttonClasses.textCompact`) junto al contador, fuera del `<label>` para no formar parte del nombre del input: p. ej. "Suggest" de la IA.

**Checkbox:** `CheckboxControl` (4×4, relleno invertido al marcar, icono `faCheck`). Para una opción con explicación se usa `CheckboxOption` (`title`, `description`), que la envuelve en una tarjeta clicable:

```
flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-100/60 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950/50
```

Dentro va un título `text-sm font-semibold` y una ayuda `text-xs text-neutral-500`.

**Interruptor (switch):** `Switch` (`components/switch`, con `label` y `showLabel`): botón `h-10` con pista `h-5 w-9 rounded-full p-0.5` (encendida `bg-neutral-950 dark:bg-white`, apagada `bg-neutral-300 dark:bg-neutral-700`) y bola `h-4 w-4 rounded-full` desplazada con `translate-x-4`. Lleva `role="switch"` y `aria-checked`. **Legado:** el interruptor dibujado dentro del ítem "Loading mode" de la sidebar.

**Sugerencias / autocompletado:** lista con el patrón de `MediaSuggestionList`:

- Posición `absolute top-[calc(100%+0.35rem)]`, `z-30`, `rounded-xl border bg-white p-1 shadow-xl dark:bg-neutral-900`, máximo 8 elementos, `role="listbox"`.
- Opción `min-h-9 rounded-xl px-3 text-sm font-medium`, con la activa resaltada en `bg-neutral-100 dark:bg-neutral-800`.
- Navegación con teclado mediante `useSuggestionNavigation` y orden con `utils/suggestionRanking.js`.
- `onMouseDown={e => e.preventDefault()}` para no perder el foco.

### 7.3 Tarjetas y bloques

**Tarjeta de gestión** (plantilla, álbum en lista, etc.):

```
min-w-0 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700
```

- Cabecera: título `text-lg font-bold truncate` y acciones `IconButton` a la derecha (`flex shrink-0 gap-1`).
- Secciones internas separadas por `mt-3 border-t border-neutral-200 pt-3 dark:border-neutral-800`.

**Bloque de dato** (par etiqueta/valor): `<dl>` con celdas `min-w-0 rounded-xl bg-neutral-100 px-3 py-2 dark:bg-neutral-950`. El `dt` va en `text-xs font-medium text-neutral-500 dark:text-neutral-400` y el `dd` en `mt-0.5 truncate text-sm font-semibold`.

**Tarjeta de media:** `MediaCard`. Prop opcional `mediaAction` (`{ icon, label, onClick, disabled }`): un botón `h-10 w-10 bg-black/65` abajo a la derecha de la imagen, siempre visible y con `Tooltip`, p. ej. restaurar. Miniatura `aspect-[4/3] rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-900`, favorito arriba a la izquierda, indicador de selección circular y pie con título `text-base font-bold` y metadatos `text-xs`. La selección se marca con `ring-2 ring-neutral-950 ring-offset-2 dark:ring-neutral-100`. No crear otra tarjeta de media; ampliar esta con props.

**Aviso en línea / panel informativo:** `rounded-xl border px-3 py-3` con fondo `/10` y borde `/30` del color semántico, icono a la izquierda y texto `text-sm`. El color nunca es la única señal: siempre hay icono y texto.

### 7.4 Tags y chips

- **Chip de tag** (canónico en toda la app; de solo lectura, `TagChip` en `components/tag-chip`):
  - Clases: `inline-flex max-w-full items-center gap-1.5 truncate rounded-xl border px-2 py-1 text-xs font-semibold`.
  - Color: `style={buildTagChipStyle(color)}` (o `buildDefaultTagStyle` para tags sin color).
  - Icono: `getTagIcon(...)`, que distingue tag guardada, tag nueva y tag de copyright.
  - Con botón de quitar: `faXmark` dentro del chip y `aria-label="Remove tag X"`.
  - **Tag bloqueada** (tag de sistema "Google Drive" en medias de Drive): `MediaMetadataFields` la recibe en `lockedTags` y la pinta primero como `<span>` (no botón), con `faGoogleDrive`, `faLock` en lugar de `faXmark`, `title` explicativo y texto `sr-only` "(can't be removed)". En la gestión de tags solo se le puede cambiar el color: en lugar de editar y borrar muestra `faLock`.
- **Chip de filtro activo** (búsqueda por facetas): píldora `rounded-full` `min-h-8`, con botón circular `h-5 w-5` para quitar.
- **Contador o badge neutro:** `rounded-full bg-neutral-200 px-2 text-xs font-bold tabular-nums dark:bg-neutral-800`.
- **Incluir / excluir tag en filtros:** botones `h-7 w-7 rounded-xl border`. Incluir activo en invertido; excluir activo en `border-red-500/50 bg-red-500/15 text-red-500`, con iconos `faPlus` y `faMinus`.

**Origen de la media:** `MediaSourceBadge` marca las medias cuyo original vive en Google Drive (`isDriveMedia` en `utils/mediaSource.js`). En tarjetas y listas es solo el icono `faGoogleDrive`, al final de la línea de metadatos (`autor · tags · icono`) con `withSeparator`, heredando tamaño y color, con `title` y texto `sr-only`. En el detalle va con etiqueta (`withLabel`): como chip junto al autor y el tamaño en escritorio, y tras la fecha en móvil. No se añaden badges ni colores nuevos para el origen.

### 7.5 Modales

Todos los modales:

- Van con `createPortal(…, document.body)`.
- Llevan `role="dialog"`, `aria-modal="true"` y `aria-labelledby` (más `aria-describedby` si hay descripción).
- Se cierran con Escape, con clic en el fondo (`onMouseDown` sobre el overlay) y con un `IconButton` `faXmark` en la cabecera. Las tres vías se desactivan mientras hay una operación en curso.

**Modal de formulario:** reutilizar `MediaFormModal`. Para nombre, autor y tags se usa `MediaMetadataFields` con el estado de `useMediaMetadataForm` y los datos de `useMetadata`:

- Overlay: `fixed inset-0 z-[1200] flex items-center justify-center bg-black/70 p-2 backdrop-blur-sm sm:p-4`.
- Caja: `rounded-xl border border-neutral-300 bg-neutral-50 shadow-2xl dark:border-neutral-800 dark:bg-neutral-900`, `max-h-[calc(100dvh-1rem)]`, `max-w-2xl` si es compacto.
- Cabecera: `h-16 border-b px-4 sm:px-6`, con título y subtítulo `truncate text-xs` que da el contexto ("3 files selected", nombre de la media).
- Cuerpo desplazable: `min-h-0 overflow-y-auto p-4 sm:p-6`.
- Pie: `flex shrink-0 flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end sm:px-6`.
- El `<form>` envuelve cuerpo y pie (`flex min-h-0 flex-col`) para que Enter envíe.

**Añadir medias:** todo flujo que añade medias a la biblioteca (subida desde el equipo, archivos de Google Drive) usa `UploadMediaModal` con su `variant` (`upload` o `drive`). Cambian el título, el icono y los textos; la estructura, el formulario, la vista previa y el progreso son los mismos. Un origen nuevo se añade como otra variante, no como otro modal. Con el asistente de IA instalado, el pie muestra la casilla "Tag with AI" (prop `aiTagging`, preferencia recordada en el navegador con `useAiTaggingPreference`).

**Confirmación:** `DeleteConfirmationModal` (`z-[1400]`, `max-w-md`, título como pregunta "Delete this template?", descripción de la consecuencia y botón de peligro; se cierra con Escape antes que cualquier modal de debajo). Para acciones destructivas que no son un borrado (p. ej. desconectar) se pasan `confirmLabel`, `pendingLabel` y `confirmIcon`. Con `tone="neutral"` el botón es primario, para acciones que no borran nada (p. ej. importar a Tagged). `children` añade un resumen entre la descripción y el pie, y `requireText` obliga a escribir una frase antes de confirmar: se usa en acciones de gran alcance que no deben lanzarse con un clic accidental. Toda acción destructiva o irreversible pasa por él; no usar `window.confirm`.

**Modal anidado:** `z-[1300]`. Con `MediaFormModal` se pasa `layer="nested"`: atiende Escape antes que el modal de debajo, así que solo se cierra el de arriba. Evitar más de dos niveles.

**Explorador de archivos externos** (`DriveBrowserModal`, para elegir fotos, vídeos y carpetas de Google Drive). Se monta sobre `MediaFormModal` y, cuando se abre con "Change" desde el modal de añadir medias, usa `layer="nested"` y conserva la selección:

- **Barra superior** (`border-b px-4 py-3 sm:px-6`): `SegmentedControl` con las vistas (*My Drive*, *Recent*, *Starred*, *Shared*; solo icono en móvil), filtro de tipo (*All*, *Images*, *Videos*, solo iconos, deshabilitado cuando en pantalla solo hay carpetas) y `SearchField` (`md:max-w-xs`) con retardo de 350 ms.
- **Barra de ubicación** (`min-h-14 border-b`): `IconButton` `faArrowLeft` para subir de carpeta, migas de pan con `buttonClasses.text` (en móvil solo las dos últimas) y, a la derecha, "Select all" / "Deselect all" (`faCheckDouble` / `faXmark`), que carga las páginas que falten hasta el límite.
- **Contenido:** carpetas primero, en filas `h-14 rounded-xl border` (el nombre abre la carpeta; el círculo de la derecha la selecciona entera) y después fotos y vídeos en rejilla cuadrada (`grid-cols-2` → `lg:grid-cols-5`) con el nombre debajo. Selección con el mismo círculo que `MediaCard` y anillo `ring-2`; Mayús + clic selecciona un rango. Los vídeos llevan su duración en una píldora `bg-black/65` y lo que ya está en la biblioteca aparece atenuado, con "In library" y sin poder seleccionarse.
- **Carga:** skeletons con la forma de la rejilla, scroll infinito con un `faSpinner` al final, `EmptyState` y `LoadErrorState` con `placement="section"`.
- **Pie:** resumen `aria-live` ("3 files and 1 folder selected") con "Clear", y a la derecha "Cancel" y "Continue" (`faArrowRight`). Excepción al pie apilado: en móvil los dos botones comparten fila (`grid grid-cols-2`) para dejar más alto a la rejilla.

### 7.6 Navegación

- **Ítem de sidebar:**
  - Base: `h-11 rounded-xl border px-3 text-sm font-bold`, icono `w-5` + texto `ml-3 truncate`.
  - Activo: `border-neutral-800 bg-neutral-900 text-white dark:border-neutral-700 dark:bg-neutral-800`.
  - Inactivo: `border-transparent text-neutral-600 hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-950`, con sus pares oscuros.
  - Cuando la sidebar está plegada, el ítem es un cuadrado `w-11` centrado con `title`.
- Una página nueva se añade a `navItems`/`adminNavItems` con su icono y a la lista de rutas de `useAccessControl`.
- **Modo demo:** un admin con el modo demo activo ve la barra de una biblioteca (subir, navegación y filtro de tags) y el subtítulo de la marca pasa a "Demo library". Sus páginas de administración (Logs, Actions, Users) se ocultan hasta que lo desactiva desde Account.
- **Paginación:** `Pagination` (botones de 40 px, página actual invertida con `aria-current="page"`).
- **Volver:** `IconButton` con `faArrowLeft` y `aria-label="Back to …"`.

### 7.7 Feedback y estados

| Situación | Solución canónica |
|---|---|
| Resultado de una acción | `toast.success("Template saved")` / `toast.error(...)` (Sonner, arriba a la derecha, estilos en `App.jsx`) |
| Error de petición | Automático desde `apiClient`; no duplicar toasts |
| Progreso largo (subida, descarga ZIP) | `useAppToast` con `progress` y cancelación (`ProgressToast`) |
| Carga inicial de página | `PageLoadingSkeleton` / `CollectionLoadingSkeleton` con la forma del contenido final |
| Recarga de resultados con datos ya visibles | `ResultsLoadingIndicator` flotante; no vaciar la vista. Con `placement="inline"` se coloca dentro de otro contenedor (p. ej. un panel del lienzo de reglas) |
| Error al cargar | `LoadErrorState` con `onRetry={() => query.refetch()}`, `placement="page"` o `"section"` |
| Sin datos / sin resultados | `EmptyState` con título, icono de la entidad y acción ("Create template" / "Clear search") |
| Barra de progreso | `ProgressBar` (`size` `sm`/`md`, `indeterminate`, `label` como nombre accesible): pista `h-1.5`/`h-2 rounded-full bg-neutral-200 dark:bg-neutral-700`; relleno `bg-neutral-950 dark:bg-white` |

**Tooltip:** `Tooltip` (`components/tooltip`, sobre `@floating-ui/react`). Envuelve a un único elemento disparador (sin `ref` propia) y se coloca solo donde cabe, en un portal. Panel `max-w-xs rounded-xl border bg-white text-xs shadow-xl dark:bg-neutral-900` en `z-[1500]`.

- `openOn="hover"` (por defecto): etiqueta breve que aparece con el ratón (300 ms) o con el foco. Sustituye a `title` en los `IconButton`, que conservan su `aria-label`. `shortcut={[MODIFIER_KEY, "Z"]}` añade el atajo con `Kbd`. Nunca contiene información esencial que no esté también en el `aria-label`.
- `openOn="click"`: ayuda más larga (texto, listas de atajos) que se abre y cierra al pulsar, también en táctil; recibe el foco al abrirse y se cierra con Escape o clic fuera. Se dispara desde un `IconButton` con `faCircleQuestion` y lleva `label` como nombre accesible. Ejemplo: `RuleEditorHelp`.
- No crear tooltips con `title` en controles nuevos ni otro componente de tooltip.

**Tecla de atajo:** `Kbd` (`components/kbd`): `<kbd>` `h-5 rounded-xl border bg-neutral-100 px-1.5 text-xs font-semibold dark:bg-neutral-800`, una por tecla ("Ctrl", "Shift", "Z").

- Los mensajes de toast son frases cortas en inglés: "Media updated", "3 files uploaded", "Could not delete album".
- Los contadores y estados dinámicos llevan `aria-live="polite"`. Los indicadores de carga llevan `role="status"` y texto `sr-only`.

### 7.8 Avatar

`UserAvatar` (`sm` 28 px, `md` 36 px, `lg` 96 px; `rounded-full`, iniciales `font-black` si no hay imagen).

### 7.9 Controles sobre media

Los botones sobre una imagen o vídeo (favorito, reproducir, cerrar en el visor) son iguales en ambos temas:

- Botón: `bg-black/65 text-white hover:bg-black/80 rounded-xl`.
- Iconos con `drop-shadow` cuando van sin fondo.
- Deben verse sin hover en táctil. En escritorio pueden atenuarse, pero nunca ocultarse del todo si la acción es esencial.

### 7.10 Editor de workflows (reglas)

Las reglas se editan como un workflow de nodos sobre un lienzo de **React Flow** (`@xyflow/react`), con la capa de tema de `styles/index.css` (sus estilos base van en `@layer components`, así que las utilidades de Tailwind mandan). No usar sus componentes con estilo propio (`Controls`, `MiniMap`): los controles se hacen con `IconButton`.

- **Página:** altura fija para el lienzo, `h-[calc(100dvh-6rem)] xl:h-[calc(100dvh-4rem)]` con `min-h-[34rem]`. Es una herramienta, así que su cabecera no es la de página: es una barra compacta como la de un IDE (`rounded-xl border bg-neutral-50 p-2 dark:bg-neutral-900`). A la izquierda, `IconButton` de volver, separador vertical (`h-6 w-px`), ruta "Rules /" (desde `sm`) y el nombre como `h1` `text-base font-bold`, que es un botón para renombrar con `faPen` (sin fondo en hover: solo el lápiz pasa de gris a `neutral-950`/`white`); un punto `h-2 w-2 rounded-full` con `animate-heartbeat` indica cambios sin guardar, como la pestaña de un editor, y al final va la ayuda (`RuleEditorHelp`). A la derecha, `Switch` "Active", separador, "Run rule" (`faPlay`) y "Save" (`faFloppyDisk`, también Ctrl/Cmd + S). Excepción a una sola acción primaria: los dos son secundarios (y deshabilitados) mientras no se pueden usar y pasan a primarios cuando sí: "Run rule" con el workflow completo y "Save" con cambios sin guardar. En móvil la barra ocupa dos filas y los dos botones comparten la segunda (`grid grid-cols-2`) junto al interruptor.
- **Barra de estado:** bajo el lienzo, `h-8 rounded-xl border bg-neutral-50 text-xs font-semibold tabular-nums`, como la de VS Code: punto y texto "Active"/"Inactive" (verde o neutro, nunca solo color), "3 nodes", "4 connections" y "1 issue" en ámbar (desde `sm`) y, a la derecha, el guardado ("Unsaved changes", `aria-live`).
- **Ayuda:** los consejos y atajos del editor van en el `Tooltip` de ayuda de la barra superior, no como texto fijo en la paleta. Los botones de icono del lienzo usan `Tooltip` con su atajo.
- **Paleta de nodos:** panel `w-72` desde `lg`; por debajo, botón "Add node" sobre el lienzo que abre la misma paleta en un modal. Cada nodo es un botón `min-h-14` que se arrastra al lienzo o se añade con un clic. Con un nodo seleccionado, el nuevo se coloca a su derecha y se conecta a su salida ("True" en condiciones); así se construye el workflow en táctil sin arrastrar conexiones.
- **Lienzo:** `rounded-xl border bg-neutral-50 dark:bg-neutral-950` con fondo de puntos. Zoom y encuadre con `IconButton` apilados abajo a la izquierda; deshacer, rehacer y "Select area" arriba a la derecha; abajo en el centro, la barra de selección múltiple y el estado o resultado de la ejecución (en teléfono, por encima de los botones de zoom).
- **Nodo** (`RuleNode`): tarjeta `w-64` (`bg-white dark:bg-neutral-900`, borde de control) con icono en caja, categoría en eyebrow ("Trigger", "Condition", "Action") y título `text-sm font-bold`; debajo, resumen `text-xs`, chips de tag (`TagChip`, máximo 4 y "+N") y, si falta configuración, aviso `text-amber-600 dark:text-amber-400` con `faTriangleExclamation`. Seleccionado: anillo `ring-2` como `MediaCard`, con una barra flotante de `IconButton` (editar, duplicar y borrar) que sustituye al hover. Puntos de conexión `h-3.5 w-3.5 rounded-full` con zona táctil ampliada; las condiciones tienen dos salidas etiquetadas, "True" (`faCheck`) y "False" (`faXmark`). La categoría y las salidas se indican con texto, nunca solo con color.
- **Conexión:** curva neutra con flecha. Si es lo único seleccionado aparece un `IconButton` `faTrash` en su centro (tamaño fijo aunque cambie el zoom).
- **Selección y configuración de un nodo:** el primer clic lo selecciona; un clic sobre un nodo ya seleccionado, un doble clic, Enter o el botón editar abren su configuración en un `MediaFormModal` compacto (arrastrarlo no la abre). El modal muestra la descripción del nodo, sus campos y el pie "Delete node" (`dangerGhost`, a la izquierda), "Cancel" y "Apply"; los cambios se guardan en la regla con "Save". Añadir un nodo no la abre: el nodo aparece seleccionado en el lienzo. La barra flotante del nodo solo aparece con un único nodo seleccionado.
- **Selección múltiple:** Ctrl/⌘ (o Shift) + arrastrar sobre el lienzo selecciona los nodos que toca el área, como la selección de medias en la galería; Ctrl/⌘ + clic suma o quita un nodo. En táctil, el `IconButton` "Select area" (`faObjectGroup`, `aria-pressed`) hace que arrastrar seleccione en lugar de mover el lienzo. Con varios nodos, una barra abajo ("2 nodes selected") permite duplicarlos (`faCopy`) o borrarlos (`faTrash`). Escape deselecciona.
- **Copiar y pegar:** Ctrl/⌘ + C copia los nodos seleccionados y las conexiones entre ellos; Ctrl/⌘ + V los pega con su configuración y Ctrl/⌘ + Shift + V los pega sin configurar, desplazados y seleccionados. No actúan mientras se escribe o hay un modal abierto, y el portapapeles se conserva al cambiar de regla. En táctil, el botón "Duplicate" (`faCopy`) de la barra del nodo.
- **Deshacer y rehacer:** Ctrl/⌘ + Z y Ctrl/⌘ + Shift + Z (o Ctrl + Y), también con sus `IconButton`. Cubren añadir, pegar, duplicar, mover y borrar nodos, conectar y cambiar la configuración de un nodo (no el nombre ni "Active"). Dentro de un campo de texto son los del propio campo.
- **Ejecución:** la confirmación se cierra al momento y el lienzo muestra el progreso: conexiones animadas (quietas con movimiento reducido), un `faSpinner` en cada nodo conectado, `ResultsLoadingIndicator` en línea y "Running..." en el botón; el lienzo se bloquea mientras tanto (se puede mover y ampliar) y el estado se ve al menos 800 ms. Al terminar, cada conexión muestra en un badge cuántas medias pasaron, las salidas "True"/"False" su recuento, los disparadores "Checked N media" y las acciones "Changed X of Y media"; abajo, el resumen con "Clear results". El resultado se oculta si cambia el workflow y vuelve si se deshace el cambio.
- **Pendientes:** aviso en línea ámbar sobre el lienzo con lo que falta para activar o ejecutar la regla; cada problema de un nodo es un enlace de texto que lo centra y selecciona.

### 7.11 Asistente de IA

El asistente etiqueta medias en el servidor con las tags que el usuario ya usa en medias parecidas (`hooks/useAiAssistant.js`). Solo añade tags; nunca quita ninguna.

- **Página `/assistant`:** página de herramienta con `IntegrationHero` (icono `faWandMagicSparkles`, eyebrow "Library tools", punto verde con los modelos instalados y la línea de estado "Ready · N of M media analyzed" o el progreso de la descarga). Acción principal: "Set up assistant" (`faDownload`) sin modelos y "Tag library" con ellos, que pasa por `DeleteConfirmationModal` con `tone="neutral"`. Secciones: "Overview" (`StatTile`), "Activity" (progreso con `ProgressBar`, tiempo restante y "Stop", o el resultado en `InlineNotice`), "Settings" (filas `DetailRow` y "Edit settings", que abre un `MediaFormModal` compacto con `SegmentedControl` de confianza y `MediaTagsField` de tags excluidas), "Safeguards" y "Models" (borrar los modelos con `dangerGhost` y confirmación).
- **Acciones en el resto de la app:** solo aparecen con los modelos instalados (`useIsAiReady`), siempre con `faWandMagicSparkles` y el texto "Tag with AI":
  - Barra de selección de la galería y de los álbumes: `AiTagSelectionButton`. Muestra un toast de carga y después el resultado ("Added 3 tags to 2 media").
  - Subida y alta desde Drive: casilla "Tag with AI" en el pie de `UploadMediaModal`.
  - Edición de una sola media: "Suggest" en el campo de tags. Añade las sugerencias al formulario sin guardar, para que el usuario las revise.
- **Feedback:** los toasts dicen cuántas tags añadió y a cuántas medias, y avisan si las salvaguardas descartaron alguna. Sin coincidencias: "No new tags to add" / "No tags to suggest" con la explicación.

---

## 8. Iconografía

- Font Awesome, importando cada icono por nombre desde `free-solid-svg-icons` (o `free-regular-svg-icons` para el estado vacío o apagado). `free-brands-svg-icons` solo para logotipos de servicios integrados, como Google Drive.
- Tamaño: hereda el del texto. Los iconos de navegación van con `w-5 shrink-0`. Los iconos protagonistas de estados vacíos usan `text-5xl sm:text-6xl`.
- Icono decorativo o acompañado de texto: `aria-hidden="true"`.

**Diccionario de acciones y entidades (obligatorio):**

| Concepto | Icono |
|---|---|
| Cerrar, quitar de una lista | `faXmark` |
| Crear, añadir, incluir | `faPlus` |
| Excluir | `faMinus` |
| Editar | `faPen` |
| Eliminar | `faTrash` |
| Papelera (pestaña, estado vacío) / restaurar | `faTrashCan` / `faRotateLeft` |
| Guardar | `faFloppyDisk` |
| Subir | `faCloudArrowUp` |
| Importar a Tagged (copiar desde un servicio externo) | `faCloudArrowDown` |
| Descargar | `faDownload` |
| Buscar | `faMagnifyingGlass` |
| Filtrar / limpiar filtros | `faFilter` / `faFilterCircleXmark` |
| Seleccionado / seleccionar todo | `faCheck` / `faCheckDouble` |
| Reintentar | `faRotate` |
| Ordenar por lo que caduca antes | `faHourglassHalf` |
| Cargando | `faSpinner` (`spin`) |
| Favorito activo / inactivo | `faHeart` sólido / `faHeart` regular |
| Media, imagen / vídeo | `faImage` / `faFilm` (reproducir: `faPlay`, pausa: `faPause`) |
| Galería | `faImages` |
| Álbum / añadir a álbum | `faFolderOpen` / `faFolderPlus` |
| Tag / metadatos | `faTag` / `faTags` |
| Copyright | `faCopyright` |
| Plantilla, duplicar | `faCopy` |
| Dashboard | `faChartColumn` |
| Vista tarjetas / lista | `faTableCellsLarge` / `faList` |
| Aleatorio / montaje | `faShuffle` |
| Anterior / siguiente | `faChevronLeft` / `faChevronRight` (extremos: `faAnglesLeft` / `faAnglesRight`) |
| Volver / avanzar en acción | `faArrowLeft` / `faArrowRight` |
| Desplegar | `faChevronDown` |
| Reordenar (arrastrar) | `faGripVertical` |
| Ordenar / cambiar criterio de orden | `faArrowUpWideShort` |
| Tema claro / oscuro | `faSun` / `faMoon` |
| Cuenta / usuarios | `faUser` / `faUsers` |
| Cerrar sesión | `faRightFromBracket` |
| Google Drive (pestaña, origen de una media) | `faGoogleDrive` (`@fortawesome/free-brands-svg-icons`) |
| Carpeta de un servicio externo | `faFolder` |
| Vistas del explorador: unidad / recientes / destacados / compartido | `faHardDrive` / `faClock` / `faStar` / `faUserGroup` |
| Almacenamiento / última subida (panel) | `faHardDrive` / `faClock` |
| GIF (imagen animada) | `faPhotoFilm` |
| Autor / nombre de media (panel, nodos de reglas) | `faUserPen` / `faFont` |
| Desconectar una integración | `faLinkSlash` |
| Elemento gestionado por la app (no editable) | `faLock` |
| Mostrar / ocultar contraseña | `faEye` / `faEyeSlash` |
| Modo demo / resetear la demo | `faFlask` / `faRotateLeft` |
| Reglas / ejecutar una regla | `faDiagramProject` / `faPlay` |
| Deshacer / rehacer | `faArrowRotateLeft` / `faArrowRotateRight` |
| Seleccionar un área (modo selección del lienzo) | `faObjectGroup` |
| Acercar / alejar / encajar la vista del lienzo | `faMagnifyingGlassPlus` / `faMagnifyingGlassMinus` / `faExpand` |
| Falta configuración (aviso) | `faTriangleExclamation` |
| Ayuda (abre un `Tooltip` con `openOn="click"`) | `faCircleQuestion` |
| Asistente de IA / etiquetar con IA / sugerir tags | `faWandMagicSparkles` |
| Confianza de la IA: estricta / equilibrada / relajada | `faBullseye` / `faScaleBalanced` / `faFeather` |
| Salvaguardas / contenido excluido / ajuste | `faShieldHalved` / `faBan` / `faSliders` |
| Se ejecuta en (procesador del servidor) | `faMicrochip` |
| Nodos disparadores: media añadida / editada / restaurada / ejecución manual | `faPlus` / `faPen` / `faRotateLeft` / `faHandPointer` |
| Nodos de condición: nombre de media / autor / tamaño / resolución / orientación / tipo de media / historial de papelera | `faFont` / `faUserPen` / `faWeightHanging` / `faRulerCombined` / `faCropSimple` / `faPhotoFilm` / `faTrashCan` |
| Nodos de acción: añadir tags / quitar tags / favorito / añadir a álbum | `faTag` / `faEraser` / `faHeart` / `faFolderPlus` |

Para una acción que no esté en la tabla, se elige el icono, se usa en todos los sitios de esa acción y se añade aquí.

---

## 9. Textos de interfaz

- La interfaz está en **inglés**. La documentación y los comentarios están en español.
- Mayúscula solo al inicio (sentence case) en títulos, botones y etiquetas: "Add to album", no "Add To Album".
- Los nombres de entidad son siempre los mismos: *media* (singular y plural), *tag*, *album*, *template*, *rule* (y *node* para sus piezas: *trigger*, *condition*, *action*), *favourites* (ortografía británica, como en las rutas), *author*, *media name*.
- Pluralización explícita: `1 template` / `3 templates`.
- Los placeholders dan un ejemplo o la acción ("For example: Travel photos", "Type a tag and press Enter"); no repiten la etiqueta.
- El texto del botón de confirmación nombra la acción ("Delete album"), no "OK" ni "Yes".
- Un valor vacío se muestra como "Undefined" (nombre) o se omite el bloque; nunca se deja un hueco sin explicar.

---

## 10. Accesibilidad (mínimos)

- Foco visible en todo control. Botones, enlaces y opciones usan `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500` y los inputs `focus:border-neutral-500`.
- Controles nativos (`button`, `input`, `select`, `label`, `a`). Un `div` clicable está prohibido.
- Botones de estado (toggle, favorito, filtros) con `aria-pressed`. Pestañas y navegación con `aria-current`. Listas de sugerencias con `role="listbox"` y opciones con `aria-selected`.
- Imágenes con `alt` (el nombre de la media); las decorativas con `alt=""`.
- La información nunca se transmite solo con color (tags de copyright con icono, excluir con icono `faMinus`, errores con texto).
- Orden de tabulación lógico. Los modales devuelven el foco al cerrarse (comprobarlo al crear uno nuevo).

---

## 11. Antipatrones (rechazar en revisión)

- Colores fuera de `neutral` y de los semánticos, o un color sin su par `dark:`.
- Radios distintos de `rounded-xl`, o `rounded-full` sin significado circular.
- Sombras en tarjetas o botones, gradientes, `blur` decorativo o bordes de colores.
- Nuevos archivos `.css`, clases `tagged-*` nuevas, `style={{}}` para valores estáticos o valores arbitrarios con equivalente en la escala.
- Modificadores `!` en código nuevo.
- Otra variante de botón, input, modal, tarjeta de media o chip de tag en vez de reutilizar la existente.
- SVG propios o iconos distintos para una acción que ya tiene icono.
- Acciones visibles solo con hover.
- Anchos o altos fijos en px que desborden en móvil, o `vh` en lugar de `dvh`.
- Textos en español en la interfaz o capitalización Title Case.

---

## 12. Checklist antes de dar por terminada una UI

- [ ] Reutiliza componentes y recetas de esta guía; si se ha creado algo nuevo, está documentado aquí.
- [ ] Solo `neutral-*` y semánticos, cada uno con su `dark:`. Probado primero en oscuro y después en claro.
- [ ] `rounded-xl` en todo, sin sombras salvo las permitidas.
- [ ] Alturas de control según la tabla 4.2. Objetivos táctiles de al menos 40 px.
- [ ] Estados de hover, focus-visible, active, disabled, loading, vacío y error cubiertos.
- [ ] Iconos según el diccionario, con `aria-label` en botones solo icono.
- [ ] Textos en inglés, en sentence case y con pluralización correcta.
- [ ] Revisado en smartphone (375 px), tablet (768 px), laptop (1280 px) y escritorio (≥1536 px), sin scroll horizontal.
- [ ] Modales: Escape, clic fuera, foco, cabecera con contexto y pie apilado en móvil.
- [ ] Lint y build del cliente sin errores.
