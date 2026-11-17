// Minimal in-browser test harness. Open tests.html, or run ./run-tests.sh.
const _tests = [];
function test(name, fn) { _tests.push({ name, fn }); }
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error((msg ? msg + ': ' : '') + 'expected ' + e + ', got ' + a);
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'expected truthy'); }

// --- test helpers ---------------------------------------------------------
function atobSafe(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  return atob(b64 + '='.repeat((4 - b64.length % 4) % 4));
}
function rawEncode(obj) {
  const bytes = SS._scramble(new TextEncoder().encode(JSON.stringify(obj)));
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// --- Task 1: payload encoding ---------------------------------------------
test('roundtrip basic', () => {
  const d = { g: 'Anna', r: 'Tomek', p: 'książki sci-fi, kawa', b: '100 zł' };
  eq(SS.decodePayload(SS.encodePayload(d)), d);
});
test('roundtrip polish, emoji, newlines', () => {
  const d = { g: 'Łucja Żółć', r: 'Mikołaj', p: 'gry 🎲\nkawa ☕\n\nherbata', b: '' };
  eq(SS.decodePayload(SS.encodePayload(d)), d);
});
test('roundtrip long text', () => {
  const p = ('abc ąę\n').repeat(300);
  eq(SS.decodePayload(SS.encodePayload({ g: 'A', r: 'B', p, b: '50 zł' })).p, p);
});
test('missing p/b decode to empty strings', () => {
  eq(SS.decodePayload(SS.encodePayload({ g: 'A', r: 'B' })), { g: 'A', r: 'B', p: '', b: '' });
});
test('encoded is URL-safe', () => {
  ok(/^[A-Za-z0-9_-]+$/.test(SS.encodePayload({ g: 'Ż?&#=/+', r: 'ó', p: '<>"\'', b: '%' })));
});
test('recipient name not readable in link', () => {
  ok(!SS.encodePayload({ g: 'Anna', r: 'Tomek' }).includes('Tomek'));
  ok(!atobSafe(SS.encodePayload({ g: 'Anna', r: 'Tomek' })).includes('Tomek'));
});
test('decode rejects garbage', () => {
  ['', 'x', '!!!', 'abc$%', SS.encodePayload({ g: 'A', r: 'B' }).slice(0, -3)]
    .forEach(s => eq(SS.decodePayload(s), null, JSON.stringify(s)));
});
test('decode rejects wrong version and missing names', () => {
  eq(SS.decodePayload(rawEncode({ v: 2, g: 'A', r: 'B' })), null);
  eq(SS.decodePayload(rawEncode({ v: 1, g: '', r: 'B' })), null);
  eq(SS.decodePayload(rawEncode({ v: 1, g: 'A' })), null);
});

// --- Task 2: validation and draw ------------------------------------------
test('validate ok', () => eq(SS.validateParticipants(['Anna', 'Tomek', 'Ola']), []));
test('validate too few', () => ok(SS.validateParticipants(['A', 'B']).includes('Potrzeba co najmniej 3 osób.')));
test('validate empty name', () => ok(SS.validateParticipants(['A', ' ', 'C']).includes('Każda osoba musi mieć imię.')));
test('validate flags case/space duplicates', () =>
  eq(SS.validateParticipants(['Anna', ' anna ', 'Ola']), ['Imię „Anna” występuje więcej niż raz.']));
test('draw: nobody draws themselves, is a permutation (1000 runs)', () => {
  for (let i = 0; i < 1000; i++) {
    const names = ['A', 'B', 'C', 'D', 'E'].slice(0, 3 + (i % 3));
    const m = SS.draw(names);
    eq(Object.keys(m).sort(), [...names].sort());
    eq(Object.values(m).sort(), [...names].sort());
    names.forEach(n => ok(m[n] !== n));
  }
});
test('draw uses normalized names', () => {
  const m = SS.draw(['  Anna ', 'Tomek', 'Ola']);
  ok('Anna' in m && !('  Anna ' in m));
});
test('draw throws on invalid input', () => {
  let threw = false; try { SS.draw(['A', 'B']); } catch (e) { threw = true; } ok(threw);
});
test('draw varies', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(JSON.stringify(SS.draw(['A', 'B', 'C', 'D'])));
  ok(seen.size > 3);
});

// --- Task 3: links and admin state ----------------------------------------
test('buildLink strips query and hash', () =>
  eq(SS.buildLink('https://u.github.io/repo/?fbclid=1#old', 'XYZ'), 'https://u.github.io/repo/#XYZ'));
test('defaultBaseUrl https', () =>
  eq(SS.defaultBaseUrl('https://u.github.io/repo/admin.html?x=1#y'), 'https://u.github.io/repo/'));
test('defaultBaseUrl file', () => eq(SS.defaultBaseUrl('file:///D:/Repos/SecretSanta/admin.html'), ''));
test('parseState garbage → default', () => {
  eq(SS.parseState(null), SS.defaultState());
  eq(SS.parseState('{oops'), SS.defaultState());
  eq(SS.parseState('[1,2]'), SS.defaultState());
});
test('parseState fills missing fields', () =>
  eq(SS.parseState('{"budget":"50 zł"}'), Object.assign(SS.defaultState(), { budget: '50 zł' })));
const st = () => Object.assign(SS.defaultState(), {
  budget: ' 100 zł ', baseUrl: 'https://x/',
  people: [{ id: '1', name: 'Anna', prefs: ' kawa ' }, { id: '2', name: 'Tomek', prefs: '' }, { id: '3', name: 'Ola', prefs: 'gry' }],
  draw: { Anna: 'Tomek', Tomek: 'Ola', Ola: 'Anna' },
});
test('drawMatches true', () => ok(SS.drawMatches(st())));
test('drawMatches false after add/remove/rename', () => {
  const a = st(); a.people.push({ id: '4', name: 'Ewa', prefs: '' }); ok(!SS.drawMatches(a), 'add');
  const b = st(); b.people.pop(); ok(!SS.drawMatches(b), 'remove');
  const c = st(); c.people[0].name = 'Ania'; ok(!SS.drawMatches(c), 'rename');
  const d = st(); d.draw = null; ok(!SS.drawMatches(d), 'no draw');
});
test('drawMatches ignores prefs/budget edits and whitespace', () => {
  const s = st(); s.people[0].prefs = 'nowe'; s.budget = '200 zł'; s.people[1].name = ' Tomek '; ok(SS.drawMatches(s));
});
test('linkFor carries recipient prefs and trimmed budget', () => {
  const link = SS.linkFor(st(), 'Ola');
  ok(link.startsWith('https://x/#'));
  eq(SS.decodePayload(link.split('#')[1]), { g: 'Ola', r: 'Anna', p: 'kawa', b: '100 zł' });
});

// --- runner ---------------------------------------------------------------
(function run() {
  const list = document.getElementById('results');
  let failed = 0;
  for (const t of _tests) {
    const li = document.createElement('li');
    try { t.fn(); li.className = 'pass'; li.textContent = t.name; }
    catch (e) { failed++; li.className = 'fail'; li.textContent = t.name + ' — ' + e.message; }
    list.appendChild(li);
  }
  const s = document.getElementById('summary');
  s.textContent = failed ? 'FAIL ' + failed + '/' + _tests.length : 'PASS ' + _tests.length + '/' + _tests.length;
  s.className = failed ? 'fail' : 'pass';
})();
