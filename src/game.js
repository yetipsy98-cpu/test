const $ = s => document.querySelector(s);
const canvas = $('#game'), ctx = canvas.getContext('2d');
const W = 1100, H = 650;
const keys = new Set();
const stations = [
  { x:110,y:130,w:180,h:82,name:'来电热线 A',sub:'月球房产 / 热线',color:'#e9c56c',type:'phone' },
  { x:435,y:130,w:180,h:82,name:'来电热线 B',sub:'企鹅保险 / 热线',color:'#86b7e8',type:'data' },
  { x:760,y:130,w:180,h:82,name:'来电热线 C',sub:'空气订阅 / 热线',color:'#bc9ce2',type:'design' },
  { x:435,y:440,w:180,h:82,name:'老板办公室',sub:'汇报工作 / 降低怒气',color:'#c5f575',type:'delivery' }
];
let players=[], playerCount=1, phase='menu', remaining=120, score=0, delivered=0, elapsed=0, last=performance.now(), muted=false, audio;
let toastUntil=0, particles=[];
let anger=0, day=1, call=null, callId=0, feedback='';
const callers=[
 {name:'王阿姨',persona:'退休宇航员 · 偏爱浪漫',balance:600,topic:'月球海景房',lines:['你说月球有海景房？那里不是没有海吗？','房子离地球这么远，我怎么去看房？','听起来太离谱了。给我一个买它的理由。'],answers:[['海是选配的，先送您一片星空。','下周安排月球物业挖海。','别问，买就对了。'],['坐您的退休火箭，头等舱留给猫。','请自己想办法。','传送门还在保修。'],['退休以后，总得有个地方看地球升起。','因为老板等着我下班。','您不买就亏了整个宇宙。']],good:[0,0,0]},
 {name:'李博士',persona:'企鹅研究员 · 热爱科学胡说',balance:800,topic:'企鹅防滑保险',lines:['企鹅已经很会滑冰了，为什么还要保险？','你们的理赔标准是什么？','最后一个问题：有研究支持吗？'],answers:[['企鹅也有下班后不想滑的时候。','因为冰面今天心情不好。','每只企鹅都必须买。'],['企鹅摔倒后，我们给冰山道歉。','赔一双想象中的防滑拖鞋。','看企鹅愿不愿意填表。'],['有，三只企鹅在餐巾纸上签了字。','数据还在南极堵车。','不要相信科学。']],good:[0,1,0]},
 {name:'陈总',persona:'云朵收藏家 · 喜欢排场',balance:1000,topic:'限量版空气订阅',lines:['普通空气免费，你这个有什么不同？','订阅后能送到办公室吗？','我为什么现在就要订？'],answers:[['这是周一清晨第一口限量空气。','没什么不同，只是瓶子很贵。','包装里藏着星期六。'],['云朵专车配送，还带一声雷当门铃。','您自己打开窗户。','得先买一架飞机。'],['每瓶都配有专属落日编号。','因为我赶着交业绩。','免费空气明天就要下班。']],good:[0,0,0]}
];
function renderCall(){
 const panel=$('#call-panel');panel.classList.toggle('hidden',!call);if(!call)return;
 const c=call.caller;panel.replaceChildren();
 const tag=document.createElement('div');tag.className='caller-tag';tag.textContent=`● 通话中 · ${call.player.name} · ${call.round+1}/3`;panel.append(tag);
 const title=document.createElement('h3');title.textContent=c.name+' / AI';panel.append(title);
 const desc=document.createElement('div');desc.className='caller-tag';desc.textContent=c.persona+' · '+c.topic;panel.append(desc);
 const meters=document.createElement('div');meters.className='meters';meters.textContent=`信任 ${call.trust}%　怀疑 ${call.suspicion}%　积蓄 ¥${c.balance}`;panel.append(meters);
 const line=document.createElement('p');line.textContent='“'+c.lines[call.round]+'”';panel.append(line);
 const f=document.createElement('div');f.className='feedback';f.textContent=feedback;panel.append(f);
 const answers=c.answers[call.round].map((label,index)=>({label,index}));
 // Rotate choices between calls, retaining their original meaning.
 const shift=(call.id+call.round)%3;answers.push(...answers.splice(0,shift));
 for(const answer of answers){const b=document.createElement('button');b.textContent=answer.label;b.disabled=phase!=='playing';b.addEventListener('click',()=>answerCall(answer.index));panel.append(b);}
 const quit=document.createElement('button');quit.className='hangup';quit.textContent='挂断电话 · 老板怒气 +10';quit.disabled=phase!=='playing';quit.onclick=()=>finishCall(false,true);panel.append(quit);
}
function answerCall(index){if(!call||phase!=='playing')return;const good=index===call.caller.good[call.round];call.trust+=good?25:5;call.suspicion+=good?0:35;feedback=good?'对方似乎被这个离谱故事打动了。':'对方开始怀疑你的说辞。';beep(good?580:190);if(call.suspicion>=70){finishCall(false);return;}if(++call.round>=3){finishCall(call.trust>=65);return;}renderCall();}
function finishCall(success,quit=false){if(!call)return;const p=call.player;if(success){const reward=Math.round(call.caller.balance*call.trust/100);score+=reward;delivered++;anger=Math.max(0,anger-5);toast(`来电成交 +¥${reward} · ${call.caller.name} 开始期待${call.caller.topic}`);beep(880);for(let i=0;i<25;i++)particles.push({x:p.x,y:p.y,vx:(Math.random()-.5)*180,vy:-Math.random()*180,t:1});}else{anger+=quit?10:18;toast('来电挂断 · 老板的血压上来了');beep(170);}call=null;renderCall();updateHUD();if(anger>=100)end();}
let best=0;
try { best=Number(localStorage.getItem('midnight-office-best')||0); } catch {}
const furniture=[{x:75,y:430,w:140,h:85},{x:800,y:405,w:155,h:85}];
function beep(freq=440){if(muted)return;try{audio??=new AudioContext();const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=freq;o.type='sine';g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.16);o.start();o.stop(audio.currentTime+.17);}catch{}}
function toast(text){$('#toast').textContent=text;$('#toast').style.opacity=1;toastUntil=performance.now()+2200;}
function nearest(p){return stations.find(s=>Math.hypot(p.x-(s.x+s.w/2),p.y-(s.y+s.h/2))<135);}
function interact(p){
  if(phase!=='playing')return;
  const station=nearest(p);if(!station){toast('靠近来电工位，再按交互键');return;}
  if(station.type==='delivery'){
    anger=Math.max(0,anger-15);remaining=Math.max(0,remaining-5);toast('向老板汇报了工作 · 怒气 -15，耗时 5 秒');updateHUD();return;
  }
  if(call){toast('有一通来电正在进行，先完成对话');return;}
  const caller=callers[callId%callers.length];
  call={caller,player:p,round:0,trust:15,suspicion:0,id:callId++};feedback='选择最符合对方性格的荒诞说辞。';renderCall();beep(580);
}
function updateHUD(){
  $('#day-number').textContent=String(day).padStart(3,'0');$('#goal-copy').textContent=`本日目标 ¥${(1000+(day-1)*500).toLocaleString()} · 荒诞来电，虚构货币`;
  $('#money').textContent='¥ '+score.toLocaleString();$('#delivered').innerHTML=String(delivered).padStart(2,'0')+' <em>通来电</em>';
  $('#tasks').innerHTML=`怒气 ${Math.round(anger)} / 100 · ${anger>70?'老板即将爆发！':anger>35?'老板：你们在忙什么？':'老板暂时很满意。'}<div class="bossbar"><span style="width:${Math.min(anger,100)}%"></span></div>`;
  $('#status').textContent=phase==='playing'?`第 ${day} 天 · 目标 ¥${1000+(day-1)*500}`:phase==='paused'?'已暂停':phase==='ended'?'本日考核完成':'等待开始营业';
}
function start(){
  if(phase==='paused'){phase='playing';$('#overlay').classList.add('hidden');renderCall();updateHUD();return;}
  if(phase!=='ended'||score<1000+(day-1)*500||anger>=100)day=1;else day++;
  remaining=120;score=0;delivered=0;elapsed=0;anger=0;call=null;callId=0;renderCall();particles=[];keys.clear();
  players=[{x:380,y:320,color:'#c5f575',name:'P1'}];
  if(playerCount===2)players.push({x:680,y:320,color:'#eab27a',name:'P2'});
  phase='playing';$('#overlay').classList.add('hidden');$('#mode-label').textContent=playerCount===2?'本地双人':'本地单人';updateHUD();beep();
}
function pause(){if(!['playing','paused'].includes(phase))return;if(phase==='paused'){start();return;}phase='paused';keys.clear();$('#modal-title').textContent='休息一下，夜班还在。';$('#modal-copy').textContent='计时已暂停。准备好后继续工作。';$('#mode-picker').style.display='none';$('#start').innerHTML='继续夜班 <span>↗</span>';$('#overlay').classList.remove('hidden');renderCall();updateHUD();}
function end(){
  if(phase==='ended')return;
  phase='ended';keys.clear();call=null;renderCall();const target=1000+(day-1)*500,passed=score>=target&&anger<100;const record=score>best;best=Math.max(best,score);
  try{localStorage.setItem('midnight-office-best',String(best));}catch{}
  $('#modal-title').textContent=anger>=100?'你被老板炒鱿鱼了。':passed?'老板：明天继续来上班。':'绩效不达标，老板很不高兴。';
  $('#modal-copy').innerHTML=`第 ${day} 天 · 成功 ${delivered} 通来电 · 收入 ¥${score} / ¥${target}<br>${record?'创造新纪录！':'历史最高：'} ¥${best}。${passed?'下一天目标将提高 ¥500。':'再来一次，证明你的胡说能力。'}`;
  $('#mode-picker').style.display='flex';$('#start').innerHTML=(passed?'进入下一天':'重新挑战')+' <span>↗</span>';$('#overlay').classList.remove('hidden');updateHUD();beep(260);
}
function blocked(x,y){return x<44||x>W-44||y<70||y>H-46||[...stations,...furniture].some(s=>x>s.x-16&&x<s.x+s.w+16&&y>s.y-12&&y<s.y+s.h+14);}
function update(dt,realDt=dt){if(phase!=='playing')return;remaining=Math.max(0,remaining-realDt);elapsed+=realDt;anger=Math.min(100,anger+realDt*(.18+day*.04));updateHUD();if(anger>=100){end();return;}
  const seconds=Math.ceil(remaining);$('#timer').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');$('#timer').style.color=remaining<20?'#ee9b84':'#c5f575';
  players.forEach((p,i)=>{
    if(call?.player===p){p.walking=false;return;}
    const controls=i===0?['a','d','w','s']:['arrowleft','arrowright','arrowup','arrowdown'];let dx=Number(keys.has(controls[1]))-Number(keys.has(controls[0])),dy=Number(keys.has(controls[3]))-Number(keys.has(controls[2]));let length=Math.hypot(dx,dy)||1;
    dx=dx/length*220*dt;dy=dy/length*220*dt;if(!blocked(p.x+dx,p.y))p.x+=dx;if(!blocked(p.x,p.y+dy))p.y+=dy;p.walking=!!(dx||dy);
  });
  particles=particles.filter(p=>(p.t-=dt)>0);particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=200*dt;});
  const prompts=players.map((p,i)=>{const s=nearest(p);return s?`${p.name} [${i?'Enter':'E'}] ${s.name}`:null;}).filter(Boolean);$('#prompt').style.display=prompts.length?'block':'none';$('#prompt').textContent=prompts.join('　｜　');
  if(!remaining)end();
}
function rect(x,y,w,h,color,r=0){ctx.fillStyle=color;if(r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}else ctx.fillRect(x,y,w,h);}
function text(str,x,y,size=14,color='#ced8c5',align='left'){ctx.fillStyle=color;ctx.font=`${size}px system-ui,sans-serif`;ctx.textAlign=align;ctx.fillText(str,x,y);}
function draw(){
  rect(0,0,W,H,'#29322b');
  for(let x=0;x<W;x+=55)for(let y=48;y<H;y+=55){rect(x+1,y+1,53,53,((x/55+Math.floor(y/55))%2)?'#303a31':'#2d372f');}
  rect(0,0,W,50,'#19251f');rect(0,50,W,6,'#52634d');rect(0,56,25,H,'#1d2b23');rect(W-25,56,25,H,'#1d2b23');rect(0,H-20,W,20,'#1d2b23');
  for(const x of [170,480,790]){rect(x,9,150,22,'#0d1715',3);rect(x+3,12,144,16,'#7b9486',2);for(let n=0;n<4;n++)rect(x+8+n*37,12,3,16,'#3d5046');}
  text('SCAM WITH YOUR FRIENDS / 离谱来电中心',W/2,37,12,'#b2c29b','center');
  rect(65,279,78,96,'#1a281e',5);rect(70,284,68,84,'#53674a',3);text('WORK',104,318,14,'#d8e5c5','center');text('HARD',104,341,14,'#d8e5c5','center');
  rect(967,265,65,115,'#1c2725',6);rect(974,272,51,52,'#486b71',5);rect(986,334,28,32,'#e7dfc1',3);text('☕',1000,357,21,'#fff','center');
  furniture.forEach((s,i)=>{rect(s.x+7,s.y+9,s.w,s.h,'#17251e90',6);rect(s.x,s.y,s.w,s.h,i?'#46513f':'#6b5a40',5);for(let j=0;j<3;j++){rect(s.x+8+j*45,s.y+9,36,s.h-18,i?'#65765a':'#8a7957',3);}text(i?'储物柜':'资料柜',s.x+s.w/2,s.y+s.h+23,12,'#84957a','center');});
  // Small floor markings make each workstation easy to identify.
  stations.forEach(s=>{const near=phase==='playing'&&players.some(p=>nearest(p)===s);ctx.strokeStyle=near?s.color:'#71816555';ctx.lineWidth=2;ctx.setLineDash([7,7]);ctx.strokeRect(s.x-13,s.y-10,s.w+26,s.h+50);ctx.setLineDash([]);
    rect(s.x+7,s.y+10,s.w,s.h,'#14201899',5);rect(s.x,s.y,s.w,s.h,'#584e3a',5);rect(s.x+2,s.y+2,s.w-4,s.h-10,'#968363',4);rect(s.x+5,s.y+5,s.w-10,4,'#b49e75');
    if(s.type==='phone'){rect(s.x+23,s.y+25,57,33,'#303f32',8);rect(s.x+18,s.y+17,67,13,'#1a2820',7);for(let i=0;i<9;i++)rect(s.x+39+(i%3)*8,s.y+34+Math.floor(i/3)*7,4,4,'#9daa83');rect(s.x+113,s.y+22,35,40,'#ddd9b7',2);for(let i=0;i<4;i++)rect(s.x+118,s.y+30+i*7,23,2,'#a4a18a');if(phase==='playing'){const pulse=.4+Math.sin(elapsed*5)*.3;ctx.globalAlpha=pulse;rect(s.x+7,s.y-9,10,10,s.color,5);ctx.globalAlpha=1;}}
    else if(s.type==='delivery'){rect(s.x+30,s.y+12,120,53,'#526341',3);rect(s.x+40,s.y+21,100,5,'#7e9561');text('BOSS ↓',s.x+90,s.y+49,14,'#d7e5bb','center');}
    else{rect(s.x+54,s.y+7,72,44,'#23342d',4);rect(s.x+60,s.y+13,60,31,s.color,2);rect(s.x+85,s.y+50,10,8,'#2b3c2f');rect(s.x+65,s.y+58,53,9,'#465341',2);rect(s.x+21,s.y+34,23,28,'#d7d5b2',2);text(s.type==='data'?'≡':'✦',s.x+90,s.y+37,23,'#2a3a3d','center');}
    text(s.name,s.x+s.w/2,s.y+s.h+25,15,s.color,'center');text(s.sub,s.x+s.w/2,s.y+s.h+44,10,'#8f9e83','center');
  });
  // Plants and the welcome rug.
  for(const [x,y] of [[58,100],[1039,565]]){rect(x-14,y+5,28,25,'#a37d53',3);for(let j=0;j<5;j++){ctx.fillStyle=j%2?'#6d9250':'#4c7647';ctx.beginPath();ctx.ellipse(x+Math.sin(j*2)*13,y-5-Math.cos(j*2)*12,10,19,j,0,Math.PI*2);ctx.fill();}}
  rect(418,565,214,47,'#465440',3);text('NO OVERTIME, PLEASE.',525,594,13,'#a7b38b','center');
  rect(511,397,28,30,'#9c544b',7);rect(516,378,18,22,'#dab28b',6);rect(514,375,22,8,'#40372c',3);text('BOSS',525,365,10,anger>60?'#ec9b7d':'#9fad8c','center');
  const figures=players.length?players:[{x:380,y:320,color:'#c5f575',name:'P1'},{x:680,y:320,color:'#eab27a',name:'P2'}];
  figures.slice().sort((a,b)=>a.y-b.y).forEach(p=>{let bob=p.walking&&phase==='playing'?Math.sin(elapsed*15)*2:0;ctx.fillStyle='#08130c66';ctx.beginPath();ctx.ellipse(p.x,p.y+15,22,10,0,0,Math.PI*2);ctx.fill();rect(p.x-12,p.y+5,9,15,'#202d27',3);rect(p.x+3,p.y+5,9,15,'#202d27',3);rect(p.x-17,p.y-22+bob,34,32,p.color,8);rect(p.x-12,p.y-39+bob,24,25,'#e7ba90',8);rect(p.x-13,p.y-43+bob,26,12,'#493c30',6);rect(p.x+7,p.y-29+bob,3,3,'#473c30');text(p.name,p.x,p.y-55,11,p.color,'center');
    if(call?.player===p){text('☎',p.x+25,p.y-20,24,'#e9c56c','center');}

  });
  particles.forEach(p=>{ctx.globalAlpha=p.t;rect(p.x,p.y,5,5,'#c5f575');});ctx.globalAlpha=1;
  const vignette=ctx.createRadialGradient(W/2,H/2,180,W/2,H/2,650);vignette.addColorStop(0,'transparent');vignette.addColorStop(1,'#08160e88');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
}
function chaos(){if(phase!=='playing')return;anger=Math.min(100,anger+8);for(let i=0;i<30;i++)particles.push({x:players[0].x,y:players[0].y,vx:(Math.random()-.5)*300,vy:-Math.random()*240,t:1});toast('你把文件撒了一地！老板怒气 +8');beep(140);updateHUD();if(anger>=100)end();}
function frame(now){const realDt=Math.max(0,(now-last)/1000);last=now;update(Math.min(realDt,.05),realDt);draw();if(now>toastUntil)$('#toast').style.opacity=0;requestAnimationFrame(frame);}
document.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' ','enter','escape'].includes(k))e.preventDefault();if(e.repeat)return;keys.add(k);if(k==='escape')pause();if(k===' ')chaos();if(k==='e'&&players[0])interact(players[0]);if(k==='enter'&&players[1])interact(players[1]);});
document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();if(phase==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&phase==='playing')pause();});
$('.primary').addEventListener('click',start);$('#pause').addEventListener('click',pause);$('#sound').addEventListener('click',()=>{muted=!muted;$('#sound').textContent='音效：'+(muted?'关':'开');});
document.querySelectorAll('.mode').forEach(b=>b.addEventListener('click',()=>{playerCount=Number(b.dataset.players);document.querySelectorAll('.mode').forEach(x=>x.classList.toggle('active',x===b));}));
$('#help').addEventListener('click',()=>{if(phase==='playing')pause();toast('P1：WASD + E；P2：方向键 + Enter。靠近任意热线接听 → 点击说辞；空格捣乱；向老板汇报可降怒气。');});
document.querySelectorAll('[data-key]').forEach(b=>{b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);if(b.dataset.key===' ')chaos();if(b.dataset.key==='e'&&players[0])interact(players[0]);});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>keys.delete(b.dataset.key));});
requestAnimationFrame(frame);
