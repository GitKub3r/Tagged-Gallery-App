---
name: migrate-to-axios-query
description: Migrar un flujo del frontend de Tagged desde fetch/fetchWithAuth/useEffect a apiClient (Axios) y TanStack React Query, o añadir una operación remota nueva con ese patrón.
---

# Migración a Axios + React Query

Modelo a copiar: `client/src/api/templateApi.js` y `client/src/hooks/useTemplates.js`.

1. **Inventario.** Busca todos los consumidores del flujo (`grep -rnE "(^|[^a-zA-Z])fetch\(|fetchWithAuth" client/src`; `refetch(` no cuenta). Anota permisos, estados de carga/error, efectos secundarios e invalidaciones. Migra el flujo completo: nunca mezcles `fetch` con Axios ni peticiones manuales con React Query.
2. **API.** Añade funciones al archivo de dominio en `client/src/api/` usando `apiClient` (nunca `axios.create` fuera de `apiClient.js`), con `unwrap(response)` y un objeto `xxxQueryKeys` centralizado. Descargas: `responseType: "blob"`. Subidas con progreso/cancelación: `onUploadProgress` y `signal`.
3. **Hooks.** Consultas con `useQuery` (`enabled` según usuario/token) y cambios con `useMutation`. Tras mutar, `invalidateQueries` o `setQueryData` solo de las claves afectadas.
4. **UI.** Elimina el estado local que duplicaba datos remotos y los `useEffect` de carga. Mantén el comportamiento visible y los contratos del backend.
5. **Errores.** El interceptor ya muestra un toast; usa `_skipErrorToast` si el flujo gestiona su propio mensaje.
6. **Limpieza.** Borra imports y código obsoletos, y comprueba con búsqueda global que no queda `fetch` en el flujo. Ejecuta lint y build; un commit por flujo migrado.
