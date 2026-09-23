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
  - **Aviso:** `amber`. Aviso en línea `border-amber-500/30 bg-amber-500/10` con icono `text-amber-600 dark:text-amber-400` (`DriveNotice`, tono `warning`); punto de estado `bg-amber-500`.
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

- **Página de perfil o integración** (Account, Google Drive): sin tarjeta envolvente. Cabecera grande con icono o avatar (`h-24 w-24`) y punto de estado, eyebrow, `h1` y, debajo, una línea `text-sm text-neutral-500` que integra el estado con su icono semántico y el dato principal ("✓ Connected as email"); sin píldoras de estado. Acción principal a la derecha; `border-b pb-8`. Debajo, `max-w-5xl` con secciones `py-8` separadas por `divide-y` (título `text-xl font-bold` y descripción), indicadores en rejilla `grid-cols-2 lg:grid-cols-4` y datos en filas `divide-y` con etiqueta en mayúsculas e icono (`w-44`) a la izquierda.
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
- Listados de tarjetas de gestión (plantillas, etc.): `grid items-start gap-3 lg:grid-cols-2`.
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
| `shadow-xl` | Menús desplegables, listas de sugerencias y toasts |
| `shadow-lg` | Indicadores flotantes (`ResultsLoadingIndicator`) |
| `shadow-sm` / `shadow-md` | Botón flotante del menú móvil y controles sobre media |

Prohibidos los gradientes decorativos, los resplandores (`blur` decorativo) y las sombras de color. El fondo con orbes de `.tagged-shell-content` y de la pantalla de inicio es **legado**.

### 5.4 Capas (z-index)

Se usa siempre esta escala; no inventar valores intermedios:

| Capa | Valor |
|---|---|
| Elementos dentro de tarjeta o media (controles superpuestos) | `z-10` / `z-20` |
| Listas de sugerencias y desplegables en línea | `z-30` (dentro de modal) / `z-50` (en página) |
| Fondo del drawer de sidebar | `z-40` |
| Sidebar en drawer | `z-50` |
| Botón flotante de menú móvil | `z-70` |
| Indicador flotante de resultados | `z-[80]` |
| Modal principal (subida, edición, formulario) | `z-[1200]` |
| Modal abierto desde otro modal | `z-[1300]` |
| Confirmaciones y diálogos sobre cualquier modal | `z-[1400]` |
| Capa de selección con marquesina | `z-[2000]` |

### 5.5 Superposiciones

- **Fondo de modal:** `bg-black/70 backdrop-blur-sm`.
- **Fondo del drawer de sidebar:** `bg-black/60` sin blur.
- **Visor de media a pantalla completa:** `bg-black/90`.

---

## 6. Movimiento

- Transición por defecto: `transition-colors`. Usar `transition-transform` y `transition-opacity` cuando cambie solo eso. Evitar `transition-all`.
- Duración: por defecto (150 ms) o `duration-200`. Hasta `duration-500` solo en la pantalla de inicio.
- Microinteracciones permitidas:
  - `hover:scale-105` en la tarjeta de media.
  - Desplazamiento `group-hover:translate-x-1` de la flecha en acciones de estado vacío.
  - Latido del favorito.
  - `animate-pulse` en skeletons.
  - `spin` en `faSpinner`.
- Todo movimiento que no sea un cambio de color lleva `motion-reduce:transition-none` / `motion-reduce:animate-none`.

---

## 7. Componentes

Antes de maquetar, se busca el componente en esta lista. Si existe, se usa; si no, se usa la receta.

### 7.1 Botones

**En código nuevo, usar `buttonClasses` (`components/button/buttonClasses.js`: `primary`, `secondary`, `dangerGhost`, `text`) en lugar de copiar las recetas.** No hace falta `!`: el estilo global de `button` está en `@layer base` y las utilidades de Tailwind lo sobrescriben. Ese estilo global sí fija `width: 100%`, borde de 2 px y fondo oscuro, así que **todo botón declara siempre su ancho, borde, fondo y padding**. En código nuevo no se añaden `!` (el código existente los usa por inercia; son **legado**).

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

**Texto / enlace:** acción terciaria, p. ej. "Clear", "Retry" o "Create one". `w-auto border-0 bg-transparent p-0 text-xs font-semibold text-neutral-600 underline shadow-none dark:text-neutral-300`. Un enlace de navegación usa `<Link>`, no `<button>`.

**Solo icono:** siempre `IconButton` (`h-10 w-10 rounded-xl`, borde de control, `bg-neutral-50 dark:bg-neutral-900`), con `aria-label` y `title` si la acción no es obvia. Los iconos van con `aria-hidden="true"`.

**Segmented control / toggle de vista** (filtro de tipo, tarjetas o lista):

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

**Búsqueda:** `SearchField`: lupa a la izquierda (`pl-9`), botón de limpiar `h-8 w-8` a la derecha y `h-11`. Dentro de paneles densos (sidebar) se usa `h-10`.

**Select:** `mediaFormInputClasses` + `appearance-none pr-10`, con icono `faChevronDown` en `absolute right-3.5 text-xs text-neutral-500`.

**Checkbox:** `CheckboxControl` (4×4, relleno invertido al marcar, icono `faCheck`). Para una opción con explicación se usa `CheckboxOption` (`title`, `description`), que la envuelve en una tarjeta clicable:

```
flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-100/60 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950/50
```

Dentro va un título `text-sm font-semibold` y una ayuda `text-xs text-neutral-500`.

**Interruptor (switch):** pista `h-5 w-9 rounded-full p-0.5` (encendida `bg-neutral-950 dark:bg-white`, apagada `bg-neutral-300 dark:bg-neutral-700`) y bola `h-4 w-4 rounded-full` desplazada con `translate-x-4`. Lleva `role="switch"` y `aria-checked`. Si se usa en más de un sitio, extraerlo a un componente `Switch`.

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

**Tarjeta de media:** `MediaCard`. Miniatura `aspect-[4/3] rounded-xl overflow-hidden bg-neutral-200 dark:bg-neutral-900`, favorito arriba a la izquierda, indicador de selección circular y pie con título `text-base font-bold` y metadatos `text-xs`. La selección se marca con `ring-2 ring-neutral-950 ring-offset-2 dark:ring-neutral-100`. No crear otra tarjeta de media; ampliar esta con props.

**Aviso en línea / panel informativo:** `rounded-xl border px-3 py-3` con fondo `/10` y borde `/30` del color semántico, icono a la izquierda y texto `text-sm`. El color nunca es la única señal: siempre hay icono y texto.

### 7.4 Tags y chips

- **Chip de tag** (canónico en toda la app):
  - Clases: `inline-flex max-w-full items-center gap-1.5 truncate rounded-xl border px-2 py-1 text-xs font-semibold`.
  - Color: `style={buildTagChipStyle(color)}` (o `buildDefaultTagStyle` para tags sin color).
  - Icono: `getTagIcon(...)`, que distingue tag guardada, tag nueva y tag de copyright.
  - Con botón de quitar: `faXmark` dentro del chip y `aria-label="Remove tag X"`.
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

**Añadir medias:** todo flujo que añade medias a la biblioteca (subida desde el equipo, archivos de Google Drive) usa `UploadMediaModal` con su `variant` (`upload` o `drive`). Cambian el título, el icono y los textos; la estructura, el formulario, la vista previa y el progreso son los mismos. Un origen nuevo se añade como otra variante, no como otro modal.

**Confirmación:** `DeleteConfirmationModal` (`z-[1400]`, `max-w-md`, título como pregunta "Delete this template?", descripción de la consecuencia y botón de peligro). Para acciones destructivas que no son un borrado (p. ej. desconectar) se pasan `confirmLabel`, `pendingLabel` y `confirmIcon`. Toda acción destructiva o irreversible pasa por él; no usar `window.confirm`.

**Modal anidado:** `z-[1300]`. Evitar más de dos niveles.

### 7.6 Navegación

- **Ítem de sidebar:**
  - Base: `h-11 rounded-xl border px-3 text-sm font-bold`, icono `w-5` + texto `ml-3 truncate`.
  - Activo: `border-neutral-800 bg-neutral-900 text-white dark:border-neutral-700 dark:bg-neutral-800`.
  - Inactivo: `border-transparent text-neutral-600 hover:border-neutral-200 hover:bg-neutral-100 hover:text-neutral-950`, con sus pares oscuros.
  - Cuando la sidebar está plegada, el ítem es un cuadrado `w-11` centrado con `title`.
- Una página nueva se añade a `navItems`/`adminNavItems` con su icono y a la lista de rutas de `useAccessControl`.
- **Paginación:** `Pagination` (botones de 40 px, página actual invertida con `aria-current="page"`).
- **Volver:** `IconButton` con `faArrowLeft` y `aria-label="Back to …"`.

### 7.7 Feedback y estados

| Situación | Solución canónica |
|---|---|
| Resultado de una acción | `toast.success("Template saved")` / `toast.error(...)` (Sonner, arriba a la derecha, estilos en `App.jsx`) |
| Error de petición | Automático desde `apiClient`; no duplicar toasts |
| Progreso largo (subida, descarga ZIP) | `useAppToast` con `progress` y cancelación (`ProgressToast`) |
| Carga inicial de página | `PageLoadingSkeleton` / `CollectionLoadingSkeleton` con la forma del contenido final |
| Recarga de resultados con datos ya visibles | `ResultsLoadingIndicator` flotante; no vaciar la vista |
| Error al cargar | `LoadErrorState` con `onRetry={() => query.refetch()}`, `placement="page"` o `"section"` |
| Sin datos / sin resultados | `EmptyState` con título, icono de la entidad y acción ("Create template" / "Clear search") |
| Barra de progreso | Pista `h-1.5`/`h-2 rounded-full bg-neutral-200 dark:bg-neutral-700`; relleno `bg-neutral-950 dark:bg-white` |

- Los mensajes de toast son frases cortas en inglés: "Media updated", "3 files uploaded", "Could not delete album".
- Los contadores y estados dinámicos llevan `aria-live="polite"`. Los indicadores de carga llevan `role="status"` y texto `sr-only`.

### 7.8 Avatar

`UserAvatar` (`sm` 28 px, `md` 36 px, `lg` 96 px; `rounded-full`, iniciales `font-black` si no hay imagen).

### 7.9 Controles sobre media

Los botones sobre una imagen o vídeo (favorito, reproducir, cerrar en el visor) son iguales en ambos temas:

- Botón: `bg-black/65 text-white hover:bg-black/80 rounded-xl`.
- Iconos con `drop-shadow` cuando van sin fondo.
- Deben verse sin hover en táctil. En escritorio pueden atenuarse, pero nunca ocultarse del todo si la acción es esencial.

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
| Guardar | `faFloppyDisk` |
| Subir | `faCloudArrowUp` |
| Descargar | `faDownload` |
| Buscar | `faMagnifyingGlass` |
| Filtrar / limpiar filtros | `faFilter` / `faFilterCircleXmark` |
| Seleccionado / seleccionar todo | `faCheck` / `faCheckDouble` |
| Reintentar | `faRotate` |
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
| Tema claro / oscuro | `faSun` / `faMoon` |
| Cuenta / usuarios | `faUser` / `faUsers` |
| Cerrar sesión | `faRightFromBracket` |
| Google Drive (pestaña, origen de una media) | `faGoogleDrive` (`@fortawesome/free-brands-svg-icons`) |
| Desconectar una integración | `faLinkSlash` |
| Mostrar / ocultar contraseña | `faEye` / `faEyeSlash` |

Para una acción que no esté en la tabla, se elige el icono, se usa en todos los sitios de esa acción y se añade aquí.

---

## 9. Textos de interfaz

- La interfaz está en **inglés**. La documentación y los comentarios están en español.
- Mayúscula solo al inicio (sentence case) en títulos, botones y etiquetas: "Add to album", no "Add To Album".
- Los nombres de entidad son siempre los mismos: *media* (singular y plural), *tag*, *album*, *template*, *favourites* (ortografía británica, como en las rutas), *author*, *media name*.
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
