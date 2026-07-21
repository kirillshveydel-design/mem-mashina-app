// SPA-переключение вкладок без перезагрузки страницы — состояние табов не теряется
(() => {
  const TABS = ['photo', 'video', 'templates', 'queue', 'notes'];

  function switchTab(name) {
    if (!TABS.includes(name)) return;
    TABS.forEach(t => {
      const section = document.getElementById('tab-' + t);
      if (section) section.style.display = (t === name) ? 'block' : 'none';
      const navBtn = document.querySelector(`nav [data-tab="${t}"]`);
      if (navBtn) navBtn.classList.toggle('active', t === name);
    });
    if (name === 'queue' && window.__memMachineQueue) window.__memMachineQueue.refresh();
    if (name === 'photo' && window.__memMachineCaptions) window.__memMachineCaptions.refreshChipCounts();
    if (name === 'notes' && window.__memMachineNotes) window.__memMachineNotes.refreshBankStatus();
  }

  document.querySelectorAll('nav [data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  window.mmSwitchTab = switchTab;
  switchTab('photo');
})();
