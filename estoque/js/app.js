// ============================================
// CONFIGURAÇÃO - Cole sua URL do Google Apps Script aqui
// ============================================
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyuOOKSFh5s3lIDJlQ1oGQHGRL-rRbbC33k8AAtCVW4QQH9W8gjWA5MYqekxQXuKHo4/exec';
// ============================================

// Estado da aplicação
let allProducts = [];
let dashboardData = {};
let currentEditId = null;

// ===== ELEMENTOS DOM =====
const elements = {
    sidebar: document.getElementById('sidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    mobileToggle: document.getElementById('mobileToggle'),
    pageTitle: document.getElementById('pageTitle'),
    globalSearch: document.getElementById('globalSearch'),
    refreshBtn: document.getElementById('refreshBtn'),
    connectionStatus: document.getElementById('connectionStatus'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    toastContainer: document.getElementById('toastContainer'),
    modalOverlay: document.getElementById('modalOverlay'),
    modalTitle: document.getElementById('modalTitle'),
    modalMessage: document.getElementById('modalMessage'),
    modalClose: document.getElementById('modalClose'),
    modalCancelBtn: document.getElementById('modalCancelBtn'),
    modalConfirmBtn: document.getElementById('modalConfirmBtn'),
    produtoForm: document.getElementById('produtoForm'),
    editId: document.getElementById('editId'),
    formTitle: document.getElementById('formTitle'),
    btnSubmit: document.getElementById('btnSubmit'),
    btnCancel: document.getElementById('btnCancel'),
    produtosBody: document.getElementById('produtosBody'),
    tableEmpty: document.getElementById('tableEmpty'),
    filterCategoria: document.getElementById('filterCategoria'),
    filterOrdem: document.getElementById('filterOrdem'),
    btnExportCSV: document.getElementById('btnExportCSV')
};

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupEventListeners();
    loadAllData();
});

// ===== NAVEGAÇÃO =====
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            navigateTo(page);
        });
    });
}

function navigateTo(page) {
    // Atualizar nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    // Atualizar páginas
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');

    // Atualizar título
    const titles = {
        dashboard: 'Dashboard',
        produtos: 'Produtos',
        adicionar: 'Adicionar Produto',
        relatorios: 'Relatórios'
    };
    elements.pageTitle.textContent = titles[page] || page;

    // Fechar sidebar mobile
    elements.sidebar.classList.remove('mobile-open');

    // Refresh dados da página
    if (page === 'dashboard') loadDashboard();
    if (page === 'produtos') renderProducts();
    if (page === 'relatorios') renderReports();
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
    // Sidebar toggle
    elements.sidebarToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('collapsed');
    });

    elements.mobileToggle.addEventListener('click', () => {
        elements.sidebar.classList.toggle('mobile-open');
    });

    // Busca global
    elements.globalSearch.addEventListener('input', debounce((e) => {
        const term = e.target.value.toLowerCase();
        if (term.length > 0) {
            navigateTo('produtos');
            filterProducts(term);
        } else {
            renderProducts();
        }
    }, 300));

    // Refresh
    elements.refreshBtn.addEventListener('click', () => {
        loadAllData();
    });

    // Formulário
    elements.produtoForm.addEventListener('submit', handleFormSubmit);
    elements.btnCancel.addEventListener('click', cancelEdit);

    // Filtros
    elements.filterCategoria.addEventListener('change', renderProducts);
    elements.filterOrdem.addEventListener('change', renderProducts);

    // Modal
    elements.modalClose.addEventListener('click', closeModal);
    elements.modalCancelBtn.addEventListener('click', closeModal);
    elements.modalOverlay.addEventListener('click', (e) => {
        if (e.target === elements.modalOverlay) closeModal();
    });

    // Export CSV
    elements.btnExportCSV.addEventListener('click', exportCSV);
}

// ===== API CALLS =====
async function apiCall(params) {
    const url = new URL(GOOGLE_SCRIPT_URL);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    try {
        const response = await fetch(url.toString());
        if (!response.ok) throw new Error('Erro na requisição');
        const data = await response.json();
        setConnectionStatus(true);
        return data;
    } catch (error) {
        console.error('API Error:', error);
        setConnectionStatus(false);
        throw error;
    }
}

function setConnectionStatus(online) {
    const status = elements.connectionStatus;
    if (online) {
        status.classList.remove('offline');
        status.innerHTML = '<i class="fas fa-circle"></i><span>Conectado</span>';
    } else {
        status.classList.add('offline');
        status.innerHTML = '<i class="fas fa-circle"></i><span>Desconectado</span>';
    }
}

// ===== LOAD DATA =====
async function loadAllData() {
    showLoading(true);
    try {
        const [productsRes, dashRes] = await Promise.all([
            apiCall({ action: 'read' }),
            apiCall({ action: 'dashboard' })
        ]);

        if (productsRes.status === 'success') {
            allProducts = productsRes.data;
        }
        if (dashRes.status === 'success') {
            dashboardData = dashRes;
        }

        renderDashboard();
        renderProducts();
        updateCategoriesFilter();
        renderReports();

        showToast('Dados carregados com sucesso!', 'success');
    } catch (error) {
        showToast('Erro ao carregar dados. Verifique a conexão.', 'error');
    }
    showLoading(false);
}

async function loadDashboard() {
    try {
        const res = await apiCall({ action: 'dashboard' });
        if (res.status === 'success') {
            dashboardData = res;
            renderDashboard();
        }
    } catch (error) {
        console.error('Erro ao carregar dashboard:', error);
    }
}

// ===== RENDER DASHBOARD =====
function renderDashboard() {
    document.getElementById('statTotalProdutos').textContent = dashboardData.totalProdutos || 0;
    document.getElementById('statTotalItens').textContent = formatNumber(dashboardData.totalItens || 0);
    document.getElementById('statValorTotal').textContent = formatCurrency(dashboardData.valorTotal || 0);
    document.getElementById('statEstoqueBaixo').textContent = dashboardData.estoqueBaixo || 0;

    // Gráfico de categorias
    renderCategoriesChart();

    // Lista de estoque baixo
    renderLowStockList();
}

function renderCategoriesChart() {
    const container = document.getElementById('categoriasChart');
    const categorias = dashboardData.categorias || {};
    const entries = Object.entries(categorias);

    if (entries.length === 0) {
        container.innerHTML = '<div class="no-data"><i class="fas fa-chart-bar"></i>Nenhuma categoria encontrada</div>';
        return;
    }

    const maxQtd = Math.max(...entries.map(([, v]) => v.quantidade));

    container.innerHTML = entries.map(([nome, data]) => {
        const percent = maxQtd > 0 ? (data.quantidade / maxQtd) * 100 : 0;
        return `
            <div class="category-bar">
                <div class="category-bar-header">
                    <span class="category-bar-name">${nome}</span>
                    <span class="category-bar-value">${data.quantidade} itens · ${formatCurrency(data.valor)}</span>
                </div>
                <div class="category-bar-track">
                    <div class="category-bar-fill" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderLowStockList() {
    const container = document.getElementById('lowStockList');
    const lowStock = allProducts.filter(p => parseInt(p.Quantidade) <= 5);

    if (lowStock.length === 0) {
        container.innerHTML = '<div class="no-data"><i class="fas fa-check-circle"></i>Todos os produtos estão com estoque adequado!</div>';
        return;
    }

    lowStock.sort((a, b) => parseInt(a.Quantidade) - parseInt(b.Quantidade));

    container.innerHTML = lowStock.map(p => {
        const qty = parseInt(p.Quantidade);
        const cls = qty <= 2 ? 'critical' : 'warning';
        return `
            <div class="low-stock-item">
                <div class="low-stock-info">
                    <span class="low-stock-name">${p.Produto}</span>
                    <span class="low-stock-category">${p.Categoria}</span>
                </div>
                <span class="low-stock-qty ${cls}">${qty}</span>
            </div>
        `;
    }).join('');
}

// ===== RENDER PRODUCTS TABLE =====
function renderProducts() {
    let products = [...allProducts];

    // Filtro por categoria
    const catFilter = elements.filterCategoria.value;
    if (catFilter) {
        products = products.filter(p => p.Categoria === catFilter);
    }

    // Ordenação
    const ordem = elements.filterOrdem.value;
    switch (ordem) {
        case 'nome':
            products.sort((a, b) => (a.Produto || '').localeCompare(b.Produto || ''));
            break;
        case 'nome-desc':
            products.sort((a, b) => (b.Produto || '').localeCompare(a.Produto || ''));
            break;
        case 'qtd-asc':
            products.sort((a, b) => parseInt(a.Quantidade) - parseInt(b.Quantidade));
            break;
        case 'qtd-desc':
            products.sort((a, b) => parseInt(b.Quantidade) - parseInt(a.Quantidade));
            break;
        case 'preco-asc':
            products.sort((a, b) => parseFloat(a.Preco) - parseFloat(b.Preco));
            break;
        case 'preco-desc':
            products.sort((a, b) => parseFloat(b.Preco) - parseFloat(a.Preco));
            break;
    }

    renderProductsTable(products);
}

function filterProducts(term) {
    const filtered = allProducts.filter(p =>
        Object.values(p).some(v =>
            v.toString().toLowerCase().includes(term)
        )
    );
    renderProductsTable(filtered);
}

function renderProductsTable(products) {
    const tbody = elements.produtosBody;

    if (products.length === 0) {
        tbody.innerHTML = '';
        elements.tableEmpty.style.display = 'block';
        return;
    }

    elements.tableEmpty.style.display = 'none';

    tbody.innerHTML = products.map(p => {
        const qty = parseInt(p.Quantidade) || 0;
        const price = parseFloat(p.Preco) || 0;
        const total = qty * price;

        let badgeClass = 'badge-success';
        if (qty <= 2) badgeClass = 'badge-danger';
        else if (qty <= 5) badgeClass = 'badge-warning';

        return `
            <tr>
                <td><strong>#${p.ID}</strong></td>
                <td>${p.Produto}</td>
                <td><span class="badge badge-info">${p.Categoria}</span></td>
                <td><span class="badge ${badgeClass}">${qty}</span></td>
                <td>${formatCurrency(price)}</td>
                <td><strong>${formatCurrency(total)}</strong></td>
                <td>${p.Fornecedor || '-'}</td>
                <td>${p.DataAtualizacao || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="btn-action btn-edit" onclick="editProduct(${p.ID})" title="Editar">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button class="btn-action btn-delete" onclick="confirmDelete(${p.ID}, '${(p.Produto || '').replace(/'/g, "\\'")}')" title="Excluir">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updateCategoriesFilter() {
    const categories = [...new Set(allProducts.map(p => p.Categoria).filter(Boolean))];
    const select = elements.filterCategoria;
    const current = select.value;

    select.innerHTML = '<option value="">Todas Categorias</option>' +
        categories.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');

    // Datalist do formulário
    const datalist = document.getElementById('categoriasList');
    datalist.innerHTML = categories.map(c => `<option value="${c}">`).join('');
}

// ===== FORM HANDLING =====
async function handleFormSubmit(e) {
    e.preventDefault();

    const params = {
        produto: document.getElementById('produto').value.trim(),
        categoria: document.getElementById('categoria').value.trim(),
        quantidade: document.getElementById('quantidade').value,
        preco: document.getElementById('preco').value,
        fornecedor: document.getElementById('fornecedor').value.trim()
    };

    if (!params.produto || !params.categoria || !params.quantidade || !params.preco) {
        showToast('Preencha todos os campos obrigatórios!', 'warning');
        return;
    }

    showLoading(true);

    try {
        let result;
        if (currentEditId) {
            params.action = 'update';
            params.id = currentEditId;
            result = await apiCall(params);
        } else {
            params.action = 'create';
            result = await apiCall(params);
        }

        if (result.status === 'success') {
            showToast(result.message, 'success');
            elements.produtoForm.reset();
            cancelEdit();
            await loadAllData();
        } else {
            showToast(result.message || 'Erro ao salvar', 'error');
        }
    } catch (error) {
        showToast('Erro ao salvar produto!', 'error');
    }

    showLoading(false);
}

function editProduct(id) {
    const product = allProducts.find(p => p.ID === id);
    if (!product) return;

    currentEditId = id;
    document.getElementById('produto').value = product.Produto || '';
    document.getElementById('categoria').value = product.Categoria || '';
    document.getElementById('quantidade').value = product.Quantidade || 0;
    document.getElementById('preco').value = product.Preco || 0;
    document.getElementById('fornecedor').value = product.Fornecedor || '';

    elements.formTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Produto #' + id;
    elements.btnSubmit.innerHTML = '<i class="fas fa-save"></i> Atualizar Produto';
    elements.btnCancel.style.display = 'flex';

    navigateTo('adicionar');
    elements.pageTitle.textContent = 'Editar Produto';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
    currentEditId = null;
    elements.produtoForm.reset();
    elements.formTitle.innerHTML = '<i class="fas fa-plus-circle"></i> Adicionar Produto';
    elements.btnSubmit.innerHTML = '<i class="fas fa-save"></i> Salvar Produto';
    elements.btnCancel.style.display = 'none';
    elements.pageTitle.textContent = 'Adicionar Produto';
}

// ===== DELETE =====
function confirmDelete(id, name) {
    elements.modalTitle.textContent = 'Excluir Produto';
    elements.modalMessage.textContent = `Tem certeza que deseja excluir "${name}"? Esta ação não pode ser desfeita.`;

    elements.modalConfirmBtn.onclick = () => deleteProduct(id);
    elements.modalOverlay.classList.add('show');
}

async function deleteProduct(id) {
    closeModal();
    showLoading(true);

    try {
        const result = await apiCall({ action: 'delete', id: id });
        if (result.status === 'success') {
            showToast(result.message, 'success');
            await loadAllData();
        } else {
            showToast(result.message || 'Erro ao excluir', 'error');
        }
    } catch (error) {
        showToast('Erro ao excluir produto!', 'error');
    }

    showLoading(false);
}

function closeModal() {
    elements.modalOverlay.classList.remove('show');
}

// ===== REPORTS =====
function renderReports() {
    renderReportCategories();
    renderReportTop10();
    renderReportCritical();
}

function renderReportCategories() {
    const container = document.getElementById('reportCategorias');
    const categorias = dashboardData.categorias || {};
    const entries = Object.entries(categorias);

    if (entries.length === 0) {
        container.innerHTML = '<div class="no-data">Sem dados</div>';
        return;
    }

    entries.sort((a, b) => b[1].valor - a[1].valor);

    container.innerHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Categoria</th>
                    <th>Qtd Itens</th>
                    <th>Valor Total</th>
                </tr>
            </thead>
            <tbody>
                ${entries.map(([nome, data]) => `
                    <tr>
                        <td><strong>${nome}</strong></td>
                        <td>${formatNumber(data.quantidade)}</td>
                        <td>${formatCurrency(data.valor)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderReportTop10() {
    const container = document.getElementById('reportTop10');
    const products = [...allProducts]
        .map(p => ({
            ...p,
            valorTotal: (parseInt(p.Quantidade) || 0) * (parseFloat(p.Preco) || 0)
        }))
        .sort((a, b) => b.valorTotal - a.valorTotal)
        .slice(0, 10);

    if (products.length === 0) {
        container.innerHTML = '<div class="no-data">Sem dados</div>';
        return;
    }

    container.innerHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Produto</th>
                    <th>Qtd</th>
                    <th>Valor Total</th>
                </tr>
            </thead>
            <tbody>
                ${products.map((p, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td><strong>${p.Produto}</strong></td>
                        <td>${p.Quantidade}</td>
                        <td>${formatCurrency(p.valorTotal)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderReportCritical() {
    const container = document.getElementById('reportCritico');
    const critical = allProducts
        .filter(p => parseInt(p.Quantidade) <= 5)
        .sort((a, b) => parseInt(a.Quantidade) - parseInt(b.Quantidade));

    if (critical.length === 0) {
        container.innerHTML = '<div class="no-data"><i class="fas fa-check-circle"></i>Nenhum produto com estoque crítico!</div>';
        return;
    }

    container.innerHTML = `
        <table class="report-table">
            <thead>
                <tr>
                    <th>Produto</th>
                    <th>Categoria</th>
                    <th>Qtd Atual</th>
                    <th>Fornecedor</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${critical.map(p => {
                    const qty = parseInt(p.Quantidade);
                    const status = qty <= 2 ? '<span class="badge badge-danger">Crítico</span>' : '<span class="badge badge-warning">Baixo</span>';
                    return `
                        <tr>
                            <td><strong>${p.Produto}</strong></td>
                            <td>${p.Categoria}</td>
                            <td>${qty}</td>
                            <td>${p.Fornecedor || '-'}</td>
                            <td>${status}</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
    `;
}

// ===== EXPORT CSV =====
function exportCSV() {
    if (allProducts.length === 0) {
        showToast('Nenhum dado para exportar!', 'warning');
        return;
    }

    const headers = ['ID', 'Produto', 'Categoria', 'Quantidade', 'Preco', 'Fornecedor', 'DataAtualizacao'];
    const rows = allProducts.map(p =>
        headers.map(h => `"${(p[h] || '').toString().replace(/"/g, '""')}"`)
    );

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `estoque_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    showToast('CSV exportado com sucesso!', 'success');
}

// ===== UTILITIES =====
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatNumber(value) {
    return new Intl.NumberFormat('pt-BR').format(value);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function showLoading(show) {
    elements.loadingOverlay.classList.toggle('show', show);
}

function showToast(message, type = 'info') {
    const icons = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-circle',
        info: 'fas fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="${icons[type]}"></i><span>${message}</span>`;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.4s ease forwards';
        setTimeout(() => toast.remove(), 400);
    }, 3500);
}
