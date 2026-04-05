// ═══════════════════════════════════════════════════════════
// voz-ai.js — Módulo VOZ AI partilhado
//
// Incluir em páginas que usem entrada por voz (depois de auth.js):
//   <script src="voz-ai.js"></script>
//
// Cada página regista os seus tipos com window.VozAI.registarTipo()
// e abre o modal com window.VozAI.abrir(tipo).
//
// ── ADICIONAR UM NOVO TIPO ────────────────────────────────
//   VozAI.registarTipo('reclamacao', {
//     titulo:  'Nova reclamação por voz',
//     prompt:  `Analisa este texto e extrai dados para uma reclamação.
//               Responde APENAS com JSON.
//               Formato: {"nome":"...","periodo":"...","empresa":"..."}`,
//     labels:  { nome:'Nome', periodo:'Período', empresa:'Empresa' },
//     fullFields: ['periodo'],          // campos que ocupam coluna inteira
//     preencher(d) {                    // callback chamado ao confirmar
//       if (d.nome)    document.getElementById('fNome').value    = d.nome;
//       if (d.empresa) document.getElementById('fEmpresa').value = d.empresa;
//     },
//     simular(texto) {                  // fallback offline (sem API key)
//       return { nome: '', periodo: '', empresa: '' };
//     },
//   });
//
// ── API KEY ───────────────────────────────────────────────
//   window.VOZ_CLAUDE_API_KEY = 'sk-ant-...';  // definir antes de incluir
//   ou deixar vazio para usar simulação offline.
// ═══════════════════════════════════════════════════════════

(function () {

  // ── Injetar HTML do modal (uma única vez) ───────────────
  function injetarModal() {
    if (document.getElementById('vozModal')) return;

    const div = document.createElement('div');
    div.innerHTML = `
<div class="voz-modal-overlay" id="vozModal">
  <div class="voz-modal">
    <div class="voz-modal-header">
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
        <rect x="5" y="1" width="6" height="9" rx="3"/>
        <path d="M2 8c0 3.3 2.7 6 6 6s6-2.7 6-6"/>
        <path d="M8 14v2"/>
      </svg>
      <h3 id="vozModalTitulo">Preencher com voz</h3>
      <button class="voz-modal-close" onclick="VozAI.fechar()">×</button>
    </div>
    <div class="voz-modal-body">
      <div class="voz-mic-wrap">
        <button class="voz-mic-btn" id="vozMicBtn" onclick="VozAI.toggle()">
          <svg id="vozMicIcon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4">
            <rect x="5" y="1" width="6" height="9" rx="3"/>
            <path d="M2 8c0 3.3 2.7 6 6 6s6-2.7 6-6"/>
            <path d="M8 14v2"/>
          </svg>
        </button>
        <div class="voz-waves">
          <div class="voz-wave"></div><div class="voz-wave"></div><div class="voz-wave"></div>
          <div class="voz-wave"></div><div class="voz-wave"></div><div class="voz-wave"></div>
          <div class="voz-wave"></div>
        </div>
        <div class="voz-status" id="vozStatus">Clica para falar</div>
      </div>
      <div class="voz-transcript" id="vozTranscript">
        <span id="vozTranscriptFinal"></span>
        <span class="voz-transcript-interim" id="vozTranscriptInterim"></span>
      </div>
      <div class="voz-loading" id="vozLoading">
        <div class="voz-dots"><span></span><span></span><span></span></div>
        <p style="font-size:10px;color:var(--muted);margin-top:8px;letter-spacing:.05em;">A Claude está a interpretar…</p>
      </div>
      <div class="voz-fields" id="vozFields"></div>
      <div class="voz-actions" id="vozActions">
        <button class="voz-btn voz-btn-cancel" onclick="VozAI.fechar()">Cancelar</button>
      </div>
    </div>
  </div>
</div>`;
    document.body.appendChild(div.firstElementChild);

    // Fechar ao clicar no overlay e com Escape
    document.getElementById('vozModal').addEventListener('click', function (e) {
      if (e.target === this) VozAI.fechar();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') VozAI.fechar();
    });
  }

  // ── Helpers partilhados ─────────────────────────────────

  /**
   * Tenta fazer match de um valor devolvido pelo modelo com um ID de escritório
   * válido, ignorando maiúsculas, acentos e palavras extra.
   * Ex: "Lisboa (escritório)" → "lisboa"  |  "Porto" → "porto"
   */
  function normalizarEscritorio(valor) {
    if (!valor) return '';
    const lista = window.getEscritoriosSync ? window.getEscritoriosSync() : [];
    const limpar = s => s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remover acentos
      .replace(/[^a-z0-9]/g, ' ')                       // só letras e números
      .trim();
    const v = limpar(valor);
    // 1. match exacto no id
    const exacto = lista.find(e => e.id === v);
    if (exacto) return exacto.id;
    // 2. id contido no valor ou valor contido no id
    const parcial = lista.find(e => v.includes(limpar(e.id)) || limpar(e.id).includes(v));
    if (parcial) return parcial.id;
    // 3. match no nome do escritório
    const porNome = lista.find(e => v.includes(limpar(e.nome)) || limpar(e.nome).includes(v));
    if (porNome) return porNome.id;
    return '';
  }

  /**
   * Define um select pelo value, ignorando maiúsculas.
   */
  function setSelect(id, valor) {
    if (!valor) return;
    const sel = document.getElementById(id);
    if (!sel) return;
    const v = valor.toLowerCase().trim();
    const opt = [...sel.options].find(o => o.value.toLowerCase() === v);
    if (opt) sel.value = opt.value;
  }

  // ── Estado interno ──────────────────────────────────────
  let _tipoAtual    = null;
  let _tipos        = {};        // registo de tipos: { [nome]: config }
  let _rec          = null;
  let _gravando     = false;
  let _transcricao  = '';
  let _dadosAtuais  = null;

  // ── Helpers DOM ─────────────────────────────────────────
  const el = id => document.getElementById(id);

  // ── API pública: window.VozAI ───────────────────────────
  const VozAI = {

    /**
     * Regista um novo tipo de formulário para ser preenchido por voz.
     * @param {string} nome  - Chave única, ex: 'tarefa', 'admissao', 'reclamacao'
     * @param {object} cfg   - Configuração (ver cabeçalho do ficheiro)
     */
    registarTipo(nome, cfg) {
      _tipos[nome] = {
        titulo:     cfg.titulo     || 'Preencher com voz',
        prompt:     cfg.prompt     || '',
        labels:     cfg.labels     || {},
        fullFields: cfg.fullFields || [],
        preencher:  cfg.preencher  || (() => {}),
        simular:    cfg.simular    || (() => ({})),
      };
    },

    /**
     * Abre o modal para o tipo especificado.
     * @param {string} tipo - Nome registado com registarTipo()
     */
    abrir(tipo) {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        if (typeof window.toast === 'function') toast('A Web Speech API só funciona no Chrome ou Edge.');
        return;
      }
      if (!_tipos[tipo]) {
        console.warn('[VozAI] Tipo não registado:', tipo);
        return;
      }

      injetarModal();

      _tipoAtual   = tipo;
      _dadosAtuais = null;
      _transcricao = '';

      const cfg = _tipos[tipo];
      el('vozModalTitulo').textContent = cfg.titulo;
      el('vozTranscript').classList.remove('visible');
      el('vozFields').classList.remove('visible');
      el('vozFields').innerHTML = '';
      el('vozLoading').classList.remove('visible');
      el('vozTranscriptFinal').textContent    = '';
      el('vozTranscriptInterim').textContent  = '';
      el('vozStatus').textContent  = 'Clica para falar';
      el('vozStatus').className    = 'voz-status';
      el('vozMicBtn').classList.remove('recording');
      el('vozActions').innerHTML   = '<button class="voz-btn voz-btn-cancel" onclick="VozAI.fechar()">Cancelar</button>';
      el('vozModal').classList.remove('recording');
      el('vozModal').classList.add('open');
    },

    fechar() {
      if (_gravando) VozAI.parar();
      el('vozModal')?.classList.remove('open');
    },

    toggle() {
      if (_gravando) VozAI.parar();
      else VozAI.iniciar();
    },

    iniciar() {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      _rec = new SR();
      _rec.lang = 'pt-PT';
      _rec.continuous = true;
      _rec.interimResults = true;
      _transcricao = '';

      el('vozTranscript').classList.add('visible');
      el('vozTranscriptFinal').textContent   = '';
      el('vozTranscriptInterim').textContent = '';

      _rec.onstart = () => {
        _gravando = true;
        el('vozMicBtn').classList.add('recording');
        el('vozModal').classList.add('recording');
        el('vozStatus').textContent = 'A ouvir… (clica para parar)';
        el('vozStatus').className   = 'voz-status rec';
        el('vozMicIcon').innerHTML  = '<rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" stroke="none"/>';
      };

      _rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript;
          if (e.results[i].isFinal) _transcricao += t + ' ';
          else interim = t;
        }
        el('vozTranscriptFinal').textContent   = _transcricao;
        el('vozTranscriptInterim').textContent = interim;
      };

      _rec.onerror = () => VozAI.parar();
      _rec.onend   = () => { if (_gravando) _rec.start(); };
      _rec.start();
    },

    parar() {
      _gravando = false;
      if (_rec) { _rec.onend = null; _rec.stop(); }
      el('vozMicBtn').classList.remove('recording');
      el('vozModal').classList.remove('recording');
      el('vozStatus').textContent = 'Clica para falar';
      el('vozStatus').className   = 'voz-status';
      el('vozMicIcon').innerHTML  = '<rect x="5" y="1" width="6" height="9" rx="3"/><path d="M2 8c0 3.3 2.7 6 6 6s6-2.7 6-6"/><path d="M8 14v2"/>';
      const texto = _transcricao.trim();
      if (texto) VozAI._processar(texto);
    },

    async _processar(texto) {
      if (!_tipoAtual) return;
      const cfg    = _tipos[_tipoAtual];
      const apiKey = window.VOZ_CLAUDE_API_KEY || '';

      el('vozLoading').classList.add('visible');
      el('vozFields').classList.remove('visible');
      el('vozActions').innerHTML = '';

      try {
        let dados;
        if (!apiKey) {
          // Modo offline — usa o simulador do tipo
          await new Promise(r => setTimeout(r, 1400));
          dados = cfg.simular(texto);
        } else {
          const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 800,
              messages: [{ role: 'user', content: cfg.prompt + '\n\nTexto: "' + texto + '"' }]
            }),
          });
          const data = await resp.json();
          const raw  = data.content?.[0]?.text || '{}';
          dados = JSON.parse(raw.replace(/```json|```/g, '').trim());
        }
        _dadosAtuais = dados;
        VozAI._mostrarCampos(dados);
      } catch (e) {
        el('vozLoading').classList.remove('visible');
        el('vozStatus').textContent = 'Erro: ' + e.message;
        el('vozActions').innerHTML  = `
          <button class="voz-btn voz-btn-retry" onclick="VozAI._processar(_transcricao.trim())">Tentar novamente</button>
          <button class="voz-btn voz-btn-cancel" onclick="VozAI.fechar()">Cancelar</button>`;
      }
    },

    _mostrarCampos(dados) {
      if (!_tipoAtual) return;
      const cfg    = _tipos[_tipoAtual];
      const fields = el('vozFields');

      el('vozLoading').classList.remove('visible');
      fields.innerHTML = Object.entries(dados).map(([k, v]) => {
        if (!(k in cfg.labels)) return '';
        const empty = !v || v === '' || v === 'vazio';
        const full  = cfg.fullFields.includes(k);
        return `<div class="voz-field${full ? ' full' : ''}">
          <div class="voz-field-key">${cfg.labels[k]}</div>
          <div class="voz-field-val${empty ? ' empty' : ''}">${empty ? '—' : String(v)}</div>
        </div>`;
      }).join('');
      fields.classList.add('visible');

      el('vozActions').innerHTML = `
        <button class="voz-btn voz-btn-confirm" onclick="VozAI._confirmar()">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l3.5 3.5L13 4"/></svg>
          Preencher formulário
        </button>
        <button class="voz-btn voz-btn-retry" onclick="VozAI.toggle()">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8A6 6 0 1114 8"/><path d="M2 8V4H6"/></svg>
          Regravar
        </button>`;
    },

    _confirmar() {
      if (!_dadosAtuais || !_tipoAtual) return;
      _tipos[_tipoAtual].preencher(_dadosAtuais);
      VozAI.fechar();
      // Scroll para o formulário
      document.querySelector('.novo-pedido-panel, .form-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (typeof window.toast === 'function') toast('Formulário preenchido por voz ✓');
    },
  };

  // Expõe globalmente
  VozAI._transcricaoRef     = () => _transcricao;
  VozAI.normalizarEscritorio = normalizarEscritorio;
  VozAI.setSelect            = setSelect;

  window.VozAI = VozAI;

})();
