// Admin panel for Gwiazdor. State lives in localStorage under STORAGE_KEY.
(function () {
  'use strict';

  const STORAGE_KEY = 'gwiazdor.v1';
  const REDRAW_QUESTION = 'Wszyscy dostaną nowe osoby i trzeba będzie wysłać wszystkie linki od nowa. Losować ponownie?';
  const $ = id => document.getElementById(id);

  let state;

  // ---- storage --------------------------------------------------------------

  function readStorage() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function showNotice(text) {
    const n = $('notice');
    n.textContent = text;
    n.hidden = !text;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      showNotice('Nie udało się zapisać danych w tej przeglądarce.');
    }
  }

  function newId() {
    return (crypto.randomUUID ? crypto.randomUUID() : 'p' + Date.now() + Math.random().toString(16).slice(2));
  }

  // ---- rendering ------------------------------------------------------------

  function renderSettings() {
    $('budget').value = state.budget;
    $('baseUrl').value = state.baseUrl;
  }

  function renderPeople() {
    const list = $('people');
    list.textContent = '';
    const tpl = $('personTpl');
    state.people.forEach((p, i) => {
      const row = tpl.content.firstElementChild.cloneNode(true);
      row.dataset.id = p.id;
      row.querySelector('.num').textContent = (i + 1) + '.';
      const name = row.querySelector('.name');
      const prefs = row.querySelector('.prefs');
      name.id = 'name-' + p.id;
      prefs.id = 'prefs-' + p.id;
      row.querySelectorAll('label')[0].htmlFor = name.id;
      row.querySelectorAll('label')[1].htmlFor = prefs.id;
      name.value = p.name;
      prefs.value = p.prefs;
      row.querySelector('.remove').setAttribute('aria-label', 'Usuń osobę ' + (i + 1));
      list.appendChild(row);
    });
    $('peopleEmpty').hidden = state.people.length > 0;
  }

  function currentErrors() {
    return SS.validateParticipants(state.people.map(p => p.name));
  }

  function renderErrors() {
    const ul = $('errors');
    ul.textContent = '';
    if (state.people.length < 2) return;
    currentErrors().forEach(msg => {
      const li = document.createElement('li');
      li.textContent = msg;
      ul.appendChild(li);
    });
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  function button(text, className, onClick) {
    const b = el('button', className, text);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }

  function renderDraw() {
    const box = $('draw');
    box.textContent = '';

    if (!SS.drawMatches(state)) {
      if (state.draw) {
        box.appendChild(el('div', 'notice',
          'Lista osób się zmieniła — wylosuj ponownie. Jeśli to pomyłka, przywróć poprzednie imię, a dotychczasowe losowanie wróci.'));
      }
      const ok = currentErrors().length === 0;
      const b = button('Losuj', 'primary', () => {
        if (state.draw && !confirm(REDRAW_QUESTION)) return;
        doDraw();
      });
      b.disabled = !ok;
      box.appendChild(b);
      if (!ok) box.appendChild(el('p', 'hint', 'Najpierw uzupełnij listę uczestników (co najmniej 3 osoby, każda z innym imieniem).'));
      return;
    }

    const noBase = !state.baseUrl;
    if (noBase) box.appendChild(el('div', 'notice', 'Uzupełnij „Adres strony” w ustawieniach.'));

    const list = el('div', 'pairs');
    state.people.forEach(p => {
      const giver = SS.normalizeName(p.name);
      const link = noBase ? '' : SS.linkFor(state, giver);
      const row = el('div', 'pair');
      row.dataset.giver = giver;

      const who = el('span', 'who');
      who.append(giver, el('span', 'arrow', '→'), state.draw[giver]);
      row.appendChild(who);

      const copied = state.copied[giver];
      if (copied && link && copied === link) row.appendChild(el('span', 'badge copied', 'skopiowany ✓'));
      else if (copied && link) row.appendChild(el('span', 'badge changed', 'zmieniony — wyślij ponownie'));

      const copyBtn = button('Kopiuj link', 'small copy', () => copyLink(giver, link));
      const openBtn = button('Otwórz', 'small', () => window.open(link, '_blank', 'noopener'));
      copyBtn.disabled = openBtn.disabled = noBase;
      const btns = el('span', 'btns');
      btns.append(copyBtn, openBtn);
      row.appendChild(btns);
      list.appendChild(row);
    });
    box.appendChild(list);

    const actions = el('div', 'actions');
    actions.appendChild(button('Losuj ponownie', '', () => {
      if (confirm(REDRAW_QUESTION)) doDraw();
    }));
    box.appendChild(actions);
    box.appendChild(el('p', 'hint',
      'Losowanie jest zapisane tylko w tej przeglądarce. Zrób kopię zapasową przyciskiem „Eksportuj” na dole strony.'));
  }

  function rowFor(giver) {
    return [...document.querySelectorAll('#draw .pair')].find(r => r.dataset.giver === giver);
  }

  function doDraw() {
    state.draw = SS.draw(state.people.map(p => p.name));
    state.copied = {};
    save();
    renderDraw();
  }

  function markCopied(giver, link) {
    state.copied[giver] = link;
    save();
    renderDraw();
  }

  function copyLink(giver, link) {
    const fallback = () => {
      markCopied(giver, link);
      const row = rowFor(giver);
      if (!row) return;
      const input = el('input', 'manual');
      input.type = 'text';
      input.readOnly = true;
      input.value = link;
      input.setAttribute('aria-label', 'Link dla ' + giver);
      row.appendChild(input);
      input.focus();
      input.select();
    };
    if (!navigator.clipboard || !navigator.clipboard.writeText) return fallback();
    navigator.clipboard.writeText(link).then(() => {
      markCopied(giver, link);
      const btn = rowFor(giver) && rowFor(giver).querySelector('.copy');
      if (btn) {
        btn.textContent = 'Skopiowano!';
        setTimeout(() => { btn.textContent = 'Kopiuj link'; }, 1500);
      }
    }, fallback);
  }

  function render() {
    renderSettings();
    renderPeople();
    renderErrors();
    renderDraw();
  }

  // Lighter refresh while typing, so inputs keep focus.
  function refreshAfterEdit() {
    save();
    renderErrors();
    renderDraw();
  }

  // ---- events ---------------------------------------------------------------

  $('budget').addEventListener('input', e => { state.budget = e.target.value; refreshAfterEdit(); });
  $('baseUrl').addEventListener('input', e => { state.baseUrl = e.target.value.trim(); refreshAfterEdit(); });

  $('people').addEventListener('input', e => {
    const row = e.target.closest('.person');
    if (!row) return;
    const person = state.people.find(p => p.id === row.dataset.id);
    if (!person) return;
    if (e.target.classList.contains('name')) person.name = e.target.value;
    if (e.target.classList.contains('prefs')) person.prefs = e.target.value;
    refreshAfterEdit();
  });

  $('people').addEventListener('click', e => {
    if (!e.target.classList.contains('remove')) return;
    const id = e.target.closest('.person').dataset.id;
    state.people = state.people.filter(p => p.id !== id);
    save();
    render();
  });

  $('addPerson').addEventListener('click', () => {
    const p = { id: newId(), name: '', prefs: '' };
    state.people.push(p);
    save();
    render();
    $('name-' + p.id).focus();
  });

  $('export').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gwiazdor-kopia.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  $('import').addEventListener('click', () => $('importFile').click());

  $('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    file.text().then(text => {
      const parsed = SS.parseState(text);
      if (text.trim() && JSON.stringify(parsed) === JSON.stringify(SS.defaultState())) {
        alert('Ten plik nie wygląda na kopię z panelu Gwiazdora.');
        return;
      }
      if (!parsed.baseUrl) parsed.baseUrl = state.baseUrl;
      state = parsed;
      save();
      render();
    });
  });

  $('clearAll').addEventListener('click', () => {
    if (!confirm('Usunąć wszystkie osoby i losowanie?')) return;
    const baseUrl = state.baseUrl;
    state = SS.defaultState();
    state.baseUrl = baseUrl;
    save();
    render();
  });

  // ---- start ----------------------------------------------------------------

  state = SS.parseState(readStorage());
  if (!state.baseUrl) state.baseUrl = SS.defaultBaseUrl(location.href);
  render();
})();
