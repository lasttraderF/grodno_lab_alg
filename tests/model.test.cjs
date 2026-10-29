const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const storage=new Map();const box={window:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},console};vm.createContext(box);for(const f of ['catalog','model'])vm.runInContext(fs.readFileSync('src/'+f+'.js','utf8'),box);const m=box.window.LabModel;
// Isolated roles and one persistent genetic registration for the same animal.
m.db.role='manager';m.db.manager='manager';assert.equal(m.roleCan(m.find('other-manager')),false);m.db.role='lab';
const known=m.find('genetic').samples[0];assert.equal(m.find('origin').samples[0].number,known.number);
// Partial receipt preserves undeclared delivery state and subsequent registrations do not renumber accepted tubes.
const r=m.find('pcr-new');r.samples[0].state='accepted';r.samples[1].state='rejected';r.samples[1].reason='Повреждена';assert.equal(m.register(r),1);const first=r.samples[0].number,num=r.number;r.samples[2].state='accepted';m.register(r);assert.equal(r.number,num);assert.equal(r.samples[0].number,first);assert.equal(r.samples[11].state,'pending');assert.equal(r.samples[1].number,'');
// Payment prevents transfer; reception cannot impersonate an executor through model operations.
assert.throws(()=>m.transmit(m.find('ifa-hold')),/предоплат/);assert.throws(()=>m.receive(r),/исполнителю/);m.transmit(r);m.db.role='analyst';m.receive(r);assert.throws(()=>m.finish(r),/Заполните/);
for(const s of r.samples.filter(s=>s.work==='received'))for(const k of m.targets(m.db,r,s))s.results[k]='−';m.finish(r);assert.equal(m.baseStatus(r),'ready');
// Extra work waits for consent and retains the physical sample and registration.
m.db.role='lab';const s=r.samples[0],physical=s.physical;r.consents.push({id:'consent',status:'pending',samples:[s.id],note:'Уточнить тип'});assert.equal(s.tests.includes('TYPING'),false);m.consent(r,'consent',true);assert.equal(s.tests.includes('TYPING'),true);assert.equal(s.number,first);assert.equal(s.physical,physical);
// Issued snapshots survive later corrections and re-collection keeps the laboratory number.
const g=m.find('genetic');const doc=m.prepare(g),before=doc.snapshot.samples[0].label;assert.throws(()=>m.approve(g,doc),/руководителю/);m.db.role='head';m.approve(g,doc);g.samples[0].label='BY000000099999';assert.equal(doc.snapshot.samples[0].label,before);const gn=g.samples[0].number;m.replace(g,g.samples[0],'Повторный отбор');assert.equal(g.samples[0].number,gn);assert.equal(g.samples[0].physical,2);assert.ok(g.samples[0].resultHistory.length);assert.equal(doc.status,'approved');
// A failed invalid BY registration cannot consume sequence or application numbers.
const bad=m.request('bad','genetic','Учебный заказчик',1);bad.samples[0].state='accepted';bad.samples[0].label='BY123';m.db.requests.push(bad);const seq=m.db.seq.gen;m.db.role='lab';assert.throws(()=>m.register(bad),/12 цифр/);assert.equal(m.db.seq.gen,seq);assert.equal(bad.number,'');
console.log('Domain scenarios passed: role scope, partial intake, numbering, payment gate, result completeness, consent, immutable document snapshot, recollection, invalid identity.');
