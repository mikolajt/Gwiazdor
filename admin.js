// Admin panel for Gwiazdor. State lives in localStorage under STORAGE_KEY.
(function () {
  'use strict';

  const STORAGE_KEY = 'gwiazdor.v1';
  const $ = id => document.getElementById(id);

  let state;
  let triedDraw = false;

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
    if (state.people.length < 2 && !triedDraw) return;
    currentErrors().forEach(msg => {
      const li = document.createElement('li');
      li.textContent = msg;
      ul.appendChild(li);
    });
  }

  function renderDraw() {
    // Filled in by the draw section (Task 6).
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

  // ---- start ----------------------------------------------------------------

  state = SS.parseState(readStorage());
  if (!state.baseUrl) state.baseUrl = SS.defaultBaseUrl(location.href);
  render();
})();
