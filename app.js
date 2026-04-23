const API_URL = 'https://script.google.com/macros/s/AKfycbyuOOKSFh5s3lIDJlQ1oGQHGRL-rRbbC33k8AAtCVW4QQH9W8gjWA5MYqekxQXuKHo4/exec';

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================
let cadastro = [];
let estoque = [];
let historico = [];

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Iniciando sistema...');
  
  // Setup das abas
  setupTabs();
  
  // Carrega dados
  await carregarTodosDados();
  
  // Setup dos formulários
  setupAutocompleteEntrada();
  setupAutocompleteSaida();
  setupFormEntrada();
  setupFormSaida();
  setupFiltros();
  
  console.log('✅ Sistema pronto!');
});

// ============================================
// CARREGAMENTO DE DADOS
// ============================================
async function carregarTodosDados() {
  await Promise.all([
    carregarCadastro(),
    carregarEstoque(),
    carregarHistorico()
  ]);
}

async function carregarCadastro() {
  try {
    const res = await fetch(`${API_URL}?action=getCadastro`);
    const json = await res.json();
    cadastro = json.data || [];
    console.log(`✅ Cadastro: ${cadastro.length} produtos`);
    if (cadastro.length > 0) console.log('Exemplo:', cadastro[0]);
  } catch (e) {
    console.error('❌ Erro cadastro:', e);
    mostrarMensagem('Erro ao carregar cadastro', 'erro');
  }
}

async function carregarEstoque() {
  try {
    const res = await fetch(`${API_URL}?action=getEstoque`);
    const json = await res.json();
    estoque = json.data || [];
    console.log(`✅ Estoque: ${estoque.length} itens`);
    renderizarEstoque();
  } catch (e) {
    console.error('❌ Erro estoque:', e);
  }
}

async function obterHistorico() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const aba = ss.getSheetByName('Movimentacoes');
    
    if (!aba || aba.getLastRow() < 2) return [];
    
    const dados = aba.getRange(2, 1, aba.getLastRow() - 1, 12).getValues();
    
    return dados.map(linha => ({
      id: linha[0],
      data: linha[1],
      tipo: linha[2],
      produto: linha[3],
      ingrediente: linha[4],
      classe: linha[5],
      quantidade: linha[6],
      unidade: linha[7],
      origem: linha[8],
      destino: linha[9],
      responsavel: linha[10],
      observacao: linha[11]
    })).reverse();
    
  } catch (erro) {
    return [];
  }
}

// ============================================
// SISTEMA DE ABAS
// ============================================
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(target)?.classList.add('active');
    });
  });
}

// ============================================
// RENDERIZAÇÃO DO ESTOQUE
// ============================================
function renderizarEstoque(filtro = '') {
  const tbody = document.getElementById('tabela-estoque');
  if (!tbody) return;
  
  const termo = filtro.toLowerCase();
  const filtrados = estoque.filter(p =>
    !termo ||
    (p.produto || '').toLowerCase().includes(termo) ||
    (p.ingredienteAtivo || '').toLowerCase().includes(termo) ||
    (p.classe || '').toLowerCase().includes(termo)
  );
  
  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px">Nenhum produto encontrado</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtrados.map(p => {
    const baixo = Number(p.quantidade) <= 5;
    return `
      <tr class="${baixo ? 'estoque-baixo' : ''}">
        <td>${p.produto || '-'}</td>
        <td>${p.ingredienteAtivo || '-'}</td>
        <td>${p.classe || '-'}</td>
        <td><strong>${p.quantidade || 0}</strong> ${p.unidade || ''}
          ${baixo ? '<span class="badge-alerta">⚠️ Baixo</span>' : ''}
        </td>
      </tr>
    `;
  }).join('');
}

// ============================================
// RENDERIZAÇÃO DO HISTÓRICO
// ============================================
function renderizarHistorico(filtro = '') {
  const tbody = document.getElementById('tabela-historico');
  if (!tbody) return;
  
  const termo = filtro.toLowerCase();
  const filtrados = historico.filter(h =>
    !termo ||
    (h.produto || '').toLowerCase().includes(termo) ||
    (h.tipo || '').toLowerCase().includes(termo) ||
    (h.responsavel || '').toLowerCase().includes(termo)
  );
  
  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px">Sem movimentações</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtrados.map(h => `
    <tr>
      <td>${h.id || '-'}</td>
      <td>${formatarData(h.data)}</td>
      <td><span class="badge-${(h.tipo || '').toLowerCase()}">${h.tipo || '-'}</span></td>
      <td>${h.produto || '-'}</td>
      <td>${h.quantidade || 0} ${h.unidade || ''}</td>
      <td>${h.origem || '-'}</td>
      <td>${h.destino || '-'}</td>
      <td>${h.responsavel || '-'}</td>
      <td>${h.observacao || '-'}</td>
    </tr>
  `).join('');
}

function formatarData(data) {
  if (!data) return '-';
  try {
    const d = new Date(data);
    return d.toLocaleString('pt-BR');
  } catch {
    return data;
  }
}

// ============================================
// AUTOCOMPLETE - ENTRADA
// ============================================
function setupAutocompleteEntrada() {
  const input = document.getElementById('entrada-produto');
  const suggestions = document.getElementById('entrada-sugestoes');
  const info = document.getElementById('entrada-info');
  
  if (!input || !suggestions) {
    console.warn('⚠️ Elementos entrada não encontrados');
    return;
  }
  
  let selectedIndex = -1;
  
  input.addEventListener('input', () => {
    const termo = input.value.trim().toLowerCase();
    suggestions.innerHTML = '';
    if (info) info.innerHTML = '';
    selectedIndex = -1;
    
    if (termo.length < 1) {
      suggestions.style.display = 'none';
      return;
    }
    
    const filtrados = cadastro.filter(p =>
      (p.nome || '').toLowerCase().includes(termo) ||
      (p.ingredienteAtivo || '').toLowerCase().includes(termo) ||
      (p.classe || '').toLowerCase().includes(termo)
    ).slice(0, 10);
    
    if (filtrados.length === 0) {
      suggestions.innerHTML = '<div class="sugestao-item" style="color:#999">Nenhum produto encontrado no cadastro</div>';
      suggestions.style.display = 'block';
      return;
    }
    
    filtrados.forEach(p => {
      const div = document.createElement('div');
      div.className = 'sugestao-item';
      div.innerHTML = `
        <strong>${p.nome}</strong>
        <small style="display:block;color:#666">${p.ingredienteAtivo || '-'} | ${p.classe || '-'}</small>
      `;
      div.addEventListener('click', () => selecionarEntrada(p));
      suggestions.appendChild(div);
    });
    suggestions.style.display = 'block';
  });
  
  input.addEventListener('keydown', (e) => {
    const items = suggestions.querySelectorAll('.sugestao-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateHighlight(items, selectedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateHighlight(items, selectedIndex);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      items[selectedIndex].click();
    } else if (e.key === 'Escape') {
      suggestions.style.display = 'none';
    }
  });
  
  function selecionarEntrada(p) {
    input.value = p.nome;
    input.dataset.ingrediente = p.ingredienteAtivo || '';
    input.dataset.classe = p.classe || '';
    suggestions.style.display = 'none';
    if (info) {
      info.innerHTML = `
        <div class="info-box">
          ✅ <strong>${p.nome}</strong><br>
          <small>Ingrediente: ${p.ingredienteAtivo || '-'} | Classe: ${p.classe || '-'}</small>
        </div>
      `;
    }
  }
  
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestions.contains(e.target)) {
      suggestions.style.display = 'none';
    }
  });
}

// ============================================
// AUTOCOMPLETE - SAÍDA
// ============================================
function setupAutocompleteSaida() {
  const input = document.getElementById('saida-produto');
  const suggestions = document.getElementById('saida-sugestoes');
  const info = document.getElementById('saida-info');
  
  if (!input || !suggestions) {
    console.warn('⚠️ Elementos saída não encontrados');
    return;
  }
  
  let selectedIndex = -1;
  
  input.addEventListener('input', () => {
    const termo = input.value.trim().toLowerCase();
    suggestions.innerHTML = '';
    if (info) info.innerHTML = '';
    selectedIndex = -1;
    
    if (termo.length < 1) {
      suggestions.style.display = 'none';
      return;
    }
    
    const filtrados = estoque.filter(p =>
      Number(p.quantidade) > 0 && (
        (p.produto || '').toLowerCase().includes(termo) ||
        (p.ingredienteAtivo || '').toLowerCase().includes(termo) ||
        (p.classe || '').toLowerCase().includes(termo)
      )
    ).slice(0, 10);
    
    if (filtrados.length === 0) {
      suggestions.innerHTML = '<div class="sugestao-item" style="color:#999">Nenhum produto disponível em estoque</div>';
      suggestions.style.display = 'block';
      return;
    }
    
    filtrados.forEach(p => {
      const div = document.createElement('div');
      div.className = 'sugestao-item';
      div.innerHTML = `
        <strong>${p.produto}</strong>
        <span class="badge-qtd">${p.quantidade} ${p.unidade || ''}</span>
        <small style="display:block;color:#666">${p.ingredienteAtivo || '-'} | ${p.classe || '-'}</small>
      `;
      div.addEventListener('click', () => selecionarSaida(p));
      suggestions.appendChild(div);
    });
    suggestions.style.display = 'block';
  });
  
  input.addEventListener('keydown', (e) => {
    const items = suggestions.querySelectorAll('.sugestao-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      updateHighlight(items, selectedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      updateHighlight(items, selectedIndex);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      items[selectedIndex].click();
    } else if (e.key === 'Escape') {
      suggestions.style.display = 'none';
    }
  });
  
  function selecionarSaida(p) {
    input.value = p.produto;
    input.dataset.estoque = p.quantidade;
    input.dataset.unidade = p.unidade || '';
    suggestions.style.display = 'none';
    if (info) {
      info.innerHTML = `
        <div class="info-box">
          ✅ <strong>${p.produto}</strong> - Disponível: <strong>${p.quantidade} ${p.unidade || ''}</strong><br>
          <small>Ingrediente: ${p.ingredienteAtivo || '-'} | Classe: ${p.classe || '-'}</small>
        </div>
      `;
    }
    const unidadeInput = document.getElementById('saida-unidade');
    if (unidadeInput) unidadeInput.value = p.unidade || '';
  }
  
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !suggestions.contains(e.target)) {
      suggestions.style.display = 'none';
    }
  });
}

function updateHighlight(items, index) {
  items.forEach((item, i) => item.classList.toggle('selected', i === index));
}

// ============================================
// FORMULÁRIO DE ENTRADA
// ============================================
function setupFormEntrada() {
  const form = document.getElementById('form-entrada');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const produtoInput = document.getElementById('entrada-produto');
    const nomeProduto = produtoInput.value.trim();
    
    // Validação: produto deve existir no cadastro
    const produtoValido = cadastro.find(p => (p.nome || '').toLowerCase() === nomeProduto.toLowerCase());
    if (!produtoValido) {
      mostrarMensagem('❌ Produto não existe no cadastro! Selecione da lista.', 'erro');
      return;
    }
    
    const dados = {
      action: 'registrarEntrada',
      produto: produtoValido.nome,
      ingredienteAtivo: produtoValido.ingredienteAtivo,
      classe: produtoValido.classe,
      quantidade: document.getElementById('entrada-quantidade').value,
      unidade: document.getElementById('entrada-unidade').value,
      origem: document.getElementById('entrada-origem').value,
      responsavel: document.getElementById('entrada-responsavel').value,
      observacao: document.getElementById('entrada-observacao')?.value || ''
    };
    
    try {
      mostrarMensagem('⏳ Registrando entrada...', 'info');
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(dados)
      });
      const json = await res.json();
      
      if (json.success) {
        mostrarMensagem('✅ Entrada registrada com sucesso!', 'sucesso');
        form.reset();
        document.getElementById('entrada-info').innerHTML = '';
        await carregarEstoque();
        await carregarHistorico();
      } else {
        mostrarMensagem('❌ Erro: ' + (json.error || 'desconhecido'), 'erro');
      }
    } catch (e) {
      console.error(e);
      mostrarMensagem('❌ Erro ao registrar entrada', 'erro');
    }
  });
}

// ============================================
// FORMULÁRIO DE SAÍDA
// ============================================
function setupFormSaida() {
  const form = document.getElementById('form-saida');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const produtoInput = document.getElementById('saida-produto');
    const nomeProduto = produtoInput.value.trim();
    const quantidade = Number(document.getElementById('saida-quantidade').value);
    
    // Validação: produto deve existir no estoque
    const produtoEstoque = estoque.find(p => (p.produto || '').toLowerCase() === nomeProduto.toLowerCase());
    if (!produtoEstoque) {
      mostrarMensagem('❌ Produto não existe no estoque!', 'erro');
      return;
    }
    
    // Validação: quantidade não pode exceder o estoque
    if (quantidade > Number(produtoEstoque.quantidade)) {
      mostrarMensagem(`❌ Quantidade excede o estoque! Disponível: ${produtoEstoque.quantidade} ${produtoEstoque.unidade}`, 'erro');
      return;
    }
    
    const dados = {
      action: 'registrarSaida',
      produto: produtoEstoque.produto,
      ingredienteAtivo: produtoEstoque.ingredienteAtivo,
      classe: produtoEstoque.classe,
      quantidade: quantidade,
      unidade: produtoEstoque.unidade,
      destino: document.getElementById('saida-destino').value,
      responsavel: document.getElementById('saida-responsavel').value,
      observacao: document.getElementById('saida-observacao')?.value || ''
    };
    
    try {
      mostrarMensagem('⏳ Registrando saída...', 'info');
      const res = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify(dados)
      });
      const json = await res.json();
      
      if (json.success) {
        mostrarMensagem('✅ Saída registrada com sucesso!', 'sucesso');
        form.reset();
        document.getElementById('saida-info').innerHTML = '';
        await carregarEstoque();
        await carregarHistorico();
      } else {
        mostrarMensagem('❌ Erro: ' + (json.error || 'desconhecido'), 'erro');
      }
    } catch (e) {
      console.error(e);
      mostrarMensagem('❌ Erro ao registrar saída', 'erro');
    }
  });
}

// ============================================
// FILTROS
// ============================================
function setupFiltros() {
  const filtroEstoque = document.getElementById('filtro-estoque');
  if (filtroEstoque) {
    filtroEstoque.addEventListener('input', (e) => renderizarEstoque(e.target.value));
  }
  
  const filtroHistorico = document.getElementById('filtro-historico');
  if (filtroHistorico) {
    filtroHistorico.addEventListener('input', (e) => renderizarHistorico(e.target.value));
  }
}

// ============================================
// MENSAGENS
// ============================================
function mostrarMensagem(texto, tipo = 'info') {
  let msg = document.getElementById('mensagem-global');
  if (!msg) {
    msg = document.createElement('div');
    msg.id = 'mensagem-global';
    document.body.appendChild(msg);
  }
  msg.className = `mensagem mensagem-${tipo}`;
  msg.textContent = texto;
  msg.style.display = 'block';
  
  setTimeout(() => {
    msg.style.display = 'none';
  }, 4000);
}
