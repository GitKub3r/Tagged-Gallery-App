# Normas de desarrollo para Codex

Estas reglas se aplican a todo el repositorio. Son obligatorias para cualquier cambio nuevo y para toda refactorización del frontend.

## Prioridad principal: consistencia y reutilización

- La consistencia visual y de código tiene prioridad sobre introducir variantes nuevas.
- Antes de crear un componente, hook, utilidad, patrón, clase o estilo, buscar si ya existe uno equivalente.
- Si existe, reutilizarlo. Si casi encaja, ampliarlo mediante props sencillas en vez de duplicarlo.
- Extraer un componente React cuando una misma estructura o comportamiento aparezca dos veces, o cuando sea evidente que se repetirá.
- Mantener los componentes pequeños, legibles y fáciles de mantener. No crear abstracciones complejas para casos hipotéticos.
- Una misma acción debe tener el mismo aspecto, icono, texto, estado y comportamiento en toda la aplicación.
- No copiar y pegar bloques de UI ni lógica que puedan compartirse.
- Seguir las convenciones ya adoptadas en el código nuevo. No introducir una segunda forma de resolver el mismo problema sin sustituir la anterior.

## Sistema visual

- El diseño debe ser minimalista, sobrio y coherente.
- Usar una paleta corta basada en grises neutros. Evitar azules oscuros y colores saturados como base de la interfaz.
- Reservar colores semánticos para estados que los necesiten: éxito, aviso, error e información.
- El modo oscuro es el tema predeterminado. La primera carga nunca debe mostrar brevemente el tema claro.
- Mantener una jerarquía clara mediante espaciado, tipografía, contraste y peso visual; no mediante adornos innecesarios.
- Evitar sombras fuertes, gradientes decorativos, bordes llamativos y ruido visual.

## Bordes y radio

- Se prohíben las esquinas rectas en elementos de interfaz como tarjetas, paneles, inputs, botones, menús, modales y avisos.
- Usar un único radio estándar: `rounded-xl` de Tailwind (`0.75rem`).
- No usar otros radios (`rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-2xl`, valores arbitrarios, etc.).
- `rounded-full` solo se permite cuando la forma circular tiene significado: avatar, indicador circular o badge tipo píldora. No usarlo como variante estética de botones o contenedores normales.
- Centralizar cualquier cambio futuro del radio estándar; no cambiar componentes uno a uno.

## CSS y Tailwind

- Tailwind CSS es el framework de estilos del frontend y la opción obligatoria para todo estilo nuevo.
- No crear nuevos archivos CSS por página o componente.
- El CSS global se limita a la configuración base, tokens, resets y casos que Tailwind no pueda expresar razonablemente.
- No usar estilos inline salvo valores realmente dinámicos que Tailwind no pueda representar.
- No introducir valores arbitrarios si existe un token o utilidad equivalente.
- Definir en la configuración de Tailwind los colores, espaciados y demás tokens compartidos. No repetir valores mágicos.
- Al modificar una pantalla antigua, migrar a Tailwind la parte afectada y eliminar el CSS legado que deje de utilizarse.
- No mezclar dos sistemas visuales dentro de un componente nuevo.
- Usar una utilidad de composición de clases compartida cuando haya clases condicionales; no concatenarlas de formas distintas en cada componente.

## Iconos

- Usar Font Awesome mediante sus paquetes oficiales para React.
- No añadir, descargar ni cargar SVG de iconos desde `public`, `src/assets` u otras carpetas.
- Cuando se migre una pantalla, sustituir sus SVG locales por el icono equivalente de Font Awesome y retirar los recursos que hayan quedado sin uso.
- Usar iconos cuando mejoren la identificación rápida de una acción o estado.
- No añadir iconos puramente decorativos ni repetirlos sin aportar información.
- Reutilizar siempre el mismo icono para la misma acción en toda la app.
- Los botones que solo muestran un icono deben tener nombre accesible mediante `aria-label` y un tooltip cuando la acción no sea obvia.
- Importar únicamente los iconos utilizados; no cargar una librería completa ni usar el CDN global.

## Componentes y estructura React

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

## Comunicación con el backend y estado remoto

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

## Accesibilidad e interacción

- Usar HTML semántico y controles nativos siempre que sea posible.
- Toda interacción debe funcionar con teclado y mostrar un foco visible coherente.
- Mantener contraste suficiente en modo oscuro, incluidos estados deshabilitados y textos secundarios.
- Incluir estados coherentes de hover, focus, active, loading, disabled, error y vacío cuando correspondan.
- No comunicar información únicamente mediante color.

## Diseño responsive

- Todo lo desarrollado en el frontend debe ser responsive desde el primer cambio. No se acepta dejar la adaptación para una tarea posterior.
- Diseñar y verificar, como mínimo, estos cuatro contextos: PC de escritorio, laptop, iPad/tablet y smartphone.
- Usar un enfoque mobile-first con breakpoints consistentes de Tailwind. No crear media queries arbitrarias por componente.
- La interfaz debe adaptarse por composición, tamaño y densidad; no limitarse a reducir texto o esconder contenido importante.
- Evitar anchos y altos fijos que provoquen overflow. Priorizar `min-*`, `max-*`, grid, flex, `clamp()` y unidades relativas cuando correspondan.
- Mantener objetivos táctiles cómodos, navegación usable con una mano y separación suficiente entre acciones en tablet y smartphone.
- No depender de hover para revelar una acción esencial. Toda funcionalidad debe estar disponible en dispositivos táctiles.
- Comprobar que no existe scroll horizontal accidental y que modales, tablas, formularios, menús y estados vacíos funcionan en los cuatro contextos.

## Flujo de trabajo obligatorio

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

## Criterio ante dudas

Si hay varias soluciones válidas, elegir en este orden: reutilizar lo existente, mantener la consistencia, escribir menos código, facilitar el mantenimiento y solo después introducir algo nuevo.
