import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FolderPlus, RefreshCw, Search, SlidersHorizontal, Star, Folder, Volume2, Film, Plug, Wrench, Grid3X3, List, X, Heart, Play, Pause, MoreHorizontal, AlertTriangle, Copy, Tags, Plus } from 'lucide-react';
import './styles.css';

const api = window.projectA || createDemoApi();
const fmtTime = s => !s ? '—' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fmtSize = n => n > 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${(n / 1e6).toFixed(1)} MB`;
const fileUrl = path => encodeURI(`file:///${path.replaceAll('\\', '/')}`);

function App() {
  const [state, setState] = useState({ folders: [], items: [], collections: [] });
  const [section, setSection] = useState('sfx');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('grid');
  const [selected, setSelected] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({ favorite: false, issue: false, ext: 'all', duration: 'all', sort: 'newest' });
  const [scan, setScan] = useState(null);
  const [playing, setPlaying] = useState(null);
  const [dragError, setDragError] = useState('');

  const load = async () => setState(await api.getState());
  useEffect(() => { load(); api.onScanProgress?.(setScan); api.onDragError?.(message => { setDragError(message); setTimeout(() => setDragError(''), 5000); }); }, []);
  const items = useMemo(() => {
    let rows = state.items.filter(x => x.kind === section);
    const q = query.toLowerCase().trim();
    if (q) rows = rows.filter(x => `${x.name} ${x.tags.join(' ')}`.toLowerCase().includes(q));
    if (filters.favorite) rows = rows.filter(x => x.favorite);
    if (filters.issue) rows = rows.filter(x => x.missing || x.duplicateOf);
    if (filters.ext !== 'all') rows = rows.filter(x => x.ext === filters.ext);
    if (filters.duration === 'short') rows = rows.filter(x => x.duration < 10);
    if (filters.duration === 'medium') rows = rows.filter(x => x.duration >= 10 && x.duration <= 60);
    if (filters.duration === 'long') rows = rows.filter(x => x.duration > 60);
    return rows.sort((a,b) => filters.sort === 'name' ? a.name.localeCompare(b.name) : filters.sort === 'duration' ? b.duration-a.duration : b.addedAt-a.addedAt);
  }, [state.items, section, query, filters]);
  const extensions = [...new Set(state.items.filter(x => x.kind === section).map(x => x.ext))];

  async function patchItem(id, patch) {
    const updated = await api.updateItem(id, patch);
    setState(s => ({ ...s, items: s.items.map(x => x.id === id ? updated : x) }));
    setSelected(x => x?.id === id ? updated : x);
  }
  async function choose() { setScan({ current: 0, total: 0, name: 'Đang đọc thư mục…' }); setState(await api.chooseFolders()); setScan(null); }
  async function rescan() { setScan({ current: 0, total: 0, name: 'Đang kiểm tra thư viện…' }); setState(await api.scan()); setScan(null); }
  async function addCollection() { const name = prompt('Tên collection'); if (name) { const collections = await api.addCollection(name); setState(s => ({ ...s, collections })); } }

  return <div className="app">
    <header className="titlebar"><div className="brand-mark" style={{width:24,height:24,border:0,overflow:'hidden'}}><img src="./icon.png" alt="" style={{width:'100%',height:'100%',display:'block',objectFit:'cover'}} /></div><b>ProjectA</b><span className="beta">BETA</span></header>
    <aside className="sidebar">
      <div className="nav-main">
        <Nav icon={Volume2} label="SFX" active={section==='sfx'} count={state.items.filter(x=>x.kind==='sfx').length} onClick={()=>setSection('sfx')} />
        <Nav icon={Film} label="Video" active={section==='video'} count={state.items.filter(x=>x.kind==='video').length} onClick={()=>setSection('video')} />
        <Nav icon={Plug} label="Plugin" disabled /><Nav icon={Wrench} label="Tool" disabled />
      </div>
      <div className="side-label">THƯ VIỆN</div>
      <button className="side-link"><Grid3X3 size={17}/>Tất cả</button>
      <button className="side-link"><Heart size={17}/>Yêu thích</button>
      <div className="side-label row">COLLECTIONS <button onClick={addCollection}><Plus size={14}/></button></div>
      {state.collections.map(c=><button className="side-link" key={c}><Folder size={17}/>{c}</button>)}
      <div className="sidebar-bottom"><button className="add-folder" onClick={choose}><FolderPlus size={18}/> Thêm thư mục</button><small>{state.folders.length} thư mục đang theo dõi</small></div>
    </aside>
    <main>
      <div className="toolbar">
        <div><h1>{section === 'sfx' ? 'Sound Effects' : 'Video Library'}</h1><p>{items.length} mục</p></div>
        <div className="actions"><div className="search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Tìm tên, tag…"/><kbd>⌘ K</kbd></div><button className={filtersOpen?'active':''} onClick={()=>setFiltersOpen(x=>!x)}><SlidersHorizontal size={18}/></button><button onClick={rescan}><RefreshCw size={18}/></button><div className="seg"><button className={view==='grid'?'active':''} onClick={()=>setView('grid')}><Grid3X3 size={17}/></button><button className={view==='list'?'active':''} onClick={()=>setView('list')}><List size={18}/></button></div></div>
      </div>
      {filtersOpen && <FilterBar filters={filters} setFilters={setFilters} extensions={extensions}/>} 
      {state.folders.length === 0 ? <Empty onAdd={choose}/> : items.length === 0 ? <div className="no-results">Không tìm thấy media phù hợp.</div> :
        <div className={`media-${view}`}>{items.map(item=><MediaCard key={item.id} item={item} section={section} selected={selected?.id===item.id} playing={playing===item.id} onSelect={()=>setSelected(item)} onFavorite={()=>patchItem(item.id,{favorite:!item.favorite})} onPlay={()=>setPlaying(playing===item.id?null:item.id)}/>)}</div>}
    </main>
    {selected && <Inspector item={selected} collections={state.collections} onClose={()=>setSelected(null)} onPatch={p=>patchItem(selected.id,p)} />}
    {scan && <div className="scan"><RefreshCw className="spin" size={18}/><div><b>Đang cập nhật thư viện</b><small>{scan.name}</small></div>{scan.total>0&&<span>{scan.current}/{scan.total}</span>}</div>}
    {dragError && <div className="drag-error" style={{position:'fixed',right:22,bottom:22,zIndex:12,display:'flex',alignItems:'center',gap:9,padding:'12px 15px',borderRadius:9,background:'#301b18',border:'1px solid #81443a',color:'#ffb4a7',boxShadow:'0 8px 32px #0008',fontSize:12}}><AlertTriangle size={18}/>{dragError}</div>}
  </div>;
}

function Nav({icon:Icon,label,active,count,disabled,onClick}) { return <button className={`nav ${active?'active':''} ${disabled?'disabled':''}`} onClick={onClick} disabled={disabled}><Icon size={20}/><span>{label}</span>{count!==undefined&&<em>{count}</em>}{disabled&&<small>Sắp có</small>}</button> }
function Empty({onAdd}) { return <div className="empty"><div className="empty-art"><FolderPlus size={44}/></div><h2>Tạo thư viện media của bạn</h2><p>Thêm một hoặc nhiều thư mục. ProjectA sẽ tự phân loại audio vào SFX, GIF và clip vào Video.</p><button onClick={onAdd}><FolderPlus size={18}/> Chọn thư mục</button><small>File gốc sẽ không bị chỉnh sửa hoặc di chuyển.</small></div> }
function FilterBar({filters,setFilters,extensions}) { const change=(k,v)=>setFilters(f=>({...f,[k]:v})); return <div className="filters"><label><span>Định dạng</span><select value={filters.ext} onChange={e=>change('ext',e.target.value)}><option value="all">Tất cả</option>{extensions.map(x=><option key={x}>{x}</option>)}</select></label><label><span>Thời lượng</span><select value={filters.duration} onChange={e=>change('duration',e.target.value)}><option value="all">Tất cả</option><option value="short">Dưới 10 giây</option><option value="medium">10–60 giây</option><option value="long">Trên 1 phút</option></select></label><label><span>Sắp xếp</span><select value={filters.sort} onChange={e=>change('sort',e.target.value)}><option value="newest">Mới thêm</option><option value="name">Tên A–Z</option><option value="duration">Thời lượng</option></select></label><button className={filters.favorite?'chip on':'chip'} onClick={()=>change('favorite',!filters.favorite)}><Star size={14}/> Yêu thích</button><button className={filters.issue?'chip on':'chip'} onClick={()=>change('issue',!filters.issue)}><AlertTriangle size={14}/> Cần xử lý</button></div> }

function MediaCard({item,section,selected,playing,onSelect,onFavorite,onPlay}) {
  const audio = useRef(); const canvas = useRef(); const video = useRef();
  useEffect(()=>{ if(section==='sfx') drawWave(canvas.current,item.path,item.hash); },[item,section]);
  useEffect(()=>{ if(audio.current){ playing?audio.current.play().catch(()=>{}):audio.current.pause(); } },[playing]);
  function enter(){ if(section==='video'&&!item.missing) video.current?.play().catch(()=>{}); }
  function leave(){ if(video.current){video.current.pause();video.current.currentTime=0;} }
  return <article className={`card ${selected?'selected':''} ${item.missing?'missing':''}`} title={item.missing?'File không còn ở vị trí cũ':'Giữ chuột và kéo file sang phần mềm edit'} onClick={onSelect} onMouseEnter={enter} onMouseLeave={leave} draggable={!item.missing} onDragStart={e=>{e.preventDefault();e.stopPropagation();api.dragFile(item.path);}}>
    <div className="preview">
      {section==='sfx'?<><canvas ref={canvas}/><audio ref={audio} src={fileUrl(item.path)} onEnded={onPlay}/><button className="play" onClick={e=>{e.stopPropagation();onPlay()}}>{playing?<Pause/>:<Play/>}</button></>:<video ref={video} src={fileUrl(item.path)} muted loop preload="metadata"/>}
      <span className="duration">{fmtTime(item.duration)}</span><button className={`fav ${item.favorite?'on':''}`} onClick={e=>{e.stopPropagation();onFavorite()}}><Star size={16} fill={item.favorite?'currentColor':'none'}/></button>
      {(item.missing||item.duplicateOf)&&<span className="warning" title={item.missing?'Không tìm thấy file':'File trùng'}><AlertTriangle size={15}/></span>}
    </div>
    <div className="card-info"><b title={item.name}>{item.name}</b><small>{item.ext.toUpperCase()} · {section==='video'&&item.width?`${item.width}×${item.height} · `:''}{fmtSize(item.size)}</small><div className="tag-row">{item.tags.slice(0,2).map(t=><span key={t}>{t}</span>)}</div></div>
  </article>
}

function Inspector({item,collections,onClose,onPatch}) {
  const [tag,setTag]=useState('');
  return <aside className="inspector"><div className="inspect-head"><b>Chi tiết</b><button onClick={onClose}><X size={18}/></button></div><div className="big-preview">{item.kind==='video'?<video src={fileUrl(item.path)} controls/>:<><Volume2 size={42}/><span>{fmtTime(item.duration)}</span></>}</div><h3>{item.name}</h3><p className="path" title={item.path}>{item.path}</p><div className="quick"><button onClick={()=>api.reveal(item.path)}><Folder size={16}/> Mở vị trí</button><button onClick={()=>navigator.clipboard.writeText(item.path)}><Copy size={16}/> Copy path</button></div><dl><div><dt>Loại</dt><dd>{item.ext.toUpperCase()}</dd></div><div><dt>Thời lượng</dt><dd>{fmtTime(item.duration)}</dd></div><div><dt>Kích thước</dt><dd>{fmtSize(item.size)}</dd></div><div><dt>Ngày thêm</dt><dd>{new Date(item.addedAt).toLocaleDateString('vi-VN')}</dd></div></dl><div className="inspect-section"><label><Tags size={16}/> TAGS</label><div className="tags">{item.tags.map(t=><button key={t} onClick={()=>onPatch({tags:item.tags.filter(x=>x!==t)})}>{t} ×</button>)}</div><form onSubmit={e=>{e.preventDefault();if(tag.trim()&&!item.tags.includes(tag.trim()))onPatch({tags:[...item.tags,tag.trim()]});setTag('')}}><input value={tag} onChange={e=>setTag(e.target.value)} placeholder="Thêm tag…"/><button>+</button></form></div><div className="inspect-section"><label><Folder size={16}/> COLLECTION</label>{collections.length===0?<small>Chưa có collection</small>:collections.map(c=><label className="check" key={c}><input type="checkbox" checked={item.collections.includes(c)} onChange={()=>onPatch({collections:item.collections.includes(c)?item.collections.filter(x=>x!==c):[...item.collections,c]})}/>{c}</label>)}</div></aside>
}

async function drawWave(canvas,path,seed='wave') { if(!canvas)return; const dpr=devicePixelRatio||1,w=canvas.clientWidth*dpr,h=canvas.clientHeight*dpr;canvas.width=w;canvas.height=h;const c=canvas.getContext('2d');c.clearRect(0,0,w,h);c.strokeStyle='#72e2b7';c.lineWidth=1.5*dpr;let samples;try{const data=await fetch(fileUrl(path)).then(r=>r.arrayBuffer());const ctx=new AudioContext();const decoded=await ctx.decodeAudioData(data);samples=decoded.getChannelData(0);ctx.close()}catch{}let n=[...seed].reduce((a,x)=>a+x.charCodeAt(0),0);c.beginPath();for(let x=0;x<w;x+=3*dpr){let amp;if(samples){const start=Math.floor(x/w*samples.length),end=Math.min(samples.length,Math.floor((x+3*dpr)/w*samples.length));let peak=0;for(let i=start;i<end;i++)peak=Math.max(peak,Math.abs(samples[i]));amp=Math.max(.04,peak)*h*.46}else{n=(n*9301+49297)%233280;amp=(.15+(n/233280)*.72)*h/2}c.moveTo(x,h/2-amp);c.lineTo(x,h/2+amp)}c.stroke();}
function createDemoApi(){let s={folders:[],items:[],collections:[]};return{getState:async()=>s,chooseFolders:async()=>s,scan:async()=>s,updateItem:async(id,p)=>{const x=s.items.find(i=>i.id===id);Object.assign(x,p);return x},addCollection:async n=>(s.collections.push(n),s.collections),dragFile(){},reveal(){},onDragError(){},onScanProgress(){}}}
createRoot(document.getElementById('root')).render(<App/>);
