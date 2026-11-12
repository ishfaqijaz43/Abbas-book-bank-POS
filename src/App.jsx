import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { BookOpen, LayoutDashboard, School, GraduationCap, Package, ShoppingCart, LogOut, Menu, Search, Plus, Trash2, CreditCard, Store, ArrowLeft, KeyRound } from 'lucide-react';
import { configured, supabase } from './supabase';

const money = n => `Rs. ${Number(n || 0).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`;
const getError = (...results) => results.find(x => x?.error)?.error?.message || '';

function App() {
  const [access, setAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) { setAccess(null); return; }
      // The audited active_access table has no branch_id column.
      const { data, error } = await supabase.from('active_access').select('role,expires_at').eq('user_id', session.user.id).maybeSingle();
      if (error) throw error;
      setAccess(data && new Date(data.expires_at) > new Date() ? data : null);
    } catch (error) { console.error('Access refresh failed:', error); setAccess(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    refresh();
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => setTimeout(refresh, 0));
    return () => subscription.unsubscribe();
  }, [refresh]);
  async function login(pin) {
    if (!configured) throw Error('Configure Supabase environment variables first.');
    const timeout = (promise, label) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(Error(label + ' timed out. Please retry.')), 15000))]);
    const { data: { session: existing }, error: sessionError } = await timeout(supabase.auth.getSession(), 'Session check');
    if (sessionError) throw Error('Session check failed: ' + sessionError.message);
    if (!existing) {
      const { error: anonError } = await timeout(supabase.auth.signInAnonymously(), 'Anonymous sign-in');
      if (anonError) throw Error('Anonymous sign-in failed: ' + anonError.message);
    }
    const { data, error } = await timeout(supabase.functions.invoke('verify-pin', { body: { pin } }), 'PIN verification');
    if (error) {
      let detail = error.message;
      if (error.context && typeof error.context.json === 'function') {
        try { const body = await error.context.json(); detail = body?.error || detail; } catch { /* original error */ }
      }
      throw Error('PIN verification failed: ' + detail);
    }
    if (!data?.ok) throw Error(data?.error || 'PIN verification was not accepted.');
    const { data: { session }, error: afterError } = await timeout(supabase.auth.getSession(), 'Session confirmation');
    if (afterError || !session) throw Error('PIN accepted, but the login session is missing.');
    const { data: accessRow, error: accessError } = await timeout(supabase.from('active_access').select('role,expires_at').eq('user_id', session.user.id).maybeSingle(), 'Access lookup');
    if (accessError) throw Error('PIN accepted, but access lookup failed: ' + accessError.message);
    if (!accessRow) throw Error('PIN accepted, but no access record is visible for this session.');
    if (new Date(accessRow.expires_at) <= new Date()) throw Error('PIN accepted, but the access record has expired.');
    setAccess(accessRow); setLoading(false);
  }
  async function verifyShop(branchId, pin) {
    const { data, error } = await supabase.functions.invoke('verify-shop-pin', { body: { branch_id: branchId, pin } });
    if (error || !data?.ok) throw Error(data?.error || 'Shop verification failed');
    await refresh();
  }
  async function logout() { await supabase?.auth.signOut(); setAccess(null); }
  if (loading) return <div className="center"><div className="spinner" />Loading...</div>;
  return <BrowserRouter>{!access ? <Login onLogin={login} /> : access.role === 'seller' && !access.branch_id ? <ShopGate onVerify={verifyShop} onLogout={logout} /> : <Shell role={access.role} branchId={access.branch_id} logout={logout} />}</BrowserRouter>;
}

function Login({ onLogin }) {
  const [pin, setPin] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e) { e.preventDefault(); if (pin.length !== 6) return; setBusy(true); setError(''); try { await onLogin(pin); } catch (e) { setError(e.message); setPin(''); } finally { setBusy(false); } }
  return <main className="login-wrap"><div className="login-art"><div className="brand-icon"><BookOpen size={34} /></div><h1>Abbas Book Bank</h1><p>Books, courses & stationery management</p><div className="art-line" /><p className="muted-light">Secure point of sale · Karachi</p></div>
    <form className="login-card" onSubmit={submit}><span className="eyebrow">WELCOME BACK</span><h2>Enter your access PIN</h2><p className="muted">Your dashboard opens automatically based on your role.</p>
      <input aria-label="Six digit PIN" autoComplete="off" inputMode="numeric" type="password" maxLength={6} pattern="[0-9]{6}" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="pin-input" placeholder="••••••" />
      <div className="keypad">{['1','2','3','4','5','6','7','8','9','Clear','0','⌫'].map(k => <button type="button" key={k} onClick={() => setPin(v => k === 'Clear' ? '' : k === '⌫' ? v.slice(0,-1) : (v+k).slice(0,6))}>{k}</button>)}</div>
      {error && <p role="alert" className="error">{error}</p>}<button className="primary full" disabled={busy || pin.length !== 6}>{busy ? 'Checking…' : 'Unlock POS →'}</button><p className="tiny muted">Protected by server-side PIN verification</p>
    </form></main>;
}

function ShopGate({ onVerify, onLogout }) {
  const [shops, setShops] = useState([]); const [selected, setSelected] = useState(null); const [pin, setPin] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  useEffect(() => { supabase.from('branches').select('id,name').eq('enabled', true).order('name').then(({ data, error }) => { setShops(data || []); if (error) setError(error.message); }); }, []);
  async function submit(e) { e.preventDefault(); if (!selected || pin.length !== 6) return; setBusy(true); setError(''); try { await onVerify(selected.id,pin); } catch (e) { setError(e.message); setPin(''); } finally { setBusy(false); } }
  return <main className="shop-gate"><div className="shop-gate-card"><div className="brand-icon"><Store size={30} /></div><span className="eyebrow">SELLER ACCESS</span><h1>{selected ? 'Verify shop access' : 'Choose your shop'}</h1><p className="muted">{selected ? `Enter the 6-digit PIN for ${selected.name}.` : 'Select the location where you are selling today.'}</p>
    {!selected ? <div className="shop-choices">{shops.map(shop => <button key={shop.id} className="shop-choice" onClick={() => { setSelected(shop); setError(''); }}><Store size={23} /><strong>{shop.name}</strong><span>Continue →</span></button>)}</div> : <form onSubmit={submit}><input aria-label="Shop PIN" className="pin-input" type="password" inputMode="numeric" autoComplete="off" placeholder="••••••" value={pin} maxLength={6} onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,6))}/><div className="keypad">{['1','2','3','4','5','6','7','8','9','Clear','0','⌫'].map(k => <button type="button" key={k} onClick={() => setPin(v => k === 'Clear' ? '' : k === '⌫' ? v.slice(0,-1) : (v+k).slice(0,6))}>{k}</button>)}</div><button className="primary full" disabled={busy || pin.length !== 6}>{busy ? 'Verifying…' : 'Open seller POS →'}</button><button className="secondary full" type="button" onClick={() => { setSelected(null); setPin(''); setError(''); }}><ArrowLeft size={16} />Change shop</button></form>}
    {error && <p role="alert" className="error">{error}</p>}<button className="text-link" onClick={onLogout}>Sign out</button>
  </div></main>;
}

function ShopManager() {
  const [shops,setShops] = useState([]); const [name,setName] = useState(''); const [pins,setPins] = useState({}); const [error,setError] = useState(''); const [message,setMessage] = useState(''); const [busy,setBusy] = useState(false);
  const load = async () => { const {data,error} = await supabase.from('branches').select('id,name,enabled').order('name'); setShops(data || []); if(error) setError(error.message); };
  useEffect(() => { load(); }, []);
  async function save(action,branchId=null) {
    const pin=pins[branchId || 'new'] || '';
    if(!/^\d{6}$/.test(pin)) {setError('Enter exactly 6 digits for the shop PIN.');return;}
    if(action==='create' && !name.trim()) {setError('Enter a shop name.');return;}
    setBusy(true);setError('');setMessage('');
    const {error}=await supabase.rpc('admin_manage_shop',{p_action:action,p_branch_id:branchId,p_name:action==='create'?name.trim():null,p_pin:pin});
    setBusy(false);if(error){setError(error.message);return;}setMessage('Shop saved successfully.');setPins({});setName('');load();
  }
  async function toggle(shop) {setBusy(true);setError('');const {error}=await supabase.rpc('admin_set_shop_enabled',{p_branch_id:shop.id,p_enabled:!shop.enabled});setBusy(false);if(error)setError(error.message);else load();}
  return <><PageHead title="Manage shops" desc="Create branches, reset their PINs and control access"/><Notice message={error}/>{message&&<p className="success">{message}</p>}
    <section className="panel"><h2>Create new shop</h2><div className="inline-form"><input placeholder="Shop name" value={name} onChange={e=>setName(e.target.value)}/><input type="password" inputMode="numeric" maxLength={6} placeholder="New 6-digit PIN" value={pins.new||''} onChange={e=>setPins(v=>({...v,new:e.target.value.replace(/\D/g,'').slice(0,6)}))}/><button className="primary" disabled={busy} onClick={()=>save('create')}>Create shop</button></div></section>
    <div className="stack">{shops.map(shop=><div className="panel shop-admin-row" key={shop.id}><div><strong>{shop.name}</strong><small>{shop.enabled?'Active':'Disabled'}</small></div><input aria-label={'New PIN for '+shop.name} type="password" inputMode="numeric" maxLength={6} placeholder="New 6-digit PIN" value={pins[shop.id]||''} onChange={e=>setPins(v=>({...v,[shop.id]:e.target.value.replace(/\D/g,'').slice(0,6)}))}/><button className="secondary" disabled={busy} onClick={()=>save('reset',shop.id)}><KeyRound size={16}/>Reset PIN</button><button className="secondary" disabled={busy} onClick={()=>toggle(shop)}>{shop.enabled?'Disable':'Enable'}</button></div>)}</div>
  </>;
}

const adminNav=[['/admin','Dashboard',LayoutDashboard],['/admin/schools','Schools & Grades',School],['/admin/products','Book Inventory',Package],['/admin/sales','Sales',ShoppingCart],['/admin/shops','Manage Shops',Store]];
const sellerNav=[['/seller','New Sale',ShoppingCart],['/seller/catalog','Browse Books',BookOpen],['/seller/history','My Sales',LayoutDashboard]];
function Shell({role,branchId,logout}) {
  const [open,setOpen]=useState(false);const nav=role==='admin'?adminNav:sellerNav;
  return <div className="shell"><aside className={'sidebar '+(open?'open':'')}><div className="side-brand"><span className="brand-icon small"><BookOpen/></span><span><b>ABBAS</b><small>BOOK BANK POS</small></span></div><div className="role-label">{role==='admin'?'ADMIN WORKSPACE':'SELLER WORKSPACE'}</div><nav>{nav.map(([url,label,Icon])=><NavLink key={url} to={url} end onClick={()=>setOpen(false)} className={({isActive})=>isActive?'nav active':'nav'}><Icon size={19}/>{label}</NavLink>)}</nav><div className="sidebar-bottom"><button className="nav" onClick={logout}><LogOut size={19}/>Sign out</button></div></aside>
    <div className="workspace"><header className="topbar"><button className="icon-btn mobile-only" onClick={()=>setOpen(!open)}><Menu/></button><div><b>Abbas Book Bank</b><span className="top-sub">{role==='admin'?'Business management':'Sales counter · Selected shop'}</span></div><span className="role-pill">{role==='admin'?'Administrator':'Seller'}</span></header><div className="content"><Routes>{role==='admin'?<><Route path="/admin" element={<Dashboard/>}/><Route path="/admin/schools" element={<Schools/>}/><Route path="/admin/products" element={<Products admin/>}/><Route path="/admin/sales" element={<SalesHistory admin/>}/><Route path="/admin/shops" element={<ShopManager/>}/><Route path="*" element={<Navigate to="/admin"/>}/></>:<><Route path="/seller" element={<POS branchId={branchId}/>}/><Route path="/seller/catalog" element={<Products/>}/><Route path="/seller/history" element={<SalesHistory/>}/><Route path="*" element={<Navigate to="/seller"/>}/></>}</Routes></div></div>{open&&<div className="overlay mobile-only" onClick={()=>setOpen(false)}/>}</div>;
}
function PageHead({title,desc,action}) {return <div className="page-head"><div><h1>{title}</h1><p className="muted">{desc}</p></div>{action}</div>;}
function Notice({message}) {return message?<p className="error" role="alert">{message}</p>:null;}
function Dashboard() {
  const [stats,setStats]=useState({sales:0,total:0,books:0,schools:0});const [recent,setRecent]=useState([]);const [err,setErr]=useState('');
  useEffect(()=>{(async()=>{const [sales,books,schools,totals]=await Promise.all([supabase.from('sales').select('id,total,created_at',{count:'exact'}).order('created_at',{ascending:false}).limit(10),supabase.from('products').select('id',{count:'exact',head:true}).eq('is_active',true),supabase.from('schools').select('id',{count:'exact',head:true}),supabase.from('sales').select('total')]);setErr(getError(sales,books,schools,totals));setRecent(sales.data||[]);setStats({sales:sales.count||0,total:(totals.data||[]).reduce((a,x)=>a+Number(x.total),0),books:books.count||0,schools:schools.count||0});})();},[]);
  return <><PageHead title="Overview" desc="Your business at a glance"/><Notice message={err}/><div className="stat-grid">{[['Total revenue',money(stats.total)],['Sales completed',stats.sales],['Book titles',stats.books],['Schools',stats.schools]].map(([a,b])=><div className="stat" key={a}><span>{a}</span><strong>{b}</strong></div>)}</div><section className="panel"><h2>Recent sales</h2><div className="table-wrap"><table><thead><tr><th>Sale ID</th><th>Date</th><th>Amount</th></tr></thead><tbody>{recent.map(x=><tr key={x.id}><td>{x.id.slice(0,8)}</td><td>{new Date(x.created_at).toLocaleString()}</td><td>{money(x.total)}</td></tr>)}</tbody></table>{!recent.length&&<p className="empty">No sales yet</p>}</div></section></>;
}

function Schools() {
  const [schools,setSchools]=useState([]),[grades,setGrades]=useState([]),[books,setBooks]=useState([]),[products,setProducts]=useState([]);
  const [schoolName,setSchoolName]=useState(''),[newGrade,setNewGrade]=useState({}),[assignment,setAssignment]=useState({});
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const [s,g,b,p]=await Promise.all([supabase.from('schools').select('id,name').order('name'),supabase.from('grades').select('id,name,school_id').order('name'),supabase.from('grade_books').select('id,grade_id,product_id,quantity,products(name)'),supabase.from('products').select('id,name').eq('is_active',true).order('name')]);setSchools(s.data||[]);setGrades(g.data||[]);setBooks(b.data||[]);setProducts(p.data||[]);setError(getError(s,g,b,p));},[]);
  useEffect(()=>{load();},[load]);
  async function mutate(action,confirmation) {if(confirmation&&!window.confirm(confirmation))return false;setBusy(true);setError('');try{const {error}=await action();if(error)throw error;await load();return true;}catch(e){setError(e.message);return false;}finally{setBusy(false);}}
  async function addSchool(e){e.preventDefault();const name=schoolName.trim();if(!name)return;if(await mutate(()=>supabase.from('schools').insert({name})))setSchoolName('');}
  async function rename(table,id,oldName){const value=window.prompt('Enter new name',oldName);if(value===null||!value.trim()||value.trim()===oldName)return;await mutate(()=>supabase.from(table).update({name:value.trim()}).eq('id',id));}
  async function addGrade(e,schoolId){e.preventDefault();const name=(newGrade[schoolId]||'').trim();if(!name)return;if(await mutate(()=>supabase.from('grades').insert({school_id:schoolId,name})))setNewGrade(v=>({...v,[schoolId]:''}));}
  async function assign(e,gradeId){e.preventDefault();const a=assignment[gradeId]||{};const quantity=Number(a.quantity||1);if(!a.product_id||!Number.isSafeInteger(quantity)||quantity<1){setError('Choose a book and valid quantity.');return;}await mutate(()=>supabase.from('grade_books').upsert({grade_id:gradeId,product_id:a.product_id,quantity},{onConflict:'grade_id,product_id'}));}
  async function editAssignment(row){const answer=window.prompt('Copies required for this grade',String(row.quantity));if(answer===null)return;const quantity=Number(answer);if(!Number.isSafeInteger(quantity)||quantity<1){setError('Quantity must be a positive whole number.');return;}await mutate(()=>supabase.from('grade_books').update({quantity}).eq('id',row.id));}
  return <><PageHead title="Schools & courses" desc="Add, edit and manage schools, grades and required books"/><Notice message={error}/><section className="panel"><h2>Add school</h2><form className="inline-form" onSubmit={addSchool}><input required placeholder="School name" value={schoolName} onChange={e=>setSchoolName(e.target.value)}/><button className="primary" disabled={busy}><Plus size={16}/>Add school</button></form></section><div className="stack">{schools.map(s=><section className="panel" key={s.id}><div className="inline-form"><h2><School size={20}/>{s.name}</h2><button className="secondary" disabled={busy} onClick={()=>rename('schools',s.id,s.name)}>Edit school</button><button className="secondary" disabled={busy} onClick={()=>mutate(()=>supabase.from('schools').delete().eq('id',s.id),`Delete ${s.name} and ALL its grades and assignments? This cannot be undone.`)}>Delete school</button></div><div className="grade-grid">{grades.filter(g=>g.school_id===s.id).map(g=><div className="grade-card" key={g.id}><h3><GraduationCap size={17}/>{g.name}</h3><div className="inline-form"><button className="secondary" disabled={busy} onClick={()=>rename('grades',g.id,g.name)}>Edit grade</button><button className="secondary" disabled={busy} onClick={()=>mutate(()=>supabase.from('grades').delete().eq('id',g.id),`Delete ${g.name} and its book assignments?`)}>Delete grade</button></div><ul>{books.filter(b=>b.grade_id===g.id).map(b=><li key={b.id}>{b.products?.name||'Unknown book'} × {b.quantity}{' '}<button className="secondary" disabled={busy} onClick={()=>editAssignment(b)}>Edit qty</button>{' '}<button className="secondary" disabled={busy} onClick={()=>mutate(()=>supabase.from('grade_books').delete().eq('id',b.id),'Remove this book from this grade?')}>Remove</button></li>)}</ul><form className="inline-form" onSubmit={e=>assign(e,g.id)}><select required value={assignment[g.id]?.product_id||''} onChange={e=>setAssignment(v=>({...v,[g.id]:{...v[g.id],product_id:e.target.value}}))}><option value="">Select book</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input aria-label="Required copies" type="number" min="1" step="1" placeholder="Qty" value={assignment[g.id]?.quantity??'1'} onChange={e=>setAssignment(v=>({...v,[g.id]:{...v[g.id],quantity:e.target.value}}))}/><button className="secondary" disabled={busy}>Assign</button></form></div>)}</div><form className="inline-form" onSubmit={e=>addGrade(e,s.id)}><input required placeholder="New grade" value={newGrade[s.id]||''} onChange={e=>setNewGrade(v=>({...v,[s.id]:e.target.value}))}/><button className="secondary" disabled={busy}><Plus size={16}/>Add grade</button></form></section>)}</div>{!schools.length&&<p className="empty">Start by adding a school.</p>}</>;
}

function Products({admin=false}) {
  const [products,setProducts]=useState([]),[shops,setShops]=useState([]),[stock,setStock]=useState([]);
  const [name,setName]=useState(''),[sku,setSku]=useState(''),[price,setPrice]=useState('');
  const [branch,setBranch]=useState(''),[quantities,setQuantities]=useState({}),[reason,setReason]=useState('');
  const [showArchived,setShowArchived]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState('');
  const load=useCallback(async()=>{const [p,b,s]=await Promise.all([supabase.from('products').select('id,name,sku,price,is_active').order('name'),supabase.from('branches').select('id,name,enabled').order('name'),supabase.from('stock').select('branch_id,product_id,quantity')]);setProducts(p.data||[]);setShops(b.data||[]);setStock(s.data||[]);setBranch(v=>b.data?.some(x=>x.id===v)?v:(b.data?.[0]?.id||''));setError(getError(p,b,s));},[]);
  useEffect(()=>{load();},[load]);
  async function mutate(action,confirmation){if(confirmation&&!window.confirm(confirmation))return false;setBusy(true);setError('');setSuccess('');try{const {data,error}=await action();if(error)throw error;await load();setSuccess('Saved successfully.');return data??true;}catch(e){setError(e.message);return false;}finally{setBusy(false);}}
  async function add(e){e.preventDefault();const n=name.trim(),p=Number(price);if(!n||price===''||!Number.isFinite(p)||p<0){setError('Enter a valid name and price.');return;}if(await mutate(()=>supabase.from('products').insert({name:n,sku:sku.trim()||null,price:p}))) {setName('');setSku('');setPrice('');}}
  async function edit(p){const n=window.prompt('Book name',p.name);if(n===null)return;const s=window.prompt('SKU / barcode (blank allowed)',p.sku||'');if(s===null)return;const priceInput=window.prompt('Price in PKR',String(p.price));if(priceInput===null)return;const value=Number(priceInput);if(!n.trim()||!priceInput.trim()||!Number.isFinite(value)||value<0){setError('Invalid name or price.');return;}await mutate(()=>supabase.from('products').update({name:n.trim(),sku:s.trim()||null,price:value}).eq('id',p.id));}
  const qty=(pid,bid)=>stock.find(s=>s.product_id===pid&&s.branch_id===bid)?.quantity||0;
  async function saveStock(p){if(!branch){setError('Choose a shop.');return;}const raw=quantities[p.id]??String(qty(p.id,branch));const quantity=Number(raw);if(raw===''||!Number.isSafeInteger(quantity)||quantity<0){setError('Quantity must be a nonnegative whole number.');return;}if(reason.trim().length<3){setError('Enter a reason of at least 3 characters.');return;}if(await mutate(()=>supabase.rpc('admin_set_stock_quantity',{p_branch_id:branch,p_product_id:p.id,p_quantity:quantity,p_reason:reason.trim()})))setQuantities(v=>({...v,[p.id]:undefined}));}
  const visible=products.filter(p=>admin?(showArchived||p.is_active):p.is_active);
  return <><PageHead title={admin?'Book inventory':'Book catalog'} desc="Manage books and separate stock quantities for each shop"/><Notice message={error}/>{success&&<p className="success">{success}</p>}
    {admin&&<section className="panel"><h2>Add book or item</h2><form className="inline-form" onSubmit={add}><input required placeholder="Product name" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="Barcode / SKU" value={sku} onChange={e=>setSku(e.target.value)}/><input required type="number" min="0" step="0.01" placeholder="Price (PKR)" value={price} onChange={e=>setPrice(e.target.value)}/><button className="primary" disabled={busy}><Plus size={16}/>Add item</button></form></section>}
    {admin&&<section className="panel"><h2>Stock management</h2><div className="inline-form"><select aria-label="Choose shop" value={branch} onChange={e=>{setBranch(e.target.value);setQuantities({});}}>{shops.map(s=><option key={s.id} value={s.id}>{s.name}{s.enabled?'':' (disabled)'}</option>)}</select><input aria-label="Stock adjustment reason" placeholder="Reason, e.g. new delivery" value={reason} onChange={e=>setReason(e.target.value)}/><label><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Show archived</label></div><p className="muted">Enter the physical count for the selected shop. Each saved adjustment is recorded. Changing one shop does not change another shop.</p></section>}
    <section className="panel"><h2>Products ({visible.length})</h2><div className="table-wrap"><table><thead><tr><th>Item</th><th>SKU</th><th>Price</th><th>Total copies</th>{admin&&<><th>Selected shop copies</th><th>Actions</th></>}</tr></thead><tbody>{visible.map(p=><tr key={p.id}><td>{p.name}{!p.is_active?' (archived)':''}</td><td>{p.sku||'—'}</td><td>{money(p.price)}</td><td>{shops.reduce((sum,s)=>sum+qty(p.id,s.id),0)}</td>{admin&&<><td><div className="inline-form"><input aria-label={'Copies for '+p.name} type="number" min="0" step="1" value={quantities[p.id]??String(qty(p.id,branch))} onChange={e=>setQuantities(v=>({...v,[p.id]:e.target.value}))}/><button className="secondary" disabled={busy||!branch} onClick={()=>saveStock(p)}>Save stock</button></div></td><td><div className="inline-form"><button className="secondary" disabled={busy} onClick={()=>edit(p)}>Edit</button><button className="secondary" disabled={busy} onClick={()=>mutate(()=>supabase.from('products').update({is_active:!p.is_active}).eq('id',p.id),p.is_active?'Archive this book? Its sales history will remain.':'Restore this book?')}>{p.is_active?'Archive':'Restore'}</button></div></td></>}</tr>)}</tbody></table></div>{!visible.length&&<p className="empty">No books to display.</p>}</section>
  </>;
}

function POS({branchId}) {
  const [products,setProducts]=useState([]),[q,setQ]=useState(''),[cart,setCart]=useState([]),[err,setErr]=useState(''),[success,setSuccess]=useState(''),[busy,setBusy]=useState(false);
  const [schools,setSchools]=useState([]),[grades,setGrades]=useState([]),[links,setLinks]=useState([]),[selectedSchool,setSelectedSchool]=useState(''),[selectedGrade,setSelectedGrade]=useState('');
  useEffect(()=>{Promise.all([supabase.from('products').select('id,name,price,sku').eq('is_active',true).order('name'),supabase.from('schools').select('*').order('name'),supabase.from('grades').select('*').order('name'),supabase.from('grade_books').select('*')]).then(([p,s,g,l])=>{setProducts(p.data||[]);setSchools(s.data||[]);setGrades(g.data||[]);setLinks(l.data||[]);setErr(getError(p,s,g,l));});},[]);
  const add=(p,qty=1)=>setCart(items=>{const found=items.find(x=>x.id===p.id);return found?items.map(x=>x.id===p.id?{...x,qty:x.qty+qty}:x):[...items,{...p,qty}];});
  const total=cart.reduce((sum,x)=>sum+Number(x.price)*x.qty,0);
  function addCourse(){const selected=links.filter(l=>l.grade_id===selectedGrade);selected.forEach(l=>{const p=products.find(x=>x.id===l.product_id);if(p)add(p,l.quantity);});if(!selected.length)setErr('No books assigned to this grade yet.');}
  async function checkout(){
    // IMPORTANT: checkout_sale in the audited database picks the first branch alphabetically.
    // Do not call it until a server-side verified branch checkout function is installed.
    setErr('Checkout is temporarily disabled: the database still needs verified shop-specific checkout. No sale was recorded.');
  }
  return <><PageHead title="New sale" desc="Select individual books or complete school courses"/><Notice message={err}/>{success&&<p className="success">{success}</p>}<p className="error">Checkout is temporarily disabled until shop-specific stock deduction is secured.</p><div className="pos-grid"><div className="stack"><section className="panel"><h2>School course</h2><div className="inline-form"><select value={selectedSchool} onChange={e=>{setSelectedSchool(e.target.value);setSelectedGrade('');}}><option value="">Select school</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select value={selectedGrade} onChange={e=>setSelectedGrade(e.target.value)}><option value="">Select grade</option>{grades.filter(g=>g.school_id===selectedSchool).map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select><button className="primary" disabled={!selectedGrade} onClick={addCourse}>Add course</button></div></section><section className="panel"><h2>Find products</h2><div className="search"><Search size={18}/><input autoFocus placeholder="Search name, SKU or scan barcode" value={q} onChange={e=>setQ(e.target.value)}/></div><div className="product-list">{products.filter(p=>(p.name+' '+(p.sku||'')).toLowerCase().includes(q.toLowerCase())).slice(0,60).map(p=><button key={p.id} className="product-row" onClick={()=>add(p)}><span><b>{p.name}</b><small>{p.sku||'Book / stationery'}</small></span><span>{money(p.price)}<Plus size={16}/></span></button>)}</div></section></div><section className="panel cart-panel"><h2><ShoppingCart size={20}/>Current sale</h2>{!cart.length?<div className="empty">No items yet. Select a book or course to begin.</div>:cart.map(p=><div className="cart-item" key={p.id}><div><b>{p.name}</b><small>{money(p.price)} each</small></div><div className="qty"><button onClick={()=>setCart(a=>a.map(x=>x.id===p.id?{...x,qty:Math.max(1,x.qty-1)}:x))}>−</button><span>{p.qty}</span><button onClick={()=>setCart(a=>a.map(x=>x.id===p.id?{...x,qty:x.qty+1}:x))}>+</button><button className="danger-text" onClick={()=>setCart(a=>a.filter(x=>x.id!==p.id))}><Trash2 size={16}/></button></div></div>)}<div className="cart-total"><span>Total payable</span><strong>{money(total)}</strong></div><button className="primary full" disabled onClick={checkout}><CreditCard size={19}/>Checkout unavailable pending shop security</button><p className="tiny muted">Sales cannot be completed until the checkout function is fixed to use the verified shop.</p></section></div></>;
}

function SalesHistory({admin=false}) {
  const [sales,setSales]=useState([]),[err,setErr]=useState('');
  useEffect(()=>{supabase.from('sales').select('id,total,created_at').order('created_at',{ascending:false}).limit(100).then(({data,error})=>{setSales(data||[]);setErr(error?.message||'');});},[]);
  return <><PageHead title={admin?'All sales':'My sales'} desc="Recent completed transactions"/><Notice message={err}/><section className="panel"><div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Date</th><th>Amount</th></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td>{s.id.slice(0,8)}</td><td>{new Date(s.created_at).toLocaleString()}</td><td>{money(s.total)}</td></tr>)}</tbody></table></div>{!sales.length&&<p className="empty">No sales recorded</p>}</section></>;
}
export default App;
