const NAV=[['home','⌂','Home'],['setlists','☷','Setlists'],['songs','♫','Songs'],['pads','▦','Cue Pads'],['lyrics','▤','Lyrics'],['media','▣','Media'],['tv','▱','TV Display'],['settings','⚙','Settings'],['backup','☁','Backup'],['help','?','Help']];
const DB_NAME='ShowCueMediaDB',DB_VER=1,STORE='files';
let dbPromise=null,displayWindow=null,autoTimer=null;
let state={padCount:Number(localStorage.getItem('showcue-pad-count')||12),setlists:[],songs:['Daar Sal Jy My Kry','Hey Karolien','Luister Na Jou Hart'],media:[],pads:{},current:null,playing:false,muted:false,displayEnabled:false,levelMatchSync:false,cutTrack:false,leadInBars:4};
try{Object.assign(state,JSON.parse(localStorage.getItem('showcue-v5-state')||localStorage.getItem('showcue-v4-state')||'{}'))}catch(e){}
if(!Array.isArray(state.setlists))state.setlists=[];
state.setlists=(state.setlists||[]).map((x,i)=>typeof x==='string'?{id:'setlist-'+i,name:x,pads:{},padCount:state.padCount}:Object.assign({padCount:state.padCount,pads:{}},x));
state.lyricsText=state.lyricsText||'';state.lyricsSync=state.lyricsSync||null;state.lyricsSpeed=Number(state.lyricsSpeed||5);
state.songs=(state.songs||[]).map((s,i)=>typeof s==='string'?{id:'song-'+i+'-'+btoa(unescape(encodeURIComponent(s))).replace(/[^a-z0-9]/gi,'').slice(0,12),name:s,audioKey:null,bpm:120}:Object.assign({bpm:120},s));
state.media=state.media||[];
state.pads=state.pads||{};state.leadInBars=Number(state.leadInBars)===2?2:4;
const $=s=>document.querySelector(s);let pdfLoadPromise=null;async function ensurePdfLib(){if(window.pdfjsLib)return window.pdfjsLib;if(pdfLoadPromise)return pdfLoadPromise;pdfLoadPromise=new Promise((resolve,reject)=>{const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.js';sc.onload=()=>resolve(window.pdfjsLib);sc.onerror=reject;document.head.appendChild(sc)});return pdfLoadPromise}const save=()=>{localStorage.setItem('showcue-v5-state',JSON.stringify(state));localStorage.setItem('showcue-pad-count',state.padCount)};
function openDB(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,DB_VER);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return dbPromise}
async function putFile(key,file){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(file,key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function getFile(key){if(!key)return null;const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readonly');const q=tx.objectStore(STORE).get(key);q.onsuccess=()=>res(q.result||null);q.onerror=()=>rej(q.error)})}
async function deleteFile(key){if(!key)return;const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
function showView(id){document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));window.scrollTo(0,0);if(id==='pads')renderPads();if(id==='lyrics')renderLyrics();if(id==='setlists')renderSetlists();if(id==='songs')renderSongs();if(id==='media')renderMedia();if(id==='tv')renderDisplayButton()}
function buildNav(){const make=a=>a.map(([id,ic,n])=>`<button data-view="${id}">${ic} <span>${n}</span></button>`).join('');$('#sideNav').innerHTML=make(NAV);$('#mobileNav').innerHTML=make(NAV.slice(0,5));document.addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){e.preventDefault();showView(b.dataset.view)}})}
function snapshotPads(){return JSON.parse(JSON.stringify(state.pads||{}))}
function renderSetlists(){$('#setlistRows').innerHTML=state.setlists.length?state.setlists.map((s,i)=>{const count=Object.keys(s.pads||{}).filter(k=>{const p=s.pads[k];return p&&(p.songId||p.videoId||p.name&&p.name!=='Empty Pad')}).length;return `<div class="setlist-card"><div class="row"><div class="grow"><b>${escapeHtml(s.name)}</b><div class="muted">Saved Cue Pad show · ${count} configured pads</div></div></div><div class="setlist-actions"><button class="btn primary" onclick="loadSetlist(${i})">LOAD INTO CUE PADS</button><button class="btn" onclick="renameSetlist(${i})">RENAME</button><button class="btn" onclick="updateSetlist(${i})">UPDATE FROM CURRENT PADS</button><button class="btn danger" onclick="deleteSetlist(${i})">DELETE</button></div></div>`}).join(''):'<div class="muted">No saved setlists yet. Configure your Cue Pads, then use “SAVE CURRENT PADS AS SETLIST”.</div>'}
function escapeHtml(v){return String(v == null ? '' : v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]))}
function saveCurrentAsSetlist(){const n=prompt('Setlist name');if(!n)return;state.setlists.push({id:'setlist-'+Date.now(),name:n,pads:snapshotPads(),padCount:state.padCount,createdAt:Date.now()});save();renderSetlists()}
function loadSetlist(i){const s=state.setlists[i];if(!s)return;state.pads=JSON.parse(JSON.stringify(s.pads||{}));state.padCount=Number(s.padCount||state.padCount||12);save();renderPads();showView('pads')}
function updateSetlist(i){const s=state.setlists[i];if(!s)return;s.pads=snapshotPads();s.padCount=state.padCount;s.updatedAt=Date.now();save();renderSetlists()}
function renameSetlist(i){const s=state.setlists[i];if(!s)return;const n=prompt('Setlist name',s.name);if(n){s.name=n;save();renderSetlists()}}
function deleteSetlist(i){if(confirm('Delete this saved setlist?')){state.setlists.splice(i,1);save();renderSetlists()}}
$('#addSetlist').onclick=()=>{const n=prompt('Empty setlist name');if(n){state.setlists.push({id:'setlist-'+Date.now(),name:n,pads:{},padCount:state.padCount});save();renderSetlists()}};$('#saveCurrentSetlist').onclick=saveCurrentAsSetlist;

function renderSongs(){$('#songRows').innerHTML=state.songs.map((s,i)=>`<div class="row"><div class="grow"><b>${s.name}</b><div class="muted">${s.audioKey?'Audio track loaded':'No audio file loaded'} · Ready for Cue Pad assignment</div></div><div class="song-controls"><label class="muted">BPM <input class="bpm-input" data-bpm="${i}" type="number" min="30" max="300" step="1" value="${s.bpm||120}"></label>${s.audioKey?'<span class="muted">🎵</span>':''}<button class="btn" onclick="deleteSong(${i})">DELETE</button></div></div>`).join('');document.querySelectorAll('[data-bpm]').forEach(x=>x.addEventListener('change',()=>{state.songs[Number(x.dataset.bpm)].bpm=Math.max(30,Math.min(300,Number(x.value)||120));save()}))}
function deleteSong(i){const s=state.songs[i];if((s && s.audioKey))deleteFile(s.audioKey);state.songs.splice(i,1);Object.values(state.pads).forEach(p=>{if(p.songId===(s && s.id))p.songId=''});save();renderSongs();renderPads()}
$('#addSong').onclick=()=>{const n=prompt('Song name');if(n){state.songs.push({id:'song-'+Date.now(),name:n,audioKey:null,bpm:120});save();renderSongs();renderPads()}};
const AUDIO_EXTS=['mp3','aiff','flac','m4a','wav','wma'];
const VIDEO_EXTS=['mp4','m4v','mov','avi'];
function extOf(name){const m=/\.([^.]+)$/.exec(name||'');return m?m[1].toLowerCase():''}
function fileTypeOk(file,exts){return exts.includes(extOf(file.name))}
$('#audioUpload').onchange=async e=>{const files=[...e.target.files];const good=files.filter(f=>fileTypeOk(f,AUDIO_EXTS));const bad=files.filter(f=>!fileTypeOk(f,AUDIO_EXTS));let added=0;for(const f of good){const id='song-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),key='audio-'+id;try{await putFile(key,f);state.songs.push({id,name:f.name.replace(/\.[^.]+$/,''),audioKey:key,fileName:f.name,bpm:120,loudnessDb:null,leadInSec:null});added++}catch(err){console.error(err)}}save();renderSongs();renderPads();$('#audioImportStatus').textContent=`Imported ${added} audio file${added===1?'':'s'}${bad.length?` · Skipped ${bad.length} unsupported extension(s)`:''}. Set BPM per song if Cut Track is used.`;e.target.value=''};
function renderMedia(){$('#mediaRows').innerHTML=state.media.length?state.media.map((m,i)=>`<div class="row"><div class="grow"><b>${m.name}</b><div class="muted">Video · ${m.fileName||''}</div></div><button class="btn" onclick="deleteMedia(${i})">DELETE</button></div>`).join(''):'<div class="muted">No videos added yet.</div>'}
async function deleteMedia(i){const m=state.media[i];if((m && m.fileKey))await deleteFile(m.fileKey);state.media.splice(i,1);Object.values(state.pads).forEach(p=>{if(p.videoId===(m && m.id))p.videoId=''});save();renderMedia();renderPads()}
$('#clearAllVideos').onclick=async()=>{if(!state.media.length){renderMedia();return}if(!confirm('Clear all imported videos? This will also remove video assignments from Cue Pads.'))return;for(const m of state.media){if((m && m.fileKey))await deleteFile(m.fileKey)}state.media=[];Object.values(state.pads).forEach(p=>{p.videoId=''});save();renderMedia();renderPads();$('#videoImportStatus').textContent='All imported videos cleared.'};
$('#videoUpload').onchange=async e=>{const files=[...e.target.files];const good=files.filter(f=>fileTypeOk(f,VIDEO_EXTS));const bad=files.filter(f=>!fileTypeOk(f,VIDEO_EXTS));let added=0;for(const f of good){const id='video-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),key='video-'+id;try{await putFile(key,f);state.media.push({id,name:f.name.replace(/\.[^.]+$/,''),fileKey:key,fileName:f.name,type:'video'});added++}catch(err){console.error(err)}}save();renderMedia();renderPads();$('#videoImportStatus').textContent=`Imported ${added} video file${added===1?'':'s'}${bad.length?` · Skipped ${bad.length} unsupported extension(s)`:''}.`;e.target.value=''};
function padBackground(p){return p.color||'#17232e'}
function editPadTouch(e,i){if(e){try{e.preventDefault()}catch(_){ }try{e.stopPropagation()}catch(_){ }}openPadEdit(i);return false}
function renderPads(){$('#padGrid').innerHTML=Array.from({length:state.padCount},(_,i)=>{const p=state.pads[i]||{name:'Empty Pad',songId:'',videoId:'',color:'#17232e'};const s=state.songs.find(x=>x.id===p.songId),v=state.media.find(x=>x.id===p.videoId);return `<div class="pad" data-pad="${i}" style="background:linear-gradient(145deg,${padBackground(p)},#0d151e)"><span class="pad-num">${i+1}</span><button type="button" class="pad-edit" aria-label="Edit pad" onclick="editPadTouch(event,${i});return false;">✎</button><div class="pad-name">${p.name}</div><div class="pad-type">${s?s.name:'No audio'}${v?' · 📺 '+v.name:''}</div></div>`}).join('');updateCountButtons()}
function updateCountButtons(){document.querySelectorAll('[data-count]').forEach(b=>b.classList.toggle('active',Number(b.dataset.count)===state.padCount))}
$('#clearPads').onclick=()=>{if(!confirm('Clear all Cue Pads, including assigned songs and videos?'))return;state.pads={};state.current=null;save();renderPads();$('#nowTitle').textContent='Nothing cued';$('#nowSub').textContent='Choose a pad';audio.pause();video.pause();}
document.addEventListener('click',e=>{let n=e.target,pad=null;while(n&&n!==document){if(n.getAttribute&&n.getAttribute('data-pad')!==null){pad=n;break}n=n.parentNode}if(pad){e.preventDefault();cuePad(Number(pad.getAttribute('data-pad')))}});
document.querySelectorAll('[data-count]').forEach(b=>b.addEventListener('click',()=>{state.padCount=Number(b.dataset.count);save();renderPads();updateCountButtons()}));
function openPadEdit(i){const p=state.pads[i]||{name:'Pad '+(i+1),songId:'',videoId:'',color:'#17232e'};$('#padName').value=p.name;$('#padColor').value=p.color||'#17232e';$('#padAssign').innerHTML='<option value="">— No audio track —</option>'+state.songs.map(s=>`<option value="${s.id}">${s.name}${s.audioKey?'':' (no audio file)'}</option>`).join('');$('#padAssign').value=p.songId||'';$('#padVideo').innerHTML='<option value="">— No video —</option>'+state.media.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');$('#padVideo').value=p.videoId||'';$('#padModal').dataset.index=i;$('#padModal').classList.add('open')}
$('#resetPadColor').onclick=()=>$('#padColor').value='#17232e';$('#padCancel').onclick=()=>$('#padModal').classList.remove('open');
$('#padSave').onclick=()=>{const i=Number($('#padModal').dataset.index);state.pads[i]={name:$('#padName').value||'Pad '+(i+1),songId:$('#padAssign').value,videoId:$('#padVideo').value,color:$('#padColor').value};save();$('#padModal').classList.remove('open');renderPads()};
const audio=$('#cueAudio'),video=$('#cueVideo');
let activeVideoUrl=null,activeAudioUrl=null;
let audioGainNode=null,audioCtx=null,mediaSourceNode=null;
const mediaCache=new Map();

function ensureAudioGraph(){
  try{
    if(audioCtx)return true;
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return false;
    audioCtx=new AC();
    mediaSourceNode=audioCtx.createMediaElementSource(audio);
    audioGainNode=audioCtx.createGain();
    mediaSourceNode.connect(audioGainNode);
    audioGainNode.connect(audioCtx.destination);
    return true;
  }catch(e){console.warn('Web Audio unavailable',e);return false}
}
function resumeAudioContext(){try{if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume()}catch(e){}}
function setPlaybackGain(db){if(!ensureAudioGraph()||!audioGainNode)return;const g=Math.pow(10,(db||0)/20);audioGainNode.gain.setValueAtTime(g,audioCtx.currentTime)}
function releaseCache(key){const x=mediaCache.get(key);if(x){URL.revokeObjectURL(x.url);mediaCache.delete(key)}}
async function preloadFile(key){
  if(!key||mediaCache.has(key))return mediaCache.get(key);
  const f=await getFile(key);
  if(!f)return null;
  const url=URL.createObjectURL(f);
  const item={blob:f,url};
  mediaCache.set(key,item);
  return item;
}
async function preloadPadFiles(){
  const jobs=[];
  Object.values(state.pads||{}).forEach(p=>{
    const s=state.songs.find(x=>x.id===p.songId),m=state.media.find(x=>x.id===p.videoId);
    if((s && s.audioKey))jobs.push(preloadFile(s.audioKey));
    if((m && m.fileKey))jobs.push(preloadFile(m.fileKey));
  });
  try{await Promise.all(jobs)}catch(e){}
}
function rmsDbFromBuffer(buffer){
  let sum=0,count=0;
  const maxFrames=Math.min(buffer.length,Math.floor(buffer.sampleRate*60));
  const step=Math.max(1,Math.floor(maxFrames/250000));
  for(let i=0;i<maxFrames;i+=step){
    let v=0;
    for(let c=0;c<buffer.numberOfChannels;c++)v+=buffer.getChannelData(c)[i]||0;
    v/=buffer.numberOfChannels;
    sum+=v*v;count++;
  }
  const rms=Math.sqrt(sum/Math.max(1,count));
  return 20*Math.log10(Math.max(rms,1e-7));
}
async function analyzeSong(song){
  if(!(song && song.audioKey))return null;
  if(typeof song.loudnessDb==='number'&&typeof song.leadInSec==='number')return song;
  const item=mediaCache.get(song.audioKey)||await preloadFile(song.audioKey);
  if(!item)return song;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    if(!AC)return song;
    const buf=await item.blob.arrayBuffer();
    const ctx=new AC();
    const decoded=await ctx.decodeAudioData(buf.slice(0));
    song.loudnessDb=rmsDbFromBuffer(decoded);
    const threshold=0.012;
    const maxFrames=Math.min(decoded.length,Math.floor(decoded.sampleRate*120));
    const step=Math.max(1,Math.floor(decoded.sampleRate/80));
    let first=0;
    for(let i=0;i<maxFrames;i+=step){
      let peak=0;
      for(let c=0;c<decoded.numberOfChannels;c++){
        const data=decoded.getChannelData(c);
        for(let j=0;j<Math.min(step,decoded.length-i);j++)peak=Math.max(peak,Math.abs(data[i+j]||0));
      }
      if(peak>threshold){first=i/decoded.sampleRate;break}
    }
    song.leadInSec=first;
    try{ctx.close()}catch(e){}
    save();
  }catch(e){song.loudnessDb=null;song.leadInSec=null}
  return song;
}
async function analyzeAllSongs(){
  for(const s of state.songs||[])if(s.audioKey&&(s.loudnessDb==null||s.leadInSec==null))await analyzeSong(s);
}
function matchingGainDb(song){
  if(!state.levelMatchSync||typeof (song && song.loudnessDb)!=='number')return 0;
  const loudest=(state.songs||[]).reduce((m,s)=>typeof s.loudnessDb==='number'?Math.max(m,s.loudnessDb):m,-Infinity);
  if(!isFinite(loudest))return 0;
  return Math.max(0,Math.min(18,loudest-song.loudnessDb));
}
function getStartOffset(song){
  if(!state.cutTrack||!song)return 0;
  const bpm=Math.max(30,Math.min(300,Number(song.bpm)||120));
  const bars=state.leadInBars===2?2:4;
  const leadIn=(60/bpm)*4*bars;
  const lead=Math.max(0,Number(song.leadInSec)||0);
  return Math.max(0,lead-leadIn);
}
async function prepareCue(p){
  audio.pause();video.pause();
  if(activeAudioUrl){URL.revokeObjectURL(activeAudioUrl);activeAudioUrl=null}
  if(activeVideoUrl){URL.revokeObjectURL(activeVideoUrl);activeVideoUrl=null}
  audio.removeAttribute('src');video.removeAttribute('src');video.style.display='none';
  const s=state.songs.find(x=>x.id===p.songId),m=state.media.find(x=>x.id===p.videoId);
  if((s && s.audioKey)){
    const item=mediaCache.get(s.audioKey)||await preloadFile(s.audioKey);
    if(item){activeAudioUrl=item.url;audio.src=item.url;audio.load()}
  }
  if((m && m.fileKey)){
    const item=mediaCache.get(m.fileKey)||await preloadFile(m.fileKey);
    if(item){activeVideoUrl=item.url;video.src=item.url;video.muted=true;video.style.display='none';video.load()}
  }
  if((s && s.audioKey) && (state.levelMatchSync||state.cutTrack)){
    await analyzeSong(s);
  }
  setPlaybackGain(matchingGainDb(s));
  return {s,m};
}
function startPreparedCue(s,m){
  resumeAudioContext();
  const offset=getStartOffset(s);
  try{
    audio.currentTime=offset;
    if(video.src)video.currentTime=offset;
  }catch(e){}
  const pa=audio.play();
  if(pa&&pa.catch)pa.catch(err=>console.warn('Audio play blocked',err));
  if(m&&video.src){const pv=video.play();if(pv&&pv.catch)pv.catch(err=>console.warn('Video play blocked',err))}
}
async function cuePad(i){
  const p=state.pads[i]||{name:'Empty Pad',songId:'',videoId:'',color:'#17232e'};
  document.querySelectorAll('.pad').forEach(x=>x.classList.remove('flash'));
  const flashPad=document.querySelector(`[data-pad="${i}"]`);if(flashPad)flashPad.classList.add('flash');
  state.current=p;state.lyricsSync=null;
  const {s,m}=await prepareCue(p);
  $('#nowTitle').textContent=p.name;
  $('#nowSub').textContent=(s?s.name:'No audio track')+(m?' · '+m.name:'');
  if((s && s.audioKey)){
    state.playing=true;
    startPreparedCue(s,m);
    $('#play').textContent='❚❚';
  }else{
    state.playing=false;$('#play').textContent='▶';
  }
  if(state.displayEnabled)syncDisplay('cue');
}
function syncAV(){
  if(video.src&&audio.src&&!video.paused&&Math.abs(video.currentTime-audio.currentTime)>.08){
    try{video.currentTime=audio.currentTime}catch(e){}
  }
}
setInterval(syncAV,250);
audio.addEventListener('play',()=>{state.playing=true;resumeAudioContext();if(video.src&&video.paused)video.play().catch(()=>{});$('#play').textContent='❚❚';syncDisplay('play')});
audio.addEventListener('pause',()=>{state.playing=false;video.pause();$('#play').textContent='▶';syncDisplay('pause')});
audio.addEventListener('ended',()=>{video.pause();state.playing=false;$('#play').textContent='▶';syncDisplay('stop')});
$('#play').onclick=()=>{resumeAudioContext();if(!audio.src)return;if(audio.paused)audio.play().catch(()=>{});else audio.pause()};
$('#stop').onclick=()=>{audio.pause();video.pause();try{audio.currentTime=getStartOffset(state.songs.find(x=>x.id===(state.current && state.current.songId)))}catch(e){}try{video.currentTime=audio.currentTime}catch(e){}state.playing=false;$('#play').textContent='▶';syncDisplay('stop')};
$('#prev').onclick=()=>$('#nowSub').textContent='Previous cue';
$('#next').onclick=()=>$('#nowSub').textContent='Next cue';
$('#mute').onclick=()=>{state.muted=!state.muted;audio.muted=state.muted;$('#mute').textContent=state.muted?'🔇':'🔊'};
document.addEventListener('visibilitychange',()=>{if(!document.hidden)preloadPadFiles()});
function renderLyrics(){const text=state.lyricsText||'';$('#lyricsEditor').value=text;const lines=(text||'Ready for lyrics').split(/\n/);$('#lyricsScroll').innerHTML=lines.map((x,i)=>`<p class="${i===0?'current':''}">${escapeHtml(x||' ')}</p>`).join('');$('#lyricsPads').innerHTML=Array.from({length:state.padCount},(_,i)=>{const p=state.pads[i]||{name:'Empty Pad',songId:'',videoId:'',color:'#17232e'};const s=state.songs.find(x=>x.id===p.songId),v=state.media.find(x=>x.id===p.videoId);return `<button class="lyrics-pad" data-lyrics-pad="${i}" style="border-left:5px solid ${padBackground(p)}"><b>PAD ${i+1}</b><div>${escapeHtml(p.name||'Empty Pad')}</div><div class="muted">${escapeHtml((s && s.name)||'No audio')}${v?' · 📺 '+escapeHtml(v.name):''}</div></button>`}).join('');$('#lyricsSpeed').value=state.lyricsSpeed||5;$('#lyricsSpeedValue').textContent=state.lyricsSpeed||5}
$('#lyricsEditor').addEventListener('input',()=>{state.lyricsText=$('#lyricsEditor').value;save();const y=$('#lyricsScroll').scrollTop;renderLyrics();$('#lyricsScroll').scrollTop=y});$('#lyricsSpeed').addEventListener('input',()=>{state.lyricsSpeed=Number($('#lyricsSpeed').value);$('#lyricsSpeedValue').textContent=state.lyricsSpeed;save()});$('#importLyrics').onclick=()=>$('#lyricsFileUpload').click();$('#lyricsFileUpload').onchange=async e=>{const f=e.target.files && e.target.files[0];if(!f)return;const ext=extOf(f.name);try{let text='';if(ext==='doc'||ext==='docx'){if(!window.mammoth)throw new Error('Word parser not loaded');text=await window.mammoth.extractRawText({arrayBuffer:await f.arrayBuffer()}).then(r=>r.value)}else if(ext==='pdf'){if(!window.pdfjsLib)try{await ensurePdfLib()}catch(_){ }if(window.pdfjsLib){window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js';const pdf=await window.pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;const pages=[];for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i);const c=await pg.getTextContent();pages.push(c.items.map(x=>x.str).join(' '))}text=pages.join('\n')}else throw new Error('PDF parser not available')}else{text=await f.text()}state.lyricsText=text||'';save();renderLyrics();alert('Lyrics imported.');}catch(err){console.error(err);alert('Could not read this lyrics file on this device. You can still type or paste the lyrics manually.')}e.target.value=''};
$('#syncLyrics').onclick=()=>{if(!state.current){alert('Cue a pad with a song first.');return}const song=state.songs.find(x=>x.id===state.current.songId);if(!(song && song.audioKey)){alert('The current pad has no audio track.');return}const lineEls=[...$('#lyricsScroll').querySelectorAll('p')];const total=Math.max(1,lineEls.length);const duration=audio.duration||0;state.lyricsSync={songId:song.id,startedAt:audio.currentTime||0,speed:state.lyricsSpeed||5,lineCount:total,duration};save();if(!autoTimer){$('#lyricsAuto').textContent='STOP SCROLL';autoTimer=setInterval(syncLyricsScroll,80)}alert('Lyrics synced to the current track. Use the speed slider to make the scroll slower or faster.');};
function syncLyricsScroll(){if(!state.lyricsSync||!audio.src||!audio.duration)return;const base=Number(state.lyricsSync.startedAt)||0;const elapsed=Math.max(0,audio.currentTime-base);const remaining=Math.max(0,(audio.duration-base));const progress=remaining?Math.min(1,elapsed/remaining):0;const max=$('#lyricsScroll').scrollHeight-$('#lyricsScroll').clientHeight;let speed=Number(state.lyricsSpeed||5);let target=max*progress*(0.65+speed/10*0.35);$('#lyricsScroll').scrollTop=Math.max(0,Math.min(max,target));}

$('#lyricsAuto').onclick=()=>{if(autoTimer){clearInterval(autoTimer);autoTimer=null;$('#lyricsAuto').textContent='AUTO SCROLL'}else{$('#lyricsAuto').textContent='STOP SCROLL';autoTimer=setInterval(()=>state.lyricsSync?syncLyricsScroll():$('#lyricsScroll').scrollBy({top:state.lyricsSpeed||5,left:0}),80)}};$('#lyricsUp').onclick=()=>$('#lyricsScroll').scrollBy({top:-300,behavior:'smooth'});$('#lyricsDown').onclick=()=>$('#lyricsScroll').scrollBy({top:300,behavior:'smooth'});$('#lyricsReset').onclick=()=>$('#lyricsScroll').scrollTo({top:0,behavior:'smooth'});
document.addEventListener('click',e=>{const b=e.target.closest('[data-lyrics-pad]');if(b){e.preventDefault();cuePad(Number(b.dataset.lyricsPad))}});

function renderDisplayButton(){$('#displayToggle').textContent=state.displayEnabled?'ON':'OFF';$('#displayToggle').classList.toggle('primary',state.displayEnabled)}
$('#displayToggle').onclick=()=>{state.displayEnabled=!state.displayEnabled;save();renderDisplayButton();if(state.displayEnabled&&!displayWindow)openDisplayWindow()};
function openDisplayWindow(){displayWindow=window.open('./display.html','ShowCueDisplay','popup,width=1280,height=720');if(!displayWindow){alert('Please allow pop-ups for ShowCue to open the TV Display window.');return}setTimeout(()=>syncDisplay('ready'),500)}
function syncDisplay(action){if(!state.displayEnabled||!displayWindow||displayWindow.closed)return;const p=state.current||{},s=state.songs.find(x=>x.id===p.songId),m=state.media.find(x=>x.id===p.videoId);displayWindow.postMessage({source:'showcue',action,pad:p,song:s?{name:s.name}:null,video:m?{name:m.name}:null,time:audio.currentTime||0,playing:!audio.paused,muted:state.muted},'*')}
$('#openTv').onclick=()=>{state.displayEnabled=true;save();renderDisplayButton();openDisplayWindow()};$('#openTvFromPad').onclick=()=>{state.displayEnabled=true;save();renderDisplayButton();if(!displayWindow||displayWindow.closed)openDisplayWindow();setTimeout(()=>syncDisplay('open'),300)};$('#tvClose').onclick=()=>$('#tvScreen').classList.remove('open');$('#backToPads').onclick=()=>{$('#tvScreen').classList.remove('open');showView('pads')};
$('#export').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='showcue-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)};$('#importFile').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{state=JSON.parse(r.result);save();renderAll()}catch(_){alert('Invalid ShowCue backup')}};r.readAsText(f)};
window.addEventListener('message',e=>{if((e.data && e.data.source)==='showcue-display'&&audio.src&&Math.abs(audio.currentTime-e.data.time)>.15)audio.currentTime=e.data.time});

function renderProcessingSettings(){
  $('#levelMatchToggle').textContent=state.levelMatchSync?'ON':'OFF';
  $('#levelMatchToggle').classList.toggle('on',state.levelMatchSync);
  $('#cutTrackToggle').textContent=state.cutTrack?'ON':'OFF';
  $('#cutTrackToggle').classList.toggle('on',state.cutTrack);
  updateCountButtons();
}
function renderLeadInOptions(){document.querySelectorAll('[data-lead-bars]').forEach(b=>b.classList.toggle('active',Number(b.dataset.leadBars)===state.leadInBars));}
document.querySelectorAll('[data-lead-bars]').forEach(b=>b.addEventListener('click',()=>{state.leadInBars=Number(b.dataset.leadBars)===2?2:4;save();renderLeadInOptions()}));
$('#levelMatchToggle').onclick=async()=>{state.levelMatchSync=!state.levelMatchSync;save();renderProcessingSettings();if(state.levelMatchSync){$('#levelMatchToggle').textContent='ANALYSING…';await analyzeAllSongs();renderProcessingSettings()}};
$('#cutTrackToggle').onclick=async()=>{state.cutTrack=!state.cutTrack;save();renderProcessingSettings();if(state.cutTrack){await analyzeAllSongs()}};
$('#homeExit').onclick=()=>{try{window.close()}catch(e){}setTimeout(()=>{if(!document.hidden&&!window.closed){alert('Your browser may not allow a web app to close itself. Use the device Home button/app switcher to leave ShowCue.')}},120)};
function renderAll(){renderSetlists();renderSongs();renderMedia();renderPads();renderLyrics();renderDisplayButton();renderProcessingSettings();renderLeadInOptions()}buildNav();renderAll();save();preloadPadFiles();