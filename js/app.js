const API_URL = 'https://script.google.com/macros/s/AKfycbyuOOKSFh5s3lIDJlQ1oGQHGRL-rRbbC33k8AAtCVW4QQH9W8gjWA5MYqekxQXuKHo4/exec';

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
  if (r.status === 'success') cadastro = r.data;
  else toast(r.message, 'error');
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

// ====================================
// AUTOCOMPLETE - FUNÇÃO GENÉRICA
// ====================================
function criarAutocomplete(config) {
  const { inputId, hiddenId, sugestoesId, infoId, getLista, onSelect, msgVazio } = config;
  const input = $(inputId);
  const hidden = $(hiddenId);
  const boxSugestoes = $(sugestoesId);
  const info = $(infoId);
  let indiceAtivo = -1;
  let itensAtuais = [];
  
  function filtrar(termo) {
    const lista = getLista();
    if (!termo) return lista.slice(0, 20); // mostra 20 primeiros
    const t = termo.toLowerCase();
    return lista.filter(item =>
      item.nome.toLowerCase().includes(t) ||
      (item.ingredienteAtivo || '').toLowerCase().includes(t) ||
      (item.classe || '').toLowerCase().includes(t)
    ).slice(0, 20);
  }
  
  function renderSugestoes(itens) {
    itensAtuais = itens;
    indiceAtivo = -1;
    
    if (itens.length === 0) {
      boxSugestoes.innerHTML = `<div class="sugestoes-vazio">${msgVazio}</div>`;
      boxSugestoes.classList.remove('hidden');
      return;
    }
    
    boxSugestoes.innerHTML = itens.map((item, i) => `
      <div class="sugestao-item" data-index="${i}">
        ${item.qtdEstoque !== undefined ? `<span class="qtd-estoque">${item.qtdEstoque} ${item.unidade || ''}</span>` : ''}
        <strong>${item.nome}</strong>
        <small>${item.ingredienteAtivo || '—'} ${item.classe ? '• ' + item.classe : ''}</small>
      </div>
    `).join('');
    boxSugestoes.classList.remove('hidden');
    
    // click handlers
    boxSugestoes.querySelectorAll('.sugestao-item').forEach(el => {
      el.addEventListener('click', () => {
        selecionar(itens[parseInt(el.dataset.index)]);
      });
    });
  }
  
  function selecionar(item) {
    input.value = item.nome;
    hidden.value = item.nome;
    boxSugestoes.classList.add('hidden');
    info.textContent = `✓ ${item.ingredienteAtivo || ''} ${item.classe ? '• ' + item.classe : ''}`;
    if (onSelect) onSelect(item);
  }
  
  input.addEventListener('input', () => {
    hidden.value = ''; // limpa validação até selecionar
    info.textContent = '';
    renderSugestoes(filtrar(input.value));
  });
  
  input.addEventListener('focus', () => {
    renderSugestoes(filtrar(input.value));
  });
  
  input.addEventListener('blur', () => {
    // delay pra permitir clique na sugestão
    setTimeout(() => {
      boxSugestoes.classList.add('hidden');
      // valida se o texto bate com algum item
      const lista = getLista();
      const match = lista.find(i => i.nome.toLowerCase() === input.value.toLowerCase());
      if (match) {
        selecionar(match);
      } else if (input.value) {
        info.textContent = '⚠️ Produto não encontrado. Selecione da lista.';
        info.style.background = '#fdecea';
        info.style.borderLeftColor = '#c0392b';
        info.style.color = '#c0392b';
        hidden.value = '';
      }
    }, 200);
  });
  
  // Navegação com teclado
  input.addEventListener('keydown', (e) => {
    const items = boxSugestoes.querySelectorAll('.sugestao-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      indiceAtivo = Math.min(indiceAtivo + 1, items.length - 1);
      atualizarAtivo(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      indiceAtivo = Math.max(indiceAtivo - 1, 0);
      atualizarAtivo(items);
    } else if (e.key === 'Enter' && indiceAtivo >= 0) {
      e.preventDefault();
      selecionar(itensAtuais[indiceAtivo]);
    } else if (e.key === 'Escape') {
      boxSugestoes.classList.add('hidden');
    }
  });
  
  function atualizarAtivo(items) {
    items.forEach((it, i) => it.classList.toggle('active', i === indiceAtivo));
    if (items[indiceAtivo]) items[indiceAtivo].scrollIntoView({ block: 'nearest' });
  }
  
  // Reseta estilo do info quando digita
  input.addEventListener('input', () => {
    info.style.background = '';
    info.style.borderLeftColor = '';
    info.style.color = '';
  });
}

// ====== AUTOCOMPLETE ENTRADA (todos produtos do cadastro) ======
criarAutocomplete({
  inputId: 'entradaProduto',
  hiddenId: 'entradaProdutoValido',
  sugestoesId: 'entradaSugestoes',
  infoId: 'entradaInfoProduto',
  getLista: () => cadastro.map(p => ({
    nome: p.nome,
    ingredienteAtivo: p.ingredienteAtivo,
    classe: p.classe
  })),
  msgVazio: 'Nenhum produto encontrado no cadastro'
});

// ====== AUTOCOMPLETE SAÍDA (apenas produtos com estoque > 0) ======
criarAutocomplete({
  inputId: 'saidaProduto',
  hiddenId: 'saidaProdutoValido',
  sugestoesId: 'saidaSugestoes',
  infoId: 'saidaInfoProduto',
  getLista: () => estoque
    .filter(e => e.quantidade > 0)
    .map(e => ({
      nome: e.produto,
      ingredienteAtivo: e.ingredienteAtivo,
      classe: e.classe,
      qtdEstoque: e.quantidade,
      unidade: e.unidade
    })),
  msgVazio: 'Nenhum produto com estoque disponível',
  onSelect: (item) => {
    $('saidaDisponivel').value = `${item.qtdEstoque} ${item.unidade || ''}`;
    if (item.unidade) $('saidaUnidade').value = item.unidade;
  }
});

// ====== FORM ENTRADA ======
$('formEntrada').addEventListener('submit', async (e) => {
  e.preventDefault();
  const produto = $('entradaProdutoValido').value || $('entradaProduto').value;
  
  // valida se bate com cadastro
  const valido = cadastro.find(p => p.nome.toLowerCase() === produto.toLowerCase());
  if (!valido) {
    toast('Selecione um produto válido da lista', 'error');
    return;
  }
  
  const dados = {
    produto: valido.nome,
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
    $('entradaProdutoValido').value = '';
    $('entradaInfoProduto').textContent = '';
    await carregarEstoque();
    await carregarHistorico();
  } else toast(r.message, 'error');
});

// ====== FORM SAÍDA ======
$('formSaida').addEventListener('submit', async (e) => {
  e.preventDefault();
  const produto = $('saidaProdutoValido').value || $('saidaProduto').value;
  
  const itemEstoque = estoque.find(i => i.produto.toLowerCase() === produto.toLowerCase());
  if (!itemEstoque || itemEstoque.quantidade <= 0) {
    toast('Selecione um produto disponível em estoque', 'error');
    return;
  }
  
  const qtd = parseFloat($('saidaQtd').value);
  if (qtd > itemEstoque.quantidade) {
    toast(`Quantidade maior que disponível (${itemEstoque.quantidade})`, 'error');
    return;
  }
  
  const dados = {
    produto: itemEstoque.produto,
    quantidade: qtd,
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
    $('saidaProdutoValido').value = '';
    $('saidaDisponivel').value = '';
    $('saidaInfoProduto').textContent = '';
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
