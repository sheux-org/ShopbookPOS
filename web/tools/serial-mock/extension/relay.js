// Runs in the ISOLATED content-script world. Receives captured bytes from the
// MAIN-world inject.js via window.postMessage and forwards them to the render
// server. Content-script fetch to a host in host_permissions bypasses page CSP.
const SERVER = 'http://localhost:8930/print';

window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || d.source !== 'shopbook-serial-mock' || d.kind !== 'write') return;
  fetch(SERVER, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bytes: d.bytes }),
  }).catch((err) => console.warn('[serial-mock] relay failed (is the server running?)', err));
});
