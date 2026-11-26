
/* Combative Sticks / GLB Import - detachable textured sections, 2026-11-08.
   The auto-rig is approximate; a generated GLB is not a professionally
   weight-painted, watertight amputatable character. */
(function () {
  'use strict';
  const importer = window.CSZombieImporter = {};
  let B=null,panel=null,status=null,slotInput=null,scaleInput=null,flipInput=null;
  let activeObject=null;
  const objects=[];
  const maskAssets=new WeakMap(),pendingMasks=new WeakMap();
  const maskFor=e=>B?.entryFor(e);
  function assetFor(e){
    if(!B||!e||e.type==='dog'||e._maskRenderDisabled)return null;
    const slot=B.slotFor(e),entry=maskFor(e);
    if(entry?.glbModel){return maskAssets.get(entry)||null;}
    const direct=B.directSlots.get(slot);
    return direct?.asset||null;
  }
  importer.applies=e=>!!assetFor(e);
  function collectAsset(asset){
    if(!asset?.retired||asset.refs>0)return;
    if(asset.texture)B.gl.deleteTexture(asset.texture);
    asset.texture=null;
    for(const buffer of Object.values(asset.uvBuffers||{}))B.gl.deleteBuffer(buffer);
    asset.uvBuffers={};
  }
  importer.retireAsset=asset=>{if(asset){asset.retired=true;collectAsset(asset);}};
  importer.disposeMaskEntry=entry=>{
    pendingMasks.delete(entry);
    importer.retireAsset(maskAssets.get(entry));
    maskAssets.delete(entry);
  };
  importer.prepareMaskEntry=(entry,throwOnError=false)=>{
    if(!B||!entry.glbModel)return;
    const signature=JSON.stringify([entry.swap,entry.flipFrontBack,entry.sideTorsoOnly,entry.adjust,entry.res]);
    if(maskAssets.get(entry)?.signature===signature)return;
    const pending=pendingMasks.get(entry);
    if(pending?.signature===signature)return pending.work;
    const ticket={signature,work:null};
    pendingMasks.set(entry,ticket);
    ticket.work=(async()=>{
      try{
        const p=await CharMask.prepareImported(entry);
        if(pendingMasks.get(entry)!==ticket)return;
        const asset=maskAssets.get(entry)||{rest:p.rest,instances:new WeakMap(),material:entry.material,refs:0,uvBuffers:{}};
        asset.material=entry.material;
        // Build replacement texture before retiring the previous one.
        // A failed upload must not turn a successfully imported GLB grey.
        let replacement=null;
        if(p.data){B.uploadMask(p);replacement=p.glTex;}
        if(replacement){const previous=asset.texture;asset.texture=replacement;if(previous&&previous!==replacement)B.gl.deleteTexture(previous);}
        if(!p.data&&!asset.texture&&entry.glbModel?.imageBytes){
          // Embedded GLB texture fallback for unmasked material-only models.
          const blob=new Blob([entry.glbModel.imageBytes],{type:entry.glbModel.imageType||'image/png'});
          const bitmap=await createImageBitmap(blob);
          try{const size=Math.min(1024,B.gl.getParameter(B.gl.MAX_TEXTURE_SIZE));
            const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
            canvas.getContext('2d').drawImage(bitmap,0,0,size,size);
            const image=canvas.getContext('2d').getImageData(0,0,size,size);
            const texPacket={res:size,data:image.data};B.uploadMask(texPacket);asset.texture=texPacket.glTex;
          }finally{bitmap.close?.();}
        }
        asset.signature=signature;maskAssets.set(entry,asset);entry._glbReady=true;
        B.maskReady();
      }catch(err){entry._glbTextureError=String(err?.message||err);if(throwOnError)throw err;console.warn('Imported mask texture failed for '+entry.slot+':',err);}
      finally{if(pendingMasks.get(entry)===ticket)pendingMasks.delete(entry);}
    })();
    return ticket.work;
  };

  const {unpack,bake,PARTS,GB}=CharMask.GLB;
  function text(message, bad=false) {
    if (status) {status.textContent=message;status.style.color=bad?'#ffb6a8':'#b8f0d5';}
    if (bad) console.warn('Obese zombie importer: '+message);
  }

  async function textureFromGLB(data) {
    if(!data.imageBytes)return null;
    const gl=B.gl;
    const blob=new Blob([data.imageBytes],{type:data.imageType});
    let im=await createImageBitmap(blob);
    const max=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE));
    if(im.width>max||im.height>max){
      const ratio=Math.min(max/im.width,max/im.height),canvas=document.createElement('canvas');
      canvas.width=Math.floor(im.width*ratio);canvas.height=Math.floor(im.height*ratio);
      canvas.getContext('2d').drawImage(im,0,0,canvas.width,canvas.height);
      im.close();im=await createImageBitmap(canvas);
    }
    const tex=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    im.close();gl.bindTexture(gl.TEXTURE_2D,null);
    return tex;
  }

  async function loadFile(file,slot){
    if(!B)throw Error('Wait for the 3D player to initialize');
    const old=B.cast.get(slot);
    if(old&&!window.confirm('Replace '+(old.direct?'GLB':'mask')+' in slot '+slot+' ('+old.name+')?'))return;
    if(file.size>32*1024*1024)throw Error('Mannequin GLB exceeds 32 MB.');
    const scale=clamp(Number(scaleInput.value)||1.93,1.6,2.3),flip=flipInput.checked;
    text('Loading '+slot+' · '+file.name+' …');
    const data=unpack(await file.arrayBuffer());
    if(!data.singleMesh)throw Error('Use a GLB with one mesh and one material.');
    if(data.indices.length/3>170000)throw Error('Use a GLB below 170,000 triangles.');
    const rest=bake(data,scale,flip),texture=await textureFromGLB(data);
    const asset={rest,texture,instances:new WeakMap(),refs:0,uvBuffers:{}};
    if(B.cast.get(slot)!==old){importer.retireAsset(asset);throw Error('Slot '+slot+' changed while loading. Choose the GLB again.');}
    B.setDirect({slot,name:file.name,direct:true,data,asset,scale,flip});
    refreshSlot();
  }

  function makeStaticGeometry(data){
    const triangles=data.indices,P=new Float32Array(triangles.length*3),N=new Float32Array(P.length),uv=new Float32Array(triangles.length*2);
    for(let i=0;i<triangles.length;i++){
      const pi=triangles[i]*3,ui=triangles[i]*2,o=i*3;
      P[o]=data.positions[pi];P[o+1]=data.positions[pi+1];P[o+2]=data.positions[pi+2];
      N[o]=data.normals[pi];N[o+1]=data.normals[pi+1];N[o+2]=data.normals[pi+2];
      uv[i*2]=data.uvs[ui];uv[i*2+1]=data.uvs[ui+1];
    }
    const geo=B.makeGeo(P,N),gl=B.gl;
    geo.uvb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,geo.uvb);gl.bufferData(gl.ARRAY_BUFFER,uv,gl.STATIC_DRAW);
    return geo;
  }


  // v19: scene JSON embeds real, UV-textured room-prop GLBs. Every prop retains
  // its normal authorable primitive hitbox and the hospital-style shatter count.
  const sceneAssets=new Map(),sceneAssetPending=new Map();
  const sceneAssetDefinitions=new Map();
  const sceneAssetErrors=new Map();
  importer.preloadSceneAssets=async(scenes,report=()=>{})=>{
   // A file may reference GLBs from other scenes. Collect the definitions first.
   sceneAssetDefinitions.clear();
   const required=new Set();
   for(const sc of scenes||[])for(const o of sc.objects||[]){
    if(!o?.glbAssetId)continue;
    required.add(o.glbAssetId);
    if(o.glbData)sceneAssetDefinitions.set(o.glbAssetId,o);
   }
   const undefinedAssets=[...required].filter(id=>!sceneAssetDefinitions.has(id));
   if(undefinedAssets.length)throw Error('Full JSON is missing GLB data: '+undefinedAssets.join(', '));
   let finished=0;
   for(const id of required){
    if(sceneAssetErrors.has(id))sceneAssetErrors.delete(id);
    if(!sceneAssets.has(id)){
     const o=sceneAssetDefinitions.get(id);
     let job=sceneAssetPending.get(id);
     if(!job){job=sceneLoadAsset(o);sceneAssetPending.set(id,job);}
     await job;
    }
    if(!sceneAssets.has(id))throw Error('Cannot prepare Western model: '+id);
    report('PRELOADING WESTERN GLBs '+(++finished)+'/'+required.size+' · '+id);
    // Let progress paint and input events run between large texture transfers.
    await new Promise(resolve=>setTimeout(resolve,0));
   }
  };
  function sceneSubGLB(buffer){
    const dv=new DataView(buffer),jl=dv.getUint32(12,true),j=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jl)));
    const prims=j.meshes?.[0]?.primitives||[];
    if(prims.length<=1)return [buffer];
    const binp=20+jl,bl=dv.getUint32(binp,true),bin=new Uint8Array(buffer,binp+8,bl);
    const enc=new TextEncoder(),results=[];
    for(const prim of prims){
      const sub=JSON.parse(JSON.stringify(j));sub.meshes[0].primitives=[prim];
      const tex=sub.materials?.[prim.material]?.pbrMetallicRoughness?.baseColorTexture?.index;
      const img=tex===undefined?0:(sub.textures?.[tex]?.source||0);
      // Preserve image indices: second material may refer to another image.
      const body=enc.encode(JSON.stringify(sub)),jp=(body.length+3)&~3,bp=(bl+3)&~3;
      const ab=new ArrayBuffer(12+8+jp+8+bp),v=new DataView(ab),b=new Uint8Array(ab);
      v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,ab.byteLength,true);
      v.setUint32(12,jp,true);v.setUint32(16,0x4e4f534a,true);b.fill(32,20,20+jp);b.set(body,20);
      v.setUint32(20+jp,bl,true);v.setUint32(24+jp,0x004e4942,true);b.set(bin,28+jp);
      results.push(ab);
    }
    return results;
  }
  async function sceneLoadAsset(o){
    const id=o.glbAssetId;if(!id||!o.glbData?.startsWith('data:model/gltf-binary;base64,'))return;
    try{
      const base64=o.glbData.slice(o.glbData.indexOf(',')+1),str=atob(base64),bytes=new Uint8Array(str.length);
      for(let i=0;i<str.length;i++)bytes[i]=str.charCodeAt(i);
      const parts=[];
      for(const primitiveBuffer of sceneSubGLB(bytes.buffer)){
        const data=unpack(primitiveBuffer);
        if(data.indices.length/3>170000)throw Error('Scenery GLB has too many triangles.');
        const geo=makeStaticGeometry(data),texture=await textureFromGLB(data);
        geo.maskTexture=texture;
        parts.push({geo,texture});
      }
      sceneAssets.set(id,{parts});
    }catch(err){sceneAssetErrors.set(id,String(err?.message||err));console.error('SCENERY GLB '+id+' failed:',err);throw Error(id+': '+(err?.message||err));}
    finally{sceneAssetPending.delete(id);}
  }
  importer.sceneAssetReady=o=>!!o?.glbAssetId&&sceneAssets.has(o.glbAssetId);
  importer.missingRequiredSceneAssets=(scenes)=>[...new Set((scenes||[]).flatMap(s=>(s.objects||[]).filter(o=>o?.glbAssetId&&!sceneAssets.has(o.glbAssetId)).map(o=>o.glbAssetId)))];
  function sceneRenderAssets(){
    const items=B.getCustomGLBObjects?.()||[];
    for(const {o,pose:q} of items){
      const id=o.glbAssetId;if(!id)continue;
      const asset=sceneAssets.get(id);
      if(!asset){if(!sceneAssetPending.has(id)){const definition=sceneAssetDefinitions.get(id)||o;const job=sceneLoadAsset(definition);sceneAssetPending.set(id,job)}continue;}
      const size=o.glbSourceSize||[1,1,1];
      const sx=q.width/Math.max(.01,size[0]),sy=q.height/Math.max(.01,size[1]),sz=q.thick/Math.max(.01,size[2]);
      const model=B.translateScale(q.x,q.y-q.height*.5+(Number(o.glbYOffset)||0),q.z,sx,sy,sz,(Number(o.glbYaw)||0)*Math.PI/180);
      for(const part of asset.parts)B.draw(part.geo,model,[1,1,1],0,0);
    }
  }

  async function loadObject(file){
    if(!B)throw Error('Wait for the 3D player to initialize');
    if(file.size>32*1024*1024)throw Error('Room prop GLB exceeds 32 MB.');
    const data=unpack(await file.arrayBuffer());
    if(data.indices.length/3>170000)throw Error('For this browser test use an optimized GLB below 170,000 triangles.');
    const texture=await textureFromGLB(data),geo=makeStaticGeometry(data);
    geo.maskTexture=texture;
    const previous=activeObject;activeObject={name:file.name,geo,texture};disposeUnusedObject(previous);
    text('Object selected: '+file.name+' · set position and click Place in room.');
  }

  function disposeUnusedObject(asset){
    if(!asset||asset===activeObject||objects.some(o=>o.asset===asset))return;
    for(const buffer of [asset.geo.vb,asset.geo.nb,asset.geo.uvb])if(buffer)B.gl.deleteBuffer(buffer);
    if(asset.texture)B.gl.deleteTexture(asset.texture);
  }
  importer.renderObjects=()=>{
    if(!B)return;
    for(const o of objects)B.draw(o.asset.geo,B.translateScale(o.x,o.y,o.z,o.scale,o.scale,o.scale,o.rot),[.7,.66,.62],0,0);
    sceneRenderAssets();
  };

  function refreshSlot(){
    const slot=slotInput.value,entry=B.cast.get(slot);
    slotInput.selectedEntry=entry;
    if(entry?.direct){scaleInput.value=entry.scale;flipInput.checked=entry.flip;}
    else{scaleInput.value=1.93;flipInput.checked=false;}
    panel.querySelector('#czClear').disabled=!entry?.direct;
    panel.querySelector('#czRetune').disabled=!entry?.direct;
    text(slot+' · '+(entry?(entry.direct?'GLB ':'Mask ')+entry.name:'Empty'));
  }
  function updateScale() {
    const entry=B.directSlots.get(slotInput.value);
    if(!entry)return;
    const scale=clamp(Number(scaleInput.value)||1.93,1.6,2.3),flip=flipInput.checked;
    entry.asset.rest=bake(entry.data,scale,flip);
    entry.scale=scale;entry.flip=flip;
    refreshSlot();
  }

  function releaseActor(e){
    const asset=e?._czMeshRef,H=asset?.instances.get(e);
    if(H){
      for(const part of Object.values(H.geos)){B.gl.deleteBuffer(part.vb);B.gl.deleteBuffer(part.nb);}
      asset.instances.delete(e);asset.refs--;collectAsset(asset);
    }
    if(e?._czAsset){const pinned=e._czAsset;e._czAsset=null;pinned.refs--;collectAsset(pinned);}
    if(e){e._czMeshRef=null;e._czWeaponPose=null;e._czDrawPose=null;}
  }
  importer.releaseActor=releaseActor;
  importer.syncActor=e=>{if(e._czMeshRef&&e._czMeshRef!==assetFor(e))releaseActor(e);};

  function instance(asset,owner){
    if(owner._czMeshRef&&owner._czMeshRef!==asset)releaseActor(owner);
    let H=asset.instances.get(owner);
    if(!H){H={pos:new Float32Array(asset.rest.q.length),nor:new Float32Array(asset.rest.nr.length),geos:{},next:0};
      asset.instances.set(owner,H);owner._czMeshRef=asset;asset.refs++;
    }
    return H;
  }
  function drawSections(asset,owner,pose,present,actor){
    const rest=asset.rest,H=instance(asset,owner),gl=B.gl;
    const now=performance.now(),key=[...present].join('|');
    const density=rest.indices.length/3,load=B.crowdSize()*density;
    const interval=load>280000?100:load>130000?55:density>50000?36:0;
    const changed=H.rest!==rest||H.key!==key;
    const frame=B.frame();
    const update=changed||(!owner.ragSettled&&H.frame!==frame&&now>=H.next);
    if(update){
      if(changed&&!actor){
        const subset=new Set();
        for(const name of present)for(const index of rest.sections[name]?.indices||[])subset.add(index);
        H.vertices=Uint32Array.from(subset);
      }
      const bones=B.HumanBody.boneMatrices(rest,pose,actor?null:present);
      if(actor)actor._czDrawPose={pose,rest,bones};
      B.HumanBody.skin(rest,bones,H.pos,H.nor,H.vertices);
      H.rest=rest;H.key=key;H.next=now+interval;H.frame=frame;
    }
    for(const name of present){
      const section=rest.sections[name];if(!section?.count)continue;
      let g=H.geos[name];
      if(!g){
        let uvb=asset.uvBuffers[name];
        if(!uvb){uvb=asset.uvBuffers[name]=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uvb);gl.bufferData(gl.ARRAY_BUFFER,section.uv,gl.STATIC_DRAW);}
        g=H.geos[name]={vb:gl.createBuffer(),nb:gl.createBuffer(),uvb,count:0,
          p:new Float32Array(section.count*3),n:new Float32Array(section.count*3)};
      }
      if(update){
        const I=section.indices,P=g.p,N=g.n;
        for(let i=0;i<I.length;i++){
          const a=I[i]*3,b=i*3;
          P[b]=H.pos[a];P[b+1]=H.pos[a+1];P[b+2]=H.pos[a+2];
          N[b]=H.nor[a];N[b+1]=H.nor[a+1];N[b+2]=H.nor[a+2];
        }
        if(g.count===section.count){
          gl.bindBuffer(gl.ARRAY_BUFFER,g.vb);gl.bufferSubData(gl.ARRAY_BUFFER,0,P);
          gl.bindBuffer(gl.ARRAY_BUFFER,g.nb);gl.bufferSubData(gl.ARRAY_BUFFER,0,N);
        }else B.hbUpload(g,P,N,section.count);
      }
      g.maskTexture=asset.texture;g.maskMaterial=asset.material||null;
      const shade=actor?.customTarget?.glbTint||maskFor(actor)?.glbTint||owner._czGlbTint;
      if(shade?.mode==='color'&&/^#[0-9a-f]{6}$/i.test(shade.color||'')){
        g.maskTint=[1,3,5].map(i=>parseInt(shade.color.slice(i,i+2),16)/255);
        g.maskTintStrength=Math.max(0,Math.min(1,Number(shade.strength??.80)));
      }else{g.maskTint=null;g.maskTintStrength=null}
      if(actor)B.customPartRenderDepth(actor,name==='torso'?'torso':name==='head'?'head':name.endsWith('_l')?(name.startsWith('th')||name.startsWith('sh')||name.startsWith('foot')?'leftLeg':'leftArm'):(name.startsWith('th')||name.startsWith('sh')||name.startsWith('foot')?'rightLeg':'rightArm'));
      B.draw(g,B.HB_IDM,[.65,.55,.47],0,.22);
    }
  }
  function attachedParts(e,popup){
    const d=e.detached||{},parts=new Set(['torso']);
    if(!e.headGone)parts.add('head');
    for(const side of ['l','r']){
      const prefix=side==='l'?'left':'right';
      if(!d[prefix+'arm'])parts.add('ua_'+side);
      if(!d[prefix+'arm']&&!d[prefix+'forearm'])parts.add('fa_'+side);
      if(!d[prefix+'arm']&&!d[prefix+'forearm']&&!d[prefix+'hand'])parts.add('hand_'+side);
      if(!popup){
        if(!d[prefix+'leg'])parts.add('th_'+side);
        if(!d[prefix+'leg']&&!d[prefix+'lowerleg'])parts.add('sh_'+side);
        if(!d[prefix+'leg']&&!d[prefix+'lowerleg']&&!d[prefix+'foot'])parts.add('foot_'+side);
      }
    }
    return parts;
  }

  // Every loose limb receives the source GLB reference at the moment it is
  // cut. Its own physics points then drive the SAME auto-rigged section(s).
  importer.attachLoose=(e,L)=>{
    if(e?._maskRenderDisabled)return;
    const asset=assetFor(e);if(asset){L._czAsset=asset;asset.refs++;}
    // The detach routine already captured hair before the fatal state change;
    // do not replace it with a post-death/fallback slot lookup.
    if(L.kind==='head'&&!L._czHairMesh)L._czHairMesh=hairConfigForActor(e);
    if(L.kind==='head')L._czHatCfg=B.slotFor(e)==='I'?null:(e?.customTarget?.clothing?.cowboy||maskFor(e)?.clothing?.cowboy||hbEntryFor(e)?.clothing?.cowboy||null);
    L._czGlbTint=e?.customTarget?.glbTint||maskFor(e)?.glbTint||null;
  };
  importer.renderLoose=L=>{
    const asset=L._czAsset;if(!asset||!B)return false;
    try{
      const G={},side=String(L.part).startsWith('left')?'l':'r';
      let segs=[];
      if(L.kind==='head'){
        Object.assign(G,looseHeadJointPose(L.points,asset.rest));segs=['head'];
      }else{
        const def={arm:[['s','e','w','h'],['ua','fa','hand']],forearm:[['e','w','h'],['fa','hand']],hand:[['w','h'],['hand']],leg:[['hip','k','a','f'],['th','sh','foot']],lowerleg:[['k','a','f'],['sh','foot']],foot:[['a','f'],['foot']]}[L.kind];
        if(!def)return false;
        def[0].forEach((k,i)=>{if(L.points[i])G[k+side]=L.points[i]});
        const count=Math.min(def[1].length,Math.max(0,L.points.length-1));
        segs=def[1].slice(0,count).map(k=>k+'_'+side);
      }
      const present=new Set(segs);if(!present.size)return false;
      if(L.kind==='head')present.add('neck');
      drawSections(asset,L,G,present,null);
      if(L.kind==='head')B.drawLooseHeadHair?.(L,G,asset.rest);
      if(L.kind==='head')B.drawLooseHeadHat?.(L,G,asset.rest);
      return true;
    }catch(err){
      releaseActor(L);console.warn('GLB loose section failed, using physics fallback:',err);
      return false;
    }
  };

  importer.weaponSocket=(actor,pose,hand,rendered=false)=>{
    if(!B||actor._maskRenderDisabled||actor.type==='dog')return null;
    const asset=assetFor(actor);if(!asset)return null;
    const side=hand==='left'?'l':'r',rest=asset.rest;
    const drawing=rendered&&actor._czDrawPose?.rest===rest?actor._czDrawPose:null;
    const cached=actor._czWeaponPose;
    const sockets=drawing||(cached?.pose===pose&&cached.rest===rest?cached:{pose,rest,bones:B.HumanBody.boneMatrices(rest,pose)});
    if(sockets[side])return sockets[side];
    if(!drawing)actor._czWeaponPose=sockets;
    const grip=[0,0,0],palm=rest.palm[side];
    for(const [index,weight] of rest.palmWeights[side]){
      if(!weight)continue;
      const {R,hr,hg}=sockets.bones[GB[index]],d=palm.map((v,i)=>v-hr[i]);
      for(let i=0;i<3;i++)grip[i]+=weight*(hg[i]+R[i*3]*d[0]+R[i*3+1]*d[1]+R[i*3+2]*d[2]);
    }
    const {R}=sockets.bones['hand_'+side],wrist=rest.Jr['w'+side],tip=rest.Jr['h'+side];
    const d=tip.map((v,i)=>v-wrist[i]),axis=d.map((_,i)=>R[i*3]*d[0]+R[i*3+1]*d[1]+R[i*3+2]*d[2]);
    const length=Math.hypot(...axis)||1;
    return sockets[side]={grip,axis:axis.map(v=>v/length)};
  };

  // The imported mesh now stays on the actor during ragdoll and amputations.
  // Reffy (slot I): fit hit zones to the same auto-rigged GLB used for drawing.
  // The older universal colliders measured a procedural MakeHuman mannequin,
  // which has different neck/face/chest proportions from the LocalMesh referee.
  // This method is used by BOTH bullet testing and the H hit-zone overlay.
  // It never changes rendering, GLB vertices, mask textures, or detachment flags.
  importer.refereeHitShapes=(e,pose)=>{
    if(!B||B.slotFor(e)!=='I'||e._maskRenderDisabled||e.type==='dog')return null;
    const asset=assetFor(e),rest=asset?.rest;
    if(!rest?.sections?.head||!rest?.sections?.torso)return null;
    if(!asset._ddRefHitSample){
      const q=rest.q,groups={head:[],neck:[],chest:[],belly:[]};
      const seen={head:new Set(),neck:new Set(),chest:new Set(),belly:new Set()};
      const add=(key,section,lo,hi,xmax)=>{
        for(const i of rest.sections[section]?.indices||[]){
          if(seen[key].has(i))continue;
          const k=i*3,y=q[k+1]/1.93;
          if(y<lo||y>hi||Math.abs(q[k]/1.93)>xmax)continue;
          seen[key].add(i);groups[key].push(i);
        }
      };
      // The top of Reffy's GLB contains his hat. Do not treat the brim as
      // a lethal face zone. Keep the lower scalp, cheeks and jaw in the head zone.
      add('head','head',.857,.950,.105);
      add('neck','torso',.810,.869,.105);
      add('chest','torso',.675,.825,.215);
      add('belly','torso',.478,.685,.215);
      if(groups.head.length<20||groups.chest.length<20)return null;
      const chosen=new Set();
      for(const [name,arr] of Object.entries(groups)){
        // Wide sections may have tens of thousands of triangle corners. Sample
        // the entire part and always retain each source-space extreme.
        const step=Math.max(1,Math.floor(arr.length/2200));
        const sampled=[];for(let n=0;n<arr.length;n+=step){sampled.push(arr[n]);chosen.add(arr[n]);}
        for(let axis=0;axis<3;axis++){
          let l=arr[0],h=arr[0];
          for(const v of arr){if(q[v*3+axis]<q[l*3+axis])l=v;if(q[v*3+axis]>q[h*3+axis])h=v;}
          sampled.push(l,h);chosen.add(l);chosen.add(h);
        }
        groups[name]=sampled;
      }
      asset._ddRefHitSample={groups,indices:Uint32Array.from(chosen)};
    }
    const {groups,indices}=asset._ddRefHitSample;
    const cache=e._ddRefHitBuffer|| (e._ddRefHitBuffer={pos:new Float32Array(rest.q.length),nor:new Float32Array(rest.nr.length)});
    if(cache.pos.length!==rest.q.length){cache.pos=new Float32Array(rest.q.length);cache.nor=new Float32Array(rest.nr.length);}
    const bones=B.HumanBody.boneMatrices(rest,pose);
    B.HumanBody.skin(rest,bones,cache.pos,cache.nor,indices);
    const pos=cache.pos;
    const bounds=name=>{
      const ids=groups[name]||[];if(!ids.length)return null;
      const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
      for(const i of ids){for(let a=0;a<3;a++){const v=pos[i*3+a];if(!Number.isFinite(v))continue;lo[a]=Math.min(lo[a],v);hi[a]=Math.max(hi[a],v);}}
      if(!lo.every(Number.isFinite)||!hi.every(Number.isFinite))return null;
      return {center:lo.map((v,i)=>(v+hi[i])*.5),half:lo.map((v,i)=>(hi[i]-v)*.5)};
    };
    const head=bounds('head'),neck=bounds('neck'),chest=bounds('chest'),belly=bounds('belly');
    if(!head||!neck||!chest||!belly)return null;
    const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    const sz=(v,lo,hi)=>clamp(v,lo,hi);
    const ell=(zone,b,margin,range)=>[zone,'ellipsoid',b.center,b.half.map((v,i)=>sz(v*margin,range[i][0],range[i][1]))];
    const shapes=[];
    if(!e.headGone&&!e.detached?.neck){
      shapes.push(ell('head',head,1.06,[[.06,.16],[.075,.18],[.064,.15]]));
      const neckCenter=neck.center.map((v,i)=>(v+([pose.neck[0],pose.neck[1],pose.neck[2]][i]))*.5);
      shapes.push(['neck','sphere',neckCenter,sz(Math.max(neck.half[0],neck.half[2])*.9,.040,.075)]);
    }
    const chestWidths=chest.half.map((v,i)=>sz(v*1.08,i===1?.095:.075,i===1?.25:.34));
    const heart=[chest.center[0]+.075,chest.center[1]+.015,chest.center[2]+.035];
    shapes.push(['heart','sphere',heart,.077]);
    shapes.push(['chest','ellipsoid',chest.center,chestWidths]);
    shapes.push(ell('abdomen',belly,1.08,[[.085,.32],[.100,.29],[.08,.30]]));
    const G=B.HumanBody.anchors(pose,rest.Jr);
    const limb=[
      ['l','left'],['r','right']
    ];
    for(const [side,prefix] of limb){
      const at=key=>G[key+side];
      const capsule=(name,a,b,r)=>{if(a&&b)shapes.push([name,'capsule',a,b,r]);};
      const sphere=(name,p,r)=>{if(p)shapes.push([name,'sphere',p,r]);};
      if(!e.detached?.[prefix+'arm']){
        sphere(prefix+'shoulder',at('s'),.079);
        capsule(prefix+'upperarm',at('s'),at('e'),.066);
        if(!e.detached?.[prefix+'forearm']){
          sphere(prefix+'elbow',at('e'),.065);
          capsule(prefix+'forearm',at('e'),at('w'),.056);
          if(!e.detached?.[prefix+'hand']){
            sphere(prefix+'wrist',at('w'),.050);
            capsule(prefix+'hand',at('w'),at('h'),.050);
          }
        }
      }
      if(e.customSourceType!=='popup'&&!e.detached?.[prefix+'leg']){
        sphere(prefix+'hip',at('hip'),.110);
        capsule(prefix+'thigh',at('hip'),at('k'),.082);
        if(!e.detached?.[prefix+'lowerleg']){
          sphere(prefix+'knee',at('k'),.071);
          capsule(prefix+'shin',at('k'),at('a'),.066);
          if(!e.detached?.[prefix+'foot']){
            sphere(prefix+'ankle',at('a'),.055);
            capsule(prefix+'foot',at('a'),at('f'),.057);
          }
        }
      }
    }
    return shapes;
  };

  importer.renderBody=(e,p,hb,victim,popup)=>{
    if(!B||e._maskRenderDisabled)return false;
    const asset=assetFor(e);if(!asset)return false;
    try {
      drawSections(asset,e,p,attachedParts(e,popup),e);
      return true;
    }catch(err){e._maskRenderDisabled=true;releaseActor(e);text('Rig failed for slot '+B.slotFor(e)+': '+err.message,true);return false;}
  };

  importer.syncSlot=()=>{if(slotInput&&B.cast.get(slotInput.value)!==slotInput.selectedEntry)refreshSlot();};
  const defaultWesternGLBs={L:globalThis.__DDGitHubRuntimeAssets["05-runtime-1"],J:globalThis.__DDGitHubRuntimeAssets["05-runtime-2"],K:globalThis.__DDGitHubRuntimeAssets["05-runtime-3"]};
  // Preloaded Western GLBs must not fail the duel merely because the browser
  // cannot decode/upload a texture. Preserve the geometry and report the real
  // reason if geometry preparation fails.
  const westernCastErrors=importer.westernCastErrors={};
  async function setupWesternCharacter(slot,base64){
    try{
      if(!B)throw Error('3D bridge was not initialized');
      const str=atob(base64),bytes=new Uint8Array(str.length);
      for(let i=0;i<str.length;i++)bytes[i]=str.charCodeAt(i);
      const data=unpack(bytes.buffer),rest=bake(data,1.93,false);
      let texture=null;
      try { texture=await textureFromGLB(data); }
      catch(textureError){
        console.warn('Western slot '+slot+' texture failed; retaining its model:',textureError);
        westernCastErrors[slot+'Texture']=String(textureError?.message||textureError);
      }
      // Embedded models are fallback only. Never replace an imported J/K/L
      // MaskEntry, even when its geometry was still preparing asynchronously.
      if(!B.cast.has(slot))B.setDirect({slot,name:slot==='J'?'Hooded Executioner':slot==='K'?'Condemned Prisoner':'Cow Killer Lady',direct:true,data,asset:{rest,texture,instances:new WeakMap(),refs:0,uvBuffers:{}},scale:1.93,flip:false});
      else if(texture)B.gl.deleteTexture(texture);
      delete westernCastErrors[slot];
      refreshSlot();
      return true;
    }catch(err){
      westernCastErrors[slot]=String(err?.message||err);
      console.error('Western slot '+slot+' could not initialize:',err);
      text('Western model '+slot+' failed: '+westernCastErrors[slot],true);
      return false;
    }
  }
  importer.setBridge=bridge=>{
    B=bridge;
    panel=document.createElement('aside');panel.id='obeseZombieImportPanel';
    panel.style.cssText='position:fixed;top:52px;right:10px;z-index:3500;background:#0d1921ee;border:1px solid #6daea5;border-radius:9px;color:#e6f7ed;font:12px system-ui;padding:9px;width:269px;box-shadow:0 5px 22px #0008;max-height:60vh;overflow:auto';
    panel.innerHTML=`<details><summary style="cursor:pointer;font-weight:700;color:#b8ead6">⬡ GLB IMPORT · TEST</summary>
      <div style="padding-top:8px;line-height:1.65">
      <label style="display:block;font-weight:bold">Import as:
       <select id="czMode" style="background:#1a3442;color:white;padding:4px;width:99%"><option value="mannequin">Mannequin</option><option value="object">Object (room prop)</option></select></label>
      <div id="czSlotPicker">
      <label>Load mannequin slot <select id="czSlot" aria-label="Load mannequin slot"></select></label>
      <button id="czClear" type="button">Clear GLB slot</button>
      </div>
      <div>Choose a GLB file:</div>
      <input id="czFile" type="file" accept=".glb,model/gltf-binary" style="width:100%;font-size:11px;margin:4px 0">
      <div id="czMannequinSettings">
      <label style="display:block">Height multiplier <input id="czScale" type="number" min="1.6" max="2.3" step="0.03" value="1.93" style="width:60px;background:#182f3c;color:#fff"></label>
      <label style="display:block"><input id="czFlip" type="checkbox"> Rotate model 180°</label>
      <button id="czRetune" style="padding:3px 8px;background:#315b69;color:white;border-radius:4px">Apply size / direction</button>
      <button id="czSpawn" style="padding:3px 8px;background:#315b69;color:white;border-radius:4px">Spawn test enemy</button>
      </div>
      <div id="czObjectSettings" hidden>
       <div>Static prop coordinates (game units):</div>
       <label>X <input id="czObjX" type="number" value="0" step="0.5" style="width:58px"></label>
       <label>Y <input id="czObjY" type="number" value="0" step="0.2" style="width:58px"></label>
       <label>Distance ahead <input id="czObjDistance" type="number" value="7" step="1" min="1" style="width:58px"></label>
       <label>Scale <input id="czObjScale" type="number" value="1.8" step="0.1" min="0.05" style="width:58px"></label>
       <label>Rotation degrees <input id="czObjRotation" type="number" value="0" step="15" style="width:58px"></label>
       <button id="czPlace" style="padding:3px 8px;background:#315b69;color:white;border-radius:4px">Place object in room</button>
       <button id="czUndoObject" style="padding:3px 8px;background:#453a43;color:white;border-radius:4px">Remove last object</button>
       <small style="display:block;color:#efc989">Objects remain visible while this player tab stays open. Static preview: no physics/collision or Studio save yet.</small>
      </div>
      <p id="czStatus" style="margin:6px 0;color:#b8f0d5">Waiting for GLB selection.</p>
      <div id="czRigWarning" style="color:#ffcc88">GLB DISMEMBERMENT v1.4.3: fitted arms and weapon grips; detachable GLB head / arms / hands / legs / feet retain the original texture and follow loose-limb physics. Approximate automatic triangle cuts may leave rough/open edges; fine weight-painting, true watertight stump caps and exact colliders are still experimental.</div>
      </div></details>`;
    document.body.appendChild(panel);
    // Imported GLB meshes still work, but this developer-only test widget must
    // never cover the public Dead Man's Draw start screen or gameplay.
    panel.hidden=true;
    panel.style.setProperty('display','none','important');
    status=panel.querySelector('#czStatus');slotInput=panel.querySelector('#czSlot');scaleInput=panel.querySelector('#czScale');flipInput=panel.querySelector('#czFlip');
    for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ')slotInput.add(new Option(letter,letter));
    slotInput.onchange=refreshSlot;
    panel.querySelector('#czClear').onclick=()=>{
      const slot=slotInput.value,entry=B.directSlots.get(slot);
      if(entry&&window.confirm('Clear GLB '+entry.name+' from slot '+slot+'?')){B.clearDirect(slot);refreshSlot();}
    };
    const mode=panel.querySelector('#czMode');
    mode.onchange=()=>{
      const isObject=mode.value==='object';
      panel.querySelector('#czMannequinSettings').hidden=isObject;
      panel.querySelector('#czSlotPicker').hidden=isObject;
      panel.querySelector('#czObjectSettings').hidden=!isObject;
      panel.querySelector('#czRigWarning').hidden=isObject;
      if(isObject)text('Object import: select a GLB and set room position.');else refreshSlot();
    };
    panel.querySelector('#czFile').addEventListener('change',async ev=>{
      const input=ev.target,f=input.files?.[0];input.value='';if(!f)return;
      input.disabled=true;
      try{if(mode.value==='object')await loadObject(f);else await loadFile(f,slotInput.value)}
      catch(err){text(err.message,true)}finally{input.disabled=false;}
    });
    panel.querySelector('#czPlace').onclick=()=>{
      if(!activeObject){text('Import a GLB as Object before placing it.',true);return;}
      const get=id=>Number(panel.querySelector('#'+id).value)||0;
      const cam=B.getCamera(),scale=clamp(get('czObjScale'),.05,100);
      objects.push({asset:activeObject,x:cam.x+get('czObjX'),y:get('czObjY'),z:cam.z-Math.max(1,get('czObjDistance')),
        scale,rot:get('czObjRotation')*Math.PI/180});
      text('Placed '+activeObject.name+' · '+objects.length+' room prop(s).');
    };
    panel.querySelector('#czUndoObject').onclick=()=>{disposeUnusedObject(objects.pop()?.asset);text(objects.length+' room prop(s) remaining.')};
    panel.querySelector('#czRetune').onclick=updateScale;
    panel.querySelector('#czSpawn').onclick=()=>{
      const a=window.__STRATIX_TEST__;
      if(a?.state!=='playing'){text('Start a game first (or use the included custom scene).',true);return;}
      try{a.createTestEnemy('runner',slotInput.value);text('Added enemy · slot '+slotInput.value);}catch(err){text(err.message,true)}
    };
    refreshSlot();
    // Build one at a time to avoid overlapping large base64 decoding, GLB
    // rig generation, PNG decoding and WebGL texture allocation.
    importer.westernCastReady=(async()=>{
      for(const slot of ['J','K','L'])await setupWesternCharacter(slot,defaultWesternGLBs[slot]);
      importer.westernCastPrepared=true;
      return ['J','K','L'].filter(slot=>!B?.directSlots?.has(slot));
    })();
    importer.requiredWesternCastReady=(needed=['J','K','L'])=>needed.every(slot=>B?.directSlots?.has(slot)||B?.cast?.has(slot));
  };
})();

