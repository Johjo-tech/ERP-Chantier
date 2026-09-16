import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
p.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0,160)));
p.on('console', m => { if (m.type()==='error') console.log('  console:', m.text().slice(0,240)); });
p.on('response', async r => { if (r.status() >= 400 && /rest\/v1/.test(r.url())) {
  console.log('  HTTP', r.status(), r.url().split('/rest/v1/')[1]?.slice(0,60), '→', (await r.text().catch(()=>'')).slice(0,200)); } });
p.on('dialog', async d => { console.log('  [dialogue]', d.message().slice(0,90)); await d.accept(); });
await p.goto('http://localhost:4302/', { waitUntil: 'networkidle' });
if (await p.locator('input[type=email]').count()) {
  await p.fill('input[type=email]', process.env.TEST_USER_EMAIL);
  await p.fill('input[type=password]', process.env.TEST_USER_PASSWORD);
  await p.click('button[type=submit], button:has-text("Connexion")');
}
await p.waitForFunction(() => (document.getElementById('content')?.innerHTML||'').length > 100, { timeout: 90000 });
const bon = await p.evaluate(() => {
  const x = state.bonsCommande.find(b => b.numeroBC === '73916');
  return { id:x.id, adresse:x.adresse, adresseLocataire:x.adresseLocataire||'(vide)', cp:x.codePostal, ville:x.ville, numeroBC:x.numeroBC };
});
console.log('LE BON  :', JSON.stringify({adresse:bon.adresse.slice(0,40)+'…', adresseLocataire:bon.adresseLocataire, cp:bon.cp, ville:bon.ville}));
await p.evaluate((id) => transformerBonCommandeEnFacture(id, true), bon.id);
await p.waitForTimeout(2500);
const f = await p.evaluate(() => ({
  lieu: document.getElementById('f_adresseLocataire')?.value ?? '(champ absent)',
  cp: document.getElementById('f_codePostal')?.value ?? '(absent)',
  ville: document.getElementById('f_ville')?.value ?? '(absent)',
  ref: document.getElementById('f_refBonCommandeClient')?.value ?? '(CHAMP ABSENT)',
  locataire: document.getElementById('f_occupant')?.value ?? '',
}));
console.log('LA FACTURE :');
console.log('  Lieu d\'intervention :', JSON.stringify(f.lieu));
console.log('  Code postal / Ville  :', JSON.stringify(f.cp), '/', JSON.stringify(f.ville));
console.log('  N° de BC du client   :', JSON.stringify(f.ref));
console.log('  Locataire            :', JSON.stringify(f.locataire));
const ok = f.lieu === bon.adresse && f.cp === bon.cp && f.ville === bon.ville && f.ref === bon.numeroBC;
console.log(ok ? '✓ TOUT EST REMONTÉ' : '✗ il manque quelque chose');
await p.screenshot({ path: 'facture.png' });
// La référence se corrige-t-elle, et l'enregistrement la garde-t-il ?
await p.fill('#f_refBonCommandeClient', 'BC-CLIENT-CORRIGE');
await p.evaluate(() => saveFacture());
await p.waitForTimeout(4000);
console.log('après enregistrement :', await p.evaluate((bcId) => {
  const f = state.factures.find(x => x.bonCommandeId === bcId);
  const toast = document.getElementById('toastBox');
  return f
    ? { trouvee:true, numero:f.numero||'(sans n°)', ref:f.refBonCommandeClient, lieu:(f.adresseLocataire||'').slice(0,34)+'…', cp:f.codePostal, ville:f.ville, mode:f.modePaiement }
    : { trouvee:false, facturesTotal:state.factures.length, dernierToast:(toast?.textContent||'').slice(0,90) };
}, bon.id));
await b.close();
