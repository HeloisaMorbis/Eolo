/* =====================================================
   JAVASCRIPT DO ÉOLO
   Aqui ficam as ações do site: login, menu, páginas e botões.
   ===================================================== */

/* Estado visual do site. Os dados persistentes são sincronizados com o Supabase. */
/* ==================== SUPABASE ==================== */
const EOLO_SUPABASE_URL = 'https://ldubrpwtmznuaotbnuxf.supabase.co';
const EOLO_SUPABASE_KEY = 'sb_publishable_bwlUvrb9-OIe-JUQD1ep7A_thym-mW-';
let eoloSupabase = null;

function inicializarSupabaseEolo(){
  if(eoloSupabase) return eoloSupabase;
  if(!window.supabase || typeof window.supabase.createClient !== 'function'){
    console.error('Biblioteca do Supabase não carregou.');
    return null;
  }
  eoloSupabase = window.supabase.createClient(EOLO_SUPABASE_URL, EOLO_SUPABASE_KEY);
  return eoloSupabase;
}

inicializarSupabaseEolo();

let usuarioAuthEolo = null;
let usuarioBancoEolo = null;
let pacienteBancoEolo = null;
let bancoEoloPronto = false;

function chaveLocalUsuarioEolo(nome){
  const id = usuarioAuthEolo?.id || 'anonimo';
  return `eolo_${id}_${nome}`;
}

function bancoDisponivelEolo(){
  return !!inicializarSupabaseEolo();
}

async function obterUsuarioBancoEolo(){
  if(!eoloSupabase) return null;
  const { data, error } = await eoloSupabase.auth.getUser();
  if(error){
    console.error('Supabase auth:', error);
    return null;
  }
  usuarioAuthEolo = data.user || null;
  return usuarioAuthEolo;
}

async function prepararUsuarioBancoEolo(){
  const user = await obterUsuarioBancoEolo();
  if(!user) return false;

  let { data: usuario, error } = await eoloSupabase
    .from('usuarios')
    .select('*')
    .eq('auth_id', user.id)
    .maybeSingle();

  if(error){
    console.error('Erro ao buscar usuario:', error);
    return false;
  }

  const nomeInicial = user.user_metadata?.nome || user.email?.split('@')[0] || 'Usuário Éolo';

  if(!usuario){
    const resposta = await eoloSupabase
      .from('usuarios')
      .insert({
        auth_id: user.id,
        email: user.email || '',
        nome: nomeInicial,
        tipo_usuario: tipoUsuario,
        idade: Number(user.user_metadata?.idade) || null,
        cadastro_concluido: false
      })
      .select('*')
      .single();

    usuario = resposta.data;
    error = resposta.error;

    if(error){
      console.error('Erro ao criar usuario:', error);
      mostrarAviso('Não foi possível criar o cadastro no banco.');
      return false;
    }
  }else{
    const atualizacoesUsuario = {};
    if(usuario.tipo_usuario !== tipoUsuario) atualizacoesUsuario.tipo_usuario = tipoUsuario;
    const idadeMeta = Number(user.user_metadata?.idade);
    if(Number.isFinite(idadeMeta) && idadeMeta > 0 && usuario.idade !== idadeMeta){
      atualizacoesUsuario.idade = idadeMeta;
    }
    if(Object.keys(atualizacoesUsuario).length){
      const atualizacao = await eoloSupabase.from('usuarios').update(atualizacoesUsuario).eq('id', usuario.id);
      if(atualizacao.error) console.error('Erro ao atualizar dados do usuario:', atualizacao.error);
      else usuario = { ...usuario, ...atualizacoesUsuario };
    }
  }

  usuarioBancoEolo = usuario;

  let paciente = await eoloSupabase
    .from('pacientes')
    .select('*')
    .eq('usuario_id', usuario.id)
    .maybeSingle();

  if(paciente.error){
    console.error('Erro ao buscar paciente:', paciente.error);
    return false;
  }

  if(!paciente.data){
    const novoPaciente = await eoloSupabase
      .from('pacientes')
      .insert({
        usuario_id: usuario.id,
        nome: usuario.nome || nomeInicial,
        email: user.email || '',
        dados: {}
      })
      .select('*')
      .single();

    if(novoPaciente.error){
      console.error('Erro ao criar paciente:', novoPaciente.error);
      mostrarAviso('Não foi possível criar o paciente no banco.');
      return false;
    }
    pacienteBancoEolo = novoPaciente.data;
  }else{
    pacienteBancoEolo = paciente.data;
  }

  bancoEoloPronto = true;
  return true;
}

async function carregarDadosBancoEolo(){
  if(!bancoEoloPronto || !pacienteBancoEolo) return;

  try{
    const ficha = await eoloSupabase
      .from('fichas_saude')
      .select('id,paciente_id,dados,atualizado_em')
      .eq('paciente_id', pacienteBancoEolo.id)
      .order('atualizado_em', {ascending:false})
      .limit(1)
      .maybeSingle();

    if(!ficha.error && ficha.data?.dados){
      salvarEolo(chaveFichaEolo(), ficha.data.dados);
    }

    const meds = await eoloSupabase
      .from('medicamentos')
      .select('*')
      .eq('paciente_id', pacienteBancoEolo.id)
      .order('id', {ascending:true});

    if(!meds.error){
      const lista = meds.data.map(m => ({
        id: m.id,
        nome: m.nome || m.dados?.nome || '',
        classificacao: m.classificacao || m.dados?.classificacao || '',
        dose: m.dados?.dose || m.dose || '',
        horario: m.dados?.horario || m.horario || '',
        tipo: m.dados?.tipo || m.tipo || ''
      }));
      salvarListaMedicamentos(lista);
    }

    const bombinhas = await eoloSupabase
      .from('bombinhas')
      .select('*')
      .eq('paciente_id', pacienteBancoEolo.id)
      .order('id', {ascending:true});

    if(!bombinhas.error){
      const lista = bombinhas.data.map(b => {
        const dados = b.dados || {};
        return {
          id: String(b.id),
          dbId: b.id,
          nome: b.nome || b.dispositivo_nome || dados.nome || 'INALADOR-A-001',
          paciente: nomesUsuarios.paciente,
          selecionada: !!dados.selecionada,
          conectado: false,
          puffsCartucho: Number(dados.puffsCartucho || 0),
          totalPuffs: Number(dados.totalPuffs || 0),
          cartuchoAtual: Number(dados.cartuchoAtual || 1),
          totalCartuchos: Number(dados.totalCartuchos || 1),
          cilindroPresente: dados.cilindroPresente !== false,
          validade: dados.validade || '',
          eventos: Array.isArray(dados.eventos) ? dados.eventos : [],
          ultimoUptime: Number(dados.ultimoUptime || 0),
          ultimaSincronizacao: dados.ultimaSincronizacao || null
        };
      });
      if(lista.length){
        const ids = lista.map(b=>b.dbId).filter(Boolean);
        if(ids.length){
          const eventosRemotos = await eoloSupabase.from('eventos_bombinha').select('*').in('bombinha_id',ids).order('ocorrido_em',{ascending:false});
          if(!eventosRemotos.error){
            eventosRemotos.data.forEach(ev=>{
              const b=lista.find(x=>x.dbId===ev.bombinha_id);
              if(!b) return;
              const tipo = ev.tipo || ev.dados?.tipo;
              if(!b.eventos.some(x=>x.tipo===tipo && Number(x.uptime)===Number(ev.uptime_s) && x.data===ev.ocorrido_em)){
                b.eventos.push({tipo,uptime:Number(ev.uptime_s||0),data:ev.ocorrido_em||new Date().toISOString()});
              }
            });
          }
        }
        bombinhasEolo = lista;
        bombinhaAtualEolo = bombinhasEolo.find(b=>b.selecionada) || bombinhasEolo[0];
        salvarBombinhasEolo();
      }
    }

    const registros = await eoloSupabase
      .from('registros_diarios')
      .select('*')
      .eq('paciente_id', pacienteBancoEolo.id)
      .order('registrado_em', {ascending:false});

    if(!registros.error){
      const lista = registros.data.map(r => r.dados || {
        id: r.id,
        data: r.registrado_em,
        paciente: nomesUsuarios.paciente
      });
      localStorage.setItem(chaveLocalUsuarioEolo('registros'), JSON.stringify(lista));
    }

    mostrarMedicamentosNovos();
    mostrarRelatorios();
    renderBombinhasEolo();
    renderUsoBombinhaEolo();
    renderHistoricoEolo();
  }catch(erro){
    console.error('Erro ao carregar dados do Supabase:', erro);
  }
}

async function salvarFichaNoBancoEolo(ficha){
  if(!bancoEoloPronto || !pacienteBancoEolo) return;
  const existente = await eoloSupabase
    .from('fichas_saude')
    .select('id')
    .eq('paciente_id', pacienteBancoEolo.id)
    .limit(1)
    .maybeSingle();

  if(existente.error){ console.error('Erro ao localizar ficha:', existente.error); return; }

  let resultado;
  if(existente.data?.id){
    resultado = await eoloSupabase.from('fichas_saude').update({dados:ficha, atualizado_em:new Date().toISOString()}).eq('id', existente.data.id);
  }else{
    resultado = await eoloSupabase.from('fichas_saude').insert({paciente_id:pacienteBancoEolo.id, dados:ficha});
  }
  if(resultado.error) console.error('Erro ao salvar ficha no Supabase:', resultado.error);
}

async function salvarMedicamentoNoBancoEolo(medicamento){
  if(!bancoEoloPronto || !pacienteBancoEolo) return;
  const resultado = await eoloSupabase.from('medicamentos').insert({
    paciente_id: pacienteBancoEolo.id,
    nome: medicamento.nome,
    classificacao: medicamento.classificacao || medicamento.tipo || '',
    dados: medicamento
  }).select('id').single();
  if(resultado.error) console.error('Erro ao salvar medicamento:', resultado.error);
  else medicamento.id = resultado.data.id;
}

async function salvarRegistroNoBancoEolo(registro){
  if(!bancoEoloPronto || !pacienteBancoEolo) return;
  const resultado = await eoloSupabase.from('registros_diarios').insert({
    paciente_id: pacienteBancoEolo.id,
    dados: registro,
    registrado_em: registro.data || new Date().toISOString()
  });
  if(resultado.error) console.error('Erro ao salvar registro diário:', resultado.error);
}

async function salvarBombinhaNoBancoEolo(bombinha){
  if(!bancoEoloPronto || !pacienteBancoEolo || !bombinha) return;
  const dados = {
    nome:bombinha.nome,
    dispositivo_nome:bombinha.nome,
    selecionada:!!bombinha.selecionada,
    puffsCartucho:Number(bombinha.puffsCartucho||0),
    totalPuffs:Number(bombinha.totalPuffs||0),
    cartuchoAtual:Number(bombinha.cartuchoAtual||1),
    totalCartuchos:Number(bombinha.totalCartuchos||1),
    cilindroPresente:bombinha.cilindroPresente!==false,
    validade:bombinha.validade||'',
    eventos:Array.isArray(bombinha.eventos)?bombinha.eventos:[],
    ultimoUptime:Number(bombinha.ultimoUptime||0),
    ultimaSincronizacao:bombinha.ultimaSincronizacao||null
  };

  if(bombinha.dbId){
    const resultado = await eoloSupabase.from('bombinhas').update({nome:bombinha.nome, dispositivo_nome:bombinha.nome, dados}).eq('id', bombinha.dbId);
    if(resultado.error) console.error('Erro ao atualizar bombinha:', resultado.error);
    return;
  }

  const existente = await eoloSupabase.from('bombinhas').select('id').eq('paciente_id',pacienteBancoEolo.id).eq('dispositivo_nome',bombinha.nome).limit(1).maybeSingle();
  if(existente.error){ console.error('Erro ao procurar bombinha:', existente.error); return; }
  if(existente.data?.id){
    bombinha.dbId = existente.data.id;
    bombinha.id = String(existente.data.id);
    const resultado = await eoloSupabase.from('bombinhas').update({nome:bombinha.nome,dados}).eq('id',existente.data.id);
    if(resultado.error) console.error('Erro ao atualizar bombinha:', resultado.error);
  }else{
    const resultado = await eoloSupabase.from('bombinhas').insert({paciente_id:pacienteBancoEolo.id,nome:bombinha.nome,dispositivo_nome:bombinha.nome,dados}).select('id').single();
    if(resultado.error) console.error('Erro ao criar bombinha:', resultado.error);
    else { bombinha.dbId=resultado.data.id; bombinha.id=String(resultado.data.id); }
  }
}

async function salvarEventoNoBancoEolo(evento){
  if(!bancoEoloPronto || !bombinhaAtualEolo?.dbId) return;
  const resultado = await eoloSupabase.from('eventos_bombinha').insert({
    bombinha_id:bombinhaAtualEolo.dbId,
    tipo:evento.tipo,
    uptime_s:Number(evento.uptime||0),
    dados:evento,
    ocorrido_em:evento.data || new Date().toISOString()
  });
  if(resultado.error) console.error('Erro ao salvar evento da bombinha:', resultado.error);
}

function chaveCadastroPendenteEolo(email){
  return `eolo_cadastro_pendente_${String(email || '').trim().toLowerCase()}`;
}

function salvarCadastroPendenteEolo(email, ficha){
  if(!email) return;
  localStorage.setItem(chaveCadastroPendenteEolo(email), JSON.stringify({
    email,
    ficha,
    criadoEm: new Date().toISOString()
  }));
}

function lerCadastroPendenteEolo(email){
  if(!email) return null;
  try{
    const bruto=localStorage.getItem(chaveCadastroPendenteEolo(email));
    return bruto ? JSON.parse(bruto) : null;
  }catch(e){
    return null;
  }
}

function apagarCadastroPendenteEolo(email){
  if(email) localStorage.removeItem(chaveCadastroPendenteEolo(email));
}

function prepararTelaFichaCadastroEolo(email, idade){
  parteFichaEolo=1;
  const tela=document.getElementById('tela-ficha-cadastro');
  if(!tela) return;

  document.getElementById('fEmail').value=email || '';
  document.getElementById('fIdade').value=idade ? String(idade) : '';
  document.getElementById('fData').value=new Date().toISOString().slice(0,10);
  document.getElementById('fCodigo').value=document.getElementById('fCodigo').value || ('EOLO-'+Math.random().toString(36).slice(2,7).toUpperCase());

  const pendente=lerCadastroPendenteEolo(email);
  if(pendente?.ficha) preencherFichaCadastroEolo(pendente.ficha);

  document.getElementById('tela-login')?.classList.remove('ativa');
  document.getElementById('tela-cadastro')?.classList.remove('ativa');
  tela.classList.add('ativa');
  atualizarParteFichaEolo();
  window.scrollTo({top:0,behavior:'auto'});
}

async function criarContaEolo(){
  inicializarSupabaseEolo();
  if(!eoloSupabase){
    mostrarAviso('Supabase não está disponível.');
    return;
  }

  const email=document.getElementById('email-cadastro')?.value.trim().toLowerCase();
  const senha=document.getElementById('senha-cadastro')?.value || '';
  const confirmarSenha=document.getElementById('confirmar-senha-cadastro')?.value || '';
  const idadeTexto=document.getElementById('idade-cadastro')?.value.trim();
  const idade=Number(idadeTexto);

  if(!email || !senha || !confirmarSenha || !idadeTexto){
    mostrarAviso('Preencha email, senha, confirmação da senha e idade.');
    return;
  }
  if(senha.length < 6){
    mostrarAviso('A senha precisa ter pelo menos 6 caracteres.');
    return;
  }
  if(senha !== confirmarSenha){
    mostrarAviso('As senhas não são iguais.');
    return;
  }
  if(!Number.isInteger(idade) || idade < 1 || idade > 120){
    mostrarAviso('Informe uma idade válida entre 1 e 120 anos.');
    return;
  }

  const botao=document.querySelector('#tela-cadastro .botao-principal');
  if(botao){ botao.disabled=true; botao.textContent='Criando conta...'; }

  try{
    const resposta=await eoloSupabase.auth.signUp({
      email,
      password:senha,
      options:{data:{tipo_usuario:'paciente',idade}}
    });

    if(resposta.error){
      mostrarAviso('Não foi possível criar a conta: '+resposta.error.message);
      return;
    }

    tipoUsuario='paciente';
    usuarioAuthEolo=resposta.data.user || null;
    bancoEoloPronto=false;
    usuarioBancoEolo=null;
    pacienteBancoEolo=null;

    // O cadastro do Éolo não usa confirmação por email.
    // A opção 'Confirm email' precisa estar desativada no Supabase.
    if(resposta.data.session){
      await prepararUsuarioBancoEolo();
    }

    prepararTelaFichaCadastroEolo(email, idade);
    mostrarAviso('Conta criada! Agora complete sua ficha de saúde.');
  }finally{
    if(botao){ botao.disabled=false; botao.textContent='Criar conta'; }
  }
}


function mostrarCriarContaEolo(){
  document.getElementById('tela-login')?.classList.remove('ativa');
  document.getElementById('tela-cadastro')?.classList.add('ativa');
  const campoEmail=document.getElementById('email-cadastro');
  if(campoEmail) campoEmail.focus();
}

function voltarParaLoginEolo(){
  document.getElementById('tela-cadastro')?.classList.remove('ativa');
  document.getElementById('tela-login')?.classList.add('ativa');
}

function mostrarSenhaCadastro(id){
  const campo=document.getElementById(id);
  if(campo) campo.type = campo.type === 'password' ? 'text' : 'password';
}


let tipoUsuario = 'paciente';
let quantidadeBombinhas = 1;
const nomesUsuarios = { paciente: 'Ana', cuidador: 'Marcos' };

const informacoesPaginas = {
  home: { title: 'Olá, {nome}!', sub: 'Veja o resumo do seu cuidado e do uso da bombinha.' },
  uso: { title: 'Uso da bombinha', sub: 'Acompanhe puffs, cartucho e validade.' },
  historico: { title: 'Histórico de uso', sub: 'Veja os registros mais recentes.' },
  crise: { title: 'Crise de Asma', sub: 'Siga as orientações com calma.' },
  dicas: { title: 'Dicas de Controle', sub: 'Informações para cuidar da asma.' },
  medicamentos: { title: 'Meus Medicamentos', sub: 'Acompanhe seus remédios.' },
  registro: { title: 'Registro Diário', sub: 'Registre como você está hoje.' },
  relatorios: { title: 'Relatórios', sub: 'Veja seus registros.' },
  faq: { title: 'Perguntas Frequentes', sub: 'Tire suas dúvidas.' },
  info: { title: 'Informações Adicionais', sub: 'Sobre a asma e o Éolo.' }
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

async function entrarNoSite(){
  if(!eoloSupabase){
    mostrarAviso('O Supabase não carregou. Atualize a página e tente novamente.');
    return;
  }

  const email=document.getElementById('email-login')?.value.trim().toLowerCase();
  const senha=document.getElementById('senha-login')?.value || '';
  if(!email || !senha){
    mostrarAviso('Informe o email e a senha.');
    return;
  }

  try{
    tipoUsuario='paciente';

    const resposta=await eoloSupabase.auth.signInWithPassword({
      email,
      password:senha
    });

    if(resposta.error){
      const mensagem=String(resposta.error.message || '').toLowerCase();

      if(mensagem.includes('invalid login credentials')){
        mostrarAviso('Email ou senha incorretos. Confira os dados e tente novamente.');
      }else{
        mostrarAviso('Não foi possível entrar: ' + resposta.error.message);
      }
      return;
    }

    usuarioAuthEolo=resposta.data.user || null;


    const preparado=await prepararUsuarioBancoEolo();
    if(!preparado){
      mostrarAviso('O login foi realizado, mas não foi possível carregar seu cadastro no banco. Verifique as políticas do Supabase.');
      await eoloSupabase.auth.signOut();
      return;
    }

    const pendente=lerCadastroPendenteEolo(email);
    if(pendente?.ficha){
      await salvarFichaNoBancoEolo(pendente.ficha);
      await salvarRemediosFichaNoBancoEolo(pendente.ficha);
      if(usuarioBancoEolo?.id){
        const conclusao=await eoloSupabase
          .from('usuarios')
          .update({cadastro_concluido:true})
          .eq('id',usuarioBancoEolo.id);
        if(conclusao.error) throw conclusao.error;
        usuarioBancoEolo={...usuarioBancoEolo,cadastro_concluido:true};
      }
      apagarCadastroPendenteEolo(email);
    }

    document.getElementById('tela-login')?.classList.remove('ativa');
    document.getElementById('tela-cadastro')?.classList.remove('ativa');
    document.getElementById('tela-ficha-cadastro')?.classList.remove('ativa');
    document.getElementById('site').hidden=false;
    document.body.classList.toggle('modo-cuidador',tipoUsuario==='cuidador');

    const dateEl=document.getElementById('data-registro');
    if(dateEl){
      dateEl.textContent=new Date().toLocaleDateString('pt-BR',{
        weekday:'long',day:'2-digit',month:'long'
      });
    }

    mostrarPagina('home');
    carregarBombinhasEolo();
    iniciarBluetoothEolo();
    await carregarDadosBancoEolo();
    mostrarAviso('Login realizado com sucesso!');

  }catch(erro){
    console.error('Erro completo no login:',erro);
    mostrarAviso('Erro ao entrar: ' + (erro?.message || 'verifique o email, a senha e a configuração do Supabase.'));
  }
}

async function sairDoSite(){
  if(eoloSupabase) await eoloSupabase.auth.signOut();
  usuarioAuthEolo=null; usuarioBancoEolo=null; pacienteBancoEolo=null; bancoEoloPronto=false;
  document.body.classList.remove('modo-cuidador');
  document.getElementById('site').hidden = true;
  document.getElementById('tela-login').classList.remove('ativa');
  document.getElementById('tela-cadastro')?.classList.remove('ativa');
  document.getElementById('tela-ficha-cadastro')?.classList.remove('ativa');
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
   O localStorage funciona como cache visual; o Supabase é a fonte persistente.
*/
function pegarMedicamentos(){
  return JSON.parse(localStorage.getItem(chaveLocalUsuarioEolo('medicamentos')) || '[]');
}

function salvarListaMedicamentos(lista){
  localStorage.setItem(chaveLocalUsuarioEolo('medicamentos'), JSON.stringify(lista));
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
  salvarMedicamentoNoBancoEolo(novoMedicamento);

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
  inicializarFichaEolo();
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
  localStorage.setItem(chaveLocalUsuarioEolo('registros'), JSON.stringify(registros));
  salvarRegistroNoBancoEolo(registro);

  mostrarRelatorios();
  limparRegistro();
  mostrarAviso('Registro salvo com sucesso');
}

function pegarRegistros(){
  return JSON.parse(localStorage.getItem(chaveLocalUsuarioEolo('registros'))) || [];
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
  localStorage.setItem(chaveLocalUsuarioEolo('registros'), JSON.stringify(registros));
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


/* =====================================================
   FUNCIONALIDADES INCORPORADAS DO NOVO PROTÓTIPO
   Ficha + uso da bombinha + cartucho + histórico.
   Neste momento os dados continuam locais, via localStorage.
   ===================================================== */
const PERGUNTAS_SAUDE_EOLO = [
  ['nariz','Você tem alergia no nariz (espirro, coceira, nariz entupido)?'],
  ['sinusite','Você já teve sinusite?'],
  ['pele','Você tem alergia na pele?'],
  ['azia','Você sente azia ou queimação no estômago com frequência?'],
  ['ronco','Alguém já disse que você ronca forte ou para de respirar enquanto dorme?'],
  ['animo','Você anda se sentindo muito triste ou ansioso(a)?'],
  ['coracao','Você tem algum problema do coração?'],
  ['diabetes','Você tem diabetes (açúcar no sangue)?'],
  ['peso','Alguém já disse que você está acima do peso?'],
  ['fumo','Você fuma ou já fumou?'],
  ['fumantes','Você mora ou convive com pessoas que fumam perto de você?'],
  ['alergia','Você tem alergia a algum remédio ou comida?'],
  ['familia','Alguém da sua família (pai, mãe, irmãos) tem ou teve asma ou alergia?']
];
const DOENCAS_EOLO = ['Hipertensão (pressão alta)','Diabetes','Doença do coração','Rinite / alergia no nariz','Sinusite','Refluxo ou gastrite','Ansiedade ou depressão','Apneia do sono','Obesidade','DPOC / bronquite crônica','Osteoporose','Problema de tireoide'];
let parteFichaEolo=1;
let bombinhasEolo=[];
let bombinhaAtualEolo=null;
let conectadoEolo=false;

function chaveFichaEolo(){ return chaveLocalUsuarioEolo('ficha_principal'); }
function chaveBombinhasEolo(){ return chaveLocalUsuarioEolo('bombinhas_principal'); }
function lerEolo(k,p){ try{ const v=JSON.parse(localStorage.getItem(k)); return v===null?p:v; }catch(e){return p;} }
function salvarEolo(k,v){ localStorage.setItem(k,JSON.stringify(v)); }
function dadosBombinhaEolo(){ return bombinhaAtualEolo || null; }

function inicializarFichaEolo(){
  const lista=document.getElementById('listaSaude');
  if(lista && !lista.children.length){
    PERGUNTAS_SAUDE_EOLO.forEach(p=>{
      const d=document.createElement('div');
      d.className='pergunta-ficha';
      d.innerHTML=`<p>${p[1]}</p><div class="opcoes-ficha"><label><input type="radio" name="s_${p[0]}" value="Sim"> Sim</label><label><input type="radio" name="s_${p[0]}" value="Não"> Não</label></div>`;
      lista.appendChild(d);
    });
  }

  const ld=document.getElementById('listaDoencas');
  if(ld && !ld.children.length){
    DOENCAS_EOLO.forEach(n=>{
      const l=document.createElement('label');
      l.innerHTML=`<input type="checkbox" class="doenca-eolo" value="${escaparTexto(n)}"> ${escaparTexto(n)}`;
      ld.appendChild(l);
    });
  }

  const ficha=lerEolo(chaveFichaEolo(),{});
  preencherFichaCadastroEolo(ficha);

  document.getElementById('btnVoltarParte')?.addEventListener('click',()=>mudarParteFichaEolo(-1));
  document.getElementById('btnAvancarParte')?.addEventListener('click',()=>mudarParteFichaEolo(1));
  document.getElementById('btnFinalizarFicha')?.addEventListener('click',finalizarFichaCadastroEolo);
  document.getElementById('fNasc')?.addEventListener('change',calcularIdadeCadastroEolo);
  document.getElementById('fPeso')?.addEventListener('input',calcularIMCCadastroEolo);
  document.getElementById('fAltura')?.addEventListener('input',calcularIMCCadastroEolo);
  document.getElementById('btnAddRemedio')?.addEventListener('click',()=>adicionarRemedioFichaEolo());
  document.querySelectorAll('input[name="atendimento"]').forEach(r=>r.addEventListener('change',atualizarPlanoFichaEolo));
  atualizarParteFichaEolo();
}

function preencherFichaCadastroEolo(f){
  if(!f || typeof f!=='object') return;
  const mapa={
    codigo:'fCodigo', dataHoje:'fData', nome:'fNome', nascimento:'fNasc', idade:'fIdade', cpf:'fCpf', telefone:'fTel',
    telefoneEmergencia:'fTelEmerg', cuidador:'fCuidador', telefoneCuidador:'fTelCuidador', plano:'fPlano', endereco:'fEndereco',
    email:'fEmail', peso:'fPeso', altura:'fAltura', imc:'fImc', idadeAsma:'fIdadeAsma', outrasDoencas:'fOutrasDoencas', outros:'fOutros',
    bombinhaDiaria:'fBombDiaria', bombinhaCrise:'fBombCrise'
  };
  Object.entries(mapa).forEach(([chave,id])=>{
    const el=document.getElementById(id);
    if(el && f[chave]!==undefined) el.value=f[chave];
  });
  if(f.respondente) marcarRadioEolo('respondente',f.respondente);
  if(f.atendimento) marcarRadioEolo('atendimento',f.atendimento);
  if(f.freqCrise) marcarRadioEolo('freqCrise',f.freqCrise);
  if(f.comprimido) marcarRadioEolo('comprimido',f.comprimido);
  if(f.criseForte) marcarRadioEolo('criseForte',f.criseForte);
  if(f.internacao) marcarRadioEolo('internacao',f.internacao);
  if(f.adesao) marcarRadioEolo('adesao',f.adesao);

  PERGUNTAS_SAUDE_EOLO.forEach(p=>{
    if(f.saude?.[p[0]]) marcarRadioEolo(`s_${p[0]}`,f.saude[p[0]]);
  });
  document.querySelectorAll('.doenca-eolo').forEach(c=>c.checked=(f.doencas||[]).includes(c.value));
  carregarRemediosFichaEolo(f.remediosDiarios||[]);
  atualizarPlanoFichaEolo();
  calcularIdadeCadastroEolo();
  calcularIMCCadastroEolo();
}

function marcarRadioEolo(nome,valor){
  const el=document.querySelector(`input[name="${nome}"][value="${CSS.escape(String(valor))}"]`);
  if(el) el.checked=true;
}

function pegarValorFicha(id){
  const el=document.getElementById(id);
  return el ? String(el.value||'').trim() : '';
}
function pegarRadioFicha(nome){
  return document.querySelector(`input[name="${nome}"]:checked`)?.value || '';
}
function pegarCheckboxesFicha(selector){
  return Array.from(document.querySelectorAll(`${selector}:checked`)).map(el=>el.value);
}

function montarFichaCadastroEolo(){
  const ficha=lerEolo(chaveFichaEolo(),{});
  ficha.codigo=pegarValorFicha('fCodigo') || ficha.codigo || '';
  ficha.dataHoje=pegarValorFicha('fData');
  ficha.respondente=pegarRadioFicha('respondente');
  ficha.nome=pegarValorFicha('fNome');
  ficha.nascimento=pegarValorFicha('fNasc');
  ficha.idade=pegarValorFicha('fIdade');
  ficha.cpf=pegarValorFicha('fCpf');
  ficha.telefone=pegarValorFicha('fTel');
  ficha.telefoneEmergencia=pegarValorFicha('fTelEmerg');
  ficha.cuidador=pegarValorFicha('fCuidador');
  ficha.telefoneCuidador=pegarValorFicha('fTelCuidador');
  ficha.atendimento=pegarRadioFicha('atendimento');
  ficha.plano=pegarValorFicha('fPlano');
  ficha.endereco=pegarValorFicha('fEndereco');
  ficha.email=pegarValorFicha('fEmail');
  ficha.peso=pegarValorFicha('fPeso');
  ficha.altura=pegarValorFicha('fAltura');
  ficha.imc=pegarValorFicha('fImc');
  ficha.idadeAsma=pegarValorFicha('fIdadeAsma');
  ficha.saude={};
  PERGUNTAS_SAUDE_EOLO.forEach(p=>ficha.saude[p[0]]=pegarRadioFicha(`s_${p[0]}`));
  ficha.doencas=pegarCheckboxesFicha('.doenca-eolo');
  ficha.outrasDoencas=pegarValorFicha('fOutrasDoencas');
  ficha.outros=pegarValorFicha('fOutros');
  ficha.remediosDiarios=pegarRemediosFichaEolo();
  ficha.bombinhaDiaria=pegarValorFicha('fBombDiaria');
  ficha.bombinhaCrise=pegarValorFicha('fBombCrise');
  ficha.freqCrise=pegarRadioFicha('freqCrise');
  ficha.comprimido=pegarRadioFicha('comprimido');
  ficha.criseForte=pegarRadioFicha('criseForte');
  ficha.internacao=pegarRadioFicha('internacao');
  ficha.adesao=pegarRadioFicha('adesao');
  ficha.u4_faltaAr=pegarRadioFicha('u4_faltaAr');
  ficha.u4_noite=pegarRadioFicha('u4_noite');
  ficha.u4_alivio=pegarRadioFicha('u4_alivio');
  ficha.u4_deixou=pegarRadioFicha('u4_deixou');
  ficha.dataAtualizacao=new Date().toISOString();
  return ficha;
}

function salvarFichaTemporariaCadastroEolo(){
  const ficha=montarFichaCadastroEolo();
  salvarEolo(chaveFichaEolo(),ficha);
  const email=pegarValorFicha('fEmail');
  salvarCadastroPendenteEolo(email,ficha);
  return ficha;
}

function validarParteFichaEolo(parte){
  if(parte===1 && !pegarValorFicha('fNome')){
    mostrarAviso('Informe seu nome completo para continuar.');
    document.getElementById('fNome')?.focus();
    return false;
  }
  if(parte===2){
    const peso=Number(String(pegarValorFicha('fPeso')).replace(',','.'));
    const altura=Number(String(pegarValorFicha('fAltura')).replace(',','.'));
    if(!peso || !altura){
      mostrarAviso('Informe seu peso e sua altura para continuar.');
      return false;
    }
  }
  return true;
}

function atualizarParteFichaEolo(){
  document.querySelectorAll('#tela-ficha-cadastro .parte-ficha').forEach((p,i)=>p.classList.toggle('on',i+1===parteFichaEolo));
  const selo=document.getElementById('seloParte');
  if(selo) selo.textContent=`Parte ${parteFichaEolo} de 6`;
  const barra=document.getElementById('barraProgresso');
  if(barra) barra.style.width=`${(parteFichaEolo/6)*100}%`;
  const voltar=document.getElementById('btnVoltarParte');
  const avancar=document.getElementById('btnAvancarParte');
  const finalizar=document.getElementById('btnFinalizarFicha');
  if(voltar) voltar.style.display=parteFichaEolo===1?'none':'inline-flex';
  if(avancar) avancar.style.display=parteFichaEolo===6?'none':'inline-flex';
  if(finalizar) finalizar.style.display=parteFichaEolo===6?'inline-flex':'none';
  document.getElementById('tela-ficha-cadastro')?.scrollTo({top:0,behavior:'smooth'});
}

function mudarParteFichaEolo(delta){
  if(delta>0 && !validarParteFichaEolo(parteFichaEolo)) return;
  salvarFichaTemporariaCadastroEolo();
  const novaParte=parteFichaEolo+delta;
  if(novaParte<1 || novaParte>6) return;
  parteFichaEolo=novaParte;
  atualizarParteFichaEolo();
}

function calcularIdadeCadastroEolo(){
  const nascimento=document.getElementById('fNasc');
  const idade=document.getElementById('fIdade');
  if(!nascimento || !idade || !nascimento.value) return;
  const hoje=new Date();
  const data=new Date(nascimento.value+'T00:00:00');
  let anos=hoje.getFullYear()-data.getFullYear();
  if(hoje.getMonth()<data.getMonth() || (hoje.getMonth()===data.getMonth() && hoje.getDate()<data.getDate())) anos--;
  idade.value=anos>=0?String(anos):'';
}

function calcularIMCCadastroEolo(){
  const peso=Number(String(pegarValorFicha('fPeso')).replace(',','.'));
  const altura=Number(String(pegarValorFicha('fAltura')).replace(',','.'));
  const imc=document.getElementById('fImc');
  if(!imc) return;
  if(!peso || !altura){ imc.value=''; return; }
  const metros=altura>3 ? altura/100 : altura;
  const valor=peso/(metros*metros);
  imc.value=Number.isFinite(valor)?valor.toFixed(1):'';
}

function atualizarPlanoFichaEolo(){
  const atendimento=pegarRadioFicha('atendimento');
  const campo=document.getElementById('campoPlano');
  if(campo) campo.style.display=atendimento==='Plano de saúde'?'block':'none';
}

function pegarRemediosFichaEolo(){
  return Array.from(document.querySelectorAll('.remedio-ficha-linha')).map(linha=>({
    nome:linha.querySelector('.remedio-ficha-nome')?.value.trim()||'',
    dose:linha.querySelector('.remedio-ficha-dose')?.value.trim()||'',
    horario:linha.querySelector('.remedio-ficha-horario')?.value||''
  })).filter(x=>x.nome);
}

function carregarRemediosFichaEolo(lista){
  const container=document.getElementById('listaRemedios');
  if(!container) return;
  container.innerHTML='';
  (lista||[]).forEach(x=>adicionarRemedioFichaEolo(x));
}

function adicionarRemedioFichaEolo(dados={}){
  const container=document.getElementById('listaRemedios');
  if(!container) return;
  const linha=document.createElement('div');
  linha.className='remedio-ficha-linha lista-rem-ficha';
  linha.innerHTML=`
    <div><label>Medicamento</label><input class="remedio-ficha-nome" value="${escaparTexto(dados.nome||'')}" placeholder="Nome"></div>
    <div><label>Dose</label><input class="remedio-ficha-dose" value="${escaparTexto(dados.dose||'')}" placeholder="Dose"></div>
    <div><label>Horário</label><input class="remedio-ficha-horario" type="time" value="${escaparTexto(dados.horario||'')}"></div>
    <button type="button" class="botao-contorno" onclick="this.parentElement.remove()">Remover</button>`;
  container.appendChild(linha);
}

async function salvarRemediosFichaNoBancoEolo(ficha){
  if(!bancoEoloPronto || !pacienteBancoEolo) return;
  const lista=ficha.remediosDiarios||[];
  for(const remedio of lista){
    const existe=await eoloSupabase.from('medicamentos').select('id').eq('paciente_id',pacienteBancoEolo.id).eq('nome',remedio.nome).limit(1).maybeSingle();
    if(existe.error) continue;
    if(!existe.data){
      const r=await eoloSupabase.from('medicamentos').insert({paciente_id:pacienteBancoEolo.id,nome:remedio.nome,classificacao:'uso diário',dados:remedio});
      if(r.error) console.error('Erro ao salvar medicamento da ficha:',r.error);
    }
  }
}

async function finalizarFichaCadastroEolo(){
  const ficha=salvarFichaTemporariaCadastroEolo();
  if(!ficha.nome){
    parteFichaEolo=1;
    atualizarParteFichaEolo();
    mostrarAviso('Informe seu nome completo antes de finalizar.');
    return;
  }

  const botao=document.getElementById('btnFinalizarFicha');
  if(botao){botao.disabled=true;botao.textContent='Salvando...';}
  try{
    // Se já existe uma sessão (confirmação de email desativada), salva agora.
    if(eoloSupabase){
      const userAtual=await obterUsuarioBancoEolo();
      if(userAtual){
        const preparado=await prepararUsuarioBancoEolo();
        if(preparado){
          await salvarFichaNoBancoEolo(ficha);
          await salvarRemediosFichaNoBancoEolo(ficha);
          if(usuarioBancoEolo?.id){
            const conclusao=await eoloSupabase.from('usuarios').update({cadastro_concluido:true}).eq('id',usuarioBancoEolo.id);
            if(conclusao.error) console.error('Erro ao concluir cadastro:', conclusao.error);
            else usuarioBancoEolo={...usuarioBancoEolo,cadastro_concluido:true};
          }
        }
      }
    }

    const email=ficha.email || document.getElementById('email-cadastro')?.value.trim().toLowerCase() || '';
    salvarCadastroPendenteEolo(email,ficha);

    if(eoloSupabase){
      await eoloSupabase.auth.signOut();
    }
    usuarioAuthEolo=null;usuarioBancoEolo=null;pacienteBancoEolo=null;bancoEoloPronto=false;
    document.getElementById('tela-ficha-cadastro')?.classList.remove('ativa');
    document.getElementById('tela-login')?.classList.add('ativa');
    document.getElementById('email-login').value=email;
    document.getElementById('senha-login').value='';
    mostrarAviso('Cadastro concluído! Agora entre com seu email e senha.');
  }finally{
    if(botao){botao.disabled=false;botao.textContent='Finalizar cadastro';}
  }
}


/* =====================================================
   BOMBINHAS / BLE
   ===================================================== */

const UUID_SERVICO_EOLO='4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const UUID_ID_EOLO='beb5483e-36e1-4688-b7f5-ea07361b26a8';
const UUID_COUNT_EOLO='beb5483e-36e1-4688-b7f5-ea07361b26a9';
const UUID_EVENTS_EOLO='beb5483e-36e1-4688-b7f5-ea07361b26aa';
const UUID_UPTIME_EOLO='beb5483e-36e1-4688-b7f5-ea07361b26ab';
const UUID_CMD_EOLO='beb5483e-36e1-4688-b7f5-ea07361b26ac';

let dispositivoBluetoothEolo=null;
let servicoBluetoothEolo=null;
let caracteristicaIdBluetoothEolo=null;
let caracteristicaCountBluetoothEolo=null;
let caracteristicaEventsBluetoothEolo=null;
let caracteristicaUptimeBluetoothEolo=null;
let caracteristicaCmdBluetoothEolo=null;

let ocupadoBluetoothEolo=false;
let ultimaTentativaBluetoothEolo=0;
let desconexaoManualEolo=false;
let intervaloLeituraBluetoothEolo=null;

const EVENTO_PUFF_EOLO=1;
const EVENTO_CILINDRO_REMOVIDO_EOLO=2;
const EVENTO_CILINDRO_INSERIDO_EOLO=3;


/* ==================== CARREGAR BOMBINHAS ==================== */

function carregarBombinhasEolo(){
  bombinhasEolo=lerEolo(chaveBombinhasEolo(),[]);

  if(!Array.isArray(bombinhasEolo)){
    bombinhasEolo=[];
  }

  if(!bombinhasEolo.length){
    bombinhasEolo=[];
  }

  bombinhaAtualEolo=bombinhasEolo.find(b=>b.selecionada) || bombinhasEolo[0] || null;

  renderBombinhasEolo();
  renderUsoBombinhaEolo();
  renderHistoricoEolo();
}

function salvarBombinhasEolo(){
  salvarEolo(chaveBombinhasEolo(),bombinhasEolo);
  if(bancoEoloPronto) bombinhasEolo.forEach(b=>salvarBombinhaNoBancoEolo(b));
}

function criarBombinhaLocalEolo(nome='INALADOR-A-001'){
  const existente=bombinhasEolo.find(b=>b.nome===nome);

  if(existente){
    bombinhaAtualEolo=existente;
    bombinhasEolo.forEach(b=>b.selecionada=(b===existente));
    salvarBombinhasEolo();
    return existente;
  }

  const nova={
    id:'bombinha-'+Date.now(),
    nome:nome,
    paciente:nomesUsuarios.paciente,
    selecionada:true,
    conectado:false,
    puffsCartucho:0,
    totalPuffs:0,
    cartuchoAtual:1,
    totalCartuchos:1,
    cilindroPresente:true,
    validade:'',
    eventos:[],
    ultimoUptime:0,
    ultimaSincronizacao:null
  };

  bombinhasEolo.forEach(b=>b.selecionada=false);
  bombinhasEolo.push(nova);
  bombinhaAtualEolo=nova;
  salvarBombinhasEolo();

  return nova;
}

function selecionarBombinhaEolo(id){
  const encontrada=bombinhasEolo.find(b=>b.id===id);

  if(!encontrada) return;

  bombinhasEolo.forEach(b=>b.selecionada=false);
  encontrada.selecionada=true;
  bombinhaAtualEolo=encontrada;

  salvarBombinhasEolo();

  renderBombinhasEolo();
  renderUsoBombinhaEolo();
  renderHistoricoEolo();
}

function renderBombinhasEolo(){
  const select=document.getElementById('seletorBombinha');
  if(!select) return;

  select.innerHTML='';

  if(!bombinhasEolo.length){
    const option=document.createElement('option');
    option.value='';
    option.textContent='Nenhuma bombinha cadastrada';
    select.appendChild(option);
    return;
  }

  bombinhasEolo.forEach(b=>{
    const option=document.createElement('option');
    option.value=b.id;
    option.textContent=b.nome+(b.conectado?' • conectada':'');
    option.selected=b.selecionada;
    select.appendChild(option);
  });

  select.onchange=()=>selecionarBombinhaEolo(select.value);
}


/* ==================== MODAL ADICIONAR BOMBINHA ==================== */

function abrirModalBombinha(){
  const modal=document.getElementById('modal-bombinha');
  if(modal) modal.classList.add('aberto');
}

function fecharModalBombinha(){
  const modal=document.getElementById('modal-bombinha');
  if(modal) modal.classList.remove('aberto');
}

function adicionarBombinhaManualEolo(){
  const campo=document.getElementById('nomeNovaBombinha');
  const nome=campo?.value.trim() || 'INALADOR-A-001';

  criarBombinhaLocalEolo(nome);
  renderBombinhasEolo();
  renderUsoBombinhaEolo();
  renderHistoricoEolo();

  if(campo) campo.value='';

  fecharModalBombinha();
  mostrarAviso('Bombinha adicionada');
}


/* ==================== ATUALIZAÇÃO DO BOTÃO BLE ==================== */

function atualizarConexaoEolo(){
  const botoes=[
    document.getElementById('btnConectarBombinha'),
    document.getElementById('btnConectarBombinhaUso')
  ].filter(Boolean);

  botoes.forEach(botao=>{
    if(ocupadoBluetoothEolo){
      botao.textContent='Procurando...';
      botao.disabled=true;
      return;
    }

    botao.disabled=false;

    if(conectadoEolo){
      botao.textContent='Desconectar';
    }else{
      botao.textContent='Conectar à bombinha';
    }
  });

  const indicadores=document.querySelectorAll('.status-conexao-eolo');

  indicadores.forEach(indicador=>{
    indicador.textContent=conectadoEolo?'Conectada':'Desconectada';
    indicador.classList.toggle('conectado',conectadoEolo);
  });
}


/* ==================== COMANDOS BLE ==================== */

async function enviarComandoBluetoothEolo(comando){
  if(!caracteristicaCmdBluetoothEolo) return false;

  const dados=new TextEncoder().encode(comando);

  try{
    if(caracteristicaCmdBluetoothEolo.writeValueWithoutResponse){
      await caracteristicaCmdBluetoothEolo.writeValueWithoutResponse(dados);
    }else{
      await caracteristicaCmdBluetoothEolo.writeValue(dados);
    }

    return true;
  }catch(erro){
    console.error('Erro ao enviar comando BLE:',erro);
    return false;
  }
}


/* ==================== DECODIFICAR EVENTOS ==================== */

function decodificarEventosEolo(buffer){
  const bytes=new Uint8Array(buffer);
  const eventos=[];

  for(let i=0;i+4<bytes.length;i+=5){
    const tipo=bytes[i];

    const uptime=
      (bytes[i+1]) |
      (bytes[i+2]<<8) |
      (bytes[i+3]<<16) |
      (bytes[i+4]<<24);

    eventos.push({
      tipo:tipo,
      uptime:uptime>>>0
    });
  }

  return eventos;
}


function processarEventosBluetoothEolo(eventos){
  if(!bombinhaAtualEolo) return;

  eventos.forEach(evento=>{
    if(evento.tipo===EVENTO_PUFF_EOLO){
      bombinhaAtualEolo.puffsCartucho++;
      bombinhaAtualEolo.totalPuffs++;

      bombinhaAtualEolo.eventos.push({
        tipo:'puff',
        uptime:evento.uptime,
        data:new Date().toISOString()
      });
    }

    if(evento.tipo===EVENTO_CILINDRO_REMOVIDO_EOLO){
      bombinhaAtualEolo.cilindroPresente=false;

      bombinhaAtualEolo.eventos.push({
        tipo:'cilindro_removido',
        uptime:evento.uptime,
        data:new Date().toISOString()
      });
    }

    if(evento.tipo===EVENTO_CILINDRO_INSERIDO_EOLO){
      bombinhaAtualEolo.cilindroPresente=true;
      bombinhaAtualEolo.totalCartuchos++;

      bombinhaAtualEolo.puffsCartucho=0;

      bombinhaAtualEolo.eventos.push({
        tipo:'cilindro_inserido',
        uptime:evento.uptime,
        data:new Date().toISOString()
      });
    }
  });

  bombinhaAtualEolo.ultimaSincronizacao=new Date().toISOString();
  bombinhaAtualEolo.conectado=conectadoEolo;

  salvarBombinhasEolo();

  renderUsoBombinhaEolo();
  renderHistoricoEolo();
}


/* ==================== LEITURA BLE ==================== */

async function sincronizarBluetoothEolo(){
  if(!dispositivoBluetoothEolo || !dispositivoBluetoothEolo.gatt) return;
  if(!dispositivoBluetoothEolo.gatt.connected) return;
  if(!caracteristicaEventsBluetoothEolo) return;

  try{
    const leituraId=await caracteristicaIdBluetoothEolo.readValue();
    const decoder=new TextDecoder();

    const idDispositivo=decoder.decode(leituraId).replace(/\0/g,'').trim();

    if(idDispositivo){
      criarBombinhaLocalEolo(idDispositivo);
    }else if(!bombinhaAtualEolo){
      criarBombinhaLocalEolo('INALADOR-A-001');
    }

    const leituraCount=await caracteristicaCountBluetoothEolo.readValue();
    const quantidadeEventos=leituraCount.getUint8(0);

    const leituraEventos=await caracteristicaEventsBluetoothEolo.readValue();
    const eventos=decodificarEventosEolo(leituraEventos.buffer);

    const eventosNovos=eventos.slice(0,quantidadeEventos);

    console.log(`Leitura: ${quantidadeEventos} evento(s), ${eventosNovos.length} novo(s).`);

    processarEventosBluetoothEolo(eventosNovos);

    if(quantidadeEventos>0){
      await enviarComandoBluetoothEolo('LIMPAR');
    }

    if(caracteristicaUptimeBluetoothEolo){
      const uptime=await caracteristicaUptimeBluetoothEolo.readValue();

      if(bombinhaAtualEolo){
        bombinhaAtualEolo.ultimoUptime=uptime.getUint32(0,true);
        salvarBombinhasEolo();
      }
    }

    renderUsoBombinhaEolo();
    renderHistoricoEolo();

  }catch(erro){
    console.error('Erro na sincronização Bluetooth:',erro);
  }
}


/* ==================== LEITURA CONTÍNUA ==================== */

function iniciarLeituraContinuaBluetoothEolo(){
  clearInterval(intervaloLeituraBluetoothEolo);

  intervaloLeituraBluetoothEolo=setInterval(()=>{
    if(conectadoEolo && dispositivoBluetoothEolo?.gatt?.connected){
      sincronizarBluetoothEolo();
    }
  },2000);
}


/* ==================== CONEXÃO ==================== */

async function conectarBluetoothEolo(){
  if(ocupadoBluetoothEolo) return;

  if(!navigator.bluetooth){
    mostrarAviso('Seu navegador não suporta Bluetooth Web.');
    return;
  }

  ocupadoBluetoothEolo=true;
  desconexaoManualEolo=false;
  atualizarConexaoEolo();

  try{
    const agora=Date.now();

    if(agora-ultimaTentativaBluetoothEolo<1000){
      ocupadoBluetoothEolo=false;
      atualizarConexaoEolo();
      return;
    }

    ultimaTentativaBluetoothEolo=agora;

    dispositivoBluetoothEolo=await navigator.bluetooth.requestDevice({
      filters:[{services:[UUID_SERVICO_EOLO]}],
      optionalServices:[UUID_SERVICO_EOLO]
    });

    console.log('Bombinha encontrada:',dispositivoBluetoothEolo.name);

    dispositivoBluetoothEolo.addEventListener(
      'gattserverdisconnected',
      desconectouBluetoothEolo
    );

    const servidor=await dispositivoBluetoothEolo.gatt.connect();

    servicoBluetoothEolo=await servidor.getPrimaryService(UUID_SERVICO_EOLO);

    caracteristicaIdBluetoothEolo=await servicoBluetoothEolo.getCharacteristic(UUID_ID_EOLO);
    caracteristicaCountBluetoothEolo=await servicoBluetoothEolo.getCharacteristic(UUID_COUNT_EOLO);
    caracteristicaEventsBluetoothEolo=await servicoBluetoothEolo.getCharacteristic(UUID_EVENTS_EOLO);
    caracteristicaUptimeBluetoothEolo=await servicoBluetoothEolo.getCharacteristic(UUID_UPTIME_EOLO);
    caracteristicaCmdBluetoothEolo=await servicoBluetoothEolo.getCharacteristic(UUID_CMD_EOLO);

    conectadoEolo=true;
    ocupadoBluetoothEolo=false;

    atualizarConexaoEolo();

    await sincronizarBluetoothEolo();

    iniciarLeituraContinuaBluetoothEolo();

    mostrarAviso('Bombinha conectada');

  }catch(erro){
    console.error('Erro ao conectar à bombinha:',erro);

    conectadoEolo=false;
    ocupadoBluetoothEolo=false;

    atualizarConexaoEolo();

    if(erro.name!=='NotFoundError'){
      mostrarAviso('Não foi possível conectar à bombinha');
    }
  }
}
async function desconectarBluetoothEolo(){
  desconexaoManualEolo=true;

  clearInterval(intervaloLeituraBluetoothEolo);
  intervaloLeituraBluetoothEolo=null;

  try{
    if(dispositivoBluetoothEolo?.gatt?.connected){
      dispositivoBluetoothEolo.gatt.disconnect();
    }
  }catch(erro){
    console.error('Erro ao desconectar:',erro);
  }

  conectadoEolo=false;
  ocupadoBluetoothEolo=false;

  if(bombinhaAtualEolo){
    bombinhaAtualEolo.conectado=false;
    salvarBombinhasEolo();
  }

  atualizarConexaoEolo();
  renderUsoBombinhaEolo();

  mostrarAviso('Bombinha desconectada');
}


/* ==================== DESCONEXÃO AUTOMÁTICA ==================== */

function desconectouBluetoothEolo(){
  console.log('Bombinha desconectada.');

  conectadoEolo=false;

  if(bombinhaAtualEolo){
    bombinhaAtualEolo.conectado=false;
    salvarBombinhasEolo();
  }

  atualizarConexaoEolo();
  renderUsoBombinhaEolo();

  if(!desconexaoManualEolo){
    tentarReconectarBluetoothEolo();
  }
}

async function tentarReconectarBluetoothEolo(){
  if(desconexaoManualEolo) return;
  if(ocupadoBluetoothEolo) return;
  if(!dispositivoBluetoothEolo) return;

  try{
    ocupadoBluetoothEolo=true;
    atualizarConexaoEolo();

    const servidor=await dispositivoBluetoothEolo.gatt.connect();

    servicoBluetoothEolo=await servidor.getPrimaryService(UUID_SERVICO_EOLO);

    caracteristicaIdBluetoothEolo=
      await servicoBluetoothEolo.getCharacteristic(UUID_ID_EOLO);

    caracteristicaCountBluetoothEolo=
      await servicoBluetoothEolo.getCharacteristic(UUID_COUNT_EOLO);

    caracteristicaEventsBluetoothEolo=
      await servicoBluetoothEolo.getCharacteristic(UUID_EVENTS_EOLO);

    caracteristicaUptimeBluetoothEolo=
      await servicoBluetoothEolo.getCharacteristic(UUID_UPTIME_EOLO);

    caracteristicaCmdBluetoothEolo=
      await servicoBluetoothEolo.getCharacteristic(UUID_CMD_EOLO);

    conectadoEolo=true;
    ocupadoBluetoothEolo=false;

    atualizarConexaoEolo();

    await sincronizarBluetoothEolo();

    iniciarLeituraContinuaBluetoothEolo();

    console.log('Reconectado à bombinha.');

  }catch(erro){
    console.error('Falha ao reconectar:',erro);

    conectadoEolo=false;
    ocupadoBluetoothEolo=false;

    atualizarConexaoEolo();
  }
}


/* ==================== INICIALIZAÇÃO DO BLUETOOTH ==================== */

function iniciarBluetoothEolo(){
  const botoes=[
    document.getElementById('btnConectarBombinha'),
    document.getElementById('btnConectarBombinhaUso')
  ].filter(Boolean);

  botoes.forEach(botao=>{
    botao.onclick=()=>{
      if(conectadoEolo){
        desconectarBluetoothEolo();
      }else{
        conectarBluetoothEolo();
      }
    };
  });

  atualizarConexaoEolo();

  if(navigator.bluetooth && navigator.bluetooth.getDevices){
    navigator.bluetooth.getDevices()
      .then(dispositivos=>{
        if(dispositivos.length){
          console.log('Bombinhas previamente autorizadas:',dispositivos.length);
        }
      })
      .catch(erro=>{
        console.warn('Não foi possível listar dispositivos autorizados:',erro);
      });
  }
}


/* =====================================================
   RENDERIZAÇÃO — USO DA BOMBINHA
   ===================================================== */

function renderUsoBombinhaEolo(){
  const bombinha=bombinhaAtualEolo;

  const puffEl=document.getElementById('puffs-cartucho-atual');
  const cartuchoEl=document.getElementById('cartucho-em-uso');
  const cilindroEl=document.getElementById('status-cilindro');
  const validadeEl=document.getElementById('validade-restante');
  const nomeEl=document.getElementById('nome-bombinha-acompanhada');
  const statusEl=document.getElementById('status-bombinha');

  if(!bombinha){
    if(puffEl) puffEl.textContent='0';
    if(cartuchoEl) cartuchoEl.textContent='—';
    if(cilindroEl) cilindroEl.textContent='—';
    if(validadeEl) validadeEl.textContent='—';
    if(nomeEl) nomeEl.textContent='Nenhuma bombinha';
    if(statusEl) statusEl.textContent='Desconectada';
    return;
  }

  if(puffEl){
    puffEl.textContent=String(bombinha.puffsCartucho || 0);
  }

  if(cartuchoEl){
    cartuchoEl.textContent=
      `${bombinha.cartuchoAtual || 1} de ${bombinha.totalCartuchos || 1}`;
  }

  if(cilindroEl){
    cilindroEl.textContent=
      bombinha.cilindroPresente ? 'Inserido' : 'Removido';

    cilindroEl.classList.toggle(
      'status-ok',
      !!bombinha.cilindroPresente
    );

    cilindroEl.classList.toggle(
      'status-alerta',
      !bombinha.cilindroPresente
    );
  }

  if(validadeEl){
    validadeEl.textContent=
      bombinha.validade || 'Não informada';
  }

  if(nomeEl){
    nomeEl.textContent=bombinha.nome || 'Bombinha';
  }

  if(statusEl){
    statusEl.textContent=
      bombinha.conectado ? 'Conectada' : 'Desconectada';

    statusEl.classList.toggle(
      'conectado',
      !!bombinha.conectado
    );
  }

  const totalPuffsEl=document.getElementById('total-puffs-bombinha');
  if(totalPuffsEl){
    totalPuffsEl.textContent=String(bombinha.totalPuffs || 0);
  }

  const totalCartuchosEl=document.getElementById('total-cartuchos-bombinha');
  if(totalCartuchosEl){
    totalCartuchosEl.textContent=String(bombinha.totalCartuchos || 0);
  }

  const ultimoUptimeEl=document.getElementById('ultimo-uptime-bombinha');
  if(ultimoUptimeEl){
    ultimoUptimeEl.textContent=
      bombinha.ultimoUptime
      ? formatarUptimeEolo(bombinha.ultimoUptime)
      : '—';
  }

  atualizarIndicadoresBombinhaEolo(bombinha);
}


/* ==================== INDICADORES ==================== */

function atualizarIndicadoresBombinhaEolo(bombinha){
  const puffs=bombinha.puffsCartucho || 0;

  const barra=document.getElementById('barra-puffs-cartucho');

  if(barra){
    const limite=200;
    const percentual=Math.min(100,(puffs/limite)*100);

    barra.style.width=percentual+'%';
  }

  const texto=document.getElementById('texto-puffs-cartucho');

  if(texto){
    texto.textContent=`${puffs} puff${puffs===1?'':'s'} registrado${puffs===1?'':'s'}`;
  }
}


/* ==================== UPTIME ==================== */

function formatarUptimeEolo(segundos){
  segundos=Number(segundos)||0;

  const dias=Math.floor(segundos/86400);
  segundos%=86400;

  const horas=Math.floor(segundos/3600);
  segundos%=3600;

  const minutos=Math.floor(segundos/60);
  const seg=Math.floor(segundos%60);

  const partes=[];

  if(dias) partes.push(`${dias}d`);
  if(horas) partes.push(`${horas}h`);
  if(minutos) partes.push(`${minutos}min`);

  partes.push(`${seg}s`);

  return partes.join(' ');
}


/* =====================================================
   HISTÓRICO DE USO DA BOMBINHA
   ===================================================== */

function renderHistoricoEolo(){
  const lista=document.getElementById('lista-historico-bombinha');
  const vazio=document.getElementById('sem-historico-bombinha');

  if(!lista) return;

  lista.innerHTML='';

  if(!bombinhaAtualEolo){
    if(vazio) vazio.style.display='block';
    return;
  }

  const eventos=Array.isArray(bombinhaAtualEolo.eventos)
    ? [...bombinhaAtualEolo.eventos]
    : [];

  eventos.sort((a,b)=>{
    return new Date(b.data)-new Date(a.data);
  });

  if(!eventos.length){
    if(vazio) vazio.style.display='block';
    return;
  }

  if(vazio) vazio.style.display='none';

  eventos.forEach(evento=>{
    const item=document.createElement('div');
    item.className='item-historico-bombinha';

    const data=new Date(evento.data);

    let titulo='Evento da bombinha';
    let descricao='';

    if(evento.tipo==='puff'){
      titulo='Puff registrado';
      descricao='Uso da bombinha detectado automaticamente.';
    }

    if(evento.tipo==='cilindro_removido'){
      titulo='Cilindro removido';
      descricao='O cilindro/cartucho foi retirado da bombinha.';
    }

    if(evento.tipo==='cilindro_inserido'){
      titulo='Cilindro inserido';
      descricao='Um novo cilindro/cartucho foi inserido.';
    }

    item.innerHTML=`
      <div class="icone-historico"></div>

      <div class="conteudo-historico">
        <strong>${titulo}</strong>
        <span>${descricao}</span>
        <small>
          ${data.toLocaleDateString('pt-BR')}
          às
          ${data.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}
        </small>
      </div>
    `;

    lista.appendChild(item);
  });
}


/* =====================================================
   MODAL / EXPOSIÇÃO DA BOMBINHA
   ===================================================== */

function abrirExposicaoBombinhaEolo(){
  const modal=document.getElementById('modal-exposicao-bombinha');

  if(modal){
    modal.classList.add('aberto');
    renderExposicaoBombinhaEolo();
  }
}

function fecharExposicaoBombinhaEolo(){
  const modal=document.getElementById('modal-exposicao-bombinha');

  if(modal){
    modal.classList.remove('aberto');
  }
}

function renderExposicaoBombinhaEolo(){
  const bombinha=bombinhaAtualEolo;

  if(!bombinha) return;

  const nome=document.getElementById('exposicao-nome-bombinha');
  const puffs=document.getElementById('exposicao-puffs');
  const cartucho=document.getElementById('exposicao-cartucho');
  const cilindro=document.getElementById('exposicao-cilindro');
  const status=document.getElementById('exposicao-status');

  if(nome) nome.textContent=bombinha.nome;
  if(puffs) puffs.textContent=bombinha.puffsCartucho || 0;

  if(cartucho){
    cartucho.textContent=
      bombinha.cartuchoAtual || 1;
  }

  if(cilindro){
    cilindro.textContent=
      bombinha.cilindroPresente
      ? 'Inserido'
      : 'Removido';
  }

  if(status){
    status.textContent=
      bombinha.conectado
      ? 'Conectada'
      : 'Desconectada';
  }
}


/* =====================================================
   ATUALIZAÇÃO DA PÁGINA DE USO
   ===================================================== */

function atualizarPaginaUsoEolo(){
  renderBombinhasEolo();
  renderUsoBombinhaEolo();
  renderHistoricoEolo();
  atualizarConexaoEolo();
}


/* =====================================================
   BOTÕES DA FICHA
   ===================================================== */

function adicionarMedicamentoFicha(){
  adicionarMedicamentoFichaEolo();
}

function salvarFicha(){
  salvarFichaEolo();
}


/* =====================================================
   BOTÕES DE BOMBINHA
   ===================================================== */

function conectarBombinha(){
  if(conectadoEolo){
    desconectarBluetoothEolo();
  }else{
    conectarBluetoothEolo();
  }
}

function desconectarBombinha(){
  desconectarBluetoothEolo();
}


/* =====================================================
   CONTROLE DE FECHAMENTO DOS MODAIS
   ===================================================== */

document.addEventListener('click',function(evento){

  const modalMedicamento=document.getElementById('modal-medicamento');

  if(
    modalMedicamento &&
    evento.target===modalMedicamento
  ){
    fecharFormularioMedicamento();
  }

  const modalBombinha=document.getElementById('modal-bombinha');

  if(
    modalBombinha &&
    evento.target===modalBombinha
  ){
    fecharModalBombinha();
  }

  const modalExposicao=document.getElementById('modal-exposicao-bombinha');

  if(
    modalExposicao &&
    evento.target===modalExposicao
  ){
    fecharExposicaoBombinhaEolo();
  }

  const modalEmergencia=document.getElementById('modal-emergencia');

  if(
    modalEmergencia &&
    evento.target===modalEmergencia
  ){
    fecharEmergencia();
  }

});


/* =====================================================
   TECLA ESC
   ===================================================== */

document.addEventListener('keydown',function(evento){
  if(evento.key!=='Escape') return;

  fecharFormularioMedicamento();
  fecharModalBombinha();
  fecharExposicaoBombinhaEolo();
  fecharEmergencia();
  fecharMenu();
});


/* =====================================================
   NAVEGAÇÃO DO MENU
   ===================================================== */

document.addEventListener('DOMContentLoaded',function(){

  document.querySelectorAll('.link-menu').forEach(link=>{
    link.addEventListener('click',function(){
      const pagina=this.dataset.target;

      if(pagina){
        mostrarPagina(pagina);
      }
    });
  });

  document.querySelectorAll('[data-pagina]').forEach(botao=>{
    botao.addEventListener('click',function(){
      const pagina=this.dataset.pagina;

      if(pagina){
        mostrarPagina(pagina);
      }
    });
  });

  document.querySelectorAll('.botao-menu').forEach(botao=>{
    botao.addEventListener('click',abrirMenu);
  });

  document.getElementById('fundo-menu')?.addEventListener(
    'click',
    fecharMenu
  );

  const btnSair=document.getElementById('btn-sair');

  if(btnSair){
    btnSair.addEventListener('click',sairDoSite);
  }

  const btnAdicionarBombinha=document.getElementById('btnAdicionarBombinha');

  if(btnAdicionarBombinha){
    btnAdicionarBombinha.addEventListener(
      'click',
      abrirModalBombinha
    );
  }

  const btnExposicao=document.getElementById('btnExposicaoBombinha');

  if(btnExposicao){
    btnExposicao.addEventListener(
      'click',
      abrirExposicaoBombinhaEolo
    );
  }

  atualizarPaginaUsoEolo();
});


/* =====================================================
   ATUALIZAÇÃO AUTOMÁTICA DA INTERFACE
   ===================================================== */

setInterval(function(){

  if(
    document.getElementById('pagina-uso')?.classList.contains('active')
  ){
    renderUsoBombinhaEolo();
  }

},1000);


/* =====================================================
   EXPORTAÇÃO DOS DADOS LOCAIS
   ===================================================== */

function exportarDadosEolo(){
  const dados={
    ficha:lerEolo(chaveFichaEolo(),{}),
    bombinhas:lerEolo(chaveBombinhasEolo(),[]),
    registros:pegarRegistros(),
    medicamentos:pegarMedicamentos(),
    exportadoEm:new Date().toISOString()
  };

  const arquivo=new Blob(
    [JSON.stringify(dados,null,2)],
    {type:'application/json'}
  );

  const url=URL.createObjectURL(arquivo);

  const link=document.createElement('a');

  link.href=url;
  link.download='dados-eolo.json';

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);

  mostrarAviso('Dados exportados');
}


/* =====================================================
   LIMPAR DADOS LOCAIS
   ===================================================== */

function limparDadosLocaisEolo(){
  const confirmar=confirm(
    'Tem certeza que deseja apagar os dados locais do Éolo?'
  );

  if(!confirmar) return;

  localStorage.removeItem(chaveFichaEolo());
  localStorage.removeItem(chaveBombinhasEolo());
  localStorage.removeItem(chaveLocalUsuarioEolo('registros'));
  localStorage.removeItem(chaveLocalUsuarioEolo('medicamentos'));

  bombinhasEolo=[];
  bombinhaAtualEolo=null;

  renderBombinhasEolo();
  renderUsoBombinhaEolo();
  renderHistoricoEolo();
  mostrarMedicamentosNovos();
  mostrarRelatorios();

  mostrarAviso('Dados locais apagados');
}


/* =====================================================
   FUNÇÕES DE APOIO
   ===================================================== */

function formatarDataEolo(data){
  if(!data) return '—';

  const d=new Date(data);

  if(Number.isNaN(d.getTime())) return '—';

  return d.toLocaleDateString(
    'pt-BR',
    {
      day:'2-digit',
      month:'2-digit',
      year:'numeric'
    }
  );
}

function formatarDataHoraEolo(data){
  if(!data) return '—';

  const d=new Date(data);

  if(Number.isNaN(d.getTime())) return '—';

  return d.toLocaleDateString(
    'pt-BR'
  )+' às '+d.toLocaleTimeString(
    'pt-BR',
    {
      hour:'2-digit',
      minute:'2-digit'
    }
  );
}


/* =====================================================
   FINAL DA PARTE 3
   ===================================================== */

/* =====================================================
   PARTE FINAL — FUNÇÕES AUXILIARES DO ÉOLO
   ===================================================== */

/* Atualiza a data exibida no cabeçalho */
function atualizarDataEolo(){
  const elemento=document.getElementById('data-registro');

  if(!elemento) return;

  const hoje=new Date();

  elemento.textContent=hoje.toLocaleDateString(
    'pt-BR',
    {
      weekday:'long',
      day:'2-digit',
      month:'long'
    }
  );
}


/* =====================================================
   FAQ
   ===================================================== */

function abrirFaq(elemento){
  if(!elemento) return;

  elemento.classList.toggle('aberto');

  const resposta=elemento.querySelector('.resposta-faq');

  if(resposta){
    resposta.style.display=
      elemento.classList.contains('aberto')
      ? 'block'
      : 'none';
  }
}


/* =====================================================
   CONFIRMAÇÃO DE AÇÕES
   ===================================================== */

function confirmarAcao(mensagem,acao){
  const confirmado=confirm(mensagem);

  if(confirmado && typeof acao==='function'){
    acao();
  }
}


/* =====================================================
   FORMATAÇÃO DE NÚMEROS
   ===================================================== */

function numeroEolo(valor){
  const numero=Number(
    String(valor)
      .replace(',','.')
      .trim()
  );

  return Number.isFinite(numero)
    ? numero
    : 0;
}


/* =====================================================
   CONTROLE DO CONTADOR DE PUFFS
   ===================================================== */

function atualizarContadorPuffsEolo(){
  if(!bombinhaAtualEolo) return;

  const elemento=document.getElementById('contador-puffs');

  if(elemento){
    elemento.textContent=
      bombinhaAtualEolo.puffsCartucho || 0;
  }

  const total=document.getElementById('contador-total-puffs');

  if(total){
    total.textContent=
      bombinhaAtualEolo.totalPuffs || 0;
  }
}


/* =====================================================
   CONTROLE DO CARTUCHO
   ===================================================== */

function atualizarCartuchoEolo(){
  if(!bombinhaAtualEolo) return;

  const cartucho=document.getElementById('cartucho-atual');

  if(cartucho){
    cartucho.textContent=
      bombinhaAtualEolo.cartuchoAtual || 1;
  }

  const total=document.getElementById('total-cartuchos');

  if(total){
    total.textContent=
      bombinhaAtualEolo.totalCartuchos || 1;
  }
}


/* =====================================================
   CONTROLE DO CILINDRO
   ===================================================== */

function atualizarCilindroEolo(){
  if(!bombinhaAtualEolo) return;

  const elemento=document.getElementById('cilindro-status');

  if(!elemento) return;

  if(bombinhaAtualEolo.cilindroPresente){
    elemento.textContent='Inserido';
    elemento.classList.add('ok');
    elemento.classList.remove('alerta');
  }else{
    elemento.textContent='Removido';
    elemento.classList.remove('ok');
    elemento.classList.add('alerta');
  }
}


/* =====================================================
   VALIDADE
   ===================================================== */

function calcularValidadeEolo(){
  if(!bombinhaAtualEolo) return;

  const elemento=document.getElementById('validade-restante');

  if(!elemento) return;

  if(!bombinhaAtualEolo.validade){
    elemento.textContent='Não informada';
    return;
  }

  const validade=new Date(
    bombinhaAtualEolo.validade+'T23:59:59'
  );

  if(Number.isNaN(validade.getTime())){
    elemento.textContent='Não informada';
    return;
  }

  const hoje=new Date();

  const diferenca=validade.getTime()-hoje.getTime();

  const dias=Math.ceil(
    diferenca/(1000*60*60*24)
  );

  if(dias<0){
    elemento.textContent='Vencida';
  }else if(dias===0){
    elemento.textContent='Vence hoje';
  }else{
    elemento.textContent=
      `${dias} dia${dias===1?'':'s'}`;
  }
}


/* =====================================================
   ATUALIZAÇÃO COMPLETA DOS INDICADORES
   ===================================================== */

function atualizarIndicadoresEolo(){
  atualizarContadorPuffsEolo();
  atualizarCartuchoEolo();
  atualizarCilindroEolo();
  calcularValidadeEolo();
}


/* =====================================================
   SELEÇÃO DE BOMBINHA
   ===================================================== */

function atualizarBombinhaSelecionadaEolo(){
  if(!bombinhaAtualEolo) return;

  bombinhasEolo.forEach(bombinha=>{
    bombinha.selecionada=
      bombinha.id===bombinhaAtualEolo.id;
  });

  salvarBombinhasEolo();

  atualizarPaginaUsoEolo();
  atualizarIndicadoresEolo();
}


/* =====================================================
   CRIAÇÃO DE EVENTO LOCAL
   ===================================================== */

function registrarEventoLocalEolo(tipo,descricao){
  if(!bombinhaAtualEolo) return;

  if(!Array.isArray(bombinhaAtualEolo.eventos)){
    bombinhaAtualEolo.eventos=[];
  }

  bombinhaAtualEolo.eventos.push({
    tipo:tipo,
    descricao:descricao || '',
    uptime:0,
    data:new Date().toISOString()
  });

  salvarBombinhasEolo();

  renderHistoricoEolo();
}


/* =====================================================
   LIMPAR HISTÓRICO DA BOMBINHA
   ===================================================== */

function limparHistoricoBombinhaEolo(){
  if(!bombinhaAtualEolo) return;

  const confirmar=confirm(
    'Deseja realmente apagar o histórico desta bombinha?'
  );

  if(!confirmar) return;

  bombinhaAtualEolo.eventos=[];
  salvarBombinhasEolo();

  renderHistoricoEolo();

  mostrarAviso('Histórico apagado');
}


/* =====================================================
   RESETAR DADOS DA BOMBINHA
   ===================================================== */

function resetarDadosBombinhaEolo(){
  if(!bombinhaAtualEolo) return;

  const confirmar=confirm(
    'Deseja zerar os dados desta bombinha?'
  );

  if(!confirmar) return;

  bombinhaAtualEolo.puffsCartucho=0;
  bombinhaAtualEolo.totalPuffs=0;
  bombinhaAtualEolo.cartuchoAtual=1;
  bombinhaAtualEolo.totalCartuchos=1;
  bombinhaAtualEolo.eventos=[];

  salvarBombinhasEolo();

  renderUsoBombinhaEolo();
  renderHistoricoEolo();

  mostrarAviso('Dados da bombinha zerados');
}


/* =====================================================
   COMANDO ZERAR NO ESP32
   ===================================================== */

async function zerarBombinhaBluetoothEolo(){
  if(!conectadoEolo){
    mostrarAviso('Conecte a bombinha primeiro');
    return;
  }

  const sucesso=
    await enviarComandoBluetoothEolo('ZERAR');

  if(sucesso){
    if(bombinhaAtualEolo){
      bombinhaAtualEolo.puffsCartucho=0;
      bombinhaAtualEolo.totalPuffs=0;
      bombinhaAtualEolo.cartuchoAtual=1;
      bombinhaAtualEolo.totalCartuchos=1;
      bombinhaAtualEolo.eventos=[];
      salvarBombinhasEolo();
    }

    renderUsoBombinhaEolo();
    renderHistoricoEolo();

    mostrarAviso('Bombinha zerada');
  }else{
    mostrarAviso('Não foi possível zerar a bombinha');
  }
}


/* =====================================================
   DEFINIR VALIDADE
   ===================================================== */

function definirValidadeBombinhaEolo(){
  if(!bombinhaAtualEolo){
    mostrarAviso('Nenhuma bombinha selecionada');
    return;
  }

  const novaValidade=prompt(
    'Informe a validade do cartucho (AAAA-MM-DD):',
    bombinhaAtualEolo.validade || ''
  );

  if(novaValidade===null) return;

  bombinhaAtualEolo.validade=novaValidade.trim();

  salvarBombinhasEolo();

  renderUsoBombinhaEolo();
  calcularValidadeEolo();

  mostrarAviso('Validade atualizada');
}


/* =====================================================
   ATUALIZAÇÃO DA BOMBINHA AO RECEBER EVENTOS
   ===================================================== */

function atualizarDadosDepoisDoEventoEolo(){
  salvarBombinhasEolo();

  atualizarIndicadoresEolo();
  renderUsoBombinhaEolo();
  renderHistoricoEolo();
}


/* =====================================================
   LOG DO BLUETOOTH
   ===================================================== */

function registrarLogBluetoothEolo(mensagem){
  const log=document.getElementById('log-bluetooth');

  if(!log) return;

  const agora=new Date();

  const hora=
    agora.toLocaleTimeString(
      'pt-BR',
      {
        hour:'2-digit',
        minute:'2-digit',
        second:'2-digit'
      }
    );

  const linha=document.createElement('div');

  linha.textContent=
    `[${hora}] ${mensagem}`;

  log.appendChild(linha);

  while(log.children.length>100){
    log.removeChild(log.firstChild);
  }

  log.scrollTop=log.scrollHeight;
}


/* =====================================================
   ATUALIZAÇÃO DO LOG
   ===================================================== */

function limparLogBluetoothEolo(){
  const log=document.getElementById('log-bluetooth');

  if(log){
    log.innerHTML='';
  }
}


/* =====================================================
   MONITORAMENTO DO ESTADO BLUETOOTH
   ===================================================== */

function monitorarBluetoothEolo(){
  if(!dispositivoBluetoothEolo) return;

  if(
    dispositivoBluetoothEolo.gatt &&
    dispositivoBluetoothEolo.gatt.connected
  ){
    if(!conectadoEolo){
      conectadoEolo=true;

      if(bombinhaAtualEolo){
        bombinhaAtualEolo.conectado=true;
        salvarBombinhasEolo();
      }

      atualizarConexaoEolo();
    }
  }else{
    if(conectadoEolo){
      conectadoEolo=false;

      if(bombinhaAtualEolo){
        bombinhaAtualEolo.conectado=false;
        salvarBombinhasEolo();
      }

      atualizarConexaoEolo();
    }
  }
}


/* =====================================================
   MONITORAMENTO CONTÍNUO
   ===================================================== */

setInterval(function(){

  monitorarBluetoothEolo();

  if(conectadoEolo){
    atualizarIndicadoresEolo();
  }

},3000);


/* =====================================================
   BOTÃO PARA SINCRONIZAR MANUALMENTE
   ===================================================== */

function sincronizarAgoraEolo(){
  if(!conectadoEolo){
    mostrarAviso('Conecte a bombinha primeiro');
    return;
  }

  sincronizarBluetoothEolo()
    .then(()=>{
      registrarLogBluetoothEolo(
        'Sincronização manual concluída.'
      );
      mostrarAviso('Dados sincronizados');
    })
    .catch(erro=>{
      console.error(erro);

      registrarLogBluetoothEolo(
        'Erro na sincronização manual.'
      );

      mostrarAviso(
        'Erro ao sincronizar'
      );
    });
}


/* =====================================================
   ATUALIZAÇÃO DO STATUS NA PÁGINA
   ===================================================== */

function atualizarStatusVisualEolo(){
  const status=document.getElementById('status-conexao');

  if(!status) return;

  if(conectadoEolo){
    status.textContent='Conectada';
    status.classList.add('conectado');
    status.classList.remove('desconectado');
  }else{
    status.textContent='Desconectada';
    status.classList.remove('conectado');
    status.classList.add('desconectado');
  }
}


/* =====================================================
   INICIALIZAÇÃO FINAL
   ===================================================== */

document.addEventListener(
  'DOMContentLoaded',
  function(){

    atualizarDataEolo();

    carregarBombinhasEolo();

    atualizarPaginaUsoEolo();

    atualizarIndicadoresEolo();

    atualizarStatusVisualEolo();

    mostrarMedicamentosNovos();

    mostrarRelatorios();

  }
);


/* =====================================================
   QUANDO O USUÁRIO VOLTA PARA A ABA
   ===================================================== */

document.addEventListener(
  'visibilitychange',
  function(){

    if(document.visibilityState==='visible'){

      carregarBombinhasEolo();

      atualizarPaginaUsoEolo();

      atualizarIndicadoresEolo();

      if(
        conectadoEolo &&
        dispositivoBluetoothEolo?.gatt?.connected
      ){
        sincronizarBluetoothEolo();
      }
    }

  }
);


/* =====================================================
   PREVENÇÃO DE ERROS DE ELEMENTOS OPCIONAIS
   ===================================================== */

window.addEventListener(
  'error',
  function(evento){

    console.error(
      'Erro JavaScript:',
      evento.error || evento.message
    );

  }
);


/* =====================================================
   DISPONIBILIZA AS FUNÇÕES PARA O HTML
   ===================================================== */

window.mostrarPagina=mostrarPagina;
window.mostrarLogin=mostrarLogin;
window.mostrarCriarContaEolo=mostrarCriarContaEolo;
window.voltarParaLoginEolo=voltarParaLoginEolo;
window.mostrarSenhaCadastro=mostrarSenhaCadastro;
window.finalizarFichaCadastroEolo=finalizarFichaCadastroEolo;
window.adicionarRemedioFichaEolo=adicionarRemedioFichaEolo;
window.mostrarSenha=mostrarSenha;
window.entrarNoSite=entrarNoSite;
window.sairDoSite=sairDoSite;

window.abrirMenu=abrirMenu;
window.fecharMenu=fecharMenu;

window.abrirPasso=abrirPasso;
window.abrirEmergencia=abrirEmergencia;
window.fecharEmergencia=fecharEmergencia;

window.trocarAbaRemedios=trocarAbaRemedios;
window.abrirFormularioMedicamento=abrirFormularioMedicamento;
window.fecharFormularioMedicamento=fecharFormularioMedicamento;
window.salvarMedicamento=salvarMedicamento;
window.excluirMedicamento=excluirMedicamento;
window.mostrarTodosMedicamentos=mostrarTodosMedicamentos;

window.escolherHumor=escolherHumor;
window.marcarOpcao=marcarOpcao;
window.marcarUmaOpcao=marcarUmaOpcao;
window.mudarContador=mudarContador;
window.salvarRegistro=salvarRegistro;
window.excluirRegistro=excluirRegistro;

window.adicionarMedicamentoFicha=adicionarMedicamentoFicha;
window.salvarFicha=salvarFicha;

window.abrirModalBombinha=abrirModalBombinha;
window.fecharModalBombinha=fecharModalBombinha;
window.adicionarBombinhaManualEolo=adicionarBombinhaManualEolo;

window.conectarBombinha=conectarBombinha;
window.desconectarBombinha=desconectarBombinha;

window.abrirExposicaoBombinhaEolo=
  abrirExposicaoBombinhaEolo;

window.fecharExposicaoBombinhaEolo=
  fecharExposicaoBombinhaEolo;

window.sincronizarAgoraEolo=
  sincronizarAgoraEolo;

window.limparHistoricoBombinhaEolo=
  limparHistoricoBombinhaEolo;

window.resetarDadosBombinhaEolo=
  resetarDadosBombinhaEolo;

window.zerarBombinhaBluetoothEolo=
  zerarBombinhaBluetoothEolo;

window.definirValidadeBombinhaEolo=
  definirValidadeBombinhaEolo;

window.exportarDadosEolo=
  exportarDadosEolo;

window.limparDadosLocaisEolo=
  limparDadosLocaisEolo;

window.abrirFaq=abrirFaq;


/* =====================================================
   FIM DO SCRIPT.JS
   ===================================================== */