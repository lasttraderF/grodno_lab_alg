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

// One physical sample carries PCR, IFA and quantitative assignments through receipt and issuance.
m.db.role='manager';
const multi=m.request('mixed-inf','pcr','Учебный заказчик нескольких испытаний',1,'draft');
multi.samples[0].label='MIX-01';multi.samples[0].material='кровь';multi.commonTests=[m.types.pcr.code];
m.setDraftTypes(multi,['pcr','ifa','mastitis']);
assert.equal(multi.samples[0].material,'кровь');
assert.deepEqual(Array.from(m.requestTypes(multi)),['pcr','ifa','mastitis']);
assert.throws(()=>m.setDraftTypes(multi,[]),/хотя бы/);

multi.vaccineState='';assert.throws(()=>m.saveDraft(multi,true),/вакцинации/);
multi.vaccineState='unknown';multi.contactSameAsCollector=true;multi.collector='Учебный ветеринар';multi.contact='Прежний контакт';
multi.symptoms=['Диарея'];multi.hasOtherSymptoms=true;multi.otherSymptoms='Учебное дополнительное наблюдение';
const mixed=m.saveDraft(multi,true);assert.equal(mixed.contact,mixed.collector);assert.equal(mixed.otherSymptoms,multi.otherSymptoms);
m.db.role='lab';mixed.samples[0].state='accepted';m.register(mixed);const mixedNumber=mixed.samples[0].number;m.transmit(mixed);
m.db.role='analyst';m.receive(mixed);
for(const k of m.targets(m.db,mixed,mixed.samples[0]))if(m.testType(m.db,mixed,k.split('::')[0])!=='mastitis')mixed.samples[0].results[k]='−';
assert.throws(()=>m.finish(mixed),/Заполните/);
for(const k of m.targetsForType(mixed,mixed.samples[0],'mastitis'))mixed.samples[0].results[k]='~ 1,2×10^3';
assert.throws(()=>m.finish(mixed),/ВКО/);mixed.samples[0].control='valid';m.finish(mixed);
assert.equal(mixed.samples[0].number,mixedNumber);assert.equal(mixed.samples[0].physical,1);
m.db.role='lab';const mixedDoc=m.prepare(mixed);assert.ok(mixedDoc.number.endsWith('-ПЦР-ИФА'));assert.equal(mixedDoc.snapshot.samples[0].tests.length,3);

// SNP and origin keep their own completion rules alongside genotypes in one genetic request.
m.db.role='manager';const combo=m.request('mixed-gen','genetic','Учебная генетическая заявка',1,'draft');
m.setDraftTypes(combo,['genetic','snp','origin']);const gs=m.saveDraft(combo,true);
m.db.role='lab';gs.samples[0].state='accepted';m.register(gs);m.transmit(gs);m.db.role='analyst';m.receive(gs);
const gsample=gs.samples[0];for(const k of m.targetsForType(gs,gsample,'genetic'))gsample.results[k]='F';
assert.throws(()=>m.finish(gs),/SNP/);Object.assign(gsample.extraData,{chip:'Учебный чип',snp:'50000',validity:'.99'});
assert.throws(()=>m.finish(gs),/маркеры/);for(const marker of m.markers)gsample.results[marker]='100/104';
Object.assign(gsample.extraData,{motherDecision:'подтверждается',fatherDecision:'не определено'});m.finish(gs);
assert.equal(m.baseStatus(gs),'ready');
console.log('Mixed-assay scenarios passed: one sample/number, IFA information, quantitative control, contact inheritance, free-text symptoms, SNP and origin completeness.');

// Automatic ordinals are stable across deletion, page boundaries and registration.
m.db.role='manager';const auto=m.request('auto-ordinal','pcr','Учебная авто-нумерация',0,'draft');auto.autoNumbered=true;auto.commonTests=[m.types.pcr.code];auto.commonMaterial='кровь';auto.commonSpecies='КРС';
for(let i=0;i<51;i++)auto.samples.push(m.newDraftSample(auto));
assert.equal(auto.samples[0].label,'1');assert.equal(auto.samples[50].label,'51');
auto.samples.splice(49,1);auto.samples.pop();auto.samples.push(m.newDraftSample(auto));assert.equal(auto.samples.at(-1).ordinal,52);
const autoSaved=m.saveDraft(auto,true);assert.equal(autoSaved.samples.at(-1).label,'52');m.db.role='lab';autoSaved.samples.at(-1).state='accepted';m.register(autoSaved);assert.equal(autoSaved.samples.at(-1).label,'52');assert.ok(autoSaved.samples.at(-1).number.endsWith('и'));

// All seven kinds can be selected in one entry form; routing and numbering remain automatic.
m.db.role='manager';const all=m.request('all-kinds','pcr','Учебный полный набор',0,'draft');Object.assign(all,{autoNumbered:true,commonTests:[m.types.pcr.code],commonMaterial:'кровь',commonSpecies:'КРС',vaccineState:'unknown'});all.samples.push(m.newDraftSample(all));
m.setDraftTypes(all,Object.keys(m.types));assert.equal(all.selectedTypes.length,7);assert.equal(all.samples.length,2);assert.equal(all.samples[1].species,'продукция / объект');
assert.throws(()=>m.saveDraft(all,true),/номер животного/);all.samples[0].animalId='BY000000001001';all.samples[1].objectName='Учебное молоко';
const combinedDraft=m.saveDraft(all,false);assert.equal(m.requestTypes(combinedDraft).length,7);assert.equal(combinedDraft.relatedRequestIds,undefined);
const firstPart=m.saveDraft(combinedDraft,true),family=m.db.requests.filter(r=>r.familyId==='all-kinds');assert.equal(family.length,3);assert.equal(firstPart.relatedRequestIds.length,2);
const infPart=family.find(r=>r.dir==='inf'),genPart=family.find(r=>r.dir==='gen'&&r.type!=='product'),productPart=family.find(r=>r.type==='product');
assert.equal(infPart.samples[0].label,'1');assert.equal(genPart.samples[0].label,'BY000000001001');assert.equal(productPart.samples[0].label,'Учебное молоко');assert.equal(infPart.samples[0].sourceSampleId,genPart.samples[0].sourceSampleId);
assert.equal(m.requestTypes(infPart).length,3);assert.equal(m.requestTypes(genPart).length,3);assert.equal(m.requestTypes(productPart).length,1);
m.db.role='lab';for(const part of family){part.samples.forEach(s=>s.state='accepted');m.register(part)}
assert.ok(infPart.number.startsWith('И'));assert.ok(genPart.number.startsWith('Г'));assert.equal(genPart.samples[0].number,known.number);assert.notEqual(productPart.samples[0].number,genPart.samples[0].number);
assert.throws(()=>m.saveDraft(combinedDraft,true),/защищена/);
console.log('Unified selection scenarios passed: seven visible kinds, automatic routing, stable ordinals, preserved genetic identity and separate official numbering.');

// A mixed application reports every blocking field, including an error beyond page one.
m.db.role='manager';const invalid=m.request('validation','ifa','',51,'draft');
Object.assign(invalid,{autoNumbered:true,selectedTypes:['ifa','genetic'],vaccineState:''});
for(const [i,s] of invalid.samples.entries()){s.ordinal=i+1;s.label=String(i+1);s.tests=['3.1.4','GEN'];s.animalId='BY'+String(9000+i).padStart(12,'0')}
invalid.samples[50].animalId='BY123';invalid.samples[1].material='';
const beforeValidation=JSON.stringify(invalid),beforeCount=m.db.requests.length;
const errors=m.draftIssues(invalid,true);
assert.deepEqual(Array.from(errors,x=>x.field),['customer','vaccineState','material','animalId']);
const lastIdError=errors.find(x=>x.field==='animalId');assert.equal(lastIdError.index,50);assert.equal(lastIdError.ordinal,51);assert.equal(lastIdError.sampleId,invalid.samples[50].id);
assert.equal(JSON.stringify(invalid),beforeValidation);assert.throws(()=>m.saveDraft(invalid,true),/заказчика/);assert.equal(m.db.requests.length,beforeCount);
invalid.customer='Учебная проверка обязательных полей';invalid.samples[1].material='кровь';invalid.samples[50].animalId='BY000000009999';
assert.deepEqual(Array.from(m.draftIssues(invalid,true),x=>x.field),['vaccineState']);
assert.equal(m.draftIssues(invalid,false).length,0);assert.equal(m.saveDraft(invalid,false).status,'draft');
invalid.vaccineState='unknown';assert.equal(m.draftIssues(invalid,true).length,0);assert.equal(m.saveDraft(invalid,true).status,'sent');

// Missing assignments, missing samples and the empty kind selection are actionable too.
const noAssignments=m.request('no-assignments','pcr','Учебная заявка',1,'draft');noAssignments.samples[0].tests=[];
assert.ok(m.draftIssues(noAssignments).some(x=>x.field==='tests'&&x.sampleId===noAssignments.samples[0].id));
noAssignments.samples=[];noAssignments.selectedTypes=[];
assert.deepEqual(Array.from(m.draftIssues(noAssignments),x=>x.field),['types','sampleList']);
console.log('Draft validation scenarios passed: complete error list, no mutation on failure, precise sample location, conditional IFA requirement and incomplete-vaccination draft saving.');

// Intake records payment, preserves audit, and gates transfer and execution.
m.db.role='lab';const payment=m.request('payment-test','pcr','Учебная проверка оплаты',1,'registered');payment.samples[0].state='accepted';payment.samples[0].work='queued';
assert.equal(m.paymentState(payment),'not_required');assert.equal(m.setPayment(payment,'pending'),true);assert.equal(payment.hold,true);assert.throws(()=>m.transmit(payment),/оплат/);assert.equal(payment.samples[0].work,'queued');
assert.equal(payment.audit[0].before,'Предоплата не требуется');assert.equal(payment.audit[0].after,'Ожидается оплата');assert.equal(payment.audit[0].role,'lab');const paymentAudit=payment.audit.length;assert.equal(m.setPayment(payment,'pending'),false);assert.equal(payment.audit.length,paymentAudit);
m.db.role='manager';assert.throws(()=>m.setPayment(payment,'paid'),/приёмка/);assert.equal(m.paymentState(payment),'pending');m.db.role='lab';assert.throws(()=>m.setPayment(payment,'invalid'),/статус/);m.setPayment(payment,'paid');assert.equal(payment.hold,false);assert.equal(m.paymentState(payment),'paid');m.transmit(payment);assert.equal(payment.samples[0].work,'sent');m.setPayment(payment,'pending');m.db.role='analyst';assert.throws(()=>m.receive(payment),/приостановлена/);m.db.role='head';m.setPayment(payment,'paid');m.db.role='analyst';m.receive(payment);m.db.role='lab';m.setPayment(payment,'not_required');assert.equal(payment.hold,false);
const legacyPayment={hold:true};assert.equal(m.paymentState(legacyPayment),'pending');const cancelled=m.request('cancelled-payment','pcr','Учебный заказчик',1,'cancelled');assert.throws(()=>m.setPayment(cancelled,'paid'),/действующей/);
// Pasted rows can be previewed without mutation and append without replacing existing samples.
const pasted=m.request('pasted','pcr','Учебный заказчик',1,'draft');Object.assign(pasted,{autoNumbered:true,commonMaterial:'кровь',commonSpecies:'КРС',commonTests:[m.types.pcr.code]});m.numberSamples(pasted);const preservedSample=pasted.samples[0],pastedBefore=JSON.stringify(pasted);const text='телята\tсыворотка\nкоровы\t';assert.equal(m.parseSampleRows(pasted,text).length,2);assert.equal(JSON.stringify(pasted),pastedBefore);assert.equal(m.importSampleRows(pasted,text),2);assert.equal(pasted.samples[0],preservedSample);assert.deepEqual(Array.from(pasted.samples,s=>s.label),['1','2','3']);assert.equal(pasted.samples[2].material,'кровь');assert.equal(pasted.samples[1].tests[0],m.types.pcr.code);const afterPaste=JSON.stringify(pasted);assert.throws(()=>m.importSampleRows(pasted,'телята\tнеизвестный материал',true),/Строка 1/);assert.equal(JSON.stringify(pasted),afterPaste);m.importSampleRows(pasted,'быки\tкровь',true);assert.equal(pasted.samples.length,1);assert.equal(pasted.samples[0].label,'1');
const pastedGen=m.request('pasted-gen','genetic','Учебный заказчик',0,'draft');Object.assign(pastedGen,{autoNumbered:true,commonMaterial:'ушной выщип',commonSpecies:'КРС',commonTests:[m.types.genetic.code]});m.importSampleRows(pastedGen,'BY000000001123\tкоровы\tушной выщип');assert.equal(pastedGen.samples[0].animalId,'BY000000001123');assert.equal(pastedGen.samples[0].label,'1');assert.throws(()=>m.parseSampleRows(pastedGen,'\tкоровы\tкровь'),/номер/);
console.log('Payment and spreadsheet scenarios passed: intake permissions, pending/paid gate, audit, legacy state, append/replace, atomic invalid paste, genetic identity.');
