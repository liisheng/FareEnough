(function (global) {
  'use strict';

  const motion = global.Motion;
  const reduced = global.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  const animated = new WeakSet();
  const roleOrder = ['rider', 'driver', 'support', 'admin'];
  let previousRole = roleOrder.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'rider';

  function run(targets, keyframes, options = {}) {
    if (reduced || !targets || !motion?.animate) return null;
    return motion.animate(targets, keyframes, options);
  }

  function once(element, animation) {
    if (!element || animated.has(element)) return;
    animated.add(element);
    animation(element);
  }

  function animateRoleView() {
    const role = roleOrder.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'rider';
    const view = document.querySelector(`#${role}-view:not([hidden])`);
    if (!view || reduced) { previousRole = role; return; }
    const direction = roleOrder.indexOf(role) >= roleOrder.indexOf(previousRole) ? 1 : -1;
    run(view, {opacity:[0,1],x:[direction*34,0]}, {duration:.42,ease:[.22,1,.36,1]});
    previousRole = role;
  }

  function animateScenario(button) {
    if (!button || reduced) return;
    run(button, {scale:[1,.975,1.025,1],y:[0,2,-4,0]}, {duration:.48,ease:'easeOut'});
    const form = document.querySelector('.intake');
    run(form, {opacity:[.72,1],y:[10,0]}, {duration:.38,ease:'easeOut'});
  }

  function animateRoute(root) {
    const route = root.querySelector?.('.route-actual');
    if (!route || animated.has(route) || reduced || typeof route.getTotalLength !== 'function') return;
    animated.add(route);
    const length = route.getTotalLength();
    route.style.strokeDasharray = `${length}`;
    route.style.strokeDashoffset = `${length}`;
    run(route, {strokeDashoffset:[length,0]}, {duration:1.35,ease:[.22,1,.36,1],delay:.2});
    const reference = root.querySelector('.route-reference');
    if (reference) run(reference, {opacity:[0,.72,1]}, {duration:.65,ease:'easeOut'});
  }

  function animateAmount(root) {
    const amount = root.querySelector?.('.decision-grid > div:nth-child(3) strong');
    if (!amount || animated.has(amount) || reduced) return;
    const match = amount.textContent.match(/S\$([\d.]+)/);
    if (!match) return;
    animated.add(amount);
    const target = Number(match[1]);
    if (!Number.isFinite(target)) return;
    run(0,target,{duration:.8,ease:'easeOut',onUpdate:value=>{amount.textContent=`S$${value.toFixed(2)}`;}});
  }

  function animateNewContent(root = document) {
    const stagger = motion?.stagger ? motion.stagger(.075) : 0;
    const timeline = [...(root.querySelectorAll?.('.evidence-timeline li') || [])].filter(item=>!animated.has(item));
    if (timeline.length && !reduced) {
      timeline.forEach(item=>animated.add(item));
      run(timeline,{opacity:[0,1],y:[18,0]},{duration:.42,delay:stagger,ease:'easeOut'});
    }
    for (const item of root.querySelectorAll?.('.case-button:not([data-motion-ready])') || []) {
      item.dataset.motionReady='true';
      run(item,{opacity:[0,1],x:[-14,0],scale:[.985,1]},{duration:.32,ease:'easeOut'});
    }
    for (const item of root.querySelectorAll?.('.decision, .unavailable, .judge') || []) {
      once(item,element=>run(element,{opacity:[0,1],y:[24,0],scale:[.985,1]},{duration:.5,ease:[.22,1,.36,1]}));
    }
    for (const item of root.querySelectorAll?.('.route-finding') || []) {
      once(item,element=>run(element,{opacity:[0,1],x:[16,0]},{duration:.4,ease:'easeOut'}));
    }
    animateRoute(root);
    animateAmount(root);
  }

  function startAmbientMotion() {
    if (reduced) return;
    run('.motion-orb-one',{x:[0,18,-8,0],y:[0,-13,8,0],rotate:[0,9,-5,0]},{duration:9,repeat:Infinity,ease:'easeInOut'});
    run('.motion-orb-two',{x:[0,-14,10,0],y:[0,10,-12,0],rotate:[0,-8,6,0]},{duration:11,repeat:Infinity,ease:'easeInOut'});
  }

  function observeDynamicAreas() {
    if (!global.MutationObserver) return;
    const observer = new MutationObserver(records=>{
      const roots = new Set(records.map(record=>record.target.closest?.('#workspace, #rider-outcome, #driver-detail, #admin-detail, .case-list') || record.target));
      global.requestAnimationFrame(()=>roots.forEach(animateNewContent));
    });
    for (const area of document.querySelectorAll('#workspace, #rider-outcome, #driver-detail, #admin-detail, .case-list')) observer.observe(area,{childList:true,subtree:true});
  }

  function boot() {
    document.documentElement.classList.add(reduced?'motion-reduced':'motion-ready');
    startAmbientMotion();
    observeDynamicAreas();
    animateNewContent(document);
    global.addEventListener('hashchange',()=>global.requestAnimationFrame(animateRoleView));
    document.addEventListener('click',event=>{
      const scenario=event.target.closest?.('[data-scenario]');
      if(scenario)animateScenario(scenario);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();

  global.FareEnoughMotion = {animateRoleView,animateNewContent,animateScenario,reduced};
})(typeof window !== 'undefined' ? window : globalThis);
