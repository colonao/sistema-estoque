const API_URL = 'COLOQUE_SUA_URL_DO_APPS_SCRIPT_AQUI';

let cadastro = [];
let estoque = [];
let historico = [];

// ====== UTIL ======
const $ = id => document.getElementById(id);
const showLoading = () => $('loading').classList.remove('hidden');
const hideLoading = () => $('loading').classList.add('hidden');

function toast(msg, type = 'success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast show ${type}`;
  setTimeout(() => t.className = 'toast', 3500);
}

async function api(action, params = {}) {
  showLoading();
  try {
    const url = new URL(API_URL);
    url.searchParams.append('action', action);
    Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    return { status: 'error', message: e.message };
  } finally {
    hideLoading();
  }
}

// ====== TABS ======
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    $(btn.dataset.tab).classList.add('active');
  });
});

// ====== CARREGAR DADOS ======
async function carregarCadastro() {
  const r = await api('getCadastro');
  if (r.status === 'success') {
    cadastro = r.data;
    preencherSelectsProdutos();
  } else toast(r.message, 'error');
}

async function carregarEstoque() {
  const r = await api('getEstoque');
  if (r.status === 'success') {
    estoque = r.data;
    renderEstoque();
  } else toast(r.message, 'error');
}

async function carregarHistorico() {
  const r = await api('getHistorico');
  if (r.status === 'success') {
    historico = r.data;
    renderHistorico();
  } else toast(r.message, 'error');
}

// ====== RENDER ESTOQUE ======
function renderEstoque() {
  const filtro = $('filtroEstoque').value.toLowerCase();
  const tbody = $('tbodyEstoque');
  const filtrado = estoque.filter(e =>
    e.produto.toLowerCase().includes(filtro) ||
    (e.ingredienteAtivo || '').toLowerCase().includes(filtro) ||
    (e.classe || '').toLowerCase().includes(filtro)
  );
  
  if (filtrado.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;">Nenhum item em estoque</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtrado.map(e => `
    <tr>
      <td><strong>${e.produto}</strong></td>
      <td>${e.ingredienteAtivo || '-'}</td>
      <td>${e.classe || '-'}</td>
      <td class="${e.quantidade <= 5 ? 'low-stock' : ''}">${e.quantidade}</td>
      <td>${e.unidade || '-'}</td>
    </tr>
  `).join('');
}

$('filtroEstoque').addEventListener('input', renderEstoque);

// ====== RENDER HISTÓRICO ======
function renderHistorico() {
  const filtroTxt = $('filtroHistorico').value.toLowerCase();
  const filtroTipo = $('filtroTipo').value;
  const tbody = $('tbodyHistorico');
  
  const filtrado = historico.filter(h => {
    const matchTipo = !filtroTipo || h.tipo === filtroTipo;
    const matchTxt = !filtroTxt ||
      h.produto.toLowerCase().includes(filtroTxt) ||
      (h.origem || '').toLowerCase().includes(filtroTxt) ||
      (h.destino || '').toLowerCase().includes(filtroTxt) ||
      (h.responsavel || '').toLowerCase().includes(filtroTxt);
    return matchTipo && matchTxt;
  });
  
  if (filtrado.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;">Nenhuma movimentação</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtrado.map(h => `
    <tr>
      <td>${h.data}</td>
      <td><span class="badge badge-${h.tipo.toLowerCase()}">${h.tipo}</span></td>
      <td><strong>${h.produto}</strong></td>
      <td>${h.quantidade}</td>
      <td>${h.unidade}</td>
      <td>${h.origem || '-'}</td>
      <td>${h.destino || '-'}</td>
      <td>${h.responsavel || '-'}</td>
      <td>${h.observacao || '-'}</td>
    </tr>
  `).join('');
}

$('filtroHistorico').addEventListener('input', renderHistorico);
$('filtroTipo').addEventListener('change', renderHistorico);

// ====== SELECTS DE PRODUTOS ======
function preencherSelectsProdutos() {
  const opcoes = '<option value="">Selecione...</option>' +
    cadastro.map(p => `<option value="${p.nome}">${p.nome} ${p.classe ? '(' + p.classe + ')' : ''}</option>`).join('');
  $('entradaProduto').innerHTML = opcoes;
  $('saidaProduto').innerHTML = opcoes;
}

// Mostra quantidade disponível na tela de saída
$('saidaProduto').addEventListener('change', (e) => {
  const prod = e.target.value;
  const item = estoque.find(i => i.produto === prod);
  $('saidaDisponivel').value = item ? `${item.quantidade} ${item.unidade}` : '0';
  if (item && item.unidade) $('saidaUnidade').value = item.unidade;
});

// ====== FORM ENTRADA ======
$('formEntrada').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dados = {
    produto: $('entradaProduto').value,
    quantidade: $('entradaQtd').value,
    unidade: $('entradaUnidade').value,
    origem: $('entradaOrigem').value,
    destino: $('entradaDestino').value,
    responsavel: $('entradaResponsavel').value,
    observacao: $('entradaObs').value
  };
  
  const r = await api('entrada', dados);
  if (r.status === 'success') {
    toast('✅ Entrada registrada!');
    $('formEntrada').reset();
    await carregarEstoque();
    await carregarHistorico();
  } else toast(r.message, 'error');
});

// ====== FORM SAÍDA ======
$('formSaida').addEventListener('submit', async (e) => {
  e.preventDefault();
  const dados = {
    produto: $('saidaProduto').value,
    quantidade: $('saidaQtd').value,
    unidade: $('saidaUnidade').value,
    origem: $('saidaOrigem').value,
    destino: $('saidaDestino').value,
    responsavel: $('saidaResponsavel').value,
    observacao: $('saidaObs').value
  };
  
  const r = await api('saida', dados);
  if (r.status === 'success') {
    toast('✅ Saída registrada!');
    $('formSaida').reset();
    $('saidaDisponivel').value = '';
    await carregarEstoque();
    await carregarHistorico();
  } else toast(r.message, 'error');
});

// ====== INIT ======
(async () => {
  await carregarCadastro();
  await carregarEstoque();
  await carregarHistorico();
})();
