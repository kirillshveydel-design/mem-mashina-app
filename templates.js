// Библиотека шаблонов — вкладка «Шаблоны» в SPA
(() => {
  const packGrid = document.getElementById('packGrid');
  const imgflipGrid = document.getElementById('imgflipGrid');
  const imgflipCard = document.getElementById('imgflipCard');
  const imgflipEmpty = document.getElementById('imgflipEmpty');
  const lemmyGrid = document.getElementById('lemmyGrid');
  const lemmyCard = document.getElementById('lemmyCard');
  const lemmyEmpty = document.getElementById('lemmyEmpty');
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

  const IMG_EXT_RE = /\.(jpg|jpeg|png|webp)(\?.*)?$/i;

  async function fetchJsonDirect(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  async function fetchJsonViaProxy(url) {
    const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
    const res = await fetch(proxyUrl);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const wrapper = await res.json();
    return JSON.parse(wrapper.contents);
  }

  async function fetchLemmyCommunity(community, limit) {
    const url = `https://lemmy.world/api/v3/post/list?community_name=${community}&sort=Hot&limit=${limit}`;
    try {
      return await fetchJsonDirect(url);
    } catch (e) {
      console.warn(`Lemmy c/${community} напрямую недоступен (${e.message}), пробую через allorigins`, e);
      return await fetchJsonViaProxy(url);
    }
  }

  async function loadLemmy() {
    lemmyCard.style.display = 'block';
    lemmyGrid.innerHTML = '';
    lemmyEmpty.style.display = 'none';
    statusText.textContent = 'Обновляю свежие тренды из Lemmy...';

    const seenUrls = new Set();
    const items = [];
    const communityCounts = {};

    for (const community of ['memes', '196']) {
      try {
        const data = await fetchLemmyCommunity(community, 40);
        const posts = data.posts || [];
        let countForCommunity = 0;
        for (const p of posts) {
          const post = p.post || {};
          const url = post.url && IMG_EXT_RE.test(post.url) ? post.url : null;
          if (!url || seenUrls.has(url)) continue;
          seenUrls.add(url);
          items.push({ name: post.name || '', url });
          countForCommunity++;
        }
        communityCounts[community] = countForCommunity;
      } catch (e) {
        console.warn(`Lemmy c/${community} недоступен (даже через allorigins)`, e);
        communityCounts[community] = 0;
      }
    }

    if (!items.length) {
      lemmyEmpty.style.display = 'block';
      lemmyEmpty.textContent = 'Lemmy сейчас недоступен (ни напрямую, ни через прокси) — показываю офлайн-пак и зал славы Imgflip.';
      statusText.textContent = 'Свежие тренды не загрузились.';
      return { total: 0, communityCounts };
    }

    items.forEach(it => {
      const div = document.createElement('div');
      div.className = 'tpl';
      div.innerHTML = `<img src="${it.url}" loading="lazy" alt="${it.name}"><div class="name">${it.name}</div>`;
      div.addEventListener('click', async () => {
        statusText.textContent = 'Открываю шаблон…';
        const dataUrl = await toDataURL(it.url);
        openInEditor(dataUrl);
      });
      lemmyGrid.appendChild(div);
    });

    statusText.textContent = `Свежих шаблонов: ${items.length} (c/memes: ${communityCounts.memes}, c/196: ${communityCounts['196']})`;
    return { total: items.length, communityCounts };
  }

  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadLemmy();
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
