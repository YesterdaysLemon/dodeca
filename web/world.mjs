import * as THREE from '/vendor/three.module.js';
import { OrbitControls } from '/vendor/OrbitControls.js';
import { mergeGeometries } from '/vendor/BufferGeometryUtils.js';
import { DRIVES } from '/core.mjs';

export const SITES = {
  food: [[18,20],[62,10],[85,58],[36,52],[12,62],[87,24],[42,9]],
  water: [[21,48],[77,38],[55,64]],
  nest: [[78,59],[24,8],[8,32]],
  relic: [[68,17],[37,60],[89,45],[47,25]],
  toy: [[41,15],[59,51],[16,35]],
  visitor: [[92,31]]
};
let randomSeed=8721;
const rand=()=>{ randomSeed=(randomSeed*1664525+1013904223)>>>0;return randomSeed/4294967296; };
const rawHeight=(x,z)=>1.6*Math.sin(x*.055)*Math.cos(z*.066)+.68*Math.sin(x*.16+z*.085);
export function height(x,z){
  let h=rawHeight(x,z);
  for(const [wx,wz] of SITES.water){const px=wx-50,pz=wz-35,d=Math.hypot((x-px)/1.4,z-pz);const t=Math.max(0,1-d/8);h=h*(1-t)+rawHeight(px,pz)*t;}
  return h;
}
const materials=new Map();
const mat=(color,extra={})=>{const key=JSON.stringify([color,extra]);if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness:.88,...extra}));return materials.get(key);};
export class Habitat {
  constructor(container){
    this.container=container;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#79cdf6');this.scene.fog=new THREE.Fog('#b8e3e8',105,240);
    this.camera=new THREE.PerspectiveCamera(45,1,.1,450);this.camera.position.set(67,48,79);
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.92;
    container.append(this.renderer.domElement);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(0,1,-3);this.controls.enableDamping=true;this.controls.dampingFactor=.065;
    this.controls.minDistance=13;this.controls.maxDistance=170;this.controls.maxPolarAngle=Math.PI*.46;this.controls.minPolarAngle=.16;this.controls.enablePan=true;
    this.scene.add(new THREE.HemisphereLight('#e7fbff','#47632a',1.65));
    const sun=new THREE.DirectionalLight('#fff0cd',2.7);sun.position.set(-40,70,35);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:200});sun.shadow.normalBias=.045;sun.shadow.bias=-.00015;this.scene.add(sun);
    this.clouds=[];this.floaters=[];this.birds=[];this.flowerHeads=[];this.trails=[];
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.buildLand();this.buildPlants();this.buildResources();this.mergeStaticMeshes();this.buildSky();
    this.dodeca=this.creature('dodeca');this.point=this.creature('point');
    this.dodeca.position.set(-6,height(-6,0)+3,0);this.point.position.set(6,height(6,2)+2.4,2);
    this.targets={dodeca:{x:-6,z:0},point:{x:6,z:2}};this.lastTrail={dodeca:null,point:null};
    this.follow=null;this.lastFrame=0;this.frameCount=0;this.frameMs=[];
    new ResizeObserver(()=>this.resize()).observe(container);this.resize();
  }
  resize(){const w=this.container.clientWidth,h=this.container.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
  mesh(geo,material,x,y,z,cast=true){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=cast;m.receiveShadow=true;this.scene.add(m);return m;}
  mergeStaticMeshes(){
    this.scene.updateMatrixWorld(true);const groups=new Map(),dynamic=new Set(this.floaters.map(x=>x.group));
    this.scene.traverse(m=>{if(!m.isMesh||m.isInstancedMesh)return;for(let p=m;p;p=p.parent)if(dynamic.has(p))return;
      const key=m.material.uuid+'|'+m.castShadow+'|'+m.receiveShadow+'|'+Object.keys(m.geometry.attributes).sort().join(',')+'|'+Boolean(m.geometry.index);
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(m);
    });
    for(const list of groups.values()){if(list.length<2)continue;const copies=list.map(m=>m.geometry.clone().applyMatrix4(m.matrixWorld));const geometry=mergeGeometries(copies);copies.forEach(g=>g.dispose());if(!geometry)continue;
      const first=list[0],merged=new THREE.Mesh(geometry,first.material);merged.castShadow=first.castShadow;merged.receiveShadow=first.receiveShadow;list.forEach(m=>m.removeFromParent());this.scene.add(merged);
    }
  }
  buildLand(){
    const terrain=new THREE.PlaneGeometry(600,600,240,240);terrain.rotateX(-Math.PI/2);const pos=terrain.attributes.position;const colors=[];
    const c=new THREE.Color();for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i);pos.setY(i,height(x,z));const v=.5+.5*Math.sin(x*.2)*Math.cos(z*.19);c.setHSL(.235+v*.018,.52+v*.1,.255+v*.045);colors.push(c.r,c.g,c.b);}terrain.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrain.computeVertexNormals();this.mesh(terrain,mat('#ffffff',{vertexColors:true}),0,0,0,false);
    // Winding footpaths join resource clearings; terrain and all props share height().
    for(const [a,b,offset] of [[[18,20],[78,59],5],[[21,48],[68,17],-4],[[24,8],[59,51],5]]){
      const verts=[],cols=[];for(let i=0;i<=90;i++){const t=i/90,x=a[0]+(b[0]-a[0])*t-50+Math.sin(t*Math.PI)*offset,z=a[1]+(b[1]-a[1])*t-35;
        const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz),width=.5+.25*Math.sin(t*13);for(const side of [-1,1]){const px=x-dz/l*width*side,pz=z+dx/l*width*side;verts.push(px,height(px,pz)+.055,pz);cols.push(.62,.63,.36);}}
      const indices=[];for(let i=0;i<90;i++){const j=i*2;indices.push(j,j+1,j+2,j+1,j+3,j+2);}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();this.mesh(g,mat('#b9bd75',{side:THREE.DoubleSide}),0,0,0,false);
    }
    const mountainMat=mat('#7daaa5',{flatShading:true});for(let i=0;i<22;i++){const angle=Math.PI+(i/21)*Math.PI,x=Math.cos(angle)*150,z=Math.sin(angle)*155-20,h=15+rand()*28;const mountain=this.mesh(new THREE.ConeGeometry(13+rand()*18,h,5),mountainMat,x,h/2-4,z);mountain.rotation.y=rand()*6;}
    const rockGeo=new THREE.IcosahedronGeometry(1,0),rockMat=mat('#859a80',{flatShading:true});for(let i=0;i<58;i++){const x=(rand()-.5)*145,z=(rand()-.5)*110;if(Math.hypot(x,z)<15)continue;const rock=this.mesh(rockGeo,rockMat,x,height(x,z)+.6,z);rock.scale.set(1+rand()*2,.7+rand()*1.8,1+rand()*2);rock.rotation.set(rand(),rand()*6,rand());}
  }
  tree(wx,wz,scale=1,odd=false){
    const x=wx-50,z=wz-35,y=height(x,z),g=new THREE.Group();g.position.set(x,y,z);g.scale.setScalar(scale);this.scene.add(g);
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.38,.76,6,7),mat(odd?'#8c7884':'#8c7b56'));trunk.position.y=2.8;trunk.rotation.z=odd?.2:-.08;trunk.castShadow=true;g.add(trunk);
    const palettes=odd?['#e5a6bc','#cc95b2','#efd3bd']:['#61994a','#86b355','#a0c365'];
    for(let j=0;j<5;j++){const leaf=new THREE.Mesh(new THREE.IcosahedronGeometry(2.5,1),mat(palettes[j%3],{flatShading:true}));leaf.position.set(Math.cos(j*2.4)*1.5,5.5+(j%3)*1.1,Math.sin(j*2.4)*1.5);leaf.scale.set(1.3,1,1.1);leaf.castShadow=true;g.add(leaf);}
    return g;
  }
  buildPlants(){
    const positions=[[8,12],[3,48],[10,66],[28,64],[38,70],[58,73],[76,72],[91,63],[99,46],[100,17],[85,7],[71,1],[56,-1],[31,1],[14,4],[18,21],[61,9],[83,57],[34,51],[85,23],[43,8],[-2,22],[109,30]];
    positions.forEach(([x,z],i)=>this.tree(x,z,.85+(i%4)*.2,i%8===0));
    for(let i=0;i<26;i++){const side=i%2===0?-20:120;this.tree(side+rand()*20,(rand()*120)-20,1.1+rand()*.9,i%11===0);}
    const blade=new THREE.BufferGeometry();blade.setAttribute('position',new THREE.Float32BufferAttribute([-.07,0,0,.07,0,0,.04,.58,0,0,.83,0],3));blade.setIndex([0,1,2,0,2,3]);blade.computeVertexNormals();
    const grassMat=mat('#ffffff',{side:THREE.DoubleSide,vertexColors:false});this.wind={value:0};
    grassMat.onBeforeCompile=shader=>{shader.uniforms.time=this.wind;shader.vertexShader='uniform float time;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed.x += sin(time*1.3+instanceMatrix[3].x*.25+instanceMatrix[3].z*.2)*.18*position.y*position.y;');};
    const grass=new THREE.InstancedMesh(blade,grassMat,18000),dummy=new THREE.Object3D(),c=new THREE.Color();let count=0;
    for(let i=0;i<24000&&count<18000;i++){const x=(rand()-.5)*140,z=(rand()-.5)*105;
      if(SITES.water.some(([wx,wz])=>Math.hypot((x-(wx-50))/1.4,z-(wz-35))<5.2))continue;
      dummy.position.set(x,height(x,z)+.01,z);dummy.rotation.y=rand()*Math.PI;dummy.scale.setScalar(.6+rand()*1.3);dummy.updateMatrix();grass.setMatrixAt(count,dummy.matrix);c.setHSL(.2+rand()*.075,.43,.33+rand()*.21);grass.setColorAt(count++,c);}
    grass.count=count;grass.receiveShadow=true;this.scene.add(grass);
    const flowers=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.17,0),mat('#fff8b5',{emissive:'#52431a',emissiveIntensity:.1}),650);
    for(let i=0;i<650;i++){const x=(rand()-.5)*110,z=(rand()-.5)*80;dummy.position.set(x,height(x,z)+.55,z);dummy.rotation.set(0,rand()*6,0);dummy.scale.setScalar(.6+rand());dummy.updateMatrix();flowers.setMatrixAt(i,dummy.matrix);c.set(['#fff1a7','#f4b9c8','#d3d9ff','#e8edc3'][i%4]);flowers.setColorAt(i,c);}this.scene.add(flowers);
  }
  buildResources(){
    const berryMat=mat('#ee855d'),waterMat=mat('#4aafbd',{roughness:.23,metalness:.12,transparent:true,opacity:.88});
    for(const [wx,wz] of SITES.food){const x=wx-50,z=wz-35;for(let j=0;j<9;j++){const bx=x+Math.cos(j*2.4)*(.6+j*.13),bz=z+Math.sin(j*2.4)*(.6+j*.13);const berry=this.mesh(new THREE.SphereGeometry(.44,10,8),berryMat,bx,height(bx,bz)+.45,bz);berry.scale.y=1.1;this.mesh(new THREE.ConeGeometry(.23,.22,5),mat('#617b32'),bx,height(bx,bz)+.91,bz);}}
    for(const [wx,wz] of SITES.water){const x=wx-50,z=wz-35,y=height(x,z);const rim=this.mesh(new THREE.CircleGeometry(5.8,48),mat('#b9c994'),x,y+.02,z,false);rim.rotation.x=-Math.PI/2;rim.scale.x=1.4;const pond=this.mesh(new THREE.CircleGeometry(5.3,48),waterMat,x,y+.08,z,false);pond.rotation.x=-Math.PI/2;pond.scale.x=1.4;
      for(let j=0;j<3;j++){const ring=this.mesh(new THREE.RingGeometry(1.5+j,1.54+j,48),new THREE.MeshBasicMaterial({color:'#cdf2e4',transparent:true,opacity:.35,side:THREE.DoubleSide}),x,y+.1,z,false);ring.rotation.x=-Math.PI/2;ring.scale.x=1.4;}
      for(let j=0;j<5;j++){const a=j*1.9,r=3.5;const pad=this.mesh(new THREE.CircleGeometry(.5,12),mat('#82b55c',{side:THREE.DoubleSide}),x+Math.cos(a)*r*1.4,y+.16,z+Math.sin(a)*r,false);pad.rotation.x=-Math.PI/2;}
    }
    for(const [wx,wz] of SITES.nest){const x=wx-50,z=wz-35,y=height(x,z);const dome=this.mesh(new THREE.SphereGeometry(3.2,14,8,0,Math.PI*2,0,Math.PI*.53),mat('#d5c594',{side:THREE.DoubleSide}),x,y,z);dome.scale.set(1,.8,1);const door=this.mesh(new THREE.SphereGeometry(1.3,14,10),mat('#514c35'),x,y+.8,z+2.4);door.scale.set(.85,1,.18);const moss=this.mesh(new THREE.SphereGeometry(3.23,14,8,0,Math.PI*2,0,Math.PI*.3),mat('#91ae69'),x,y,z);moss.scale.y=.81;}
    for(const [wx,wz] of SITES.relic){const x=wx-50,z=wz-35,y=height(x,z);const group=new THREE.Group();group.position.set(x,y+2.7,z);this.scene.add(group);const crystal=new THREE.Mesh(new THREE.OctahedronGeometry(1.5),mat('#c1a4df',{metalness:.2,roughness:.35,emissive:'#6d5384',emissiveIntensity:.22}));crystal.scale.y=1.6;crystal.castShadow=true;group.add(crystal);const orbit=new THREE.Mesh(new THREE.TorusGeometry(2.4,.055,6,48),mat('#ded7a5',{emissive:'#9c8153',emissiveIntensity:.3}));orbit.rotation.x=Math.PI*.37;group.add(orbit);this.floaters.push({group,y,crystal,orbit});for(let j=0;j<3;j++){const rock=this.mesh(new THREE.IcosahedronGeometry(.7,0),mat('#9aa68d'),x+Math.cos(j*2.1)*2.8,y+.4,z+Math.sin(j*2.1)*2.8);rock.scale.y=.6;}}
    for(const [wx,wz] of SITES.toy){const x=wx-50,z=wz-35,y=height(x,z);const pod=this.mesh(new THREE.TorusKnotGeometry(.8,.28,50,7),mat('#e9b654',{roughness:.5}),x,y+1,z);pod.rotation.z=.5;}
    const markerMat=mat('#cab58b');for(const [wx,wz] of SITES.visitor){const x=wx-50,z=wz-35;for(let j=0;j<3;j++){this.mesh(new THREE.CylinderGeometry(.2,.35,3+j*.4,7),markerMat,x+j*1.6,height(x+j*1.6,z)+1.5,z);}}
    // The wilderness is a little impossible: floating rock gardens and curved giant fronds.
    for(const [x,z,y,s] of [[-43,-36,17,1],[36,-43,23,1.3],[-62,18,15,.8]]){
      const island=this.mesh(new THREE.ConeGeometry(5*s,8*s,7),mat('#92a197',{flatShading:true}),x,y,z);island.rotation.z=Math.PI;
      const cap=this.mesh(new THREE.CylinderGeometry(5*s,5*s,.6,9),mat('#a8c56f'),x,y+4*s,z);cap.castShadow=true;
      const top=this.mesh(new THREE.IcosahedronGeometry(3*s,1),mat('#e8bbce',{flatShading:true}),x,y+7*s,z);top.scale.y=.7;
      for(let j=0;j<4;j++){const vine=this.mesh(new THREE.CylinderGeometry(.06,.02,5+j,4),mat('#64896c'),x+Math.cos(j*1.6)*3*s,y-2-j*.2,z+Math.sin(j*1.6)*3*s);vine.rotation.z=.13;}
    }
  }
  buildSky(){
    const cloudMat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,transparent:true,opacity:.93});
    for(let i=0;i<14;i++){const g=new THREE.Group();g.position.set((rand()-.5)*270,35+rand()*22,(rand()-.5)*180-30);for(let j=0;j<5;j++){const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(3+rand()*3,2),cloudMat);puff.position.set((j-2)*4,rand()*2,rand()*2);puff.scale.set(1.3,.7,1);g.add(puff);}this.scene.add(g);this.clouds.push(g);}
    const birdMat=new THREE.LineBasicMaterial({color:'#395b64',transparent:true,opacity:.55});for(let i=0;i<7;i++){const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-.6,.2,0),new THREE.Vector3(0,0,0),new THREE.Vector3(.6,.2,0)]);const bird=new THREE.Line(geo,birdMat);bird.position.set(i*3-15,25+i%3,-35);this.scene.add(bird);this.birds.push(bird);}
  }
  creature(kind){
    const g=new THREE.Group();this.scene.add(g);const inner=new THREE.Group();g.add(inner);g.userData.inner=inner;
    if(kind==='dodeca'){
      const body=new THREE.Mesh(new THREE.DodecahedronGeometry(2.1),mat('#e99068',{flatShading:true,roughness:.56}));body.castShadow=true;inner.add(body);
      const edge=new THREE.LineSegments(new THREE.EdgesGeometry(body.geometry),new THREE.LineBasicMaterial({color:'#ffdfb0',transparent:true,opacity:.7}));inner.add(edge);
      const phi=(1+Math.sqrt(5))/2,vecs=[[0,1,phi],[0,-1,phi],[0,1,-phi],[0,-1,-phi],[1,phi,0],[-1,phi,0],[1,-phi,0],[-1,-phi,0],[phi,0,1],[-phi,0,1],[phi,0,-1],[-phi,0,-1]];
      g.userData.lights=vecs.map((v,i)=>{const dot=new THREE.Mesh(new THREE.SphereGeometry(.19,8,6),mat(DRIVES[i].color,{emissive:DRIVES[i].color,emissiveIntensity:.5}));dot.position.copy(new THREE.Vector3(...v).normalize().multiplyScalar(2.3));inner.add(dot);return dot;});
      for(const x of [-.56,.56]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.18,12,10),mat('#374739',{roughness:.2}));eye.position.set(x,.3,1.91);inner.add(eye);}
    } else {
      const body=new THREE.Mesh(new THREE.SphereGeometry(1.15,24,20),mat('#80dcdf',{roughness:.18,metalness:.08,emissive:'#40999f',emissiveIntensity:.35}));body.castShadow=true;inner.add(body);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1.75,.045,6,48),mat('#d0ffff',{emissive:'#71c9d1',emissiveIntensity:.65}));ring.rotation.x=Math.PI/2.3;inner.add(ring);
      const pupil=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),mat('#225f69'));pupil.position.set(0,.1,1.1);inner.add(pupil);
    }
    const shadow=new THREE.Mesh(new THREE.CircleGeometry(kind==='dodeca'?2.1:1.3,32),new THREE.MeshBasicMaterial({color:'#294f33',transparent:true,opacity:.15,depthWrite:false}));shadow.rotation.x=-Math.PI/2;this.scene.add(shadow);g.userData.shadow=shadow;
    return g;
  }
  setBodies(d,p,votes){
    for(const [id,world] of [['dodeca',d],['point',p]]){
      this.targets[id]={x:world.x-50,z:world.y-35};
      const last=this.lastTrail[id],pos=new THREE.Vector3(world.x-50,height(world.x-50,world.y-35)+.15,world.y-35);
      if(last&&last.distanceTo(pos)>.05){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([last,pos]),new THREE.LineBasicMaterial({color:id==='dodeca'?'#d47952':'#248caa',transparent:true,opacity:.4}));this.scene.add(line);this.trails.push(line);if(this.trails.length>130){const old=this.trails.shift();this.scene.remove(old);old.geometry.dispose();old.material.dispose();}}
      this.lastTrail[id]=pos;
    }
    if(votes)DRIVES.forEach((drive,i)=>{const power=votes.drives[drive.id]?.pressure??.2;this.dodeca.userData.lights[i].scale.setScalar(.7+power*.9);});
  }
  resetTrails(){for(const line of this.trails){this.scene.remove(line);line.geometry.dispose();line.material.dispose();}this.trails=[];this.lastTrail={dodeca:null,point:null};}
  focus(id){this.follow=id;if(!id){this.camera.position.set(67,48,79);this.controls.target.set(0,1,-3);}else{const g=this[id];this.controls.target.copy(g.position);this.camera.position.copy(g.position).add(new THREE.Vector3(21,17,25));}}
  project(id){const p=this[id].position.clone().add(new THREE.Vector3(0,4,0));p.project(this.camera);return {x:(p.x*.5+.5)*this.container.clientWidth,y:(-p.y*.5+.5)*this.container.clientHeight,visible:p.z<1&&p.z>-1&&Math.abs(p.x)<1.1&&Math.abs(p.y)<1.1};}
  render(time){
    const t=time/1000,dt=Math.min((time-this.lastFrame)/1000,.06);this.lastFrame=time;this.wind.value=this.reduced?0:t;
    for(const id of ['dodeca','point']){const g=this[id],target=this.targets[id],before=g.position.clone(),dx=target.x-g.position.x,dz=target.z-g.position.z;
      const f=1-Math.exp(-dt*3.2);g.position.x+=dx*f;g.position.z+=dz*f;g.position.y=height(g.position.x,g.position.z)+(id==='dodeca'?2.7:2.15)+(this.reduced?0:Math.sin(t*2+(id==='point'?2:0))*.2);
      if(Math.hypot(dx,dz)>.12){let angle=Math.atan2(dx,dz)-g.rotation.y;angle=Math.atan2(Math.sin(angle),Math.cos(angle));g.rotation.y+=angle*f;}
      g.userData.inner.rotation.z=this.reduced?0:Math.sin(t*2.4)*.035;
      g.userData.shadow.position.set(g.position.x,height(g.position.x,g.position.z)+.07,g.position.z);
      if(this.follow===id){const delta=g.position.clone().sub(before);this.camera.position.add(delta);this.controls.target.lerp(g.position,.07);}
    }
    if(!this.reduced){this.floaters.forEach((o,i)=>{o.group.position.y=o.y+2.7+Math.sin(t+i)*.35;o.crystal.rotation.y=t*.18;o.orbit.rotation.z=t*.09;});this.clouds.forEach((g,i)=>{g.position.x+=dt*(.13+i*.01);if(g.position.x>160)g.position.x=-160;});this.birds.forEach((b,i)=>{b.position.x=Math.sin(t*.055+i*.12)*40;b.position.z=-35+Math.cos(t*.055+i*.12)*18;b.rotation.y=t*.055;b.scale.y=.6+Math.sin(t*4+i)*.3;});}
    this.controls.update();this.renderer.render(this.scene,this.camera);this.frameCount++;
  }
}
