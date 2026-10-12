const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../scripts/app.js'),'utf8');

function boot(saved = new Map()) {
  const elements = new Map(), listeners = {}, exports = [];
  const element = key => {
    if (!elements.has(key)) elements.set(key,{value:'',innerHTML:'',textContent:'',checked:false,listeners:{},addEventListener(t,f){this.listeners[t]=f;},setAttribute(){},removeAttribute(){},setCustomValidity(s){this.validityMessage=s;},reportValidity(){},showModal(){},close(){}});
    return elements.get(key);
  };
  element('#trip').value='USER-TRIP-1';
  element('#category').value='no-show';
  element('#status-filter').value=element('#category-filter').value='all';
  const context = {document:{querySelector:element,addEventListener(t,f){listeners[t]=f;},createElement(){return {click(){}};}},localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},location:{hash:'#rider'},window:{addEventListener(){}},Blob:class {constructor(parts){exports.push(JSON.parse(parts.join('')));}},URL:{createObjectURL(){return 'blob:test';},revokeObjectURL(){}},setTimeout:f=>f()};
  vm.createContext(context);vm.runInContext(source,context);
  return {element,context,exports,saved,submit:id=>element(id).listeners.submit({preventDefault(){}}),click:dataset=>listeners.click({target:{closest:()=>({dataset})}})};
}

test('linked stakeholder accounts persist, stay separate in views/exports, and cannot be duplicated',()=>{
  const app=boot(), e=app.element;
  assert.match(e('#driver-cases').innerHTML,/No disputes awaiting your response/);
  e('#complaint').value='RIDER_PRIVATE: I was waiting at the pickup.';
  app.submit('#intake-form');
  const id=JSON.parse(app.saved.get('fareenough.requests.v1'))[0].id;
  assert.match(e('#rider-outcome').innerHTML,/Awaiting driver response/);
  assert.doesNotMatch(e('#driver-detail').innerHTML,/RIDER_PRIVATE/);
  e('#driver-account').value='   ';app.submit('#driver-form');
  assert.match(e('#driver-account').validityMessage,/10 and 2,000/);
  e('#driver-account').value='DRIVER_PRIVATE: <script>test</script> I waited near pickup.';
  app.submit('#driver-form');
  assert.match(e('#rider-outcome').innerHTML,/Both accounts received/);
  assert.doesNotMatch(e('#rider-outcome').innerHTML,/DRIVER_PRIVATE/);
  assert.match(e('#driver-detail').innerHTML,/&lt;script&gt;/);
  app.click({supportCase:id});
  assert.match(e('#workspace').innerHTML,/RIDER_PRIVATE/);
  assert.match(e('#workspace').innerHTML,/DRIVER_PRIVATE/);
  app.click({export:'rider'});app.click({export:'driver'});
  assert.doesNotMatch(JSON.stringify(app.exports[0]),/DRIVER_PRIVATE/);
  assert.doesNotMatch(JSON.stringify(app.exports[1]),/RIDER_PRIVATE/);
  app.submit('#intake-form');
  assert.equal(JSON.parse(app.saved.get('fareenough.requests.v1')).length,1);
  const reloaded=boot(app.saved);
  assert.match(reloaded.element('#driver-detail').innerHTML,/DRIVER_PRIVATE/);
  assert.match(reloaded.element('#rider-outcome').innerHTML,/Both accounts received/);
  reloaded.context.location.hash='#driver';vm.runInContext('renderView()',reloaded.context);
  assert.equal(reloaded.element('#driver-view').hidden,false);
  assert.equal(reloaded.element('#rider-view').hidden,true);
});

test('safety flag remains in human review after both accounts and refresh',()=>{
  const app=boot();app.element('#complaint').value='A safety concern needs a human reviewer.';app.element('#safety').checked=true;app.submit('#intake-form');
  app.element('#driver-account').value='My account is ready for human review.';app.submit('#driver-form');
  const reloaded=boot(app.saved);
  assert.match(reloaded.element('#driver-detail').innerHTML,/Human review required/);
  assert.match(reloaded.element('#rider-outcome').innerHTML,/Human review requested/);
});


test('empty startup has no seeded records; legacy narratives survive without invented trip metadata',()=>{
  const fresh=boot();
  assert.match(fresh.element('#rider-cases').innerHTML,/No requests submitted/);
  assert.match(fresh.element('#workspace').innerHTML,/No case selected/);
  const saved=new Map([['fareenough.requests.v1',JSON.stringify([{id:'LOCAL-123',type:'route',complaint:'Preserve my previously entered account.',driverAccount:'Preserve the driver account too.',status:'pending',filed:'Previously saved'}])]]);
  const migrated=boot(saved);
  assert.match(migrated.element('#rider-outcome').innerHTML,/Preserve my previously entered/);
  assert.match(migrated.element('#driver-detail').innerHTML,/Preserve the driver account/);
  assert.doesNotMatch([...['#rider-outcome','#driver-detail','#workspace'].map(id=>migrated.element(id).innerHTML)].join(''),/DEMO-10|S\$|EX-00|synthetic-route|organizer-disp/);
  migrated.click({export:'support'});
  assert.equal(migrated.exports[0].policy,null);
  assert.equal(migrated.exports[0].adjustmentCents,null);
});
