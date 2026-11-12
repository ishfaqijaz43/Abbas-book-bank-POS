import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { BookOpen, LayoutDashboard, School, GraduationCap, Package, ShoppingCart, LogOut, Menu, Search, Plus, Trash2, CreditCard, Store, ArrowLeft, KeyRound } from 'lucide-react';
import { configured, supabase } from './supabase';

const abbasResponsiveStyles = `
.abb-page { width:100%; min-width:0; max-width:1180px; margin:0 auto; }
.abb-page *, .abb-page *::before, .abb-page *::after { box-sizing:border-box; }
.abb-page .abb-panel { padding:22px; margin-bottom:18px; border-radius:16px; min-width:0; }
.abb-section-title { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; margin-bottom:18px; }
.abb-section-title h2 { margin:0; font-size:18px; line-height:1.35; }
.abb-hint { color:#66758a; font-size:12px; line-height:1.5; margin:0; }
.abb-page .abb-btn { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:42px; padding:9px 14px; white-space:nowrap; text-align:center; font-weight:600; line-height:1.2; border-radius:9px; cursor:pointer; }
.abb-page .abb-btn:disabled { opacity:.55; cursor:not-allowed; }
.abb-page .abb-danger { color:#a52e3b; border:1px solid #f1c9ce; background:#fff4f4; }
.abb-page .abb-field { display:flex; flex-direction:column; gap:7px; min-width:0; }
.abb-page .abb-field label { font-size:12px; color:#43536a; font-weight:600; }
.abb-page .abb-field input, .abb-page .abb-field select, .abb-page .abb-form-line input, .abb-page .abb-assignment-form input, .abb-page .abb-assignment-form select { width:100%; min-width:0; min-height:42px; padding:9px 12px; border:1px solid #d9e1ec; border-radius:9px; background:white; color:#15243c; font-size:14px; }
.abb-page input:focus, .abb-page select:focus { outline:2px solid #9abcf8; outline-offset:1px; }
.abb-add-form { display:grid; grid-template-columns:minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr); gap:16px; }
.abb-opening { grid-column:1/-1; padding:16px; border-radius:12px; background:#f6f8fc; border:1px solid #e5ebf3; }
.abb-opening > strong { display:block; margin-bottom:12px; font-size:14px; }
.abb-opening-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin-bottom:8px; }
.abb-add-submit { grid-column:1/-1; justify-self:start; }
.abb-stock-settings { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
.abb-required { color:#bc273b; }
.abb-setting-footer { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-top:14px; }
.abb-check { display:flex; align-items:center; gap:7px; font-size:13px; cursor:pointer; }
.abb-check input { width:16px; height:16px; }
.abb-count { display:inline-flex; justify-content:center; align-items:center; min-width:25px; height:25px; padding:0 7px; border-radius:20px; font-size:13px; color:#2e5b9e; background:#eaf1ff; }
.abb-books { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; }
.abb-book { min-width:0; border:1px solid #e2e9f3; border-radius:14px; background:#fff; overflow:hidden; }
.abb-book-top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; padding:17px 17px 12px; }
.abb-book-name { display:flex; align-items:center; gap:11px; min-width:0; }
.abb-book-name > div { min-width:0; }
.abb-book-name h3 { margin:0 0 4px; font-size:16px; overflow-wrap:anywhere; }
.abb-book-icon { flex:0 0 38px; height:38px; display:flex; align-items:center; justify-content:center; border-radius:10px; background:#eaf1ff; color:#285ab4; }
.abb-price { font-size:14px; white-space:nowrap; }
.abb-shop-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; padding:0 17px 15px; }
.abb-shop-qty { display:flex; flex-direction:column; gap:8px; padding:12px; min-width:0; border:1px solid #e6ebf3; border-radius:10px; background:#f8fafc; }
.abb-shop-qty span { color:#627187; font-size:12px; line-height:1.4; overflow-wrap:anywhere; }
.abb-shop-qty strong { font-size:22px; color:#152a48; }
.abb-shop-qty small { font-size:11px; font-weight:500; color:#627187; }
.abb-shop-selected { border-color:#86adf7; background:#f0f6ff; }
.abb-book-footer { padding:14px 17px 17px; border-top:1px solid #e9edf4; background:#fbfcff; }
.abb-stock-edit { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:end; gap:10px; }
.abb-stock-edit .abb-field input { max-width:160px; }
.abb-actions { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.abb-book-actions { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); margin-top:12px; }
.abb-book-actions .abb-btn { width:100%; }
.abb-stack { display:grid; gap:16px; }
.abb-heading { display:flex; align-items:center; gap:9px; min-width:0; }
.abb-heading h2 { margin:0; overflow-wrap:anywhere; }
.abb-school-header { padding-bottom:14px; border-bottom:1px solid #e8edf4; }
.abb-grade-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
.abb-grade-card { min-width:0; padding:16px; border:1px solid #e4eaf3; border-radius:12px; background:#fbfcff; }
.abb-grade-heading { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin-bottom:14px; }
.abb-assigned { display:grid; gap:8px; margin-bottom:14px; }
.abb-assignment { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; border-radius:9px; background:#fff; padding:9px; border:1px solid #e7ebf2; }
.abb-assignment span { overflow-wrap:anywhere; font-size:13px; }
.abb-assignment small { color:#64748b; }
.abb-assignment .abb-btn { min-height:34px; padding:6px 9px; font-size:12px; }
.abb-assignment-form { display:grid; grid-template-columns:minmax(0,1fr) 68px auto; align-items:end; gap:8px; }
.abb-form-line { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:10px; align-items:center; }
.abb-add-grade { margin-top:16px; }
@media(max-width:1100px) { .abb-books { grid-template-columns:1fr; } }
@media(max-width:760px) {
  .abb-page .abb-panel { padding:15px; border-radius:13px; margin-bottom:14px; }
  .abb-add-form { grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
  .abb-add-form > .abb-field:first-child { grid-column:1/-1; }
  .abb-opening-grid, .abb-stock-settings, .abb-grade-grid { grid-template-columns:1fr; }
  .abb-school-header { align-items:flex-start; }
  .abb-grade-card { padding:12px; }
  .abb-page .abb-btn { font-size:13px; }
}
@media(max-width:420px) {
  .abb-add-form { grid-template-columns:1fr; }
  .abb-add-form > .abb-field:first-child { grid-column:auto; }
  .abb-shop-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
  .abb-stock-edit { grid-template-columns:minmax(0,1fr) auto; }
  .abb-book-top { flex-wrap:wrap; }
  .abb-assignment-form { grid-template-columns:minmax(0,1fr) 60px; }
  .abb-assignment-form .abb-btn { grid-column:1/-1; }
  .abb-school-header .abb-actions { width:100%; }
  .abb-school-header .abb-actions .abb-btn { flex:1; }
}
`;

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
      // Read the verified shop assignment as well as the login role.
      const { data, error } = await supabase.from('active_access').select('role,expires_at,branch_id').eq('user_id', session.user.id).maybeSingle();
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
    const { data: accessRow, error: accessError } = await timeout(supabase.from('active_access').select('role,expires_at,branch_id').eq('user_id', session.user.id).maybeSingle(), 'Access lookup');
    if (accessError) throw Error('PIN accepted, but access lookup failed: ' + accessError.message);
    if (!accessRow) throw Error('PIN accepted, but no access record is visible for this session.');
    if (new Date(accessRow.expires_at) <= new Date()) throw Error('PIN accepted, but the access record has expired.');
    setAccess(accessRow); setLoading(false);
  }
  async function verifyShop(branchId, pin) {
    if (!branchId || !/^\d{6}$/.test(pin)) {
      throw Error('Select a shop and enter its 6-digit PIN.');
    }
    // Database RPC checks the active seller session, verifies the hashed shop PIN,
    // enforces the failed-attempt lockout, and assigns the branch server-side.
    const { data, error } = await supabase.rpc('verify_shop_pin', {
      p_branch_id: branchId,
      p_pin: pin
    });
    if (error) throw Error(error.message || 'Shop verification failed.');
    if (data !== true) throw Error('Incorrect shop PIN. Please try again.');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) throw Error('Session expired. Please sign in again.');
    const { data: verified, error: accessError } = await supabase
      .from('active_access')
      .select('role,expires_at,branch_id')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (accessError || !verified || verified.role !== 'seller' ||
        verified.branch_id !== branchId || new Date(verified.expires_at) <= new Date()) {
      throw Error('Shop PIN accepted, but shop access could not be confirmed.');
    }
    setAccess(verified);
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
  return <div className="shell"><style>{abbasResponsiveStyles}</style><aside className={'sidebar '+(open?'open':'')}><div className="side-brand"><span className="brand-icon small"><BookOpen/></span><span><b>ABBAS</b><small>BOOK BANK POS</small></span></div><div className="role-label">{role==='admin'?'ADMIN WORKSPACE':'SELLER WORKSPACE'}</div><nav>{nav.map(([url,label,Icon])=><NavLink key={url} to={url} end onClick={()=>setOpen(false)} className={({isActive})=>isActive?'nav active':'nav'}><Icon size={19}/>{label}</NavLink>)}</nav><div className="sidebar-bottom"><button className="nav" onClick={logout}><LogOut size={19}/>Sign out</button></div></aside>
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
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{
    const [s,g,b,p]=await Promise.all([
      supabase.from('schools').select('id,name').order('name'),
      supabase.from('grades').select('id,name,school_id').order('name'),
      supabase.from('grade_books').select('id,grade_id,product_id,quantity,products(name)'),
      supabase.from('products').select('id,name').eq('is_active',true).order('name')
    ]);
    setSchools(s.data||[]);setGrades(g.data||[]);setBooks(b.data||[]);setProducts(p.data||[]);
    const err=getError(s,g,b,p);if(err)throw Error(err);
  },[]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  async function mutate(action,confirmation){
    if(confirmation&&!window.confirm(confirmation))return false;
    setBusy(true);setError('');setMessage('');
    try{const {error}=await action();if(error)throw error;await load();setMessage('Changes saved.');return true;}
    catch(e){setError(e.message);return false;}finally{setBusy(false);}
  }
  async function addSchool(e){e.preventDefault();const name=schoolName.trim();if(!name)return;if(await mutate(()=>supabase.from('schools').insert({name})))setSchoolName('');}
  async function rename(table,id,oldName){const value=window.prompt('Enter new name',oldName);if(value===null||!value.trim()||value.trim()===oldName)return;await mutate(()=>supabase.from(table).update({name:value.trim()}).eq('id',id));}
  async function addGrade(e,schoolId){e.preventDefault();const name=(newGrade[schoolId]||'').trim();if(!name)return;if(await mutate(()=>supabase.from('grades').insert({school_id:schoolId,name})))setNewGrade(v=>({...v,[schoolId]:''}));}
  async function assign(e,gradeId){e.preventDefault();const a=assignment[gradeId]||{};const quantity=Number(a.quantity||1);if(!a.product_id||!Number.isSafeInteger(quantity)||quantity<1){setError('Choose a book and a valid quantity.');return;}await mutate(()=>supabase.from('grade_books').upsert({grade_id:gradeId,product_id:a.product_id,quantity},{onConflict:'grade_id,product_id'}));}
  async function editAssignment(row){const answer=window.prompt('Copies required for this grade',String(row.quantity));if(answer===null)return;const quantity=Number(answer);if(!Number.isSafeInteger(quantity)||quantity<1){setError('Quantity must be a positive whole number.');return;}await mutate(()=>supabase.from('grade_books').update({quantity}).eq('id',row.id));}
  return <div className="abb-page"><PageHead title="Schools & grades" desc="Manage schools, classes and required books"/><Notice message={error}/>{message&&<p className="success">{message}</p>}
    <section className="panel abb-panel"><div className="abb-section-title"><h2>Add a school</h2><span className="abb-hint">Create a school before adding its grades</span></div>
      <form className="abb-form-line" onSubmit={addSchool}><input required placeholder="School name" value={schoolName} onChange={e=>setSchoolName(e.target.value)}/><button className="primary abb-btn" disabled={busy}><Plus size={16}/>Add school</button></form></section>
    <div className="abb-stack">{schools.map(s=><section className="panel abb-panel" key={s.id}>
      <div className="abb-section-title abb-school-header"><div className="abb-heading"><School size={20}/><h2>{s.name}</h2></div><div className="abb-actions"><button className="secondary abb-btn" disabled={busy} onClick={()=>rename('schools',s.id,s.name)}>Edit school</button><button className="secondary abb-btn abb-danger" disabled={busy} onClick={()=>mutate(()=>supabase.from('schools').delete().eq('id',s.id),`Delete ${s.name} and ALL its grades and assignments? This cannot be undone.`)}>Delete school</button></div></div>
      <div className="abb-grade-grid">{grades.filter(g=>g.school_id===s.id).map(g=><div className="abb-grade-card" key={g.id}>
        <div className="abb-grade-heading"><div className="abb-heading"><GraduationCap size={18}/><strong>{g.name}</strong></div><div className="abb-actions"><button className="secondary abb-btn" disabled={busy} onClick={()=>rename('grades',g.id,g.name)}>Edit</button><button className="secondary abb-btn abb-danger" disabled={busy} onClick={()=>mutate(()=>supabase.from('grades').delete().eq('id',g.id),`Delete ${g.name} and its book assignments?`)}>Delete</button></div></div>
        <div className="abb-assigned">{books.filter(b=>b.grade_id===g.id).map(b=><div className="abb-assignment" key={b.id}><span>{b.products?.name||'Unknown book'} <small>× {b.quantity}</small></span><div className="abb-actions"><button className="secondary abb-btn" disabled={busy} onClick={()=>editAssignment(b)}>Edit qty</button><button className="secondary abb-btn abb-danger" disabled={busy} onClick={()=>mutate(()=>supabase.from('grade_books').delete().eq('id',b.id),'Remove this book from this grade?')}>Remove</button></div></div>)}{!books.some(b=>b.grade_id===g.id)&&<p className="abb-hint">No books assigned yet.</p>}</div>
        <form className="abb-assignment-form" onSubmit={e=>assign(e,g.id)}><select required aria-label={'Book for '+g.name} value={assignment[g.id]?.product_id||''} onChange={e=>setAssignment(v=>({...v,[g.id]:{...v[g.id],product_id:e.target.value}}))}><option value="">Select book</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input aria-label="Required copies" type="number" min="1" step="1" value={assignment[g.id]?.quantity??'1'} onChange={e=>setAssignment(v=>({...v,[g.id]:{...v[g.id],quantity:e.target.value}}))}/><button className="secondary abb-btn" disabled={busy}>Assign</button></form>
      </div>)}</div>
      <form className="abb-form-line abb-add-grade" onSubmit={e=>addGrade(e,s.id)}><input required placeholder="New grade or class" value={newGrade[s.id]||''} onChange={e=>setNewGrade(v=>({...v,[s.id]:e.target.value}))}/><button className="secondary abb-btn" disabled={busy}><Plus size={16}/>Add grade</button></form>
    </section>)}</div>{!schools.length&&<p className="empty">Start by adding a school.</p>}
  </div>;
}

function Products({admin=false}) {
  const [products,setProducts]=useState([]),[shops,setShops]=useState([]),[stock,setStock]=useState([]);
  const [name,setName]=useState(''),[sku,setSku]=useState(''),[price,setPrice]=useState('');
  const [opening,setOpening]=useState({}),[branch,setBranch]=useState(''),[quantities,setQuantities]=useState({}),[reason,setReason]=useState('');
  const [showArchived,setShowArchived]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState('');
  const load=useCallback(async()=>{
    const [p,b,s]=await Promise.all([
      supabase.from('products').select('id,name,sku,price,is_active').order('name'),
      supabase.from('branches').select('id,name,enabled').order('name'),
      supabase.from('stock').select('branch_id,product_id,quantity')
    ]);
    const err=getError(p,b,s);if(err)throw Error(err);
    setProducts(p.data||[]);setShops(b.data||[]);setStock(s.data||[]);
    setBranch(v=>b.data?.some(x=>x.id===v)?v:(b.data?.[0]?.id||''));
  },[]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  const qty=(pid,bid)=>stock.find(s=>s.product_id===pid&&s.branch_id===bid)?.quantity??0;
  async function mutate(action,confirmation){
    if(confirmation&&!window.confirm(confirmation))return false;
    setBusy(true);setError('');setSuccess('');
    try{const {error}=await action();if(error)throw error;await load();setSuccess('Saved successfully.');return true;}
    catch(e){setError(e.message);return false;}finally{setBusy(false);}
  }
  async function add(e){
    e.preventDefault();if(busy)return;
    const n=name.trim(),p=Number(price);
    if(!n||price===''||!Number.isFinite(p)||p<0){setError('Enter a valid book name and price.');return;}
    for(const shop of shops){const raw=opening[shop.id]??'0';const value=Number(raw);if(raw===''||!Number.isSafeInteger(value)||value<0){setError('Enter a valid whole-number quantity for '+shop.name);return;}}
    setBusy(true);setError('');setSuccess('');
    try{
      const {data:created,error:insertError}=await supabase.from('products').insert({name:n,sku:sku.trim()||null,price:p}).select('id').single();
      if(insertError)throw insertError;
      // Stock is saved through the audited admin-only RPC, never by direct table writes.
      // Separate RPCs are not one transaction: if one fails, keep the book and report partial progress.
      const failed=[];
      for(const shop of shops){
        const value=Number(opening[shop.id]??'0');if(value===0)continue;
        const {error:stockError}=await supabase.rpc('admin_set_stock_quantity',{p_branch_id:shop.id,p_product_id:created.id,p_quantity:value,p_reason:'Opening stock'});
        if(stockError)failed.push(`${shop.name}: ${stockError.message}`);
      }
      setName('');setSku('');setPrice('');setOpening({});
      try{await load();}catch(loadError){setError('Book created, but refresh failed: '+loadError.message);return;}
      if(failed.length)setError('Book was created, but some opening stock did not save. Do not add the book again. Use Manage stock to correct it. '+failed.join(' | '));
      else setSuccess('Book created and opening stock saved for each shop.');
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  async function edit(p){const n=window.prompt('Book name',p.name);if(n===null)return;const s=window.prompt('SKU / barcode (blank allowed)',p.sku||'');if(s===null)return;const input=window.prompt('Price in PKR',String(p.price));if(input===null)return;const value=Number(input);if(!n.trim()||!input.trim()||!Number.isFinite(value)||value<0){setError('Invalid name or price.');return;}await mutate(()=>supabase.from('products').update({name:n.trim(),sku:s.trim()||null,price:value}).eq('id',p.id));}
  async function saveStock(p){
    if(!branch){setError('Choose a shop.');return;}
    const key=`${branch}:${p.id}`,raw=quantities[key]??String(qty(p.id,branch)),value=Number(raw);
    if(raw===''||!Number.isSafeInteger(value)||value<0){setError('Quantity must be a nonnegative whole number.');return;}
    if(reason.trim().length<3){setError('Enter a reason of at least 3 characters, e.g. New delivery.');return;}
    if(await mutate(()=>supabase.rpc('admin_set_stock_quantity',{p_branch_id:branch,p_product_id:p.id,p_quantity:value,p_reason:reason.trim()})))setQuantities(v=>{const next={...v};delete next[key];return next;});
  }
  const visible=products.filter(p=>admin?(showArchived||p.is_active):p.is_active);
  return <div className="abb-page"><PageHead title={admin?'Book inventory':'Book catalog'} desc={admin?'Manage books and separate stock for every shop':'Browse books and current stock'}/><Notice message={error}/>{success&&<p className="success">{success}</p>}
    {admin&&<section className="panel abb-panel"><div className="abb-section-title"><h2>Add book or item</h2><span className="abb-hint">Set starting copies for each shop when adding a book</span></div>
      <form className="abb-add-form" onSubmit={add}>
        <div className="abb-field"><label>Book name</label><input required placeholder="e.g. English Grade 5" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="abb-field"><label>Barcode / SKU</label><input placeholder="Optional" value={sku} onChange={e=>setSku(e.target.value)}/></div>
        <div className="abb-field"><label>Price (PKR)</label><input required type="number" min="0" step="0.01" placeholder="0.00" value={price} onChange={e=>setPrice(e.target.value)}/></div>
        <div className="abb-opening"><strong>Opening stock by shop</strong><div className="abb-opening-grid">{shops.map(shop=><div className="abb-field" key={shop.id}><label htmlFor={'opening-'+shop.id}>{shop.name}</label><input id={'opening-'+shop.id} type="number" min="0" step="1" inputMode="numeric" value={opening[shop.id]??'0'} onChange={e=>setOpening(v=>({...v,[shop.id]:e.target.value}))}/></div>)}</div><p className="abb-hint">Enter actual physical copies. Zero means no stock at that shop.</p></div>
        <button className="primary abb-btn abb-add-submit" disabled={busy||!shops.length}><Plus size={17}/>{busy?'Saving…':'Add book & opening stock'}</button>
      </form></section>}
    {admin&&<section className="panel abb-panel"><div className="abb-section-title"><h2>Manage stock</h2><span className="abb-hint">Changes are recorded in inventory history</span></div>
      <div className="abb-stock-settings"><div className="abb-field"><label>Shop to update</label><select aria-label="Choose shop" value={branch} onChange={e=>setBranch(e.target.value)}>{shops.map(shop=><option key={shop.id} value={shop.id}>{shop.name}{shop.enabled?'':' (disabled)'}</option>)}</select></div><div className="abb-field"><label>Reason for stock change <span className="abb-required">*</span></label><input aria-label="Stock adjustment reason" placeholder="e.g. New delivery" value={reason} onChange={e=>setReason(e.target.value)}/></div></div>
      <div className="abb-setting-footer"><p className="abb-hint">Select a shop, enter a reason, then update a book below. Other shops are unaffected.</p><label className="abb-check"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Show archived books</label></div>
    </section>}
    <section className="panel abb-panel"><div className="abb-section-title"><h2>Books <span className="abb-count">{visible.length}</span></h2><span className="abb-hint">Current quantities by shop</span></div>
      <div className="abb-books">{visible.map(p=><article className="abb-book" key={p.id}>
        <div className="abb-book-top"><div className="abb-book-name"><span className="abb-book-icon"><BookOpen size={20}/></span><div><h3>{p.name}</h3><span className="abb-hint">SKU: {p.sku||'Not set'}{!p.is_active?' · Archived':''}</span></div></div><strong className="abb-price">{money(p.price)}</strong></div>
        <div className="abb-shop-grid">{shops.map(shop=><div key={shop.id} className={'abb-shop-qty '+(shop.id===branch&&admin?'abb-shop-selected':'')}><span>{shop.name}</span><strong>{qty(p.id,shop.id)} <small>copies</small></strong></div>)}</div>
        {admin&&<div className="abb-book-footer"><div className="abb-stock-edit"><div className="abb-field"><label>Copies at selected shop</label><input aria-label={'Copies for '+p.name} type="number" inputMode="numeric" min="0" step="1" value={quantities[`${branch}:${p.id}`]??String(qty(p.id,branch))} onChange={e=>setQuantities(v=>({...v,[`${branch}:${p.id}`]:e.target.value}))}/></div><button className="primary abb-btn" disabled={busy||!branch} onClick={()=>saveStock(p)}>Save stock</button></div><div className="abb-actions abb-book-actions"><button className="secondary abb-btn" disabled={busy} onClick={()=>edit(p)}>Edit book</button><button className="secondary abb-btn abb-danger" disabled={busy} onClick={()=>mutate(()=>supabase.from('products').update({is_active:!p.is_active}).eq('id',p.id),p.is_active?'Archive this book? Sales history will remain.':'Restore this book?')}>{p.is_active?'Archive':'Restore'}</button></div></div>}
      </article>)}</div>{!visible.length&&<p className="empty">No books to display.</p>}
    </section>
  </div>;
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
