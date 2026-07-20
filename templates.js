// Библиотека шаблонов — вкладка «Шаблоны» в SPA
(() => {
  const packGrid = document.getElementById('packGrid');
  const imgflipGrid = document.getElementById('imgflipGrid');
  const imgflipCard = document.getElementById('imgflipCard');
  const imgflipEmpty = document.getElementById('imgflipEmpty');
  const statusText = document.getElementById('statusText');
  const ownFileInput = document.getElementById('ownFileInput');

  function openInEditor(src) {
    window.mmSwitchTab('photo');
    window.__memMachine.loadImageFromSource(src);
  }

  async function toDataURL(url) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(blob);
      });
    } catch (e) {
      return url; // фолбэк: прямая ссылка (canvas может её не принять из-за CORS)
    }
  }

  async function loadOfflinePack() {
    try {
      const res = await fetch('templates-pack/metadata.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const items = await res.json();
      packGrid.innerHTML = '';
      items.forEach(it => {
        const div = document.createElement('div');
        div.className = 'tpl';
        const src = 'templates-pack/' + it.file;
        div.innerHTML = `<img src="${src}" loading="lazy" alt="${it.name}"><div class="name">${it.name}</div>`;
        div.addEventListener('click', () => openInEditor(src));
        packGrid.appendChild(div);
      });
    } catch (e) {
      console.warn('Офлайн-пак не загрузился', e);
      packGrid.innerHTML = '<div class="muted">Офлайн-пак не найден.</div>';
    }
  }

  async function loadImgflip() {
    imgflipCard.style.display = 'block';
    imgflipGrid.innerHTML = '';
    imgflipEmpty.style.display = 'none';
    statusText.textContent = 'Обновляю тренды из сети...';
    try {
      const res = await fetch('https://api.imgflip.com/get_memes');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data.success) throw new Error('imgflip success=false');
      const memes = data.data.memes.slice(0, 30);
      memes.forEach(m => {
        const div = document.createElement('div');
        div.className = 'tpl';
        div.innerHTML = `<img src="${m.url}" loading="lazy" alt="${m.name}"><div class="name">${m.name}</div>`;
        div.addEventListener('click', async () => {
          statusText.textContent = 'Открываю шаблон…';
          const dataUrl = await toDataURL(m.url);
          openInEditor(dataUrl);
        });
        imgflipGrid.appendChild(div);
      });
      statusText.textContent = `Обновлено: ${memes.length} шаблонов из сети`;
    } catch (e) {
      console.warn('Imgflip недоступен', e);
      imgflipEmpty.style.display = 'block';
      statusText.textContent = 'Не удалось обновить — показываю офлайн-пак ниже, он никуда не делся.';
    }
  }

  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadImgflip();
  });

  document.getElementById('ownImageBtn').addEventListener('click', () => ownFileInput.click());
  ownFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => openInEditor(ev.target.result);
    reader.readAsDataURL(file);
  });

  // По умолчанию показываем офлайн-пак — приложение работает без сети.
  // Обновление из Imgflip — по клику, бонусом.
  loadOfflinePack();
})();
