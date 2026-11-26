/* Dead Man's Draw packaged HTML loader and page-preview bridge. */
(()=>{'use strict';
 const script=document.getElementById('dd-standalone-manifest');
 if(!script)return;
 let pkg;try{pkg=JSON.parse(script.textContent)}catch(err){console.error('Invalid package manifest',err);return}
 const config=pkg.config||{}, images=pkg.backgrounds||{};
 if(config.title){document.title=config.title;const title=document.querySelector('#intro .huge');if(title)title.textContent=config.title;}
 const by=id=>document.getElementById(id);
 function setImg(id,uri){if(!uri)return;const el=by(id);if(!el)return;el.style.backgroundImage='linear-gradient(90deg,rgba(5,9,16,.78),rgba(5,9,16,.55)),url('+JSON.stringify(uri)+')';el.style.backgroundSize='cover';el.style.backgroundPosition='center';}
 setImg('intro',images.menu);setImg('settings',images.settings);setImg('results',images.telemetry);
 const api={settings:config,loaded:false,status:'Starting...',previewPage:null};window.DDPackagedGame=api;
 const status=document.createElement('div');status.id='ddPackagedStatus';status.style.cssText='position:fixed;bottom:10px;left:10px;z-index:200;max-width:min(86%,560px);background:#07151cef;border:1px solid #668f90;border-radius:7px;padding:8px 11px;color:#c5e9dd;font:12px/1.4 Segoe UI,Arial';status.textContent='Loading packaged Western scenes…';document.body.appendChild(status);
 const packagePrefsKey='dd_packaged_settings_'+String(config.projectKey||'western').replace(/[^a-z0-9_-]/gi,'_');
 const defaults={reload:'KeyR',fire:'Space',crouch:'KeyC'};
 const allowedCodes=new Set([...Array(26)].map((_,i)=>'Key'+String.fromCharCode(65+i)).concat([...Array(10)].map((_,i)=>'Digit'+i),['Space','Enter','ShiftLeft','ControlLeft','AltLeft','ArrowDown','ArrowUp','ArrowLeft','ArrowRight']));
 function readPrefs(){try{return JSON.parse(localStorage.getItem(packagePrefsKey)||'{}')||{}}catch(_){return {}}}
 let prefs=readPrefs();
 function normalizeBindings(map){const r={...defaults};for(const k of Object.keys(defaults)){if(allowedCodes.has(map?.[k]))r[k]=map[k]}return r;}
 prefs.bindings=normalizeBindings(prefs.bindings);
 window.DDExportBindings=prefs.bindings;
 function persist(){try{localStorage.setItem(packagePrefsKey,JSON.stringify(prefs))}catch(_){}}
 function label(code){return code.replace(/^Key/,'').replace(/^Digit/,'').replace('Space','SPACE')}
 if(config.showHitIndicator===false){const x=by('csHitHUD');if(x)x.style.display='none';}
 if(config.allowPlayerHitCustomize===false){for(const el of document.querySelectorAll('[id^="csHitSettings"],[id="csHitOptions"],[id="hitPrefsPanel"]'))el.style.display='none';}
 if(config.showObjectNames!==undefined){const cb=by('customShowObjectLabels');if(cb){cb.checked=!!config.showObjectNames;cb.dispatchEvent(new Event('change',{bubbles:true}));}}
 if(config.showGunArm===false&&window.DDWesternGunArm)window.DDWesternGunArm.enabled=false;
 if(config.showSettings===false){for(const id of ['settingsBtn','settingsBtnGame']){const e=by(id);if(e)e.style.display='none';}}
 if(config.showTelemetry===false){for(const id of ['toggleDetailsBtn','exportBtn']){const e=by(id);if(e)e.style.display='none';}}
 if(config.allowPlayerHitCustomize===false){const x=by('csHitSettings');if(x)x.style.display='none';}
 for(const id of ['customImportBtn','customJsonInput']){const x=by(id);if(x)x.style.display='none';} // The exported simple menu owns the optional JSON picker.
 if(config.showHUD===false){for(const id of ['topHUD','lowerHUD','sequenceHUD']){const hud=by(id);if(hud)hud.style.display='none';}}
 if(config.showKeyRebinding!==false){
   const panel=by('settings')?.querySelector('.screenPanel');
   if(panel){const wrap=document.createElement('section');wrap.id='ddPlayerBindings';wrap.style.cssText='border:1px solid #568680;border-radius:8px;padding:12px;margin:12px 0;background:#0a2128;color:#d8f1ec;font:12px/1.5 Segoe UI,Arial';
    const actions=['reload','fire',...(config.includeCrouch?['crouch']:[])];
    wrap.innerHTML='<div style="font-size:15px;font-weight:750;margin-bottom:7px">PLAYER KEY BINDINGS</div><p style="font-size:11px;margin:0 0 9px;color:#abc8c4">Choose a key, then Save. Mouse firing stays available.</p>';
    for(const k of actions){const row=document.createElement('div');row.style.cssText='display:flex;justify-content:space-between;align-items:center;gap:7px;margin:5px 0';const t=document.createElement('span');t.textContent=k.toUpperCase();const b=document.createElement('button');b.type='button';b.textContent=label(prefs.bindings[k]);b.addEventListener('click',()=>{b.textContent='PRESS KEY…';const capture=e=>{e.preventDefault();e.stopImmediatePropagation();window.removeEventListener('keydown',capture,true);if(allowedCodes.has(e.code)){prefs.bindings[k]=e.code;b.textContent=label(e.code)}else b.textContent=label(prefs.bindings[k]);};window.addEventListener('keydown',capture,true);});row.append(t,b);wrap.append(row);}
    const foot=document.createElement('div');foot.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-top:10px';
    const add=(txt,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=txt;b.onclick=fn;foot.append(b)};
    add('SAVE KEYS',()=>{persist();status.textContent='Key bindings saved.'});
    add('RESET DEFAULTS',()=>{prefs.bindings={...defaults};persist();wrap.querySelectorAll('button').forEach((b,i)=>{if(i<actions.length)b.textContent=label(prefs.bindings[actions[i]])})});
    add('EXPORT KEYS',()=>{const blob=new Blob([JSON.stringify({format:'dead-mans-draw-keybinds-v1',bindings:prefs.bindings},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Dead_Mans_Draw_Player_Keys.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
    const up=document.createElement('input');up.type='file';up.accept='.json,application/json';up.style.display='none';up.onchange=async()=>{try{const d=JSON.parse(await up.files[0].text());if(d.format!=='dead-mans-draw-keybinds-v1')throw Error('Not a keybind file');prefs.bindings=normalizeBindings(d.bindings);persist();wrap.querySelectorAll('button').forEach((b,i)=>{if(i<actions.length)b.textContent=label(prefs.bindings[actions[i]])});status.textContent='Key bindings loaded.';}catch(err){status.textContent='Key bindings not loaded: '+err.message}};
    add('LOAD KEYS',()=>up.click());wrap.append(foot,up);panel.append(wrap);
   }
 }
 // The earliest event listener is injected in HEAD, before the game's key handlers.
 if(config.showKeyRebinding!==false)window.__DDExportKeyBindings=prefs.bindings;
 if(config.showGunArm!==undefined&&window.DDWesternGunArm)window.DDWesternGunArm.enabled=!!config.showGunArm;
 if(config.showMenu===false&&by('intro'))by('intro').style.opacity='0.01';
 function previewPage(name){api.previewPage=name;for(const id of ['intro','settings','results']){const x=by(id);if(x)x.style.display='none';}const x=by(name==='menu'?'intro':name==='settings'?'settings':name==='telemetry'?'results':'intro');if(x)x.style.display='flex';status.style.display='block';status.textContent=name==='telemetry'?'PREVIEW: Actual results layout; values populate after gameplay.':name==='settings'?'PREVIEW: Packaged settings and background':name==='menu'?'PREVIEW: Packaged main menu and background':'PREVIEW';}
 window.addEventListener('message',e=>{if(e.data?.type==='dd-export-preview-page'){previewPage(e.data.page);}else if(e.data?.type==='dd-export-preview-live'){api.previewPage=null;for(const id of ['settings','results']){const x=by(id);if(x)x.style.display='none';}if(by('intro'))by('intro').style.display='flex';status.textContent='Live 3D test: click BEGIN CUSTOM JSON in the preview.';} });
 // GitHub Pages packaging only: restore the original data URIs expected by the engine.
 async function hydrateGithubAssets(value){
   const references=new Map();
   function scan(v){if(!v||typeof v!=='object')return;
     if(v.__ddGithubAsset){references.set(v.__ddGithubAsset,v.mime);return;}
     for(const x of Object.values(v))scan(x);
   }
   scan(value);const entries=Array.from(references);const decoded=new Map();let cursor=0,finished=0;
   async function worker(){while(cursor<entries.length){const [path,mime]=entries[cursor++];
     const res=await fetch(path);if(!res.ok)throw Error('Cannot load '+path+' (HTTP '+res.status+')');
     const blob=new Blob([await res.arrayBuffer()],{type:mime});
     const uri=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);});
     decoded.set(path,uri);status.textContent='Loading game assets '+(++finished)+' / '+entries.length+'…';
   }}
   await Promise.all(Array.from({length:Math.min(4,entries.length)},worker));
   function replace(v){if(!v||typeof v!=='object')return v;if(v.__ddGithubAsset)return decoded.get(v.__ddGithubAsset);
     for(const k of Object.keys(v))v[k]=replace(v[k]);return v;
   }return replace(value);
 }
 async function loadPackedScenes(){
   status.textContent='Loading included Western models and scenes…';
   const response=await fetch('data/scenes.json');if(!response.ok)throw Error('Cannot load scenes (HTTP '+response.status+')');
   return hydrateGithubAssets(await response.json());
 }
 function base64Bytes(b64){const raw=atob(b64);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)out[i]=raw.charCodeAt(i);return out}
 async function initialize(){try{
   const scenes=await loadPackedScenes();if(pkg.maskPack)await hydrateGithubAssets(pkg.maskPack);const num=scenes.length;if(!num)throw Error('No scenes were bundled');
   if(pkg.maskPack?.characters?.length&&window.CharMask&&window.__STRATIX_TEST__){const bank=window.__STRATIX_TEST__.masks.bank;
      await CharMask.installPackObject(pkg.maskPack,{bank,destination:'auto',install:e=>bank.set(e.slot,e),confirm:()=>true,prepare:async entries=>{for(const e of entries){if(e.glbModel)await window.CSZombieImporter?.prepareMaskEntry?.(e,true);}}});
   }
   if(pkg.audio&&pkg.audio.length&&window.CSStandaloneLoadPack){for(const pack of pkg.audio){const bytes=base64Bytes(pack.base64);await window.CSStandaloneLoadPack(new File([bytes],pack.name,{type:'application/zip'}))}}
   if(typeof window.CSStandaloneImport!=='function')throw Error('3D engine failed to initialize');
   // Direct import prevents a second 80MB JSON encode/decode during startup.
   const input={format:'combat-strategy-sticks-sequence-v1',scenes,name:'Packaged_Game.json'};
   const watch=setInterval(()=>{const txt=by('customJsonStatus')?.textContent||'';if(txt)status.textContent=txt.slice(0,220);},300);
   try{await window.CSStandaloneImport(input);}finally{clearInterval(watch);}
   const importText=by('customJsonStatus')?.textContent||'';
   if(!/^(READY:|CHALLENGE BY )/i.test(importText))throw Error(importText||'The 3D scene importer did not report READY.');
   window.CSStandaloneApplyOptions?.({lives:config.lives||1,showLivesSetting:!!config.showLivesSetting});
   api.loaded=true;api.status='READY';status.textContent='READY · '+num+' packaged scene(s) · models and audio prepared.';
   if(config.showMenu===false&&!pkg.preview){if(by('intro'))by('intro').style.opacity='1';by('startBtn')?.click();}
   if(pkg.preview)previewPage('menu');
   setTimeout(()=>{if(!pkg.preview&&api.loaded)status.style.display='none'},5000);
 }catch(err){api.status='ERROR: '+err.message;status.textContent='PACKAGE ERROR: '+err.message;console.error('Packaged game load',err);if(by('customJsonStatus'))by('customJsonStatus').textContent=api.status;}}
 if(document.readyState==='complete')initialize();else window.addEventListener('load',initialize,{once:true});
})();