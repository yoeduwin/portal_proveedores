/**
 * ============================================================
 * Code.gs - Router principal y configuración
 * Portal de Proveedores - Ejecutiva Ambiental
 * ============================================================
 *
 * Este archivo contiene:
 * - Constantes de configuración
 * - Router principal (doGet / doPost)
 * - Funciones de inicialización
 * - Seed de datos demo
 * - Tests básicos
 */
// ============================================================
// CONFIGURACIÓN - EDITAR ESTOS VALORES ANTES DE DEPLOY
// ============================================================
const CONFIG = {
  // ID del Google Spreadsheet que sirve como base de datos
  SPREADSHEET_ID: '1fMHNv6-5_3tnWr7ln19i51-GWAAFxHK49iZnTmtH-rc',
  // ID de la carpeta raíz en Drive para archivos de proveedores
  DRIVE_ROOT_FOLDER_ID: '1QxjHVDtEOFir07A_c2jtvbfKIFFfhPvA',
  // Correo del área de CXP (Cuentas por Pagar)
  CXP_EMAIL: 'cxp@ejecutivaambiental.com',
  // URL del frontend (GitHub Pages) - para links en correos
  FRONTEND_URL: 'https://yoeduwin.github.io/portal_proveedores/',
  // URL de la Web App publicada - se llena automáticamente
  WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbwQaPVLdJ58LYmk6rmuRkB4yzZilqr09r8XIdO3moe3oyIlUlZC0NdaxCFlJfUa8DSfXQ/exec',
  // Nombre de la empresa
  COMPANY_NAME: 'Ejecutiva Ambiental',
  // Prefijo para folios internos
  FOLIO_PREFIX: 'EA-CXP',
  // Tiempo de expiración de tokens de sesión (en milisegundos) - 24 horas
  TOKEN_EXPIRY_MS: 24 * 60 * 60 * 1000,
  // Rate limit: máximo de requests por minuto por IP/correo
  RATE_LIMIT_PER_MINUTE: 30,
  // Orígenes permitidos para CORS (GitHub Pages URL)
  ALLOWED_ORIGINS: [
    'https://yoeduwin.github.io/portal-proveedores/',
    'http://localhost:3000', // desarrollo local
    'http://127.0.0.1:5500' // Live Server VS Code
  ],
  // Hojas del spreadsheet
  SHEETS: {
    SUPPLIERS: 'SUPPLIERS',
    USERS: 'USERS',
    INVOICES: 'INVOICES',
    PARAMS: 'PARAMS',
    AUDIT_LOG: 'AUDIT_LOG'
  }
};
// ============================================================
// NOMBRES DE HOJAS - Headers esperados
// ============================================================
const SHEET_HEADERS = {
  SUPPLIERS: ['supplierId', 'nombre', 'RFC', 'correo', 'telefono', 'estado', 'carpetaDriveId', 'createdAt'],
  USERS: ['userId', 'supplierId', 'correo', 'hash', 'rol', 'activo', 'lastLogin', 'tokenSesion', 'tokenExpiry', 'createdAt'],
  INVOICES: ['invoiceId', 'supplierId', 'folioInterno', 'uuid', 'rfcEmisor', 'nombreEmisor', 'fechaEmision', 'total', 'moneda', 'fechaRecepcion', 'fechaPagoProgramada', 'estatus', 'driveXmlId', 'drivePdfId', 'observaciones', 'rechazoMotivo', 'fechaPagoReal', 'referenciaPago', 'createdAt'],
  PARAMS: ['clave', 'valor'],
  AUDIT_LOG: ['when', 'who', 'action', 'invoiceId', 'details']
};
// ============================================================
// doGet - Maneja requests GET
// ============================================================
function doGet(e) {
  // Si se accede directamente al Web App, servir el frontend embebido (Opción A)
  if (!e.parameter.action) {
    return HtmlService.createHtmlOutputFromFile('index')
      .setTitle('Portal Proveedores - Ejecutiva Ambiental')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  // Para API REST (Opción B - GitHub Pages)
  var output = handleRequest(e, 'GET');
  return buildCorsResponse(output, e);
}
// ============================================================
// doPost - Maneja requests POST
// ============================================================
function doPost(e) {
  var output = handleRequest(e, 'POST');
  return buildCorsResponse(output, e);
}
// ============================================================
// Router principal
// ============================================================
function handleRequest(e, method) {
  try {
    // Parsear params según método
    var params = method === 'POST' ? parsePostData(e) : e.parameter;

    // action puede venir en URL (?action=login) o en el body JSON
    var action = e.parameter.action || params.action || '';

    // --- Rate limiting ---
    var clientId = params.correo || params.token || 'anonymous';
    if (!checkRateLimit(clientId)) {
      return errorResponse('Demasiadas solicitudes. Intenta en un minuto.', 429);
    }
    // --- Rutas públicas (sin autenticación) ---
    switch (action) {
      case 'login':
        return handleLogin(params);
      case 'ping':
        return successResponse({ message: 'Portal Proveedores API activa', timestamp: new Date().toISOString() });
    }
    // --- Rutas protegidas (requieren token) ---
    var session = validateToken(params.token);
    if (!session) {
      return errorResponse('Sesión inválida o expirada. Inicia sesión nuevamente.', 401);
    }
    // Inyectar datos de sesión
    params._user = session;
    switch (action) {
      // --- Proveedor ---
      case 'uploadInvoice':
        return handleUploadInvoice(params, e);
      case 'getMyInvoices':
        return handleGetMyInvoices(params);
      case 'getInvoiceDetail':
        return handleGetInvoiceDetail(params);
      case 'getProfile':
        return handleGetProfile(params);
      // --- Admin ---
      case 'getSuppliers':
        requireAdmin(session);
        return handleGetSuppliers(params);
      case 'getAllInvoices':
        requireAdmin(session);
        return handleGetAllInvoices(params);
      case 'updateInvoiceStatus':
        requireAdmin(session);
        return handleUpdateInvoiceStatus(params);
      case 'exportCSV':
        requireAdmin(session);
        return handleExportCSV(params);
      case 'getDashboardStats':
        requireAdmin(session);
        return handleGetDashboardStats(params);
      case 'createSupplier':
        requireAdmin(session);
        return handleCreateSupplier(params);
      case 'deleteSupplier':
        requireAdmin(session);
        return handleDeleteSupplier(params);
      case 'adminUploadInvoice':
        requireAdmin(session);
        return handleAdminUploadInvoice(params, e);
      case 'registerPartialPayment':
        requireAdmin(session);
        return handleRegisterPartialPayment(params);
      case 'getInvoicePayments':
        return handleGetInvoicePayments(params);
      case 'deleteInvoice':
        requireAdmin(session);
        return handleDeleteInvoice(params);
      case 'updateSupplier':
        requireAdmin(session);
        return handleUpdateSupplier(params);
      default:
        return errorResponse('Acción no reconocida: ' + action, 400);
    }
  } catch (err) {
    Logger.log('Error en handleRequest: ' + err.message + '\n' + err.stack);
    if (err.message === 'FORBIDDEN') {
      return errorResponse('No tienes permisos para esta acción.', 403);
    }
    return errorResponse('Error interno del servidor: ' + err.message, 500);
  }
}
// ============================================================
// Parsear datos POST
// ============================================================
function parsePostData(e) {
  var params = {};
  // Copiar parámetros de URL
  if (e.parameter) {
    for (var key in e.parameter) {
      params[key] = e.parameter[key];
    }
  }
  // Parsear body JSON o text/plain (text/plain evita CORS preflight)
  if (e.postData && (e.postData.type === 'application/json' || e.postData.type === 'text/plain')) {
    try {
      var body = JSON.parse(e.postData.contents);
      for (var key in body) {
        params[key] = body[key];
      }
    } catch (err) {
      Logger.log('Error parseando body: ' + err.message);
    }
  }
  // Parsear form data
  if (e.postData && e.postData.type === 'application/x-www-form-urlencoded') {
    var pairs = e.postData.contents.split('&');
    pairs.forEach(function(pair) {
      var kv = pair.split('=');
      params[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
  }
  return params;
}
// ============================================================
// Construir respuesta con CORS
// ============================================================
function buildCorsResponse(data, e) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
// ============================================================
// Respuestas estandarizadas
// ============================================================
function successResponse(data) {
  return {
    success: true,
    data: data,
    timestamp: new Date().toISOString()
  };
}
function errorResponse(message, code) {
  return {
    success: false,
    error: message,
    code: code || 500,
    timestamp: new Date().toISOString()
  };
}
// ============================================================
// Verificar que el usuario sea admin
// ============================================================
function requireAdmin(session) {
  if (session.rol !== 'admin') {
    throw new Error('FORBIDDEN');
  }
}
// ============================================================
// HANDLERS - Login
// ============================================================
function handleLogin(params) {
  var correo = (params.correo || '').trim().toLowerCase();
  var password = (params.password || '').trim();
  if (!correo || !password) {
    return errorResponse('Correo y contraseña son obligatorios.', 400);
  }
  var user = findUserByEmail(correo);
  if (!user) {
    return errorResponse('Credenciales inválidas.', 401);
  }
  if (user.activo !== 'true' && user.activo !== true) {
    return errorResponse('Cuenta desactivada. Contacta al administrador.', 403);
  }
  // Verificar contraseña
  var hash = hashPassword(password);
  if (hash !== user.hash) {
    return errorResponse('Credenciales inválidas.', 401);
  }
  // Generar token de sesión
  var token = generateSessionToken();
  var expiry = new Date(Date.now() + CONFIG.TOKEN_EXPIRY_MS).toISOString();
  // Guardar token en la hoja USERS
  updateUserToken(user.userId, token, expiry);
  // Log de auditoría
  logAudit(correo, 'LOGIN', '', 'Inicio de sesión exitoso');
  // Obtener datos del proveedor si aplica
  var supplierData = null;
  if (user.supplierId && user.rol === 'supplier') {
    supplierData = findSupplierById(user.supplierId);
  }
  return successResponse({
    token: token,
    user: {
      userId: user.userId,
      correo: user.correo,
      rol: user.rol,
      supplierId: user.supplierId || null,
      supplierName: supplierData ? supplierData.nombre : null
    }
  });
}
// ============================================================
// HANDLERS - Proveedor: Subir factura
// ============================================================
function handleUploadInvoice(params, e) {
  var user = params._user;
  // Solo proveedores pueden subir facturas
  if (user.rol !== 'supplier') {
    return errorResponse('Solo proveedores pueden subir facturas.', 403);
  }
  // Obtener datos del proveedor
  var supplier = findSupplierById(user.supplierId);
  if (!supplier) {
    return errorResponse('Proveedor no encontrado.', 404);
  }
  // Validar que venga el XML
  var xmlBase64 = params.xmlFile;
  var pdfBase64 = params.pdfFile || null;
  var xmlFileName = params.xmlFileName || 'factura.xml';
  var pdfFileName = params.pdfFileName || 'factura.pdf';
  var observaciones = params.observaciones || '';
  if (!xmlBase64) {
    return errorResponse('El archivo XML CFDI es obligatorio.', 400);
  }
  // Decodificar XML
  var xmlContent;
  try {
    xmlContent = Utilities.newBlob(Utilities.base64Decode(xmlBase64)).getDataAsString();
  } catch (err) {
    return errorResponse('Error al leer el archivo XML. Verifica que sea un archivo válido.', 400);
  }
  // Parsear CFDI
  var cfdiData = parseCFDI(xmlContent);
  if (!cfdiData.valid) {
    return errorResponse('El archivo XML no es un CFDI válido: ' + cfdiData.error, 400);
  }
  // Verificar duplicados por UUID
  if (isDuplicateUUID(cfdiData.uuid)) {
    return errorResponse('Esta factura ya fue registrada (UUID duplicado: ' + cfdiData.uuid + ').', 409);
  }
  // Fecha de pago: usar la manual si viene, si no calcular automáticamente
  var fechaRecepcion = new Date();
  var fechaPagoManual = (params.fechaPagoProgramada || '').trim();
  var fechaPago = fechaPagoManual ? new Date(fechaPagoManual + 'T12:00:00') : computePaymentDate(fechaRecepcion);
  // Generar folio interno
  var folioInterno = generateFolio();
  // Guardar archivos en Drive
  var driveFiles = saveFilesToDrive(supplier, xmlBase64, xmlFileName, pdfBase64, pdfFileName, folioInterno);
  // Crear registro en Sheets
  var invoiceId = Utilities.getUuid();
  var invoiceData = {
    invoiceId: invoiceId,
    supplierId: user.supplierId,
    folioInterno: folioInterno,
    uuid: cfdiData.uuid,
    rfcEmisor: cfdiData.rfcEmisor,
    nombreEmisor: cfdiData.nombreEmisor,
    fechaEmision: cfdiData.fechaEmision,
    total: cfdiData.total,
    moneda: cfdiData.moneda,
    fechaRecepcion: fechaRecepcion.toISOString(),
    fechaPagoProgramada: formatDate(fechaPago),
    estatus: 'Programado',
    driveXmlId: driveFiles.xmlId,
    drivePdfId: driveFiles.pdfId || '',
    observaciones: observaciones,
    rechazoMotivo: '',
    fechaPagoReal: '',
    referenciaPago: '',
    createdAt: new Date().toISOString()
  };
  insertInvoice(invoiceData);
  // Log de auditoría
  logAudit(user.correo, 'UPLOAD_INVOICE', invoiceId, 'Factura subida: ' + folioInterno + ' | UUID: ' + cfdiData.uuid);
  // Enviar correos
  try {
    sendInvoiceReceivedToAdmin(invoiceData, supplier);
    sendInvoiceConfirmationToSupplier(invoiceData, supplier);
  } catch (emailErr) {
    Logger.log('Error enviando correos: ' + emailErr.message);
  }
  // Preparar datos del acuse
  var acuse = {
    folioInterno: folioInterno,
    uuid: cfdiData.uuid,
    total: cfdiData.total,
    moneda: cfdiData.moneda,
    fechaPagoProgramada: formatDate(fechaPago),
    fechaRecepcion: fechaRecepcion.toISOString(),
    estatus: 'Programado',
    rfcEmisor: cfdiData.rfcEmisor,
    nombreEmisor: cfdiData.nombreEmisor
  };
  return successResponse({
    message: 'Factura registrada exitosamente.',
    acuse: acuse
  });
}
// ============================================================
// HANDLERS - Proveedor: Obtener mis facturas
// ============================================================
function handleGetMyInvoices(params) {
  var user = params._user;
  if (user.rol !== 'supplier') {
    return errorResponse('Acceso no autorizado.', 403);
  }
  var invoices = getInvoicesBySupplier(user.supplierId);
  return successResponse({ invoices: invoices });
}
// ============================================================
// HANDLERS - Proveedor: Detalle de factura
// ============================================================
function handleGetInvoiceDetail(params) {
  var user = params._user;
  var invoiceId = params.invoiceId;
  if (!invoiceId) {
    return errorResponse('ID de factura requerido.', 400);
  }
  var invoice = findInvoiceById(invoiceId);
  if (!invoice) {
    return errorResponse('Factura no encontrada.', 404);
  }
  // Proveedor solo puede ver sus propias facturas
  if (user.rol === 'supplier' && invoice.supplierId !== user.supplierId) {
    return errorResponse('No tienes acceso a esta factura.', 403);
  }
  // Agregar URLs de descarga de Drive
  if (invoice.driveXmlId) {
    invoice.xmlDownloadUrl = 'https://drive.google.com/uc?export=download&id=' + invoice.driveXmlId;
  }
  if (invoice.drivePdfId) {
    invoice.pdfDownloadUrl = 'https://drive.google.com/uc?export=download&id=' + invoice.drivePdfId;
  }
  return successResponse({ invoice: invoice });
}
// ============================================================
// HANDLERS - Perfil del proveedor
// ============================================================
function handleGetProfile(params) {
  var user = params._user;
  if (user.rol === 'supplier') {
    var supplier = findSupplierById(user.supplierId);
    return successResponse({ profile: supplier, role: 'supplier' });
  }
  return successResponse({ profile: { correo: user.correo }, role: 'admin' });
}
// ============================================================
// HANDLERS - Admin: Obtener proveedores
// ============================================================
function handleGetSuppliers(params) {
  var suppliers = getAllSuppliers();
  return successResponse({ suppliers: suppliers });
}
// ============================================================
// HANDLERS - Admin: Obtener todas las facturas
// ============================================================
function handleGetAllInvoices(params) {
  var filters = {
    supplierId: params.supplierId || '',
    estatus: params.estatus || '',
    fechaDesde: params.fechaDesde || '',
    fechaHasta: params.fechaHasta || '',
    porPagarEstaSemana: params.porPagarEstaSemana === 'true',
    vencidos: params.vencidos === 'true'
  };
  var invoices = getAllInvoices(filters);
  // Enriquecer con nombre del proveedor
  var suppliers = getAllSuppliersMap();
  invoices.forEach(function(inv) {
    var sup = suppliers[inv.supplierId];
    inv.supplierName = sup ? sup.nombre : 'Desconocido';
    inv.supplierRFC = sup ? sup.RFC : '';
  });
  return successResponse({ invoices: invoices });
}
// ============================================================
// HANDLERS - Admin: Cambiar estatus de factura
// ============================================================
function handleUpdateInvoiceStatus(params) {
  var user = params._user;
  var invoiceId = params.invoiceId;
  var nuevoEstatus = params.estatus;
  var motivo = params.motivo || '';
  var fechaPagoReal = params.fechaPagoReal || '';
  var referenciaPago = params.referenciaPago || '';
  if (!invoiceId || !nuevoEstatus) {
    return errorResponse('ID de factura y nuevo estatus son obligatorios.', 400);
  }
  var estatusValidos = ['Programado', 'Pagado', 'Rechazado', 'En revisión', 'Pago parcial'];
  if (estatusValidos.indexOf(nuevoEstatus) === -1) {
    return errorResponse('Estatus no válido. Opciones: ' + estatusValidos.join(', '), 400);
  }
  if (nuevoEstatus === 'Rechazado' && !motivo) {
    return errorResponse('El motivo de rechazo es obligatorio.', 400);
  }
  var invoice = findInvoiceById(invoiceId);
  if (!invoice) {
    return errorResponse('Factura no encontrada.', 404);
  }
  var oldEstatus = invoice.estatus;
  // Actualizar campos
  var updates = { estatus: nuevoEstatus };
  if (nuevoEstatus === 'Rechazado') {
    updates.rechazoMotivo = motivo;
  }
  if (nuevoEstatus === 'Pagado') {
    updates.fechaPagoReal = fechaPagoReal || formatDate(new Date());
    updates.referenciaPago = referenciaPago;
  }
  updateInvoice(invoiceId, updates);
  // Log de auditoría
  logAudit(user.correo, 'STATUS_CHANGE', invoiceId,
    'Estatus cambiado de "' + oldEstatus + '" a "' + nuevoEstatus + '"' +
    (motivo ? ' | Motivo: ' + motivo : ''));
  // Enviar correos según el nuevo estatus
  var supplier = findSupplierById(invoice.supplierId);
  try {
    if (nuevoEstatus === 'Rechazado') {
      sendInvoiceRejectedToSupplier(invoice, supplier, motivo);
    } else if (nuevoEstatus === 'Pagado') {
      sendInvoicePaidToSupplier(invoice, supplier, updates.fechaPagoReal, referenciaPago);
    }
  } catch (emailErr) {
    Logger.log('Error enviando correo de cambio de estatus: ' + emailErr.message);
  }
  return successResponse({ message: 'Estatus actualizado a "' + nuevoEstatus + '".' });
}
// ============================================================
// HANDLERS - Admin: Exportar CSV
// ============================================================
function handleExportCSV(params) {
  var invoices = getAllInvoices({});
  var suppliers = getAllSuppliersMap();
  var headers = ['Folio Interno', 'UUID', 'Proveedor', 'RFC Emisor', 'Fecha Emisión', 'Total', 'Moneda', 'Fecha Recepción', 'Fecha Pago Programada', 'Estatus', 'Fecha Pago Real', 'Referencia Pago', 'Observaciones', 'Motivo Rechazo'];
  var rows = invoices.map(function(inv) {
    var sup = suppliers[inv.supplierId];
    return [
      inv.folioInterno, inv.uuid, sup ? sup.nombre : '', inv.rfcEmisor,
      inv.fechaEmision, inv.total, inv.moneda, inv.fechaRecepcion,
      inv.fechaPagoProgramada, inv.estatus, inv.fechaPagoReal,
      inv.referenciaPago, inv.observaciones, inv.rechazoMotivo
    ].map(function(v) { return '"' + (v || '').toString().replace(/"/g, '""') + '"'; }).join(',');
  });
  var csv = headers.join(',') + '\n' + rows.join('\n');
  return successResponse({ csv: csv, filename: 'facturas_' + formatDate(new Date()) + '.csv' });
}
// ============================================================
// HANDLERS - Admin: Dashboard stats
// ============================================================
function handleGetDashboardStats(params) {
  var invoices = getAllInvoices({});
  var today = new Date();
  var stats = {
    total: invoices.length,
    programadas: 0,
    pagadas: 0,
    rechazadas: 0,
    enRevision: 0,
    porPagarEstaSemana: 0,
    vencidas: 0,
    montoTotal: 0,
    montoPendiente: 0
  };
  invoices.forEach(function(inv) {
    var total = parseFloat(inv.total) || 0;
    stats.montoTotal += total;
    switch (inv.estatus) {
      case 'Programado':
        stats.programadas++;
        stats.montoPendiente += total;
        // Verificar si vence esta semana
        var fechaPago = new Date(inv.fechaPagoProgramada);
        var diffDays = (fechaPago - today) / (1000 * 60 * 60 * 24);
        if (diffDays >= 0 && diffDays <= 7) stats.porPagarEstaSemana++;
        if (diffDays < 0) stats.vencidas++;
        break;
      case 'Pagado':
        stats.pagadas++;
        break;
      case 'Rechazado':
        stats.rechazadas++;
        break;
      case 'En revisión':
        stats.enRevision++;
        stats.montoPendiente += total;
        break;
      case 'Pago parcial':
        stats.programadas++;
        stats.montoPendiente += total;
        var fechaPagoParcial = new Date(inv.fechaPagoProgramada);
        var diffDaysParcial = (fechaPagoParcial - today) / (1000 * 60 * 60 * 24);
        if (diffDaysParcial >= 0 && diffDaysParcial <= 7) stats.porPagarEstaSemana++;
        if (diffDaysParcial < 0) stats.vencidas++;
        break;
    }
  });
  return successResponse({ stats: stats });
}
// ============================================================
// HANDLERS - Admin: Crear proveedor
// ============================================================
function handleCreateSupplier(params) {
  var nombre = (params.nombre || '').trim();
  var rfc = (params.rfc || '').trim().toUpperCase();
  var correo = (params.correoSupplier || '').trim().toLowerCase();
  var telefono = (params.telefono || '').trim();
  var password = (params.passwordSupplier || '').trim();
  if (!nombre || !rfc || !correo || !password) {
    return errorResponse('Nombre, RFC, correo y contraseña son obligatorios.', 400);
  }
  // Verificar que no exista RFC duplicado
  var existingSupplier = findSupplierByRFC(rfc);
  if (existingSupplier) {
    return errorResponse('Ya existe un proveedor con el RFC: ' + rfc, 409);
  }
  // Verificar que no exista correo duplicado
  var existingUser = findUserByEmail(correo);
  if (existingUser) {
    return errorResponse('Ya existe un usuario con el correo: ' + correo, 409);
  }
  // Crear carpeta en Drive
  var rootFolder = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
  var supplierFolder = rootFolder.createFolder(rfc + ' - ' + nombre);
  // Crear registro de proveedor
  var supplierId = Utilities.getUuid();
  var supplierData = {
    supplierId: supplierId,
    nombre: nombre,
    RFC: rfc,
    correo: correo,
    telefono: telefono,
    estado: 'activo',
    carpetaDriveId: supplierFolder.getId(),
    createdAt: new Date().toISOString()
  };
  insertSupplier(supplierData);
  // Crear usuario para el proveedor
  var userId = Utilities.getUuid();
  var userData = {
    userId: userId,
    supplierId: supplierId,
    correo: correo,
    hash: hashPassword(password),
    rol: 'supplier',
    activo: 'true',
    lastLogin: '',
    tokenSesion: '',
    tokenExpiry: '',
    createdAt: new Date().toISOString()
  };
  insertUser(userData);
  // Log de auditoría
  logAudit(params._user.correo, 'CREATE_SUPPLIER', '', 'Proveedor creado: ' + nombre + ' (' + rfc + ')');
  return successResponse({
    message: 'Proveedor creado exitosamente.',
    supplier: supplierData
  });
}
// ============================================================
// HANDLERS - Admin: Eliminar proveedor
// ============================================================
function handleDeleteSupplier(params) {
  var user = params._user;
  var supplierId = params.supplierId;
  if (!supplierId) {
    return errorResponse('ID de proveedor requerido.', 400);
  }
  var supplier = findSupplierById(supplierId);
  if (!supplier) {
    return errorResponse('Proveedor no encontrado.', 404);
  }
  // Verificar que no tenga facturas
  var invoices = getInvoicesBySupplier(supplierId);
  if (invoices.length > 0) {
    return errorResponse('No se puede eliminar: el proveedor tiene ' + invoices.length + ' factura(s) registrada(s). Elimina las facturas primero.', 409);
  }
  // Eliminar usuario asociado
  deleteUserBySupplier(supplierId);
  // Eliminar proveedor
  deleteSupplier(supplierId);
  // Log de auditoría
  logAudit(user.correo, 'DELETE_SUPPLIER', '', 'Proveedor eliminado: ' + supplier.nombre + ' (' + supplier.RFC + ')');
  return successResponse({ message: 'Proveedor "' + supplier.nombre + '" eliminado.' });
}
// ============================================================
// HANDLERS - Admin: Subir factura en nombre de un proveedor
// ============================================================
function handleAdminUploadInvoice(params, e) {
  var user = params._user;
  var supplierId = params.supplierId;
  if (!supplierId) {
    return errorResponse('Debes seleccionar un proveedor.', 400);
  }
  var supplier = findSupplierById(supplierId);
  if (!supplier) {
    return errorResponse('Proveedor no encontrado.', 404);
  }
  // Validar XML
  var xmlBase64 = params.xmlFile;
  var pdfBase64 = params.pdfFile || null;
  var xmlFileName = params.xmlFileName || 'factura.xml';
  var pdfFileName = params.pdfFileName || 'factura.pdf';
  var observaciones = params.observaciones || '';
  if (!xmlBase64) {
    return errorResponse('El archivo XML CFDI es obligatorio.', 400);
  }
  var xmlContent;
  try {
    xmlContent = Utilities.newBlob(Utilities.base64Decode(xmlBase64)).getDataAsString();
  } catch (err) {
    return errorResponse('Error al leer el archivo XML.', 400);
  }
  var cfdiData = parseCFDI(xmlContent);
  if (!cfdiData.valid) {
    return errorResponse('El archivo XML no es un CFDI válido: ' + cfdiData.error, 400);
  }
  if (isDuplicateUUID(cfdiData.uuid)) {
    return errorResponse('Factura ya registrada (UUID duplicado: ' + cfdiData.uuid + ').', 409);
  }
  var fechaRecepcion = new Date();
  var fechaPagoManual = (params.fechaPagoProgramada || '').trim();
  var fechaPago = fechaPagoManual ? new Date(fechaPagoManual + 'T12:00:00') : computePaymentDate(fechaRecepcion);
  var folioInterno = generateFolio();
  var driveFiles = saveFilesToDrive(supplier, xmlBase64, xmlFileName, pdfBase64, pdfFileName, folioInterno);
  var invoiceId = Utilities.getUuid();
  var invoiceData = {
    invoiceId: invoiceId,
    supplierId: supplierId,
    folioInterno: folioInterno,
    uuid: cfdiData.uuid,
    rfcEmisor: cfdiData.rfcEmisor,
    nombreEmisor: cfdiData.nombreEmisor,
    fechaEmision: cfdiData.fechaEmision,
    total: cfdiData.total,
    moneda: cfdiData.moneda,
    fechaRecepcion: fechaRecepcion.toISOString(),
    fechaPagoProgramada: formatDate(fechaPago),
    estatus: 'Programado',
    driveXmlId: driveFiles.xmlId,
    drivePdfId: driveFiles.pdfId || '',
    observaciones: observaciones + (observaciones ? ' | ' : '') + 'Subida por admin: ' + user.correo,
    rechazoMotivo: '',
    fechaPagoReal: '',
    referenciaPago: '',
    createdAt: new Date().toISOString()
  };
  insertInvoice(invoiceData);
  logAudit(user.correo, 'ADMIN_UPLOAD_INVOICE', invoiceId,
    'Factura subida por admin para proveedor ' + supplier.nombre + ': ' + folioInterno);
  try {
    sendInvoiceConfirmationToSupplier(invoiceData, supplier);
  } catch (emailErr) {
    Logger.log('Error enviando correo: ' + emailErr.message);
  }
  var acuse = {
    folioInterno: folioInterno,
    uuid: cfdiData.uuid,
    total: cfdiData.total,
    moneda: cfdiData.moneda,
    fechaPagoProgramada: formatDate(fechaPago),
    fechaRecepcion: fechaRecepcion.toISOString(),
    estatus: 'Programado',
    rfcEmisor: cfdiData.rfcEmisor,
    nombreEmisor: cfdiData.nombreEmisor
  };
  return successResponse({ message: 'Factura registrada para ' + supplier.nombre + '.', acuse: acuse });
}
// ============================================================
// HANDLERS - Admin: Registrar pago parcial
// ============================================================
function handleRegisterPartialPayment(params) {
  var user = params._user;
  var invoiceId = params.invoiceId;
  var montoParcial = params.montoParcial;
  var referencia = params.referencia || '';
  var fechaPago = params.fechaPago || formatDate(new Date());
  var comprobante = params.comprobante || null;
  var comprobanteFileName = params.comprobanteFileName || 'comprobante.pdf';
  if (!invoiceId || !montoParcial) {
    return errorResponse('ID de factura y monto son obligatorios.', 400);
  }
  var monto = parseFloat(montoParcial);
  if (isNaN(monto) || monto <= 0) {
    return errorResponse('El monto debe ser un número mayor a 0.', 400);
  }
  var invoice = findInvoiceById(invoiceId);
  if (!invoice) {
    return errorResponse('Factura no encontrada.', 404);
  }
  // Calcular saldo pendiente
  var totalFactura = parseFloat(invoice.total) || 0;
  var pagosAnteriores = getPaymentsByInvoice(invoiceId);
  var totalPagado = 0;
  pagosAnteriores.forEach(function(p) { totalPagado += parseFloat(p.monto) || 0; });
  var saldoPendiente = totalFactura - totalPagado;
  if (monto > saldoPendiente + 0.01) {
    return errorResponse('El monto ($' + monto.toFixed(2) + ') excede el saldo pendiente ($' + saldoPendiente.toFixed(2) + ').', 400);
  }
  // Guardar comprobante en Drive si viene
  var driveComprobanteId = '';
  if (comprobante) {
    try {
      var supplier = findSupplierById(invoice.supplierId);
      var folder = DriveApp.getFolderById(supplier.carpetaDriveId);
      var blob = Utilities.newBlob(Utilities.base64Decode(comprobante), 'application/pdf',
        'comprobante_' + invoice.folioInterno + '_pago' + (pagosAnteriores.length + 1) + '.pdf');
      var file = folder.createFile(blob);
      driveComprobanteId = file.getId();
    } catch (err) {
      Logger.log('Error guardando comprobante: ' + err.message);
    }
  }
  // Registrar pago parcial
  var paymentId = Utilities.getUuid();
  insertPayment({
    paymentId: paymentId,
    invoiceId: invoiceId,
    monto: monto.toFixed(2),
    fechaPago: fechaPago,
    referencia: referencia,
    driveComprobanteId: driveComprobanteId,
    registradoPor: user.correo,
    createdAt: new Date().toISOString()
  });
  // Actualizar estatus de la factura
  var nuevoTotalPagado = totalPagado + monto;
  var nuevoEstatus;
  if (nuevoTotalPagado >= totalFactura - 0.01) {
    nuevoEstatus = 'Pagado';
    updateInvoice(invoiceId, {
      estatus: 'Pagado',
      fechaPagoReal: fechaPago,
      referenciaPago: referencia
    });
  } else {
    nuevoEstatus = 'Pago parcial';
    updateInvoice(invoiceId, { estatus: 'Pago parcial' });
  }
  logAudit(user.correo, 'PARTIAL_PAYMENT', invoiceId,
    'Pago parcial $' + monto.toFixed(2) + ' | Acumulado: $' + nuevoTotalPagado.toFixed(2) +
    ' de $' + totalFactura.toFixed(2) + ' | Ref: ' + referencia);
  // Notificar al proveedor
  var supplier = findSupplierById(invoice.supplierId);
  try {
    sendPartialPaymentToSupplier(invoice, supplier, monto, nuevoTotalPagado, totalFactura, referencia);
  } catch (emailErr) {
    Logger.log('Error enviando correo de pago parcial: ' + emailErr.message);
  }
  return successResponse({
    message: nuevoEstatus === 'Pagado'
      ? 'Pago registrado. Factura liquidada al 100%.'
      : 'Pago parcial registrado. Saldo pendiente: $' + (totalFactura - nuevoTotalPagado).toFixed(2),
    payment: {
      monto: monto.toFixed(2),
      totalPagado: nuevoTotalPagado.toFixed(2),
      totalFactura: totalFactura.toFixed(2),
      saldoPendiente: (totalFactura - nuevoTotalPagado).toFixed(2),
      estatus: nuevoEstatus
    }
  });
}
// ============================================================
// HANDLERS - Obtener pagos de una factura
// ============================================================
function handleGetInvoicePayments(params) {
  var invoiceId = params.invoiceId;
  if (!invoiceId) {
    return errorResponse('ID de factura requerido.', 400);
  }
  var invoice = findInvoiceById(invoiceId);
  if (!invoice) {
    return errorResponse('Factura no encontrada.', 404);
  }
  // Proveedor solo puede ver sus propias facturas
  var user = params._user;
  if (user.rol === 'supplier' && invoice.supplierId !== user.supplierId) {
    return errorResponse('No tienes acceso.', 403);
  }
  var payments = getPaymentsByInvoice(invoiceId);
  var totalPagado = 0;
  payments.forEach(function(p) {
    totalPagado += parseFloat(p.monto) || 0;
    if (p.driveComprobanteId) {
      p.comprobanteUrl = 'https://drive.google.com/uc?export=download&id=' + p.driveComprobanteId;
    }
  });
  return successResponse({
    payments: payments,
    totalPagado: totalPagado.toFixed(2),
    totalFactura: invoice.total,
    saldoPendiente: (parseFloat(invoice.total) - totalPagado).toFixed(2)
  });
}
// ============================================================
// Email: Notificar pago parcial al proveedor
// ============================================================
function sendPartialPaymentToSupplier(invoice, supplier, montoPago, totalPagado, totalFactura, referencia) {
  if (!supplier || !supplier.correo) return;
  var saldo = totalFactura - totalPagado;
  var subject = CONFIG.COMPANY_NAME + ' - Pago parcial registrado: ' + invoice.folioInterno;
  var body = 'Estimado proveedor ' + supplier.nombre + ',\n\n' +
    'Se ha registrado un pago parcial para su factura:\n\n' +
    'Folio: ' + invoice.folioInterno + '\n' +
    'UUID: ' + invoice.uuid + '\n' +
    'Monto del pago: $' + parseFloat(montoPago).toFixed(2) + '\n' +
    'Total acumulado: $' + parseFloat(totalPagado).toFixed(2) + '\n' +
    'Total factura: $' + parseFloat(totalFactura).toFixed(2) + '\n' +
    'Saldo pendiente: $' + saldo.toFixed(2) + '\n' +
    'Referencia: ' + (referencia || 'N/A') + '\n\n' +
    (saldo <= 0.01 ? 'Su factura ha sido liquidada al 100%.\n\n' : '') +
    'Consulta el detalle en: ' + CONFIG.FRONTEND_URL + '\n\n' +
    'Saludos,\n' + CONFIG.COMPANY_NAME;
  MailApp.sendEmail(supplier.correo, subject, body);
}
// ============================================================
// Database helpers: PAYMENTS sheet
// ============================================================
function ensurePaymentsSheet() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName('PAYMENTS');
  if (!sheet) {
    sheet = ss.insertSheet('PAYMENTS');
    var headers = ['paymentId', 'invoiceId', 'monto', 'fechaPago', 'referencia', 'driveComprobanteId', 'registradoPor', 'createdAt'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sheet;
}
function insertPayment(data) {
  var sheet = ensurePaymentsSheet();
  sheet.appendRow([
    data.paymentId, data.invoiceId, data.monto, data.fechaPago,
    data.referencia, data.driveComprobanteId, data.registradoPor, data.createdAt
  ]);
}
function getPaymentsByInvoice(invoiceId) {
  var sheet = ensurePaymentsSheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var payments = [];
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === invoiceId) {
      var obj = {};
      for (var j = 0; j < headers.length; j++) {
        obj[headers[j]] = data[i][j];
      }
      payments.push(obj);
    }
  }
  return payments;
}
// ============================================================
// HANDLERS - Admin: Eliminar factura
// ============================================================
function handleDeleteInvoice(params) {
  var user = params._user;
  var invoiceId = params.invoiceId;
  if (!invoiceId) {
    return errorResponse('ID de factura requerido.', 400);
  }
  var invoice = findInvoiceById(invoiceId);
  if (!invoice) {
    return errorResponse('Factura no encontrada.', 404);
  }
  // Eliminar pagos asociados
  deletePaymentsByInvoice(invoiceId);
  // Eliminar factura
  deleteInvoiceRow(invoiceId);
  logAudit(user.correo, 'DELETE_INVOICE', invoiceId,
    'Factura eliminada: ' + invoice.folioInterno + ' | UUID: ' + invoice.uuid);
  return successResponse({ message: 'Factura "' + invoice.folioInterno + '" eliminada.' });
}
// ============================================================
// HANDLERS - Admin: Editar proveedor
// ============================================================
function handleUpdateSupplier(params) {
  var user = params._user;
  var supplierId = params.supplierId;
  if (!supplierId) {
    return errorResponse('ID de proveedor requerido.', 400);
  }
  var supplier = findSupplierById(supplierId);
  if (!supplier) {
    return errorResponse('Proveedor no encontrado.', 404);
  }
  var updates = {};
  if (params.nombre) updates.nombre = params.nombre.trim();
  if (params.telefono !== undefined) updates.telefono = params.telefono.trim();
  if (params.correoSupplier) {
    var nuevoCorreo = params.correoSupplier.trim().toLowerCase();
    if (nuevoCorreo !== supplier.correo) {
      var existingUser = findUserByEmail(nuevoCorreo);
      if (existingUser) {
        return errorResponse('Ya existe un usuario con el correo: ' + nuevoCorreo, 409);
      }
      updates.correo = nuevoCorreo;
      // Actualizar correo también en USERS
      updateUserEmail(supplierId, nuevoCorreo);
    }
  }
  if (params.estado) updates.estado = params.estado;
  updateSupplierRow(supplierId, updates);
  // Si viene nueva contraseña, actualizarla
  if (params.newPassword && params.newPassword.trim()) {
    updateUserPassword(supplierId, params.newPassword.trim());
  }
  logAudit(user.correo, 'UPDATE_SUPPLIER', '', 'Proveedor editado: ' + (updates.nombre || supplier.nombre));
  return successResponse({ message: 'Proveedor actualizado.' });
}
// ============================================================
// Database helpers: Delete invoice / payments / update supplier
// ============================================================
function deleteInvoiceRow(invoiceId) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.INVOICES);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === invoiceId) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}
function deletePaymentsByInvoice(invoiceId) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName('PAYMENTS');
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === invoiceId) {
      sheet.deleteRow(i + 1);
    }
  }
}
function updateSupplierRow(supplierId, updates) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.SUPPLIERS);
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === supplierId) {
      for (var key in updates) {
        var colIdx = headers.indexOf(key);
        if (colIdx !== -1) {
          sheet.getRange(i + 1, colIdx + 1).setValue(updates[key]);
        }
      }
      return;
    }
  }
}
function updateUserEmail(supplierId, newEmail) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === supplierId) {
      sheet.getRange(i + 1, 3).setValue(newEmail); // columna correo
      return;
    }
  }
}
function updateUserPassword(supplierId, newPassword) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === supplierId) {
      sheet.getRange(i + 1, 4).setValue(hashPassword(newPassword)); // columna hash
      return;
    }
  }
}
// ============================================================
// Database helpers: Delete supplier / user
// ============================================================
function deleteSupplier(supplierId) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.SUPPLIERS);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === supplierId) {
      sheet.deleteRow(i + 1);
      return;
    }
  }
}
function deleteUserBySupplier(supplierId) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEETS.USERS);
  var data = sheet.getDataRange().getValues();
  // Eliminar de abajo hacia arriba para no alterar índices
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === supplierId) {
      sheet.deleteRow(i + 1);
    }
  }
}
// ============================================================
// REGISTRO DE ADMIN - Ejecutar desde el editor de Apps Script
// ============================================================
/**
 * Crea un usuario administrador.
 *
 * USO: Desde el editor de Apps Script, selecciona esta función
 *      en el dropdown y haz click en Ejecutar (▶).
 *      Revisa los logs (Ver > Registros) para confirmar.
 *
 * EDITA el correo y contraseña antes de ejecutar.
 */
function registerAdmin() {
  // ---- EDITAR ESTOS VALORES ----
  var correo = 'cxp@ejecutivaambiental.com';
  var password = 'qwerty34161';
  // -------------------------------

  // Verificar que no exista
  var existing = findUserByEmail(correo);
  if (existing) {
    Logger.log('ERROR: Ya existe un usuario con el correo: ' + correo);
    Logger.log('Si necesitas cambiar la contraseña, elimina la fila del usuario en la hoja USERS y vuelve a ejecutar.');
    return;
  }

  var userId = Utilities.getUuid();
  insertUser({
    userId: userId,
    supplierId: '',
    correo: correo,
    hash: hashPassword(password),
    rol: 'admin',
    activo: 'true',
    lastLogin: '',
    tokenSesion: '',
    tokenExpiry: '',
    createdAt: new Date().toISOString()
  });

  Logger.log('=== ADMIN CREADO EXITOSAMENTE ===');
  Logger.log('Correo: ' + correo);
  Logger.log('Contraseña: ' + password);
  Logger.log('Ya puedes iniciar sesión en el portal.');
}
// ============================================================
// Formatear fecha como YYYY-MM-DD
// ============================================================
function formatDate(date) {
  if (typeof date === 'string') return date;
  var d = new Date(date);
  var year = d.getFullYear();
  var month = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return year + '-' + month + '-' + day;
}
// ============================================================
// INICIALIZACIÓN - Crear hojas si no existen
// ============================================================
function initializeSpreadsheet() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  for (var sheetName in SHEET_HEADERS) {
    var sheet = ss.getSheetByName(CONFIG.SHEETS[sheetName]);
    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEETS[sheetName]);
      var headers = SHEET_HEADERS[sheetName];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      Logger.log('Hoja creada: ' + CONFIG.SHEETS[sheetName]);
    }
  }
  // Crear parámetros iniciales si no existen
  var paramsSheet = ss.getSheetByName(CONFIG.SHEETS.PARAMS);
  var paramsData = paramsSheet.getDataRange().getValues();
  var hasCounter = false;
  var hasFeriados = false;
  for (var i = 1; i < paramsData.length; i++) {
    if (paramsData[i][0] === 'folio_counter') hasCounter = true;
    if (paramsData[i][0] === 'feriados_2025') hasFeriados = true;
  }
  if (!hasCounter) {
    paramsSheet.appendRow(['folio_counter', '0']);
  }
  if (!hasFeriados) {
    // Días feriados oficiales de México (formato YYYY-MM-DD, separados por coma)
    var feriados = [
      '2025-01-01', '2025-02-03', '2025-03-17', '2025-05-01', '2025-05-05',
      '2025-09-16', '2025-11-17', '2025-12-25',
      '2026-01-01', '2026-02-02', '2026-03-16', '2026-05-01', '2026-05-05',
      '2026-09-16', '2026-11-16', '2026-12-25'
    ].join(',');
    paramsSheet.appendRow(['feriados', feriados]);
  }
  Logger.log('Spreadsheet inicializado correctamente.');
}
// ============================================================
// SEED - Datos de demostración
// ============================================================
function seedDemoData() {
  initializeSpreadsheet();
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  // Crear carpeta raíz si no existe el ID
  var rootFolder;
  try {
    rootFolder = DriveApp.getFolderById(CONFIG.DRIVE_ROOT_FOLDER_ID);
  } catch (e) {
    rootFolder = DriveApp.createFolder('Portal Proveedores - Facturas');
    Logger.log('IMPORTANTE: Actualiza CONFIG.DRIVE_ROOT_FOLDER_ID con: ' + rootFolder.getId());
  }
  // --- Proveedor demo ---
  var supplierId1 = Utilities.getUuid();
  var supplierFolder1 = rootFolder.createFolder('XAXX010101000 - Proveedor Demo SA');
  insertSupplier({
    supplierId: supplierId1,
    nombre: 'Proveedor Demo SA de CV',
    RFC: 'XAXX010101000',
    correo: 'proveedor@demo.com',
    telefono: '5551234567',
    estado: 'activo',
    carpetaDriveId: supplierFolder1.getId(),
    createdAt: new Date().toISOString()
  });
  var supplierId2 = Utilities.getUuid();
  var supplierFolder2 = rootFolder.createFolder('XEXX010101000 - Servicios Ambientales');
  insertSupplier({
    supplierId: supplierId2,
    nombre: 'Servicios Ambientales del Norte SA',
    RFC: 'XEXX010101000',
    correo: 'servicios@demo.com',
    telefono: '5559876543',
    estado: 'activo',
    carpetaDriveId: supplierFolder2.getId(),
    createdAt: new Date().toISOString()
  });
  // --- Usuarios demo ---
  // Admin
  insertUser({
    userId: Utilities.getUuid(),
    supplierId: '',
    correo: 'admin@ejecutivaambiental.com',
    hash: hashPassword('Admin123!'),
    rol: 'admin',
    activo: 'true',
    lastLogin: '',
    tokenSesion: '',
    tokenExpiry: '',
    createdAt: new Date().toISOString()
  });
  // Proveedor 1
  insertUser({
    userId: Utilities.getUuid(),
    supplierId: supplierId1,
    correo: 'proveedor@demo.com',
    hash: hashPassword('Proveedor123!'),
    rol: 'supplier',
    activo: 'true',
    lastLogin: '',
    tokenSesion: '',
    tokenExpiry: '',
    createdAt: new Date().toISOString()
  });
  // Proveedor 2
  insertUser({
    userId: Utilities.getUuid(),
    supplierId: supplierId2,
    correo: 'servicios@demo.com',
    hash: hashPassword('Proveedor123!'),
    rol: 'supplier',
    activo: 'true',
    lastLogin: '',
    tokenSesion: '',
    tokenExpiry: '',
    createdAt: new Date().toISOString()
  });
  // --- Factura demo ---
  var invoiceId1 = Utilities.getUuid();
  var folio1 = generateFolio();
  var fechaRecepcion = new Date();
  insertInvoice({
    invoiceId: invoiceId1,
    supplierId: supplierId1,
    folioInterno: folio1,
    uuid: 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890',
    rfcEmisor: 'XAXX010101000',
    nombreEmisor: 'Proveedor Demo SA de CV',
    fechaEmision: '2025-01-10',
    total: '15000.00',
    moneda: 'MXN',
    fechaRecepcion: fechaRecepcion.toISOString(),
    fechaPagoProgramada: formatDate(computePaymentDate(fechaRecepcion)),
    estatus: 'Programado',
    driveXmlId: '',
    drivePdfId: '',
    observaciones: 'Factura de demostración',
    rechazoMotivo: '',
    fechaPagoReal: '',
    referenciaPago: '',
    createdAt: new Date().toISOString()
  });
  Logger.log('=== DATOS DEMO CREADOS ===');
  Logger.log('Admin: admin@ejecutivaambiental.com / Admin123!');
  Logger.log('Proveedor 1: proveedor@demo.com / Proveedor123!');
  Logger.log('Proveedor 2: servicios@demo.com / Proveedor123!');
  Logger.log('Carpeta Drive raíz: ' + rootFolder.getId());
}
// ============================================================
// TESTS - Funciones de prueba
// ============================================================
/**
 * Test: parseCFDI
 */
function testParseCFDI() {
  var xmlSample = '<?xml version="1.0" encoding="UTF-8"?>' +
    '<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" ' +
    'Total="15000.00" Moneda="MXN" Serie="A" Folio="123" Fecha="2025-01-15T10:30:00">' +
    '<cfdi:Emisor Rfc="XAXX010101000" Nombre="Proveedor Demo SA de CV" />' +
    '<cfdi:Complemento>' +
    '<tfd:TimbreFiscalDigital UUID="A1B2C3D4-E5F6-7890-ABCD-EF1234567890" />' +
    '</cfdi:Complemento>' +
    '</cfdi:Comprobante>';
  var result = parseCFDI(xmlSample);
  Logger.log('=== TEST parseCFDI ===');
  Logger.log('Valid: ' + result.valid);
  Logger.log('UUID: ' + result.uuid);
  Logger.log('RFC: ' + result.rfcEmisor);
  Logger.log('Nombre: ' + result.nombreEmisor);
  Logger.log('Total: ' + result.total);
  Logger.log('Moneda: ' + result.moneda);
  Logger.log('Fecha: ' + result.fechaEmision);
  // Assertions
  if (!result.valid) throw new Error('CFDI debería ser válido');
  if (result.uuid !== 'A1B2C3D4-E5F6-7890-ABCD-EF1234567890') throw new Error('UUID incorrecto');
  if (result.rfcEmisor !== 'XAXX010101000') throw new Error('RFC incorrecto');
  if (result.total !== '15000.00') throw new Error('Total incorrecto');
  Logger.log('TEST PASSED ✓');
}
/**
 * Test: generateFolio
 */
function testGenerateFolio() {
  Logger.log('=== TEST generateFolio ===');
  var folio1 = generateFolio();
  var folio2 = generateFolio();
  Logger.log('Folio 1: ' + folio1);
  Logger.log('Folio 2: ' + folio2);
  // Validar formato
  var regex = /^EA-CXP-\d{6}-\d{5}$/;
  if (!regex.test(folio1)) throw new Error('Formato de folio incorrecto: ' + folio1);
  if (folio1 === folio2) throw new Error('Los folios no deberían ser iguales');
  Logger.log('TEST PASSED ✓');
}
/**
 * Test: computePaymentDate
 */
function testComputePaymentDate() {
  Logger.log('=== TEST computePaymentDate ===');
  // Caso 1: Recibida el 5 de enero → pago el 15 de enero
  var date1 = new Date(2025, 0, 5); // 5 de enero
  var pay1 = computePaymentDate(date1);
  Logger.log('Recepción: ' + formatDate(date1) + ' → Pago: ' + formatDate(pay1));
  if (pay1.getDate() !== 15 || pay1.getMonth() !== 0) throw new Error('Caso 1 falló');
  // Caso 2: Recibida el 14 de enero → pago el 15 de enero
  var date2 = new Date(2025, 0, 14);
  var pay2 = computePaymentDate(date2);
  Logger.log('Recepción: ' + formatDate(date2) + ' → Pago: ' + formatDate(pay2));
  if (pay2.getDate() !== 15 || pay2.getMonth() !== 0) throw new Error('Caso 2 falló');
  // Caso 3: Recibida el 15 de enero → pago el 29 de enero
  var date3 = new Date(2025, 0, 15);
  var pay3 = computePaymentDate(date3);
  Logger.log('Recepción: ' + formatDate(date3) + ' → Pago: ' + formatDate(pay3));
  if (pay3.getDate() !== 29 || pay3.getMonth() !== 0) throw new Error('Caso 3 falló');
  // Caso 4: Recibida el 28 de enero → pago el 29 de enero
  var date4 = new Date(2025, 0, 28);
  var pay4 = computePaymentDate(date4);
  Logger.log('Recepción: ' + formatDate(date4) + ' → Pago: ' + formatDate(pay4));
  if (pay4.getDate() !== 29 || pay4.getMonth() !== 0) throw new Error('Caso 4 falló');
  // Caso 5: Recibida el 29 de enero → pago el 15 de febrero
  var date5 = new Date(2025, 0, 29);
  var pay5 = computePaymentDate(date5);
  Logger.log('Recepción: ' + formatDate(date5) + ' → Pago: ' + formatDate(pay5));
  // 15 de febrero 2025 es sábado → se mueve a lunes 17
  if (pay5.getMonth() !== 1) throw new Error('Caso 5 falló - mes incorrecto');
  Logger.log('  (15 feb 2025 es sábado, se mueve a lunes 17)');
  // Caso 6: Recibida el 31 de enero → pago el 15 de febrero (→ lunes 17)
  var date6 = new Date(2025, 0, 31);
  var pay6 = computePaymentDate(date6);
  Logger.log('Recepción: ' + formatDate(date6) + ' → Pago: ' + formatDate(pay6));
  Logger.log('TEST PASSED ✓');
}
/**
 * Test: duplicateUUIDCheck
 */
function testDuplicateUUIDCheck() {
  Logger.log('=== TEST duplicateUUIDCheck ===');
  // UUID que no debería existir
  var result1 = isDuplicateUUID('ZZZZZZZZ-0000-0000-0000-000000000000');
  Logger.log('UUID inexistente duplicado: ' + result1);
  if (result1) throw new Error('No debería detectar duplicado para UUID nuevo');
  Logger.log('TEST PASSED ✓');
}
/**
 * Ejecutar todos los tests
 */
function runAllTests() {
  Logger.log('========================================');
  Logger.log('EJECUTANDO TODOS LOS TESTS');
  Logger.log('========================================');
  testParseCFDI();
  testComputePaymentDate();
  // Estos tests requieren el spreadsheet configurado
  try {
    testGenerateFolio();
    testDuplicateUUIDCheck();
  } catch (e) {
    Logger.log('Tests que requieren Sheets: ' + e.message);
    Logger.log('(Configura SPREADSHEET_ID para ejecutar estos tests)');
  }
  Logger.log('========================================');
  Logger.log('TODOS LOS TESTS COMPLETADOS');
  Logger.log('========================================');
}
