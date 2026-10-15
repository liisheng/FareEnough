import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import Database from 'better-sqlite3';
import Fastify from 'fastify';
import { setTestDb, closeDb } from '../../../backend/dist/db/connection.js';
import { runMigrations } from '../../../backend/dist/db/migrate.js';
import { workspaceRoutes } from '../../../backend/dist/routes/workspace.js';
import { runRoutes } from '../../../backend/dist/routes/runs.js';
import { createAutomaticReviews } from '../../../backend/dist/automatic-reviews.js';
import { ReplayModelProvider } from '../../../backend/dist/providers/replay-provider.js';
import { parseConfig } from '../../../backend/dist/config.js';

test('desktop intake, automatic review, evidence keyboard access, audit export and admin resolution',async({page})=>{
  const db=new Database(':memory:');runMigrations(db);setTestDb(db);
  const app=Fastify();let runner,calls=0;
  app.get('/health',async()=>({liveAvailable:true}));
  await app.register(runRoutes,{env:parseConfig({AI_MODE:'live',MODEL_PROVIDER:'adp',ADP_RIDER_APP_KEY:'test',ADP_DRIVER_APP_KEY:'test',ADP_JUDGE_APP_KEY:'test'}),onReady:r=>runner=r,
    liveProviderFactory:()=>({id:'browser-controlled',mode:'live',async generate(request){calls++;if(request.stage==='rider_rebuttal')throw Error('controlled technical failure');return new ReplayModelProvider().generate(request);}})});
  const queue=createAutomaticReviews(runner,{retryDelaysMs:[0,0]});await app.register(workspaceRoutes,{enqueueReview:queue.enqueue});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:3001/**',async route=>{
    const req=route.request();
    if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});return;}
    const response=await app.inject({method:req.method(),url:new URL(req.url()).pathname,headers:req.headers(),payload:req.postData()||undefined});
    await route.fulfill({status:response.statusCode,body:response.body,contentType:'application/json',headers:{'access-control-allow-origin':'*'}});
  });
  await page.route('http://127.0.0.1:3000/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    const file=path==='/'?'index.html':path.slice(1);
    try{await route.fulfill({body:await readFile(new URL('../../'+file,import.meta.url)),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404});}
  });
  try {
    await page.goto('http://127.0.0.1:3000/');
    await expect(page.locator('#trip')).toHaveValue(/^TRIP-/);
    await page.getByRole('button',{name:/No-show evidence/}).click();
    await expect(page.locator('#category')).toHaveValue('no-show');
    await expect(page.locator('#demo-message')).toContainText('No-show scenario prepared');
    await page.locator('#complaint').fill('I waited at the lobby and could not find the car.');
    await page.getByRole('button',{name:'Submit request'}).click();
    await expect(page.locator('#rider-cases button')).toHaveCount(1);
    await page.locator('#driver-link').click();
    await page.locator('#driver-account').fill('I waited at the pickup location and contacted the rider.');
    await page.getByRole('button',{name:'Submit my account',exact:true}).click();
    await page.locator('#support-link').click();
    await expect(page.getByRole('button',{name:'Retry AI review',exact:true})).toBeVisible();
    await expect(page.locator('#audit-panel [data-run-id]')).toHaveCount(3);
    expect(calls).toBe(9);
    await page.locator('#audit-panel summary').first().click();
    const citation=page.locator('#audit-panel button[data-citation="gps-005"]').first();
    await citation.focus();await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('#evidence-content')).toContainText('gps-005');
    await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(citation).toBeFocused();
    const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Download review summary'}).click();
    const download=await downloaded;expect(download.suggestedFilename()).toContain('-support.json');
    const exported=JSON.parse(await readFile(await download.path(),'utf8'));
    expect(exported.runs).toHaveLength(3);expect(exported.runs[0].artifacts.rider_brief).toBeTruthy();
    expect(JSON.stringify(exported)).not.toContain('systemPrompt');
    await page.reload();await expect(page.locator('#audit-panel [data-run-id]')).toHaveCount(3);expect(calls).toBe(9);
    await page.getByRole('button',{name:'Retry AI review',exact:true}).click();
    await expect(page.locator('#audit-panel [data-run-id]')).toHaveCount(4);expect(calls).toBe(12);
    await page.locator('#admin-link').click();
    await page.locator('#admin-rationale').fill('The records cannot establish a supported financial adjustment. Close without adjustment.');
    await page.getByRole('button',{name:'Submit final decision'}).click();
    await expect(page.getByRole('heading',{name:'Final admin decision'})).toBeVisible();
    await page.locator('#rider-link').click();
    await expect(page.locator('#rider-outcome')).toContainText('Admin decision');
    await expect(page.locator('#rider-outcome')).not.toContainText('Close without adjustment.');
    expect(errors).toEqual([]);
  } finally {await queue.close();await app.close();closeDb();}
});

test('mobile route and ERP journey shows the validated 325-cent result without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const db=new Database(':memory:');runMigrations(db);setTestDb(db);
  const app=Fastify();let runner,calls=0;
  app.get('/health',async()=>({liveAvailable:true}));
  await app.register(runRoutes,{env:parseConfig({AI_MODE:'live',MODEL_PROVIDER:'adp',ADP_RIDER_APP_KEY:'test',ADP_DRIVER_APP_KEY:'test',ADP_JUDGE_APP_KEY:'test'}),onReady:r=>runner=r,
    liveProviderFactory:()=>({id:'browser-route-controlled',mode:'live',async generate(request){calls++;return new ReplayModelProvider().generate(request);}})});
  const queue=createAutomaticReviews(runner,{retryDelaysMs:[0,0]});await app.register(workspaceRoutes,{enqueueReview:queue.enqueue});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:3001/**',async route=>{
    const req=route.request();
    if(req.method()==='OPTIONS'){await route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});return;}
    const response=await app.inject({method:req.method(),url:new URL(req.url()).pathname,headers:req.headers(),payload:req.postData()||undefined});
    await route.fulfill({status:response.statusCode,body:response.body,contentType:'application/json',headers:{'access-control-allow-origin':'*'}});
  });
  await page.route('http://127.0.0.1:3000/**',async route=>{
    const path=new URL(route.request().url()).pathname,file=path==='/'?'index.html':path.slice(1);
    try{await route.fulfill({body:await readFile(new URL('../../'+file,import.meta.url)),contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});}catch{await route.fulfill({status:404});}
  });
  try{
    await page.goto('http://127.0.0.1:3000/');
    await expect(page.locator('#trip')).toHaveValue(/^TRIP-/);
    await page.getByRole('button',{name:/Unsupported ERP/}).click();
    await expect(page.locator('#category')).toHaveValue('route');
    await expect(page.locator('#complaint')).toHaveValue(/separate ERP charge/);
    await page.getByRole('button',{name:'Submit request'}).click();
    await page.locator('#driver-link').click();
    await page.locator('#driver-account').fill('The rider approved the detour; please verify the ERP line independently.');
    await page.getByRole('button',{name:'Submit my account',exact:true}).click();
    await queue.idle();
    await page.locator('#support-link').click();
    await expect(page.getByRole('heading',{name:'Route and additional charge review'})).toBeVisible();
    await expect(page.getByRole('img',{name:/Reference and actual route comparison/})).toBeVisible();
    await expect(page.locator('#workspace')).toContainText('S$3.25');
    await expect(page.locator('#workspace')).toContainText('Deterministic confidence: 100%');
    await page.locator('#audit-panel details').first().locator('summary').click();
    const citation=page.locator('#audit-panel button[data-citation="fare-erp-001"]').first();
    await expect(citation).toBeVisible();
    await citation.focus();await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('fare-erp-001');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    expect(calls).toBe(5);expect(errors).toEqual([]);
  }finally{await queue.close();await app.close();closeDb();}
});
