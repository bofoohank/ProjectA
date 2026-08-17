import { Folder, Grid3X3, Heart, Plus, Settings as SettingsIcon, Film, Plug, Volume2, Wrench } from 'lucide-react';
import './sidebar.css';

function Nav({ icon: Icon, label, active, count, disabled, onClick }) {
  return <button className={`nav ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`} onClick={onClick} disabled={disabled}><Icon size={20}/><span>{label}</span>{count !== undefined && <em>{count}</em>}{disabled && <small>Sắp có</small>}</button>;
}

export default function Sidebar({ items, section, onSection, libraryFilter, onLibraryFilter, collections, onAddCollection, onSettings }) {
  const count = kind => items.filter(item => item.kind === kind).length;
  const active = (type, value) => libraryFilter.type === type && libraryFilter.value === value;
  return <aside className="sidebar">
    <div className="nav-main">
      <Nav icon={Volume2} label="SFX" active={section === 'sfx'} count={count('sfx')} onClick={() => onSection('sfx')} />
      <Nav icon={Film} label="Video" active={section === 'video'} count={count('video')} onClick={() => onSection('video')} />
      <Nav icon={Plug} label="Plugin" disabled /><Nav icon={Wrench} label="Tool" disabled />
    </div>
    <div className="side-label">THƯ VIỆN</div>
    <button className={`side-link ${active('all') ? 'active' : ''}`} onClick={() => onLibraryFilter({ type: 'all' })}><Grid3X3 size={17}/>Tất cả</button>
    <button className={`side-link ${active('favorite') ? 'active' : ''}`} onClick={() => onLibraryFilter({ type: 'favorite' })}><Heart size={17}/>Yêu thích</button>
    <div className="side-label row">COLLECTIONS <button onClick={onAddCollection}><Plus size={14}/></button></div>
    {collections.map(collection => <button className={`side-link ${active('collection', collection) ? 'active' : ''}`} key={collection} onClick={() => onLibraryFilter({ type: 'collection', value: collection })}><Folder size={17}/>{collection}</button>)}
    <div className="sidebar-bottom"><button className="side-link" onClick={onSettings}><SettingsIcon size={18}/> Settings</button><small>@xh4nk</small></div>
  </aside>;
}
