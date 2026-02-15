/**
 * ============================================================
 * app.js - Lógica del Frontend
 * Portal de Proveedores - Ejecutiva Ambiental
 * ============================================================
 *
 * Opción B: Frontend en GitHub Pages consumiendo API de Apps Script.
 * Para Opción A (embebido en GAS), cambiar API_URL por google.script.run.
 */

// ============================================================
// CONFIGURACIÓN
// ============================================================

/**
 * URL del Web App de Google Apps Script publicado.
 * IMPORTANTE: Usar la URL que termina en /exec (NO /dev).
 * Ejemplo: https://script.google.com/macros/s/AKfycb.../exec
 */
const API_URL = 'TU_WEBAPP_URL_AQUI';

// ============================================================
// ESTADO DE LA APLICACIÓN
// ============================================================
const State = {
  token: localStorage.getItem('ea_token') || null,
  user: JSON.parse(localStorage.getItem('ea_user') || 'null'),
  currentView: 'login',
  lastAcuse: null
};

// ============================================================
// MÓDULO PRINCIPAL: App
// ============================================================
const App = {

  // --------------------------------------------------------
  // INICIALIZACIÓN
  // --------------------------------------------------------
  init() {
    if (State.token && State.user) {
      this.onLoginSuccess(State.user, State.token, false);
    } else {
      this.showView('login');
    }
  },

  // --------------------------------------------------------
  // NAVEGACIÓN
  // --------------------------------------------------------
  showView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('d-none'));
    const view = document.getElementById('view' + viewId.charAt(0).toUpperCase() + viewId.slice(1));
    if (view) view.classList.remove('d-none');
    State.currentView = viewId;
  },

  setupNav(role) {
    const nav = document.getElementById('mainNav');
    const links = document.getElementById('navLinks');
    nav.style.display = '';
    links.innerHTML = '';

    if (role === 'supplier') {
      links.innerHTML = `
        <li class="nav-item">
          <a class="nav-link active" href="#" onclick="App.navigate('upload')">
            <i class="bi bi-cloud-upload"></i> Subir Factura
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="#" onclick="App.navigate('myInvoices')">
            <i class="bi bi-receipt"></i> Mis Facturas
          </a>
        </li>`;
    } else if (role === 'admin') {
      links.innerHTML = `
        <li class="nav-item">
          <a class="nav-link active" href="#" onclick="App.navigate('dashboard')">
            <i class="bi bi-speedometer2"></i> Dashboard
          </a>
        </li>
        <li class="nav-item">
          <a class="nav-link" href="#" onclick="App.navigate('suppliers')">
            <i class="bi bi-people"></i> Proveedores
          </a>
        </li>`;
    }
  },

  navigate(viewId) {
    // Actualizar nav links activos
    document.querySelectorAll('#navLinks .nav-link').forEach(l => l.classList.remove('active'));
    event.target.closest('.nav-link')?.classList.add('active');

    this.showView(viewId);

    // Cargar datos según la vista
    switch (viewId) {
      case 'myInvoices': this.loadMyInvoices(); break;
      case 'dashboard': this.loadDashboard(); break;
      case 'suppliers': this.loadSuppliers(); break;
    }
  },

  // --------------------------------------------------------
  // LOGIN
  // --------------------------------------------------------
  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn = document.getElementById('loginBtn');
    const errorDiv = document.getElementById('loginError');

    errorDiv.classList.add('d-none');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Ingresando...';

    try {
      const data = await API.call('login', { correo: email, password: password });

      if (data.success) {
        this.onLoginSuccess(data.data.user, data.data.token, true);
      } else {
        errorDiv.textContent = data.error || 'Error al iniciar sesión.';
        errorDiv.classList.remove('d-none');
      }
    } catch (err) {
      errorDiv.textContent = 'Error de conexión. Verifica la URL del servidor.';
      errorDiv.classList.remove('d-none');
      console.error('Login error:', err);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-lock"></i> Iniciar sesión';
    }
  },

  onLoginSuccess(user, token, save) {
    State.user = user;
    State.token = token;

    if (save) {
      localStorage.setItem('ea_token', token);
      localStorage.setItem('ea_user', JSON.stringify(user));
    }

    document.getElementById('navUserName').textContent =
      user.supplierName || user.correo;

    this.setupNav(user.rol);

    if (user.rol === 'supplier') {
      this.showView('upload');
    } else {
      this.showView('dashboard');
      this.loadDashboard();
    }
  },

  logout() {
    State.token = null;
    State.user = null;
    localStorage.removeItem('ea_token');
    localStorage.removeItem('ea_user');
    document.getElementById('mainNav').style.display = 'none';
    this.showView('login');
    document.getElementById('loginForm').reset();
  },

  // --------------------------------------------------------
  // PROVEEDOR: SUBIR FACTURA
  // --------------------------------------------------------
  async handleUpload(e) {
    e.preventDefault();
    const xmlInput = document.getElementById('xmlFile');
    const pdfInput = document.getElementById('pdfFile');
    const obs = document.getElementById('observaciones').value;
    const btn = document.getElementById('uploadBtn');
    const errorDiv = document.getElementById('uploadError');
    const successDiv = document.getElementById('uploadSuccess');

    errorDiv.classList.add('d-none');
    successDiv.classList.add('d-none');
    document.getElementById('acuseContainer').classList.add('d-none');

    if (!xmlInput.files[0]) {
      errorDiv.textContent = 'Selecciona un archivo XML.';
      errorDiv.classList.remove('d-none');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Enviando...';
    this.showLoading('Subiendo factura...');

    try {
      // Leer archivos como Base64
      const xmlBase64 = await this.fileToBase64(xmlInput.files[0]);
      const pdfBase64 = pdfInput.files[0] ? await this.fileToBase64(pdfInput.files[0]) : null;

      const params = {
        xmlFile: xmlBase64,
        xmlFileName: xmlInput.files[0].name,
        observaciones: obs
      };

      if (pdfBase64) {
        params.pdfFile = pdfBase64;
        params.pdfFileName = pdfInput.files[0].name;
      }

      const data = await API.call('uploadInvoice', params);

      if (data.success) {
        successDiv.textContent = data.data.message;
        successDiv.classList.remove('d-none');

        // Mostrar acuse
        State.lastAcuse = data.data.acuse;
        this.renderAcuse(data.data.acuse);

        // Limpiar formulario
        document.getElementById('uploadForm').reset();
      } else {
        errorDiv.textContent = data.error || 'Error al subir la factura.';
        errorDiv.classList.remove('d-none');
      }
    } catch (err) {
      errorDiv.textContent = 'Error de conexión: ' + err.message;
      errorDiv.classList.remove('d-none');
      console.error('Upload error:', err);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-send"></i> Enviar Factura';
      this.hideLoading();
    }
  },

  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // --------------------------------------------------------
  // ACUSE DE RECIBO
  // --------------------------------------------------------
  renderAcuse(acuse) {
    const container = document.getElementById('acuseContainer');
    const body = document.getElementById('acuseBody');

    body.innerHTML = `
      <div id="acuseContent" style="padding: 20px; background: #f8f9fa;">
        <div style="text-align: center; margin-bottom: 15px;">
          <h5 style="color: #1a5632;">ACUSE DE RECIBO DE FACTURA</h5>
          <p style="color: #666; margin: 0;">Ejecutiva Ambiental</p>
        </div>
        <table class="table table-bordered mb-0">
          <tr><th style="width:40%">Folio Interno</th><td><strong>${acuse.folioInterno}</strong></td></tr>
          <tr><th>UUID</th><td style="font-size:0.85em; word-break:break-all;">${acuse.uuid}</td></tr>
          <tr><th>RFC Emisor</th><td>${acuse.rfcEmisor}</td></tr>
          <tr><th>Nombre Emisor</th><td>${acuse.nombreEmisor || '-'}</td></tr>
          <tr><th>Total</th><td><strong>$${formatMoney(acuse.total)} ${acuse.moneda}</strong></td></tr>
          <tr><th>Fecha/Hora Recepción</th><td>${formatDateTime(acuse.fechaRecepcion)}</td></tr>
          <tr><th>Pago Programado</th><td><strong class="text-success">${acuse.fechaPagoProgramada}</strong></td></tr>
          <tr><th>Estatus</th><td><span class="badge bg-warning text-dark">${acuse.estatus}</span></td></tr>
        </table>
      </div>`;

    container.classList.remove('d-none');
    container.scrollIntoView({ behavior: 'smooth' });
  },

  copyAcuse() {
    if (!State.lastAcuse) return;
    const a = State.lastAcuse;
    const text =
      `═══════════════════════════════════\n` +
      `  ACUSE DE RECIBO DE FACTURA\n` +
      `  Ejecutiva Ambiental\n` +
      `═══════════════════════════════════\n\n` +
      `Folio Interno:   ${a.folioInterno}\n` +
      `UUID:            ${a.uuid}\n` +
      `RFC Emisor:      ${a.rfcEmisor}\n` +
      `Nombre Emisor:   ${a.nombreEmisor || '-'}\n` +
      `Total:           $${formatMoney(a.total)} ${a.moneda}\n` +
      `Recepción:       ${formatDateTime(a.fechaRecepcion)}\n` +
      `Pago Programado: ${a.fechaPagoProgramada}\n` +
      `Estatus:         ${a.estatus}\n\n` +
      `═══════════════════════════════════`;

    navigator.clipboard.writeText(text).then(() => {
      this.toast('Acuse copiado al portapapeles', 'success');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.toast('Acuse copiado', 'success');
    });
  },

  downloadAcuse() {
    const el = document.getElementById('acuseContent');
    if (!el) return;

    html2canvas(el, { scale: 2, backgroundColor: '#ffffff' }).then(canvas => {
      const link = document.createElement('a');
      link.download = `acuse_${State.lastAcuse?.folioInterno || 'factura'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      this.toast('Acuse descargado como imagen', 'success');
    }).catch(err => {
      console.error('Error generando imagen:', err);
      this.toast('Error al generar imagen', 'danger');
    });
  },

  // --------------------------------------------------------
  // PROVEEDOR: MIS FACTURAS
  // --------------------------------------------------------
  async loadMyInvoices() {
    const loading = document.getElementById('myInvoicesLoading');
    const table = document.getElementById('myInvoicesTable');
    const body = document.getElementById('myInvoicesBody');
    const empty = document.getElementById('myInvoicesEmpty');

    loading.style.display = '';
    table.style.display = 'none';
    empty.classList.add('d-none');

    try {
      const data = await API.call('getMyInvoices');

      if (data.success) {
        const invoices = data.data.invoices;

        if (invoices.length === 0) {
          empty.classList.remove('d-none');
        } else {
          body.innerHTML = invoices.map(inv => `
            <tr>
              <td><strong>${inv.folioInterno}</strong></td>
              <td style="font-size:0.8em; max-width:150px;" class="text-truncate" title="${inv.uuid}">${inv.uuid}</td>
              <td>${inv.fechaEmision}</td>
              <td>$${formatMoney(inv.total)}</td>
              <td>${inv.fechaPagoProgramada}</td>
              <td>${statusBadge(inv.estatus)}</td>
              <td>${formatDateTime(inv.fechaRecepcion)}</td>
              <td>
                <button class="btn btn-outline-primary btn-sm" onclick="App.viewInvoiceDetail('${inv.invoiceId}')">
                  <i class="bi bi-eye"></i>
                </button>
              </td>
            </tr>`).join('');
          table.style.display = '';
        }
      }
    } catch (err) {
      console.error('Error loading invoices:', err);
      this.toast('Error al cargar facturas', 'danger');
    } finally {
      loading.style.display = 'none';
    }
  },

  // --------------------------------------------------------
  // DETALLE DE FACTURA
  // --------------------------------------------------------
  async viewInvoiceDetail(invoiceId) {
    const modal = new bootstrap.Modal(document.getElementById('invoiceDetailModal'));
    const body = document.getElementById('invoiceDetailBody');
    const footer = document.getElementById('invoiceDetailFooter');

    body.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-success"></div></div>';
    footer.innerHTML = '';
    modal.show();

    try {
      const data = await API.call('getInvoiceDetail', { invoiceId });

      if (data.success) {
        const inv = data.data.invoice;
        body.innerHTML = `
          <div class="row">
            <div class="col-md-6">
              <table class="table table-sm">
                <tr><th>Folio Interno</th><td><strong>${inv.folioInterno}</strong></td></tr>
                <tr><th>UUID</th><td style="font-size:0.85em; word-break:break-all;">${inv.uuid}</td></tr>
                <tr><th>RFC Emisor</th><td>${inv.rfcEmisor}</td></tr>
                <tr><th>Nombre Emisor</th><td>${inv.nombreEmisor || '-'}</td></tr>
                <tr><th>Fecha Emisión</th><td>${inv.fechaEmision}</td></tr>
                <tr><th>Total</th><td><strong>$${formatMoney(inv.total)} ${inv.moneda}</strong></td></tr>
              </table>
            </div>
            <div class="col-md-6">
              <table class="table table-sm">
                <tr><th>Fecha Recepción</th><td>${formatDateTime(inv.fechaRecepcion)}</td></tr>
                <tr><th>Pago Programado</th><td><strong>${inv.fechaPagoProgramada}</strong></td></tr>
                <tr><th>Estatus</th><td>${statusBadge(inv.estatus)}</td></tr>
                ${inv.fechaPagoReal ? `<tr><th>Fecha Pago Real</th><td>${inv.fechaPagoReal}</td></tr>` : ''}
                ${inv.referenciaPago ? `<tr><th>Referencia</th><td>${inv.referenciaPago}</td></tr>` : ''}
                ${inv.rechazoMotivo ? `<tr><th class="text-danger">Motivo Rechazo</th><td class="text-danger">${inv.rechazoMotivo}</td></tr>` : ''}
                ${inv.observaciones ? `<tr><th>Observaciones</th><td>${inv.observaciones}</td></tr>` : ''}
              </table>
            </div>
          </div>`;

        // Botones de descarga
        let footerHtml = '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>';
        if (inv.xmlDownloadUrl) {
          footerHtml = `<a href="${inv.xmlDownloadUrl}" target="_blank" class="btn btn-outline-success btn-sm">
            <i class="bi bi-file-earmark-code"></i> Descargar XML</a> ` + footerHtml;
        }
        if (inv.pdfDownloadUrl) {
          footerHtml = `<a href="${inv.pdfDownloadUrl}" target="_blank" class="btn btn-outline-danger btn-sm">
            <i class="bi bi-file-earmark-pdf"></i> Descargar PDF</a> ` + footerHtml;
        }

        // Botón cambiar estatus (solo admin)
        if (State.user?.rol === 'admin') {
          footerHtml = `<button class="btn btn-warning btn-sm" onclick="App.openChangeStatus('${inv.invoiceId}', '${inv.folioInterno}', '${inv.estatus}')">
            <i class="bi bi-pencil-square"></i> Cambiar Estatus</button> ` + footerHtml;
        }

        footer.innerHTML = footerHtml;
      } else {
        body.innerHTML = `<div class="alert alert-danger">${data.error}</div>`;
      }
    } catch (err) {
      body.innerHTML = '<div class="alert alert-danger">Error al cargar detalle.</div>';
    }
  },

  // --------------------------------------------------------
  // ADMIN: DASHBOARD
  // --------------------------------------------------------
  async loadDashboard() {
    this.loadDashboardStats();
    this.loadSupplierFilter();
    this.loadAllInvoices();
  },

  async loadDashboardStats() {
    try {
      const data = await API.call('getDashboardStats');
      if (data.success) {
        const s = data.data.stats;
        document.getElementById('statTotal').textContent = s.total;
        document.getElementById('statProgramadas').textContent = s.programadas;
        document.getElementById('statPagadas').textContent = s.pagadas;
        document.getElementById('statVencidas').textContent = s.vencidas;
        document.getElementById('statPorPagarSemana').textContent = s.porPagarEstaSemana;
        document.getElementById('statMontoPendiente').textContent = '$' + formatMoney(s.montoPendiente);
        document.getElementById('statEnRevision').textContent = s.enRevision;
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  },

  async loadSupplierFilter() {
    try {
      const data = await API.call('getSuppliers');
      if (data.success) {
        const select = document.getElementById('filterSupplier');
        // Mantener la primera opción
        select.innerHTML = '<option value="">Todos los proveedores</option>';
        data.data.suppliers.forEach(s => {
          select.innerHTML += `<option value="${s.supplierId}">${s.nombre} (${s.RFC})</option>`;
        });
      }
    } catch (err) {
      console.error('Error loading suppliers for filter:', err);
    }
  },

  async loadAllInvoices() {
    const loading = document.getElementById('adminInvoicesLoading');
    const table = document.getElementById('adminInvoicesTable');
    const body = document.getElementById('adminInvoicesBody');

    loading.style.display = '';
    table.style.display = 'none';

    const params = {
      supplierId: document.getElementById('filterSupplier')?.value || '',
      estatus: document.getElementById('filterEstatus')?.value || '',
      fechaDesde: document.getElementById('filterFechaDesde')?.value || '',
      fechaHasta: document.getElementById('filterFechaHasta')?.value || ''
    };

    try {
      const data = await API.call('getAllInvoices', params);

      if (data.success) {
        const invoices = data.data.invoices;
        body.innerHTML = invoices.map(inv => `
          <tr>
            <td><strong>${inv.folioInterno}</strong></td>
            <td>${inv.supplierName || '-'}</td>
            <td style="font-size:0.75em; max-width:120px;" class="text-truncate" title="${inv.uuid}">${inv.uuid}</td>
            <td>${inv.fechaEmision}</td>
            <td>$${formatMoney(inv.total)}</td>
            <td>${inv.fechaPagoProgramada}</td>
            <td>${statusBadge(inv.estatus)}</td>
            <td class="text-nowrap">
              <button class="btn btn-outline-primary btn-sm" onclick="App.viewInvoiceDetail('${inv.invoiceId}')" title="Ver detalle">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-warning btn-sm" onclick="App.openChangeStatus('${inv.invoiceId}', '${inv.folioInterno}', '${inv.estatus}')" title="Cambiar estatus">
                <i class="bi bi-pencil-square"></i>
              </button>
            </td>
          </tr>`).join('');
        table.style.display = '';
      }
    } catch (err) {
      console.error('Error loading all invoices:', err);
      this.toast('Error al cargar facturas', 'danger');
    } finally {
      loading.style.display = 'none';
    }
  },

  filterThisWeek() {
    document.getElementById('filterEstatus').value = 'Programado';
    // Calcular esta semana
    const today = new Date();
    const endWeek = new Date(today);
    endWeek.setDate(today.getDate() + 7);

    document.getElementById('filterFechaDesde').value = '';
    document.getElementById('filterFechaHasta').value = '';

    // Usar filtro especial del backend
    this.loadAllInvoicesSpecial({ porPagarEstaSemana: 'true' });
  },

  filterOverdue() {
    document.getElementById('filterEstatus').value = '';
    document.getElementById('filterFechaDesde').value = '';
    document.getElementById('filterFechaHasta').value = '';

    this.loadAllInvoicesSpecial({ vencidos: 'true' });
  },

  async loadAllInvoicesSpecial(extraParams) {
    const loading = document.getElementById('adminInvoicesLoading');
    const table = document.getElementById('adminInvoicesTable');
    const body = document.getElementById('adminInvoicesBody');

    loading.style.display = '';
    table.style.display = 'none';

    try {
      const data = await API.call('getAllInvoices', extraParams);

      if (data.success) {
        const invoices = data.data.invoices;
        body.innerHTML = invoices.map(inv => `
          <tr>
            <td><strong>${inv.folioInterno}</strong></td>
            <td>${inv.supplierName || '-'}</td>
            <td style="font-size:0.75em; max-width:120px;" class="text-truncate" title="${inv.uuid}">${inv.uuid}</td>
            <td>${inv.fechaEmision}</td>
            <td>$${formatMoney(inv.total)}</td>
            <td>${inv.fechaPagoProgramada}</td>
            <td>${statusBadge(inv.estatus)}</td>
            <td class="text-nowrap">
              <button class="btn btn-outline-primary btn-sm" onclick="App.viewInvoiceDetail('${inv.invoiceId}')">
                <i class="bi bi-eye"></i>
              </button>
              <button class="btn btn-outline-warning btn-sm" onclick="App.openChangeStatus('${inv.invoiceId}', '${inv.folioInterno}', '${inv.estatus}')">
                <i class="bi bi-pencil-square"></i>
              </button>
            </td>
          </tr>`).join('');
        table.style.display = '';
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      loading.style.display = 'none';
    }
  },

  clearFilters() {
    document.getElementById('filterSupplier').value = '';
    document.getElementById('filterEstatus').value = '';
    document.getElementById('filterFechaDesde').value = '';
    document.getElementById('filterFechaHasta').value = '';
    this.loadAllInvoices();
  },

  // --------------------------------------------------------
  // ADMIN: CAMBIAR ESTATUS
  // --------------------------------------------------------
  openChangeStatus(invoiceId, folio, currentStatus) {
    // Cerrar modal de detalle si está abierto
    const detailModal = bootstrap.Modal.getInstance(document.getElementById('invoiceDetailModal'));
    if (detailModal) detailModal.hide();

    document.getElementById('csInvoiceId').value = invoiceId;
    document.getElementById('csFolio').textContent = folio;
    document.getElementById('csEstatus').value = currentStatus;
    document.getElementById('csMotivo').value = '';
    document.getElementById('csFechaPago').value = '';
    document.getElementById('csReferencia').value = '';
    document.getElementById('changeStatusError').classList.add('d-none');

    this.toggleStatusFields();

    const modal = new bootstrap.Modal(document.getElementById('changeStatusModal'));
    modal.show();
  },

  toggleStatusFields() {
    const status = document.getElementById('csEstatus').value;
    document.getElementById('csRechazoFields').classList.toggle('d-none', status !== 'Rechazado');
    document.getElementById('csPagoFields').classList.toggle('d-none', status !== 'Pagado');
  },

  async submitStatusChange() {
    const invoiceId = document.getElementById('csInvoiceId').value;
    const estatus = document.getElementById('csEstatus').value;
    const motivo = document.getElementById('csMotivo').value;
    const fechaPago = document.getElementById('csFechaPago').value;
    const referencia = document.getElementById('csReferencia').value;
    const errorDiv = document.getElementById('changeStatusError');
    const btn = document.getElementById('csBtn');

    errorDiv.classList.add('d-none');

    if (estatus === 'Rechazado' && !motivo.trim()) {
      errorDiv.textContent = 'El motivo de rechazo es obligatorio.';
      errorDiv.classList.remove('d-none');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
      const data = await API.call('updateInvoiceStatus', {
        invoiceId, estatus, motivo, fechaPagoReal: fechaPago, referenciaPago: referencia
      });

      if (data.success) {
        bootstrap.Modal.getInstance(document.getElementById('changeStatusModal')).hide();
        this.toast(data.data.message, 'success');
        // Recargar datos
        if (State.user.rol === 'admin') {
          this.loadDashboard();
        } else {
          this.loadMyInvoices();
        }
      } else {
        errorDiv.textContent = data.error;
        errorDiv.classList.remove('d-none');
      }
    } catch (err) {
      errorDiv.textContent = 'Error de conexión.';
      errorDiv.classList.remove('d-none');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar Cambio';
    }
  },

  // --------------------------------------------------------
  // ADMIN: EXPORTAR CSV
  // --------------------------------------------------------
  async exportCSV() {
    try {
      this.showLoading('Generando CSV...');
      const data = await API.call('exportCSV');

      if (data.success) {
        const blob = new Blob(['\ufeff' + data.data.csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = data.data.filename;
        link.click();
        this.toast('CSV descargado', 'success');
      }
    } catch (err) {
      this.toast('Error al exportar CSV', 'danger');
    } finally {
      this.hideLoading();
    }
  },

  // --------------------------------------------------------
  // ADMIN: PROVEEDORES
  // --------------------------------------------------------
  async loadSuppliers() {
    const loading = document.getElementById('suppliersLoading');
    const table = document.getElementById('suppliersTable');
    const body = document.getElementById('suppliersBody');

    loading.style.display = '';
    table.style.display = 'none';

    try {
      const data = await API.call('getSuppliers');

      if (data.success) {
        body.innerHTML = data.data.suppliers.map(s => `
          <tr>
            <td><strong>${s.nombre}</strong></td>
            <td>${s.RFC}</td>
            <td>${s.correo}</td>
            <td>${s.telefono || '-'}</td>
            <td>${s.estado === 'activo'
              ? '<span class="badge bg-success">Activo</span>'
              : '<span class="badge bg-secondary">Inactivo</span>'}</td>
            <td>${formatDateTime(s.createdAt)}</td>
          </tr>`).join('');
        table.style.display = '';
      }
    } catch (err) {
      console.error('Error loading suppliers:', err);
    } finally {
      loading.style.display = 'none';
    }
  },

  async handleCreateSupplier(e) {
    e.preventDefault();
    const btn = document.getElementById('nsBtn');
    const errorDiv = document.getElementById('newSupplierError');

    errorDiv.classList.add('d-none');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creando...';

    try {
      const data = await API.call('createSupplier', {
        nombre: document.getElementById('nsNombre').value,
        rfc: document.getElementById('nsRFC').value.toUpperCase(),
        correoSupplier: document.getElementById('nsCorreo').value,
        telefono: document.getElementById('nsTelefono').value,
        passwordSupplier: document.getElementById('nsPassword').value
      });

      if (data.success) {
        bootstrap.Modal.getInstance(document.getElementById('newSupplierModal')).hide();
        document.getElementById('newSupplierForm').reset();
        this.toast('Proveedor creado exitosamente', 'success');
        this.loadSuppliers();
        this.loadSupplierFilter();
      } else {
        errorDiv.textContent = data.error;
        errorDiv.classList.remove('d-none');
      }
    } catch (err) {
      errorDiv.textContent = 'Error de conexión.';
      errorDiv.classList.remove('d-none');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-save"></i> Crear Proveedor';
    }
  },

  // --------------------------------------------------------
  // UI: Loading overlay
  // --------------------------------------------------------
  showLoading(text) {
    document.getElementById('loadingText').textContent = text || 'Procesando...';
    document.getElementById('loadingOverlay').classList.remove('d-none');
  },

  hideLoading() {
    document.getElementById('loadingOverlay').classList.add('d-none');
  },

  // --------------------------------------------------------
  // UI: Toast notification
  // --------------------------------------------------------
  toast(message, type) {
    const container = document.getElementById('toastContainer') || (() => {
      const div = document.createElement('div');
      div.id = 'toastContainer';
      div.className = 'position-fixed top-0 end-0 p-3';
      div.style.zIndex = '9999';
      document.body.appendChild(div);
      return div;
    })();

    const id = 'toast_' + Date.now();
    const bgClass = type === 'success' ? 'bg-success' : type === 'danger' ? 'bg-danger' : 'bg-info';

    container.insertAdjacentHTML('beforeend', `
      <div id="${id}" class="toast align-items-center text-white ${bgClass} border-0" role="alert">
        <div class="d-flex">
          <div class="toast-body">${message}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>`);

    const toastEl = document.getElementById(id);
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();

    toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
  }
};

// ============================================================
// MÓDULO API: Comunicación con el backend
// ============================================================
const API = {
  /**
   * Realiza una llamada a la API de Apps Script.
   *
   * CORS en Apps Script:
   * - Las Web Apps publicadas como "Cualquier persona" responden
   *   correctamente a fetch() desde cualquier origen.
   * - Se debe usar la URL /exec, NO /dev.
   * - Los datos se envían como parámetros de URL para GET
   *   o como JSON en POST.
   */
  async call(action, params) {
    params = params || {};
    params.action = action;

    // Agregar token si existe
    if (State.token) {
      params.token = State.token;
    }

    // Determinar si es GET o POST
    // POST para: login, uploadInvoice, updateInvoiceStatus, createSupplier
    const postActions = ['login', 'uploadInvoice', 'updateInvoiceStatus', 'createSupplier'];
    const method = postActions.includes(action) ? 'POST' : 'GET';

    try {
      let response;

      if (method === 'GET') {
        const queryString = Object.entries(params)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&');
        response = await fetch(`${API_URL}?${queryString}`, {
          method: 'GET',
          redirect: 'follow'
        });
      } else {
        response = await fetch(API_URL, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify(params)
        });
      }

      const text = await response.text();

      try {
        return JSON.parse(text);
      } catch (parseErr) {
        console.error('Response no es JSON:', text.substring(0, 500));
        return { success: false, error: 'Respuesta inválida del servidor.' };
      }
    } catch (fetchErr) {
      console.error('Fetch error:', fetchErr);
      throw fetchErr;
    }
  }
};

// ============================================================
// UTILIDADES GLOBALES
// ============================================================

/**
 * Formatea un número como moneda con comas.
 */
function formatMoney(amount) {
  const num = parseFloat(amount);
  if (isNaN(num)) return amount;
  return num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Formatea un ISO string como fecha legible.
 */
function formatDateTime(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    const day = ('0' + d.getDate()).slice(-2);
    const month = ('0' + (d.getMonth() + 1)).slice(-2);
    const year = d.getFullYear();
    const hours = ('0' + d.getHours()).slice(-2);
    const mins = ('0' + d.getMinutes()).slice(-2);
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch (e) {
    return isoString;
  }
}

/**
 * Genera un badge HTML para un estatus.
 */
function statusBadge(estatus) {
  const map = {
    'Programado': 'bg-warning text-dark',
    'Pagado': 'bg-success',
    'Rechazado': 'bg-danger',
    'En revisión': 'bg-info'
  };
  const cls = map[estatus] || 'bg-secondary';
  return `<span class="badge ${cls}">${estatus}</span>`;
}

// ============================================================
// INICIALIZAR APP
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
