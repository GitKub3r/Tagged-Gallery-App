---
name: new-frontend-component
description: Crear o modificar una pantalla o componente React de Tagged siguiendo el sistema visual y las normas del proyecto (Tailwind, neutral-*, rounded-xl, modo oscuro, responsive, Font Awesome).
---

# Nuevo componente o pantalla de frontend

Sigue `.claude/CLAUDE.md` (secciones "Lenguaje visual observado" y "Normas de diseño e interacción").

1. **Buscar antes de crear.** Revisa `client/src/components/` (`IconButton`, `EmptyState`, `LoadErrorState`, `LibraryToolbar`, `SearchField`, `Pagination`, `MediaFormModal`, `loading-skeletons/`, `toast/`) y `client/src/utils/` (`tagStyle`, `tagIcon`). Reutiliza o amplía con props explícitas.
2. **Ubicación.** Compartido: `client/src/components/<kebab-case>/<PascalCase>.jsx`. Solo de una página: `pages/<nombre>page/components/`. Exportación con nombre y función flecha.
3. **Estilos.** Solo Tailwind. Paleta `neutral-*` con su variante `dark:` en cada color, `rounded-xl`, foco `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500`. Sin CSS nuevo, sin estilos inline (salvo colores de tag dinámicos), sin sombras fuertes ni gradientes.
4. **Botones y campos.** Copia las clases del botón primario/secundario y `mediaFormInputClasses`. Botones solo icono con `IconButton` y `aria-label`.
5. **Iconos.** Font Awesome, importando solo los usados; reutiliza el icono existente de la misma acción.
6. **Datos.** Nada de `fetch` ni `useEffect` para peticiones: usa hooks de React Query sobre `client/src/api/` (ver skill `migrate-to-axios-query`).
7. **Estados.** Carga (skeleton), error (`LoadErrorState` con reintento), vacío (`EmptyState`) y feedback de acciones (Sonner).
8. **Responsive.** Mobile-first con `sm:`/`md:`/`lg:`/`xl:`, sin anchos fijos, objetivos táctiles de al menos `h-10`/`h-11`, nada esencial solo con hover.
9. **Idioma.** Textos de interfaz en inglés.
10. **Cierre.** `npm run lint --prefix client` y `npm run build --prefix client`; revisar en modo oscuro en escritorio, laptop, tablet y móvil; un commit por cambio lógico.
