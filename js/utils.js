// ═══════════════════════════════════════════════════════════
// utils.js — Utilitários partilhados
// Incluir em TODAS as páginas (depois dos SDKs Firebase, antes de auth.js)
// ═══════════════════════════════════════════════════════════

// ── Escape HTML ──────────────────────────────────────────
window.escHtml = function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;');
};

// ── Toast (notificação temporária) ───────────────────────
window.toast = function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
};

// ── Status de sincronização ──────────────────────────────
window.setStatus = function setStatus(msg, color) {
  const el = document.getElementById('syncStatus');
  if (el) {
    el.textContent = msg;
    el.style.color  = color || 'var(--muted)';
  }
};

// ── Formatação de datas ──────────────────────────────────

// "agora mesmo" / "5 min atrás" / "3h atrás" / "12 jan"
window.fmtShort = function fmtShort(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60000)    return 'agora mesmo';
  if (diff < 3600000)  return Math.floor(diff / 60000)  + ' min atrás';
  if (diff < 86400000) return Math.floor(diff / 3600000) + 'h atrás';
  return new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
};

// "12 de janeiro de 2025 às 14:30"
window.fmtDateFull = function fmtDateFull(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })
       + ' às '
       + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
};

// "12/01/2025"
window.fmtData = function fmtData(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// "12/01/2025 14:30"
window.fmtDataHora = function fmtDataHora(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
       + ' '
       + d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
};

// ── Modal de confirmação genérico ────────────────────────
// Substitui window.confirm() — não bloqueia o thread principal.
//
// Uso:
//   const confirmou = await window.confirmar('Eliminar esta tarefa?');
//   if (!confirmou) return;
//
// Ou com opções:
//   const confirmou = await window.confirmar({
//     titulo:  'Eliminar processo',
//     texto:   'Esta operação não pode ser desfeita.',
//     btnOk:   'Eliminar',
//     perigo:  true,   // botão OK fica vermelho
//   });

(function () {
  // Injetar CSS e HTML do modal uma única vez
  function injetarModalConfirm() {
    if (document.getElementById('_confirmModal')) return;

    const style = document.createElement('style');
    style.textContent = `
      #_confirmOverlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.3);z-index:9000;align-items:center;justify-content:center;}
      #_confirmOverlay.open{display:flex;}
      #_confirmModal{background:var(--surface,#fff);border:1px solid var(--border,#e2e2e8);border-radius:16px;padding:24px 26px;width:340px;max-width:90vw;box-shadow:0 12px 40px rgba(0,0,0,.18);font-family:'DM Mono',monospace;}
      #_confirmModal h3{font-family:'Manrope',sans-serif;font-weight:800;font-size:14px;letter-spacing:-.02em;margin:0 0 8px;}
      #_confirmModal p{font-size:11px;color:var(--muted,#8888a0);line-height:1.6;margin:0 0 18px;}
      #_confirmModal .cf-footer{display:flex;gap:8px;justify-content:flex-end;}
      #_confirmModal .cf-btn{border:none;border-radius:8px;font-family:'DM Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.09em;padding:9px 18px;cursor:pointer;transition:opacity .15s;}
      #_confirmModal .cf-btn:hover{opacity:.82;}
      #_confirmModal .cf-cancel{background:var(--surface2,#f7f7f9);color:var(--text,#1a1a22);border:1px solid var(--border,#e2e2e8);}
      #_confirmModal .cf-ok{background:var(--text,#1a1a22);color:#fff;}
      #_confirmModal .cf-ok.perigo{background:var(--red,#dc2626);}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = '_confirmOverlay';
    overlay.innerHTML = `
      <div id="_confirmModal">
        <h3 id="_confirmTitulo"></h3>
        <p  id="_confirmTexto"></p>
        <div class="cf-footer">
          <button class="cf-btn cf-cancel" id="_confirmCancelar">Cancelar</button>
          <button class="cf-btn cf-ok"     id="_confirmOk">Confirmar</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  window.confirmar = function confirmar(opcoes) {
    // Aceita string simples ou objecto com opções
    const cfg = typeof opcoes === 'string'
      ? { titulo: opcoes, texto: '', btnOk: 'Confirmar', perigo: false }
      : { titulo: '', texto: '', btnOk: 'Confirmar', perigo: false, ...opcoes };

    return new Promise(resolve => {
      injetarModalConfirm();

      document.getElementById('_confirmTitulo').textContent = cfg.titulo;
      document.getElementById('_confirmTexto').textContent  = cfg.texto;

      const btnOk = document.getElementById('_confirmOk');
      btnOk.textContent = cfg.btnOk;
      btnOk.classList.toggle('perigo', !!cfg.perigo);

      const overlay = document.getElementById('_confirmOverlay');
      overlay.classList.add('open');

      function fechar(resultado) {
        overlay.classList.remove('open');
        btnOk.replaceWith(btnOk.cloneNode(true));           // remove listeners
        document.getElementById('_confirmCancelar').replaceWith(
          document.getElementById('_confirmCancelar').cloneNode(true)
        );
        resolve(resultado);
      }

      document.getElementById('_confirmOk').addEventListener('click',      () => fechar(true));
      document.getElementById('_confirmCancelar').addEventListener('click', () => fechar(false));
      overlay.addEventListener('click', e => { if (e.target === overlay) fechar(false); });
    });
  };
})();

// ── Indicador de offline / reconnection ─────────────────
(function () {
  let banner = null;
  let hideTimer = null;

  const CSS = `
    #_offlineBanner {
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 9500;
      font-family: 'DM Mono', monospace; font-size: 11px; letter-spacing: .04em;
      padding: 9px 20px; text-align: center;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transform: translateY(100%); transition: transform .25s ease;
      pointer-events: none;
    }
    #_offlineBanner.show { transform: translateY(0); pointer-events: auto; }
    #_offlineBanner.offline { background: #d97706; color: #fff; }
    #_offlineBanner.online  { background: #16a34a; color: #fff; }
    html.dark #_offlineBanner.offline { background: #92400e; }
    html.dark #_offlineBanner.online  { background: #14532d; }
    ._ob-dot {
      width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,.8);
      flex-shrink: 0;
    }
    ._ob-dot.pulse { animation: obPulse 1.2s ease-in-out infinite; }
    @keyframes obPulse { 0%,100%{opacity:.3} 50%{opacity:1} }
  `;

  function injetar() {
    if (document.getElementById('_offlineBanner')) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    banner = document.createElement('div');
    banner.id = '_offlineBanner';
    document.body.appendChild(banner);
  }

  function mostrarOffline() {
    injetar();
    clearTimeout(hideTimer);
    banner.className = 'offline show';
    banner.innerHTML = '<span class="_ob-dot pulse"></span>Sem ligação — os dados podem não estar actualizados';
  }

  function mostrarOnline() {
    if (!banner) return; // nunca ficou offline, não há banner
    clearTimeout(hideTimer);
    banner.className = 'online show';
    banner.innerHTML = '<span class="_ob-dot"></span>Ligação restaurada';
    hideTimer = setTimeout(() => {
      banner.classList.remove('show');
    }, 2500);
  }

  window.addEventListener('offline', mostrarOffline);
  window.addEventListener('online',  mostrarOnline);

  // Estado inicial (ex: página carregada sem rede)
  if (!navigator.onLine) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mostrarOffline);
    } else {
      mostrarOffline();
    }
  }
})();
