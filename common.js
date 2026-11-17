// Shared logic for the Gwiazdor pages. Pure functions, no DOM.
// Loaded with a classic <script> tag (ES modules do not work over file://).
(function () {
  'use strict';

  const SS = {};
  const KEY = new TextEncoder().encode('gwiazdor-2026');

  // ---- payload encoding ---------------------------------------------------

  // XOR with a fixed key. Obfuscation only: keeps names unreadable in the URL.
  SS._scramble = function (bytes) {
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ KEY[i % KEY.length];
    return out;
  };

  function toBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function fromBase64Url(s) {
    if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('bad characters');
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  SS.encodePayload = function (data) {
    const obj = { v: 1, g: data.g, r: data.r, p: data.p || '', b: data.b || '' };
    return toBase64Url(SS._scramble(new TextEncoder().encode(JSON.stringify(obj))));
  };

  SS.decodePayload = function (s) {
    try {
      const bytes = SS._scramble(fromBase64Url(s));
      const obj = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      if (!obj || typeof obj !== 'object' || obj.v !== 1) return null;
      if (typeof obj.g !== 'string' || !obj.g || typeof obj.r !== 'string' || !obj.r) return null;
      if (obj.p !== undefined && typeof obj.p !== 'string') return null;
      if (obj.b !== undefined && typeof obj.b !== 'string') return null;
      return { g: obj.g, r: obj.r, p: obj.p || '', b: obj.b || '' };
    } catch (e) {
      return null;
    }
  };

  // ---- participants and the draw -------------------------------------------

  SS.normalizeName = function (name) {
    return String(name == null ? '' : name).trim().replace(/\s+/g, ' ');
  };

  function nameKey(name) {
    return SS.normalizeName(name).toLocaleLowerCase('pl');
  }

  SS.validateParticipants = function (names) {
    const errors = [];
    const clean = names.map(SS.normalizeName);
    if (clean.length < 3) errors.push('Potrzeba co najmniej 3 osób.');
    if (clean.some(n => !n)) errors.push('Każda osoba musi mieć imię.');
    const seen = new Map();
    const reported = new Set();
    clean.forEach(n => {
      if (!n) return;
      const k = nameKey(n);
      if (seen.has(k) && !reported.has(k)) {
        errors.push('Imię „' + seen.get(k) + '” występuje więcej niż raz.');
        reported.add(k);
      } else if (!seen.has(k)) {
        seen.set(k, n);
      }
    });
    return errors;
  };

  function cryptoRandom() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 4294967296;
  }

  function shuffle(arr, random) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // Random derangement: giver -> recipient, nobody draws themselves.
  SS.draw = function (names, random) {
    const errors = SS.validateParticipants(names);
    if (errors.length) throw new Error(errors.join(' '));
    random = random || cryptoRandom;
    const givers = names.map(SS.normalizeName);
    let recipients;
    do {
      recipients = shuffle(givers.slice(), random);
    } while (recipients.some((n, i) => n === givers[i]));
    const result = {};
    givers.forEach((g, i) => { result[g] = recipients[i]; });
    return result;
  };

  // ---- links and admin state -----------------------------------------------

  SS.buildLink = function (baseUrl, encoded) {
    return String(baseUrl).split('#')[0].split('?')[0] + '#' + encoded;
  };

  SS.defaultBaseUrl = function (href) {
    let url;
    try { url = new URL(href); } catch (e) { return ''; }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.origin + url.pathname.replace(/[^/]*$/, '');
  };

  SS.defaultState = function () {
    return { budget: '', baseUrl: '', people: [], draw: null, copied: {} };
  };

  function isPlainObject(x) {
    return !!x && typeof x === 'object' && !Array.isArray(x);
  }

  function stringMap(x) {
    if (!isPlainObject(x)) return null;
    const out = {};
    for (const k of Object.keys(x)) {
      if (typeof x[k] !== 'string') return null;
      out[k] = x[k];
    }
    return out;
  }

  SS.parseState = function (json) {
    const state = SS.defaultState();
    let raw;
    try { raw = JSON.parse(json); } catch (e) { return state; }
    if (!isPlainObject(raw)) return state;
    if (typeof raw.budget === 'string') state.budget = raw.budget;
    if (typeof raw.baseUrl === 'string') state.baseUrl = raw.baseUrl;
    if (Array.isArray(raw.people)) {
      state.people = raw.people
        .filter(isPlainObject)
        .map((p, i) => ({
          id: typeof p.id === 'string' && p.id ? p.id : 'p' + i + '-' + Date.now(),
          name: typeof p.name === 'string' ? p.name : '',
          prefs: typeof p.prefs === 'string' ? p.prefs : '',
        }));
    }
    state.draw = stringMap(raw.draw);
    state.copied = stringMap(raw.copied) || {};
    return state;
  };

  SS.drawMatches = function (state) {
    if (!state.draw) return false;
    const names = state.people.map(p => SS.normalizeName(p.name)).sort();
    const keys = Object.keys(state.draw).sort();
    return names.length === keys.length && names.every((n, i) => n === keys[i]);
  };

  SS.linkFor = function (state, giver) {
    const g = SS.normalizeName(giver);
    const r = state.draw[g];
    const person = state.people.find(p => SS.normalizeName(p.name) === r);
    const payload = { g: g, r: r, p: person ? person.prefs.trim() : '', b: state.budget.trim() };
    return SS.buildLink(state.baseUrl, SS.encodePayload(payload));
  };

  window.SS = SS;
})();
