window.bootProtectedPage({
  activePage: 'novo-modulo',
  moduleId: 'novo-modulo',
}, ({ profile, escritorio }) => {
  const status = document.getElementById('moduleStatus');
  const content = document.getElementById('moduleContent');

  status.textContent = 'Modulo inicializado.';
  content.innerHTML = `
    <div class="module-grid">
      <div><strong>Utilizador:</strong> ${window.escHtml(profile.nomeCompleto || profile.nome || profile.email || '-')}</div>
      <div><strong>Escritorio ativo:</strong> ${window.escHtml(window.nomeEscritorio ? window.nomeEscritorio(escritorio) : (escritorio || '-'))}</div>
      <div><strong>Podes gerir?</strong> ${window.temPermissao('modules.novo-modulo.manage') ? 'Sim' : 'Nao'}</div>
    </div>
  `;
});
