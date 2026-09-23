---
name: new-frontend-component
description: Crear o modificar una pantalla o componente React de Tagged siguiendo el sistema visual y las normas del proyecto (Tailwind, neutral-*, rounded-xl, modo oscuro, responsive, Font Awesome).
---

# Nuevo componente o pantalla de frontend

Sigue `.claude/DESIGN.md` (guía visual obligatoria) y las normas de `.claude/CLAUDE.md`. Ante cualquier duda de color, tamaño, icono o texto, la respuesta está en DESIGN.md; si no lo está, decide con sus tokens y añádelo a la guía.

1. **Buscar antes de crear.** Revisa `client/src/components/` (`IconButton`, `EmptyState`, `LoadErrorState`, `LibraryToolbar`, `SearchField`, `Pagination`, `MediaFormModal`, `loading-skeletons/`, `toast/`) y `client/src/utils/` (`tagStyle`, `tagIcon`). Reutiliza o amplía con props explícitas.
2. **Ubicación.** Compartido: `client/src/components/<kebab-case>/<PascalCase>.jsx`. Solo de una página: `pages/<nombre>page/components/`. Exportación con nombre y función flecha.
3. **Estilos.** Solo Tailwind. Paleta `neutral-*` con su variante `dark:` en cada color, `rounded-xl`, foco `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-500`. Sin CSS nuevo, sin estilos inline (salvo colores de tag dinámicos), sin sombras fuertes ni gradientes.
4. **Botones y campos.** Copia las recetas de DESIGN.md §7.1 y §7.2 (primario, secundario, peligro, segmented, `mediaFormInputClasses`) sin `!`. Botones solo icono con `IconButton` y `aria-label`. Alturas según §4.2.
5. **Iconos.** Font Awesome, importando solo los usados, según el diccionario de DESIGN.md §8.
6. **Datos.** Nada de `fetch` ni `useEffect` para peticiones: usa hooks de React Query sobre `client/src/api/` (ver skill `migrate-to-axios-query`).
7. **Estados.** Carga (skeleton), error (`LoadErrorState` con reintento), vacío (`EmptyState`) y feedback de acciones (Sonner).
8. **Responsive.** Mobile-first con `sm:`/`md:`/`lg:`/`xl:`, sin anchos fijos, objetivos táctiles de al menos `h-10`/`h-11`, nada esencial solo con hover.
9. **Idioma.** Textos de interfaz en inglés.
10. **Checklist.** Recorre DESIGN.md §12.
11. **Cierre.** `npm run lint --prefix client` y `npm run build --prefix client`; revisar en modo oscuro en escritorio, laptop, tablet y móvil; un commit por cambio lógico.
