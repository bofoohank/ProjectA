import { AlertTriangle, Star } from 'lucide-react';

export default function FilterBar({ filters, setFilters, extensions }) {
  const change = (key, value) => setFilters(current => ({ ...current, [key]: value }));
  return <div className="filters">
    <label><span>Định dạng</span><select value={filters.ext} onChange={event => change('ext', event.target.value)}><option value="all">Tất cả</option>{extensions.map(extension => <option key={extension}>{extension}</option>)}</select></label>
    <label><span>Thời lượng</span><select value={filters.duration} onChange={event => change('duration', event.target.value)}><option value="all">Tất cả</option><option value="short">Dưới 10 giây</option><option value="medium">10–60 giây</option><option value="long">Trên 1 phút</option></select></label>
    <label><span>Sắp xếp</span><select value={filters.sort} onChange={event => change('sort', event.target.value)}><option value="newest">Mới thêm</option><option value="name">Tên A–Z</option><option value="duration">Thời lượng</option></select></label>
    <button className={filters.favorite ? 'chip on' : 'chip'} onClick={() => change('favorite', !filters.favorite)}><Star size={14}/> Yêu thích</button>
    <button className={filters.issue ? 'chip on' : 'chip'} onClick={() => change('issue', !filters.issue)}><AlertTriangle size={14}/> Cần xử lý</button>
  </div>;
}
