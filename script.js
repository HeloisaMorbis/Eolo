/* =====================================================
   JAVASCRIPT DO ÉOLO
   Aqui ficam as ações do site: login, menu, páginas e botões.
   ===================================================== */

/* Dados de exemplo usados enquanto o site não está ligado ao banco de dados. */
let tipoUsuario = 'paciente';
let quantidadeBombinhas = 1;
const nomesUsuarios = { paciente: 'Ana', cuidador: 'Marcos' };

const informacoesPaginas = {
  home:          { title: 'Olá, {nome}!', sub: 'Cuide da sua respiração todos os dias.' },
};

/* ==================== TROCAR DE PÁGINA ==================== */
function mostrarPagina(nomePagina){
  document.querySelectorAll('.pagina').forEach(p => p.classList.remove('active'));
  document.getElementById('pagina-' + (nomePagina === 'home' ? 'inicio' : nomePagina)).classList.add('active');

  document.querySelectorAll('.link-menu').forEach(b => b.classList.toggle('active', b.dataset.target === nomePagina));

  const informacao = informacoesPaginas[nomePagina];
  if (informacao){
    document.getElementById('titulo-cabecalho').textContent = informacao.title.replace('{nome}', nomesUsuarios[tipoUsuario]);
    document.getElementById('subtitulo-cabecalho').textContent = nomePagina === 'home' && tipoUsuario === 'cuidador'
      ? 'Acompanhando o uso da bombinha de ' + nomesUsuarios.paciente + '.'
      : informacao.sub;
  }

  document.querySelector('.conteudo-principal').scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  window.scrollTo(0, 0);
  fecharMenu();
}

/* ==================== APRESENTAÇÃO E LOGIN ==================== */
function mostrarLogin(){
  document.getElementById('pagina-apresentacao').classList.add('escondida');
  document.getElementById('tela-login').classList.add('ativa');
}


document.querySelectorAll('.escolha-tipo button').forEach(botao => {
  botao.addEventListener('click', () => {
    document.querySelectorAll('.escolha-tipo button').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected','false'); });
    botao.classList.add('active'); botao.setAttribute('aria-selected','true');
    tipoUsuario = botao.dataset.role;
  });
});

function mostrarSenha(){
  const campoSenha = document.getElementById('senha-login');
  campoSenha.type = campoSenha.type === 'password' ? 'text' : 'password';
}

function entrarNoSite(){
  document.getElementById('tela-login').classList.remove('ativa');
  document.getElementById('site').hidden = false;

  document.body.classList.toggle('modo-cuidador', tipoUsuario === 'cuidador');

  const dateEl = document.getElementById('data-registro');
  if (dateEl){
    dateEl.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  }

  mostrarPagina('home');
}

function sairDoSite(){
  document.body.classList.remove('modo-cuidador');
  document.getElementById('site').hidden = true;
  document.getElementById('tela-login').classList.remove('ativa');
  document.getElementById('pagina-apresentacao').classList.remove('escondida');
}

/* ---------------- menu-lateral mobile ---------------- */
function abrirMenu(){
  document.getElementById('menu-lateral').classList.add('open');
  document.getElementById('fundo-menu').classList.add('show');
}
function fecharMenu(){
  document.getElementById('menu-lateral').classList.remove('open');
  document.getElementById('fundo-menu').classList.remove('show');
}

/* ==================== CRISE DE ASMA ==================== */
function abrirPasso(el){ el.classList.toggle('open'); }
function abrirEmergencia(){ document.getElementById('modal-emergencia').classList.add('show'); }
function fecharEmergencia(){ document.getElementById('modal-emergencia').classList.remove('show'); }

/* ==================== DICAS ==================== */
const conteudoDicas = {
  entenda: {
    title: 'Entenda sua asma',
    text: 'A asma é uma doença inflamatória crônica das vias aéreas que causa estreitamento dos brônquios, dificultando a passagem do ar.',
    tags: ['Tosse', 'Falta de ar', 'Chiado', 'Aperto no peito'],
    tip: 'Cada pessoa pode ter sintomas diferentes e em intensidades variadas. Por isso, é importante conhecer o seu corpo e os fatores que podem desencadear crises.'
  },
  inalador: {
    title: 'Como usar o inalador',
    text: 'Agite a bombinha, expire todo o ar dos pulmões, encaixe o bocal nos lábios e pressione enquanto inspira lenta e profundamente.',
    tags: ['Agitar', 'Expirar', 'Inspirar devagar', 'Prender o ar 10s'],
    tip: 'Usar um espaçador (aerocâmara) melhora muito o aproveitamento da medicação, principalmente em crianças.'
  },
  gatilhos: {
    title: 'Evite gatilhos',
    text: 'Poeira, fumaça, mofo, pelos de animais e mudanças bruscas de temperatura são gatilhos comuns de crise.',
    tags: ['Poeira', 'Fumaça', 'Mofo', 'Pelos de animais'],
    tip: 'Manter o ambiente limpo e arejado reduz bastante a exposição aos gatilhos mais comuns.'
  },
  atividade: {
    title: 'Atividade física',
    text: 'Pessoas com asma podem e devem se exercitar. O importante é manter a asma controlada e, se necessário, usar a bombinha de alívio antes do esforço.',
    tags: ['Aquecimento', 'Bombinha antes do esforço', 'Hidratação'],
    tip: 'Converse com seu médico sobre usar a medicação de alívio 15 minutos antes de atividades físicas mais intensas.'
  },
  faq: {
    title: 'Perguntas frequentes',
    text: 'Reunimos as dúvidas mais comuns sobre asma e sobre o uso do aplicativo.',
    tags: ['Tratamento', 'Registro diário', 'Cuidador'],
    tip: 'Veja a página "Perguntas Frequentes" no menu para respostas detalhadas.'
  }
};

document.querySelectorAll('.item-dica').forEach(itemDica => {
  itemDica.addEventListener('click', () => {
    document.querySelectorAll('.item-dica').forEach(i => i.classList.remove('active'));
    itemDica.classList.add('active');

    const dadosDica = conteudoDicas[itemDica.dataset.topic];
    const detalhe = document.getElementById('detalhe-dicas');
    detalhe.innerHTML = `
      <h3>${dadosDica.title}</h3>
      <p>${dadosDica.text}</p>
      <p class="titulo-secao">Principais pontos</p>
      <div class="etiquetas-sintomas">${dadosDica.tags.map(aviso => `<span class="etiqueta">${aviso}</span>`).join('')}</div>
      <div class="aviso-informacao">${dadosDica.tip}</div>
    `;
  });
});

/* ==================== MEDICAMENTOS ==================== */
function trocarAbaRemedios(botao){
  document.querySelectorAll('.botao-aba').forEach(b => b.classList.remove('active'));
  botao.classList.add('active');
  document.getElementById('lista-diarios').style.display = botao.dataset.tab === 'diarios' ? 'flex' : 'none';
  document.getElementById('lista-alivio').style.display = botao.dataset.tab === 'alivio' ? 'flex' : 'none';
}

/* ==================== ADICIONAR MEDICAMENTO ==================== */
/*
   Os medicamentos novos ficam no localStorage do navegador.
   Isso NÃO usa banco de dados: os dados ficam somente neste navegador.
*/
function pegarMedicamentos(){
  return JSON.parse(localStorage.getItem('medicamentosEolo') || '[]');
}

function salvarListaMedicamentos(lista){
  localStorage.setItem('medicamentosEolo', JSON.stringify(lista));
}

function abrirFormularioMedicamento(){
  document.getElementById('modal-medicamento').classList.add('aberto');
  document.getElementById('nome-medicamento').focus();
}

function fecharFormularioMedicamento(){
  document.getElementById('modal-medicamento').classList.remove('aberto');
  document.getElementById('nome-medicamento').value = '';
  document.getElementById('dose-medicamento').value = '';
  document.getElementById('horario-medicamento').value = '';
  document.getElementById('frequencia-medicamento').value = '';
  document.getElementById('tipo-medicamento').value = 'controle';
}

function salvarMedicamento(){
  const nome = document.getElementById('nome-medicamento').value.trim();
  const tipo = document.getElementById('tipo-medicamento').value;
  const dose = document.getElementById('dose-medicamento').value.trim();
  const horario = document.getElementById('horario-medicamento').value;
  const frequencia = document.getElementById('frequencia-medicamento').value.trim();

  if (!nome){
    mostrarAviso('Digite o nome do medicamento');
    return;
  }

  if (tipo === 'controle' && !frequencia){
    mostrarAviso('Informe a frequência do medicamento');
    return;
  }

  const novoMedicamento = {
    id: Date.now(),
    nome: nome,
    tipo: tipo,
    dose: dose || 'Dose não informada',
    horario: horario || 'Horário não informado',
    frequencia: frequencia || 'Uso quando necessário'
  };

  const lista = pegarMedicamentos();
  lista.push(novoMedicamento);
  salvarListaMedicamentos(lista);

  fecharFormularioMedicamento();
  mostrarMedicamentosNovos();
  mostrarAviso('Medicamento adicionado com sucesso!');
}

function mostrarMedicamentosNovos(){
  const lista = document.getElementById('lista-novos-medicamentos');
  if (!lista) return;

  const medicamentos = pegarMedicamentos();
  lista.innerHTML = '';

  const mensagemVazia = document.getElementById('sem-medicamentos');
  if (mensagemVazia) {
    mensagemVazia.style.display = medicamentos.length === 0 ? 'block' : 'none';
  }

  medicamentos.forEach(medicamento => {
    const cartao = document.createElement('div');
    cartao.className = 'cartao-remedio';

    const textoTipo = medicamento.tipo === 'controle' ? 'Controle diário' : 'Resgate / alívio';
    const classeIcone = medicamento.tipo === 'controle' ? '' : ' icone-alivio';
    const classeStatus = medicamento.tipo === 'controle' ? 'status-verde' : 'status-azul';

    cartao.innerHTML = `
      <div class="icone-remedio${classeIcone}"></div>
      <div class="principal-remedio">
        <b>${escaparTexto(medicamento.nome)}</b>
        <span>${escaparTexto(medicamento.dose)} · ${escaparTexto(medicamento.frequencia)}</span>
        <span class="horario-remedio">Horário: ${escaparTexto(medicamento.horario)}</span>
      </div>
      <div class="lado-remedio">
        <span class="etiqueta-status ${classeStatus}">${textoTipo}</span>
        <button class="botao-excluir-remedio" onclick="excluirMedicamento(${medicamento.id})">Excluir</button>
      </div>
    `;

    lista.appendChild(cartao);
  });
}

function excluirMedicamento(id){
  const lista = pegarMedicamentos().filter(medicamento => medicamento.id !== id);
  salvarListaMedicamentos(lista);
  mostrarMedicamentosNovos();
  mostrarAviso('Medicamento excluído');
}

function mostrarTodosMedicamentos(){
  mostrarMedicamentosNovos();
  mostrarAviso('Seus medicamentos estão na lista acima');
}

/* Evita que um texto digitado pelo usuário seja interpretado como HTML. */
function escaparTexto(texto){
  return texto.replace(/[&<>'"]/g, function(caractere){
    const simbolos = {'&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'};
    return simbolos[caractere];
  });
}

/* Mostra os medicamentos salvos quando a página é aberta. */
document.addEventListener('DOMContentLoaded', function(){
  mostrarMedicamentosNovos();
  mostrarRelatorios();
});

/* ==================== REGISTRO DIÁRIO ==================== */
function escolherHumor(botao){
  botao.parentElement.querySelectorAll('.botao-humor').forEach(b => b.classList.remove('sel'));
  botao.classList.add('sel');
}
function marcarOpcao(opcao){ opcao.classList.toggle('sel'); }
function marcarUmaOpcao(opcao){
  opcao.parentElement.querySelectorAll('.opcao').forEach(c => c.classList.remove('sel'));
  opcao.classList.add('sel');
}
function mudarContador(delta){
  quantidadeBombinhas = Math.max(0, quantidadeBombinhas + delta);
  document.getElementById('valor-contador').textContent = quantidadeBombinhas;
}
function salvarRegistro(){
  const humorSelecionado = document.querySelector('.botao-humor.sel');
  const sintomasSelecionados = Array.from(document.querySelectorAll('.grupo-opcoes .opcao.sel'))
    .map(opcao => opcao.textContent.trim());

  const usouAlivioBotao = Array.from(document.querySelectorAll('.grupo-opcoes .opcao.sel'))
    .find(opcao => opcao.textContent.trim() === 'Sim' || opcao.textContent.trim() === 'Não');

  const gatilhosSelecionados = Array.from(document.querySelectorAll('#lista-gatilhos input:checked'))
    .map(caixa => caixa.parentElement.textContent.trim());

  const observacao = document.getElementById('observacoes-registro').value.trim();

  if (!humorSelecionado){
    mostrarAviso('Escolha como está a sua respiração');
    return;
  }

  const registro = {
    id: Date.now(),
    data: new Date().toISOString(),
    paciente: nomesUsuarios.paciente,
    humor: humorSelecionado.dataset.mood,
    sintomas: sintomasSelecionados.filter(item => item !== 'Sim' && item !== 'Não'),
    usouAlivio: usouAlivioBotao ? usouAlivioBotao.textContent.trim() : 'Não informado',
    quantidadeAlivio: quantidadeBombinhas,
    gatilhos: gatilhosSelecionados,
    observacao: observacao
  };

  const registros = pegarRegistros();
  registros.push(registro);
  localStorage.setItem('registrosEolo', JSON.stringify(registros));

  mostrarRelatorios();
  limparRegistro();
  mostrarAviso('Registro salvo com sucesso');
}

function pegarRegistros(){
  return JSON.parse(localStorage.getItem('registrosEolo')) || [];
}

function mostrarRelatorios(){
  const lista = document.getElementById('lista-relatorios');
  const vazio = document.getElementById('sem-relatorios');
  if (!lista) return;

  const registros = pegarRegistros().sort((a, b) => new Date(b.data) - new Date(a.data));
  lista.innerHTML = '';
  vazio.style.display = registros.length ? 'none' : 'block';

  registros.forEach(registro => {
    const card = document.createElement('div');
    card.className = 'cartao-relatorio';

    const data = new Date(registro.data).toLocaleDateString('pt-BR');
    const hora = new Date(registro.data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const humor = registro.humor.toUpperCase();

    card.innerHTML = `
      <div class="topo-relatorio">
        <div>
          <span class="data-relatorio">${data} às ${hora}</span>
          <h3>${escaparTexto(registro.paciente)}</h3>
        </div>
        <span class="estado-relatorio estado-${registro.humor}">${humor}</span>
      </div>

      <div class="linha-relatorio">
        <strong>Sintomas:</strong> ${escaparTexto(registro.sintomas.length ? registro.sintomas.join(', ') : 'Nenhum informado')}
      </div>
      <div class="linha-relatorio">
        <strong>Medicamento de alívio:</strong> ${escaparTexto(registro.usouAlivio)} — ${registro.quantidadeAlivio} vez(es)
      </div>
      <div class="linha-relatorio">
        <strong>Possíveis gatilhos:</strong> ${escaparTexto(registro.gatilhos.length ? registro.gatilhos.join(', ') : 'Nenhum informado')}
      </div>
      <div class="linha-relatorio">
        <strong>Observação:</strong> ${escaparTexto(registro.observacao || 'Nenhuma observação')}
      </div>

      <button class="botao-excluir-relatorio" onclick="excluirRegistro(${registro.id})">Excluir registro</button>
    `;

    lista.appendChild(card);
  });
}

function excluirRegistro(id){
  const registros = pegarRegistros().filter(registro => registro.id !== id);
  localStorage.setItem('registrosEolo', JSON.stringify(registros));
  mostrarRelatorios();
  mostrarAviso('Registro excluído');
}

function limparRegistro(){
  document.querySelectorAll('.botao-humor').forEach(botao => botao.classList.remove('sel'));
  document.querySelectorAll('.grupo-opcoes .opcao').forEach(opcao => opcao.classList.remove('sel'));
  document.querySelectorAll('#lista-gatilhos input').forEach(caixa => caixa.checked = false);
  document.getElementById('observacoes-registro').value = '';
  quantidadeBombinhas = 1;
  document.getElementById('valor-contador').textContent = quantidadeBombinhas;
}


/* ---------------- aviso-tela ---------------- */
let tempoAviso;
function mostrarAviso(mensagem){
  const aviso = document.getElementById('aviso-tela');
  aviso.textContent = mensagem;
  aviso.classList.add('show');
  clearTimeout(tempoAviso);
  tempoAviso = setTimeout(() => aviso.classList.remove('show'), 2200);
}
