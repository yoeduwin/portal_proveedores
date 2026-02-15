# Portal Proveedores - Guia de Despliegue

## Arquitectura

```
GitHub Pages (frontend)          Google Apps Script (backend)          Google Sheets (BD)
 index.html                        Code.gs  (router + handlers)         SUPPLIERS
 app.js        ── fetch ──>        Database.gs (CRUD sheets)            USERS
 styles.css                        Utils.gs (hash, tokens, CFDI)        INVOICES
                                   Email.gs (notificaciones)            PARAMS
                                                                        AUDIT_LOG
```

El frontend en GitHub Pages se comunica con el backend en Apps Script via `fetch`.
Los datos se almacenan en Google Sheets y los archivos (XML/PDF) en Google Drive.

---

## Paso 1: Configurar Google Sheets

1. Crea un Google Spreadsheet nuevo (o usa uno existente)
2. Copia el **ID** del spreadsheet (esta en la URL: `docs.google.com/spreadsheets/d/{ESTE_ID}/edit`)
3. Actualiza `CONFIG.SPREADSHEET_ID` en `Code.gs` con ese ID

> La primera vez que ejecutes `initializeSpreadsheet()` se crearan las hojas automaticamente:
> `SUPPLIERS`, `USERS`, `INVOICES`, `PARAMS`, `AUDIT_LOG`

---

## Paso 2: Configurar Google Drive

1. Crea una carpeta en Google Drive para almacenar facturas de proveedores
2. Copia el **ID** de la carpeta (esta en la URL: `drive.google.com/drive/folders/{ESTE_ID}`)
3. Actualiza `CONFIG.DRIVE_ROOT_FOLDER_ID` en `Code.gs`

---

## Paso 3: Desplegar el Backend (Google Apps Script)

### 3.1 Crear el proyecto

1. Ve a [script.google.com](https://script.google.com) > **Nuevo proyecto**
2. Renombra el proyecto: `Portal Proveedores Backend`

### 3.2 Copiar los archivos

Copia el contenido de `Code.gs` del repositorio al archivo `Code.gs` del proyecto en Apps Script.

> Si tienes archivos adicionales como `Database.gs`, `Utils.gs`, `Email.gs`, crea archivos nuevos
> en el editor de Apps Script (icono `+` > Script) y pega el contenido de cada uno.

### 3.3 Inicializar datos

En el editor de Apps Script:

1. Selecciona la funcion `initializeSpreadsheet` en el dropdown superior
2. Click en **Ejecutar** (icono play)
3. Autoriza los permisos que pida (Sheets, Drive, Gmail)
4. Verifica en tu Spreadsheet que se hayan creado las 5 hojas con headers

### 3.4 Cargar datos demo (opcional)

1. Selecciona `seedDemoData` en el dropdown
2. Click en **Ejecutar**
3. Esto crea:

| Usuario | Correo | Password | Rol |
|---------|--------|----------|-----|
| Admin | admin@ejecutivaambiental.com | Admin123! | admin |
| Proveedor 1 | proveedor@demo.com | Proveedor123! | supplier |
| Proveedor 2 | servicios@demo.com | Proveedor123! | supplier |

### 3.5 Publicar como Web App

1. Click en **Implementar** > **Nueva implementacion**
2. Tipo: **Aplicacion web**
3. Configuracion:
   - Descripcion: `v1.0`
   - Ejecutar como: **Yo** (tu cuenta de Google)
   - Quien tiene acceso: **Cualquier persona**
4. Click **Implementar**
5. Copia la **URL** que termina en `/exec`

### 3.6 Actualizar la URL en el frontend

Pega la URL copiada en `app.js` linea 20:

```js
const API_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

Y tambien en `Code.gs` en `CONFIG.WEBAPP_URL`.

> **IMPORTANTE**: Cada vez que modifiques `Code.gs` y quieras que los cambios se reflejen,
> debes crear una **nueva implementacion** (no basta con guardar).
> Alternativa: usa "Implementar" > "Implementaciones de prueba" durante desarrollo.

---

## Paso 4: Desplegar el Frontend (GitHub Pages)

1. Sube `index.html`, `app.js` y `styles.css` a un repositorio en GitHub
2. Ve a **Settings** > **Pages**
3. Source: **Deploy from a branch**
4. Branch: `main` (o `master`), carpeta `/ (root)`
5. Click **Save**
6. Tu portal estara disponible en: `https://{tu-usuario}.github.io/{nombre-repo}/`

---

## Paso 5: Verificar el despliegue

### Test rapido desde el navegador

Abre la URL del Web App con `?action=ping`:

```
https://script.google.com/macros/s/AKfycb.../exec?action=ping
```

Deberias ver:
```json
{"success":true,"data":{"message":"Portal Proveedores API activa","timestamp":"..."}}
```

### Test de login

Abre tu GitHub Pages y prueba login con las credenciales demo.

---

## Flujo de uso

### Como Admin

1. Login con credenciales de admin
2. **Dashboard**: Ver resumen de facturas (programadas, pagadas, rechazadas)
3. **Proveedores**: Crear nuevos proveedores (les asigna usuario/password)
4. **Facturas**: Ver todas las facturas, cambiar estatus (Programado/Pagado/Rechazado/En revision)
5. **Exportar CSV**: Descargar reporte de facturas

### Como Proveedor

1. Login con credenciales proporcionadas por el admin
2. **Subir Factura**: Cargar XML CFDI (obligatorio) + PDF (opcional)
   - El sistema valida el XML, extrae UUID/RFC/total
   - Detecta duplicados por UUID
   - Calcula fecha de pago automaticamente (quincenas: dia 15 y ultimo dia habil)
3. **Mis Facturas**: Ver estatus de facturas subidas
4. **Detalle**: Ver informacion completa y descargar archivos

---

## Solucion de problemas

| Problema | Causa | Solucion |
|----------|-------|----------|
| Login funciona pero crear proveedor no | `Code.gs` viejo sin fix del router | Actualizar `Code.gs` y crear nueva implementacion |
| CORS error en consola | Origen no permitido | Agregar tu URL a `CONFIG.ALLOWED_ORIGINS` en `Code.gs` |
| "Sesion invalida o expirada" | Token expirado (24h) | Hacer login de nuevo |
| "Accion no reconocida" | `action` no llega al backend | Verificar que `Code.gs` tenga el fix: `params` se parsea ANTES de leer `action` |
| Archivos no se guardan en Drive | Permisos insuficientes | Reautorizar el script (Ejecutar > Revisar permisos) |
| Cambios en Code.gs no se reflejan | Falta nueva implementacion | Implementar > Nueva implementacion (cada cambio requiere esto) |

---

## Estructura de archivos

```
portal_proveedores/
  index.html       - HTML del portal (vistas login, dashboard, facturas, etc.)
  app.js           - Logica frontend (fetch a API, manejo de estado, UI)
  styles.css       - Estilos personalizados sobre Bootstrap 5
  Code.gs          - Backend: router, handlers, config (copiar a Apps Script)
  GUIA-DESPLIEGUE.md  - Esta guia
```
