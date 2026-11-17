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
