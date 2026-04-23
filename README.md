# Tagged

Guia rapida para ejecutar la app en desarrollo y acceder desde tu movil en la misma red local.

## Requisitos

- Node.js instalado
- Dependencias instaladas en la raiz, `client/` y `server/`
- PC y movil conectados a la misma red Wi-Fi/LAN

## 1) Obtener la IP local del PC

En Windows:

```powershell
ipconfig
```

Usa la **Direccion IPv4** de tu adaptador de red real (por ejemplo `192.168.1.131`).
No uses IPs virtuales de WSL/Hyper-V (por ejemplo `192.168.112.x`).

## 2) Configurar variables de entorno

### Backend: `server/.env`

Asegura que `CORS_ORIGIN` apunte al frontend en tu IP local:

```dotenv
CORS_ORIGIN=http://192.168.1.131:5173
```

### Frontend: `client/.env`

Crea `client/.env` (en minusculas) y configura la API para red local:

```dotenv
VITE_API_URL=http://192.168.1.131:3000/api/v1
```

> Si dejas `http://localhost:3000/api/v1`, en movil fallara el login con errores tipo `Load failed`.

## 3) Levantar la app

Desde la carpeta raiz del proyecto, en dos terminales:

### Terminal A (backend)

```bash
npm run dev:server
```

### Terminal B (frontend en LAN)

```bash
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

## 4) Probar

- En PC: `http://localhost:5173`
- En movil: `http://192.168.1.131:5173`

## Troubleshooting rapido

- `ERR_CONNECTION_REFUSED` en `192.168.x.x:5173`:
    - El frontend no esta levantado o no escucha en red.
    - Verifica que Vite muestre `Network: http://192.168.1.131:5173/`.

- En PC funciona pero en movil sale `Load failed` al login:
    - `VITE_API_URL` sigue en `localhost` o el frontend no fue reiniciado tras cambiar `.env`.
    - Reinicia Vite despues de editar `client/.env`.

- El backend no arranca:
    - Revisa credenciales DB en `server/.env`.
    - Verifica que MySQL este disponible y puerto 3000 libre.

- Movil no accede aunque todo esta bien configurado:
    - Permite Node.js en Firewall de Windows para red privada.
    - Abre puertos 5173 (frontend) y 3000 (backend).
