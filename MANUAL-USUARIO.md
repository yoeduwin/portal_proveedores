# Manual de Usuario - Portal de Proveedores

## Ejecutiva Ambiental

Portal web para que los proveedores suban sus facturas CFDI y el area de Cuentas por Pagar (CXP) gestione su recepcion, revision y pago.

---

## Acceso al portal

1. Abre el portal en tu navegador: `https://yoeduwin.github.io/portal_proveedores/`
2. Ingresa tu **correo** y **contrasena**
3. Click en **Iniciar sesion**

> Si no tienes credenciales, solicitalas al administrador de CXP.

El sistema detecta automaticamente tu rol (proveedor o administrador) y te muestra las opciones correspondientes.

---

## Para Proveedores

### Subir una factura

Esta es la pantalla principal al iniciar sesion.

1. **Archivo XML CFDI** (obligatorio): Click en "Seleccionar archivo" y elige el XML timbrado de tu factura
2. **Archivo PDF** (opcional): Adjunta la representacion impresa de la factura
3. **Observaciones** (opcional): Agrega notas para el area de CXP (ej: "Factura correspondiente a servicio de enero")
4. Click en **Enviar Factura**

El sistema automaticamente:
- Valida que el XML sea un CFDI valido (version 4.0 del SAT)
- Extrae los datos: UUID, RFC emisor, total, moneda, fecha de emision
- Verifica que no sea una factura duplicada (por UUID)
- Calcula la fecha de pago programada (siguiente quincena: dia 15 o ultimo dia habil del mes)
- Guarda los archivos en Google Drive

### Acuse de recibo

Despues de subir la factura, el sistema muestra un **acuse de recibo** con:
- Folio interno asignado (ej: EA-CXP-250215-00001)
- UUID de la factura
- Total y moneda
- Fecha de pago programada
- RFC y nombre del emisor

Puedes:
- **Copiar como texto**: Copia los datos al portapapeles
- **Descargar como imagen**: Guarda una captura del acuse (util para enviar por WhatsApp o correo)

### Consultar mis facturas

1. Click en **Mis Facturas** en el menu superior
2. Se muestra una tabla con todas tus facturas

Cada factura muestra:
| Columna | Descripcion |
|---------|-------------|
| Folio Interno | Identificador unico asignado por el sistema |
| UUID | Folio fiscal del SAT (primeros 8 caracteres) |
| Fecha Emision | Fecha en que se emitio el CFDI |
| Total | Monto de la factura |
| Pago Programado | Fecha estimada de pago |
| Estatus | Estado actual de la factura |
| Acciones | Boton para ver el detalle |

### Estatus de las facturas

| Estatus | Significado |
|---------|-------------|
| **Programado** | La factura fue recibida y esta programada para pago |
| **En revision** | CXP esta revisando la factura (puede requerir aclaracion) |
| **Pagado** | La factura ya fue pagada |
| **Rechazado** | La factura fue rechazada (revisa el motivo en el detalle) |

### Ver detalle de una factura

1. En la tabla de "Mis Facturas", click en el boton **Ver** (icono de ojo)
2. Se abre una ventana con toda la informacion:
   - Datos generales (folio, UUID, RFC, total, moneda)
   - Fechas (emision, recepcion, pago programado, pago real)
   - Estatus actual
   - Observaciones
   - Motivo de rechazo (si aplica)
   - Referencia bancaria del pago (si ya fue pagado)
3. Si hay archivos disponibles, puedes descargar el XML y/o PDF

---

## Para Administradores (CXP)

### Dashboard

Pantalla principal al iniciar sesion. Muestra tarjetas resumen con:

- **Total Facturas**: Cantidad total de facturas en el sistema
- **Programadas**: Facturas pendientes de pago
- **Pagadas**: Facturas ya liquidadas
- **Vencidas**: Facturas cuya fecha de pago programada ya paso
- **Por pagar esta semana**: Facturas que vencen en los proximos 7 dias
- **Monto pendiente**: Suma total de facturas pendientes (programadas + en revision)
- **En Revision**: Facturas que se estan revisando

Debajo del resumen esta la **tabla de todas las facturas**.

### Filtrar facturas

Usa los controles arriba de la tabla:

- **Proveedor**: Filtrar por un proveedor especifico
- **Estatus**: Filtrar por estatus (Programado, Pagado, Rechazado, En revision)
- **Fecha desde / hasta**: Filtrar por rango de fechas
- **Esta semana**: Mostrar solo facturas con pago esta semana
- **Vencidos**: Mostrar solo facturas con fecha de pago vencida
- **X (limpiar)**: Quitar todos los filtros

### Cambiar estatus de una factura

1. En la tabla, click en el boton **Cambiar estatus** (icono de lapiz)
2. Se abre una ventana mostrando el folio de la factura
3. Selecciona el nuevo estatus:

   **Programado**: Estado inicial, pendiente de pago

   **En revision**: Cuando necesitas revisar la factura antes de pagarla

   **Pagado**: Registrar que la factura fue pagada
   - Se habilitan campos adicionales:
     - *Fecha real de pago*: Cuando se hizo la transferencia
     - *Referencia bancaria*: Numero de referencia SPEI o similar

   **Rechazado**: Rechazar la factura
   - Se habilita campo obligatorio:
     - *Motivo de rechazo*: Explica por que se rechaza (el proveedor vera este mensaje)

4. Click en **Guardar Cambio**

> El proveedor recibe una notificacion por correo cuando su factura cambia a "Pagado" o "Rechazado".

### Registrar un nuevo proveedor

1. Click en **Proveedores** en el menu
2. Click en el boton **Nuevo Proveedor**
3. Llena el formulario:
   - **Nombre / Razon Social**: Nombre completo del proveedor
   - **RFC**: RFC a 12 o 13 caracteres (se convierte a mayusculas)
   - **Correo electronico**: Sera su usuario para iniciar sesion
   - **Telefono**: Opcional
   - **Contrasena**: Minimo 6 caracteres (compartir con el proveedor para que acceda)
4. Click en **Crear Proveedor**

El sistema:
- Valida que no exista otro proveedor con el mismo RFC
- Valida que no exista otro usuario con el mismo correo
- Crea una carpeta en Google Drive para sus archivos
- Crea el registro del proveedor y su usuario

> Despues de crear el proveedor, compartele el correo y contrasena para que pueda acceder al portal.

### Exportar a CSV

1. En el Dashboard, click en **Exportar CSV**
2. Se descarga un archivo `.csv` con todas las facturas
3. Abre el archivo en Excel o Google Sheets para analisis adicional

Columnas incluidas: Folio, UUID, Proveedor, RFC, Fecha Emision, Total, Moneda, Fecha Recepcion, Fecha Pago Programada, Estatus, Fecha Pago Real, Referencia, Observaciones, Motivo Rechazo.

---

## Notificaciones por correo

El sistema envia correos automaticos en estos eventos:

| Evento | Destinatario | Contenido |
|--------|-------------|-----------|
| Factura subida | Admin (CXP) | Aviso de nueva factura con datos del proveedor |
| Factura subida | Proveedor | Confirmacion de recepcion con folio y fecha de pago |
| Factura rechazada | Proveedor | Aviso con el motivo del rechazo |
| Factura pagada | Proveedor | Confirmacion con fecha de pago y referencia bancaria |

---

## Preguntas frecuentes

**Mi factura fue rechazada, que hago?**
Revisa el motivo en el detalle de la factura. Corrige el problema y sube una nueva factura con el XML corregido.

**No puedo subir mi factura, dice "CFDI no valido"**
Verifica que el archivo XML sea un CFDI timbrado version 4.0 del SAT. El archivo debe contener el nodo `TimbreFiscalDigital` con el UUID.

**Dice "UUID duplicado"**
Ya subiste esta factura anteriormente. Revisa en "Mis Facturas" si ya aparece registrada.

**Cuando me van a pagar?**
La fecha de pago se calcula automaticamente en base a quincenas (dia 15 y ultimo dia habil del mes). Si la fecha cae en fin de semana o dia feriado, se mueve al siguiente dia habil. Consulta la columna "Pago Programado" en tus facturas.

**Se cerro mi sesion**
Las sesiones expiran despues de 24 horas. Vuelve a iniciar sesion con tu correo y contrasena.
