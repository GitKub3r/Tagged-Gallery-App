---
name: add-api-endpoint
description: Añadir un endpoint o recurso al backend Express de Tagged respetando las capas route, controller, service y model, la autenticación y el formato de respuesta.
---

# Nuevo endpoint del backend

Rutas en `server/routes/api/v1/`, CommonJS, clases con métodos estáticos. Modelo a copiar: `Template` (route, controller, service y model).

1. **Modelo** (`models/X.model.js`): consultas SQL parametrizadas con `mysql2`. Si hay tabla o columna nueva, actualiza `database.sql` **y** añade la creación/`ALTER` idempotente en un `ensureTable()` llamado desde `server/index.js`, porque el script de Docker no se ejecuta sobre volúmenes existentes.
2. **Servicio** (`services/X.service.js`): valida entrada y aplica reglas de negocio; devuelve `{ data }` o `{ error, status }`.
3. **Controlador** (`controllers/X.controller.js`): traduce con `sendResult` y un `handleError` (`ER_DUP_ENTRY` → 409, resto 500 con `console.error`). Respuesta siempre `{ success, data }` o `{ success: false, message }`.
4. **Ruta**: protege con `authenticate` (y `isAdmin` cuando proceda) importado de `middlewares/auth.middleware`; regístrala en `routes/api/v1/index.js` y en la lista de endpoints de bienvenida. Filtra siempre por `req.user.id`; los permisos reales se comprueban aquí, no en el cliente.
5. **Auditoría**: registra las acciones relevantes con `AuditService`.
6. **Cliente**: añade la función al archivo de `client/src/api/` y su hook de React Query (ver `migrate-to-axios-query`).
7. **Comprobar** arrancando el servidor y probando el endpoint; un commit por cambio lógico.
