import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { BookOpen, LayoutDashboard, School, GraduationCap, Package, ShoppingCart, LogOut, Menu, Search, Plus, Trash2, CreditCard, Store, ArrowLeft, KeyRound } from 'lucide-react';
import { configured, supabase } from './supabase';
import { Operations } from './Operations';
import {Staff, Reports, Returns, SellerStock, SalesLedger} from './ExtendedPOS';
import { CashRegisterGate, CashRegisterPage, AdminCashRegisters } from './CashRegister';

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
  return <BrowserRouter>{!access ? <Login onLogin={login} /> : access.role === 'seller' && !access.branch_id ? <ShopGate onVerify={verifyShop} onLogout={logout} /> : <CashRegisterGate role={access.role} branchId={access.branch_id}><Shell role={access.role} branchId={access.branch_id} logout={logout} /></CashRegisterGate>}</BrowserRouter>;
}

function Login({ onLogin }) {
  const [pin, setPin] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e) { e.preventDefault(); if (pin.length !== 6) return; setBusy(true); setError(''); try { await onLogin(pin); } catch (e) { setError(e.message); setPin(''); } finally { setBusy(false); } }
  return <main className="login-wrap"><div className="login-art"><div className="brand-duo login-brand-duo"><img src="/branding/abbas-book-bank.jpg" alt="Abbas Book Bank logo"/><img src="/branding/af-notebook.jpg" alt="AF Notebook logo"/></div><h1>Abbas Book Bank <span className="brand-byline">by AF Notebook</span></h1><p>Books, courses & stationery management</p><div className="art-line" /><p className="muted-light">Secure point of sale · Karachi</p></div>
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
  return <main className="shop-gate"><div className="shop-gate-card"><div className="brand-duo gate-brand-duo"><img src="/branding/abbas-book-bank.jpg" alt="Abbas Book Bank logo"/><img src="/branding/af-notebook.jpg" alt="AF Notebook logo"/></div><strong className="gate-brand-name">Abbas Book Bank by AF Notebook</strong><span className="eyebrow">SELLER ACCESS</span><h1>{selected ? 'Verify shop access' : 'Choose your shop'}</h1><p className="muted">{selected ? `Enter the 6-digit PIN for ${selected.name}.` : 'Select the location where you are selling today.'}</p>
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

const adminNav=[['/admin','Dashboard',LayoutDashboard],['/admin/schools','Schools & Grades',School],['/admin/products','Products & Inventory',Package],['/admin/sales','Sales',ShoppingCart],['/admin/shops','Manage Shops',Store],['/admin/operations','Purchasing & Transfers',Package],['/admin/returns','Returns & Exchanges',ShoppingCart],['/admin/staff','Staff Directory',Store],['/admin/reports','Reports & Audit',LayoutDashboard],['/admin/cash','Cash Registers',Store],['/admin/expenses','Expenses',CreditCard],['/admin/settings','Settings',KeyRound]];
const sellerNav=[['/seller','New Sale',ShoppingCart],['/seller/catalog','Browse Books',BookOpen],['/seller/history','My Sales',LayoutDashboard],['/seller/stock','My Shop Stock',Package],['/seller/returns','Returns & Exchanges',ShoppingCart],['/seller/cash','Cash Register',Store]];
function Shell({role,branchId,logout}) {
  const [open,setOpen]=useState(false);const nav=role==='admin'?adminNav:sellerNav;
  return <div className="shell"><style>{abbasResponsiveStyles}</style><aside className={'sidebar '+(open?'open':'')}><div className="side-brand"><span className="brand-duo sidebar-brand-duo"><img src="/branding/abbas-book-bank.jpg" alt="Abbas Book Bank logo"/><img src="/branding/af-notebook.jpg" alt="AF Notebook logo"/></span><span><b>ABBAS BOOK BANK</b><small>BY AF NOTEBOOK</small></span></div><div className="role-label">{role==='admin'?'ADMIN WORKSPACE':'SELLER WORKSPACE'}</div><nav>{nav.map(([url,label,Icon])=><NavLink key={url} to={url} end onClick={()=>setOpen(false)} className={({isActive})=>isActive?'nav active':'nav'}><Icon size={19}/>{label}</NavLink>)}</nav></aside>
    <div className="workspace"><header className="topbar"><button className="icon-btn mobile-only" onClick={()=>setOpen(!open)}><Menu/></button><div className="top-brand"><span className="brand-duo topbar-brand-duo"><img src="/branding/abbas-book-bank.jpg" alt="Abbas Book Bank logo"/><img src="/branding/af-notebook.jpg" alt="AF Notebook logo"/></span><span><b>Abbas Book Bank by AF Notebook</b><span className="top-sub">{role==='admin'?'Business management':'Sales counter · Selected shop'}</span></span></div><div className="abb-top-actions"><span className="role-pill">{role==='admin'?'Administrator':'Seller'}</span><button className="abb-top-signout" onClick={logout} title="Sign out"><LogOut size={16}/> <span>Sign out</span></button></div></header><div className="content"><Routes>{role==='admin'?<><Route path="/admin" element={<Dashboard/>}/><Route path="/admin/schools" element={<AdminPageBoundary><Schools/></AdminPageBoundary>}/><Route path="/admin/products" element={<Products admin/>}/><Route path="/admin/sales" element={<SalesLedger admin/>}/><Route path="/admin/shops" element={<ShopManager/>}/><Route path="/admin/operations" element={<Operations/>}/><Route path="/admin/returns" element={<Returns/>}/><Route path="/admin/staff" element={<Staff/>}/><Route path="/admin/reports" element={<Reports/>}/><Route path="/admin/cash" element={<AdminCashRegisters/>}/><Route path="/admin/expenses" element={<Expenses/>}/><Route path="/admin/settings" element={<AdminSettings/>}/><Route path="*" element={<Navigate to="/admin"/>}/></>:<><Route path="/seller" element={<POS branchId={branchId}/>}/><Route path="/seller/catalog" element={<Products/>}/><Route path="/seller/history" element={<SalesLedger/>}/><Route path="/seller/stock" element={<SellerStock branchId={branchId}/>}/><Route path="/seller/returns" element={<Returns seller/>}/><Route path="/seller/cash" element={<CashRegisterPage/>}/><Route path="*" element={<Navigate to="/seller"/>}/></>}</Routes><footer className="abb-credit">Developed by <strong>ByteCraft Solutions</strong></footer></div></div>{open&&<div className="overlay mobile-only" onClick={()=>setOpen(false)}/>}</div>;
}
function PageHead({title,desc,action}) {return <div className="page-head"><div><h1>{title}</h1><p className="muted">{desc}</p></div>{action}</div>;}
function Notice({message}) {return message?<p className="error" role="alert">{message}</p>:null;}
function DashboardVisuals({data,trend,period,setPeriod,trendLimited}) {
  const total=Number(data.stock_units||0),costed=Number(data.costed_stock_units||0),uncosted=Number(data.uncosted_stock_units||0);
  const coverage=total?Math.min(100,Math.max(0,costed/total*100)):0;
  const days=period===7?7:30;
  const today=new Date();today.setHours(0,0,0,0);
  const points=Array.from({length:days},(_,i)=>{const day=new Date(today);day.setDate(today.getDate()-(days-1-i));const key=[day.getFullYear(),String(day.getMonth()+1).padStart(2,'0'),String(day.getDate()).padStart(2,'0')].join('-');return {key,label:day.toLocaleDateString(undefined,{month:'short',day:'numeric'}),value:trend.filter(x=>{const d=new Date(x.created_at);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')===key}).reduce((a,x)=>a+Number(x.total||0),0)};});
  const max=Math.max(1,...points.map(x=>x.value));const coords=points.map((x,i)=>`${32+(i/(days-1))*636},${171-(x.value/max)*135}`).join(' ');
  const sum=points.reduce((a,x)=>a+x.value,0);
  return <div className="abb-visual-grid">
    <section className="abb-visual-panel abb-trend"><div className="abb-visual-heading"><div><h2>Sales trend</h2><p>Recorded sales by day · {days} days</p></div><div className="abb-visual-toggle"><button className={period===7?'active':''} onClick={()=>setPeriod(7)}>7D</button><button className={period===30?'active':''} onClick={()=>setPeriod(30)}>30D</button></div></div><div className="abb-trend-total">{money(sum)} <small>period sales</small></div><svg className="abb-trend-svg" viewBox="0 0 700 210" role="img" aria-label={`Daily sales over ${days} days`} preserveAspectRatio="none"><defs><linearGradient id="abbTrendFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#3277a5" stopOpacity=".18"/><stop offset="1" stopColor="#3277a5" stopOpacity="0"/></linearGradient></defs>{[36,81,126,171].map(y=><line key={y} x1="32" x2="668" y1={y} y2={y} stroke="#e8eef5" strokeDasharray="4 5"/>)}<polygon points={`32,171 ${coords} 668,171`} fill="url(#abbTrendFill)"/><polyline points={coords} fill="none" stroke="#367ba9" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/></svg><div className="abb-axis"><span>{points[0].label}</span><span>{points[Math.floor((days-1)/2)].label}</span><span>{points[days-1].label}</span></div>{trendLimited&&<p className="abb-data-warning">Sales list reached the 1,000-row limit. Chart totals may be incomplete.</p>}</section>
    <section className="abb-visual-panel"><div className="abb-visual-heading"><div><h2>Inventory cost coverage</h2><p>Units with recorded purchase costs</p></div></div><div className="abb-donut-layout"><div className="abb-donut" style={{background:total?`conic-gradient(#397ea4 ${coverage}%,#e8edf4 ${coverage}% 100%)`:'#e8edf4'}}><div><strong>{coverage.toFixed(1)}%</strong><small>costed</small></div></div><div className="abb-legend"><div><i className="abb-dot abb-dot-costed"/>Costed <strong>{costed.toLocaleString()}</strong></div><div><i className="abb-dot abb-dot-uncosted"/>Uncosted <strong>{uncosted.toLocaleString()}</strong></div><div className="abb-legend-total">Total <strong>{total.toLocaleString()}</strong></div></div></div></section>
    <section className="abb-visual-panel"><div className="abb-visual-heading"><div><h2>Cost data completeness</h2><p>Purchase cost entry progress</p></div></div><div className="abb-gauge"><svg viewBox="0 0 220 130" role="img" aria-label={`${coverage.toFixed(1)} percent stock units have purchase costs`}><path d="M 27 112 A 83 83 0 0 1 193 112" fill="none" stroke="#e8edf4" strokeWidth="17" strokeLinecap="round"/><path d="M 27 112 A 83 83 0 0 1 193 112" fill="none" stroke="#397ea4" strokeWidth="17" strokeLinecap="round" pathLength="100" strokeDasharray={`${coverage} 100`}/><text x="110" y="93" fontSize="33" fontWeight="750" textAnchor="middle" fill="#1a3657">{coverage.toFixed(0)}%</text><text x="110" y="115" fontSize="11" textAnchor="middle" fill="#72849a">stock cost coverage</text></svg></div><p className="abb-gauge-caption">{uncosted>0?`${uncosted.toLocaleString()} units still need purchase costs.`:'All current stock units have recorded purchase costs.'}</p></section>
  </div>;
}

function Dashboard() {
  const [data,setData]=useState(null),[recent,setRecent]=useState([]),[trend,setTrend]=useState([]),[period,setPeriod]=useState(7),[trendLimited,setTrendLimited]=useState(false),[err,setErr]=useState(''),[loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{
    setLoading(true);setErr('');
    try {
      const start=new Date();start.setDate(start.getDate()-30);start.setHours(0,0,0,0);
      const [financial,sales,history]=await Promise.all([
        supabase.rpc('pos_financial_overview'),
        supabase.from('sales').select('id,receipt_no,total,created_at').order('created_at',{ascending:false}).limit(8),
        supabase.from('sales').select('id,total,created_at').gte('created_at',start.toISOString()).order('created_at',{ascending:false}).limit(1000)
      ]);
      if(financial.error)throw financial.error;
      if(sales.error)throw sales.error;
      if(history.error)throw history.error;
      const periodStart=new Date(financial.data?.period_started_at||0).getTime();
      setData(financial.data);setRecent((sales.data||[]).filter(x=>new Date(x.created_at).getTime()>=periodStart));setTrend((history.data||[]).filter(x=>new Date(x.created_at).getTime()>=periodStart));setTrendLimited((history.data||[]).length===1000);
    }catch(e){setErr(e.message||String(e));}finally{setLoading(false);}
  },[]);
  useEffect(()=>{refresh();},[refresh]);
  const [expenseTotal,setExpenseTotal]=useState(null);
  useEffect(()=>{supabase.rpc('pos_expense_summary').then(({data,error})=>{if(!error)setExpenseTotal(Number(data?.total_expenses||0));});},[data]);
  const d=data||{};const uncosted=Number(d.uncosted_stock_units||0),unknownSold=Number(d.uncosted_sold_units||0);
  const metrics=[
    ['Listed products',d.listed_products??'—','Active catalog items','catalog'],
    ['Stock units',d.stock_units??'—','Across all shops','stock'],
    ['Stock cost value',uncosted?'Incomplete':money(d.stock_cost_value||0),uncosted?`${uncosted} units missing costs`:'Recorded inventory cost','cost'],
    ['Stock selling value',money(d.stock_selling_value||0),'At current listed prices','selling'],
    ['Net sales',money(d.net_sales||0),'After completed refunds','sales'],
    ['Gross profit',unknownSold?'Incomplete':money(d.realized_gross_profit||0),unknownSold?`${unknownSold} sold units missing historical costs`:'Sales less recorded item costs','profit'],
    ['Operating expenses',expenseTotal===null?'Not available':money(expenseTotal),'All recorded operating expenses','expenses'],
    ['Net operating profit',unknownSold||expenseTotal===null?'Incomplete':money(Number(d.realized_gross_profit||0)-expenseTotal),unknownSold?'Historical cost data missing':'Gross profit minus operating expenses (before taxes)','netprofit'],
    ['Potential stock margin',uncosted?'Incomplete':money(d.potential_margin||0),uncosted?'Enter missing purchase costs':'Before overhead and expenses','margin'],
    ['Completed sales',d.sales_count??'—','All recorded transactions','orders']
  ];
  return <div className="premium-dashboard">
    <div className="premium-hero"><div><span className="premium-eyebrow">ABBAS BOOK BANK · ADMIN OVERVIEW</span><h1>Business at a glance</h1><p>Inventory, sales and financial performance in one place.</p></div><button className="premium-refresh" onClick={refresh} disabled={loading}>{loading?'Refreshing…':'Refresh overview'}</button></div>
    <Notice message={err}/>
    {data&&<>{(uncosted>0||unknownSold>0)&&<div className="premium-warning" role="status"><strong>Financial data needs attention</strong><span>{uncosted>0?`${uncosted} stock units have no purchase cost. `:''}{unknownSold>0?`${unknownSold} historical sold units have no cost snapshot. `:''}Unknown costs are never treated as zero profit. Historical sales cannot be repaired by entering today's cost.</span></div>}
    <div className="premium-metrics">{metrics.map(([label,value,detail,key])=><div className={'premium-metric premium-'+key} key={key}><span className="premium-metric-label">{label}</span><strong>{value}</strong><small>{detail}</small></div>)}</div>
    <DashboardVisuals data={d} trend={trend} period={period} setPeriod={setPeriod} trendLimited={trendLimited}/><div className="premium-bottom"><section className="premium-recent"><div className="premium-panel-head"><div><h2>Recent sales</h2><p>Latest completed transactions</p></div><span className="premium-count">{recent.length} shown</span></div><div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Date</th><th>Amount</th></tr></thead><tbody>{recent.map(x=><tr key={x.id}><td>{displayReceipt(x.receipt_no)}</td><td>{new Date(x.created_at).toLocaleString()}</td><td>{money(x.total)}</td></tr>)}</tbody></table>{!recent.length&&<p className="empty">No sales yet</p>}</div></section><section className="premium-insight"><h2>Inventory health</h2><p>Track what your inventory is worth and where data is incomplete.</p><div><span>Costed stock units</span><strong>{d.costed_stock_units??0}</strong></div><div><span>Uncosted stock units</span><strong>{uncosted}</strong></div><div><span>Refunds</span><strong>{money(d.refunds||0)}</strong></div><div><span>Schools</span><strong>{d.schools_count??0}</strong></div><p className="premium-note">Net operating profit deducts recorded expenses from gross profit. Gross profit itself excludes overhead, rent, salaries and other operating expenses. Cost values reflect recorded purchase costs, not verified historical purchase lots.</p></section></div></>}
    {loading&&!data&&<section className="panel">Loading financial overview…</section>}
  </div>;
}

function Expenses(){
  const categories=['Rent','Tea & meals','Transport','Maintenance','Utilities','Salaries','Supplies','Other'];
  const [items,setItems]=useState([]),[amount,setAmount]=useState(''),[category,setCategory]=useState('Rent'),[note,setNote]=useState(''),[date,setDate]=useState(new Date().toISOString().slice(0,10)),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
  const load=useCallback(async()=>{const {data,error}=await supabase.rpc('pos_list_expenses');if(error)throw error;setItems(data||[]);},[]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  async function save(e){e.preventDefault();const n=Number(amount);if(!Number.isFinite(n)||n<=0){setError('Expense must be greater than zero.');return;}setBusy(true);setError('');setSuccess('');try{const {error}=await supabase.rpc('pos_add_expense',{p_amount:n,p_category:category,p_note:note.trim(),p_expense_date:date});if(error)throw error;await load();setAmount('');setNote('');setSuccess('Expense saved.');}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function remove(id){if(!window.confirm('Delete this expense?'))return;setBusy(true);setError('');try{const {error}=await supabase.rpc('pos_delete_expense',{p_id:id});if(error)throw error;await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
  const total=items.reduce((sum,x)=>sum+Number(x.amount||0),0);
  return <div className="abb-page"><PageHead title="Business expenses" desc="Track operating costs separately from inventory purchases"/><Notice message={error}/>{success&&<p className="success">{success}</p>}<section className="panel abb-panel"><div className="abb-section-title"><h2>Record an expense</h2><span className="abb-hint">Expenses reduce operating profit, not gross profit</span></div><form className="abb-add-form" onSubmit={save}><div className="abb-field"><label>Date</label><input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></div><div className="abb-field"><label>Category</label><select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(x=><option key={x}>{x}</option>)}</select></div><div className="abb-field"><label>Amount (PKR)</label><input required type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></div><div className="abb-field"><label>Notes / purpose</label><input maxLength={500} value={note} onChange={e=>setNote(e.target.value)} placeholder="Optional details"/></div><button className="primary abb-btn abb-add-submit" disabled={busy}>{busy?'Saving…':'Save expense'}</button></form></section><section className="panel abb-panel"><div className="abb-section-title"><h2>Recent expenses</h2><strong>{money(total)} (shown records)</strong></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Amount</th><th></th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{x.expense_date}</td><td>{x.category}</td><td>{x.note||'—'}</td><td>{money(x.amount)}</td><td><button className="secondary" disabled={busy} onClick={()=>remove(x.id)}>Delete</button></td></tr>)}</tbody></table></div>{!items.length&&<p className="empty">No expenses recorded yet.</p>}<p className="abb-hint">Showing the latest 100 entries. Dashboard totals include all entries.</p></section></div>;
}

class AdminPageBoundary extends React.Component {
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error,info){console.error('Admin page failed',error,info);}
  render(){if(this.state.error)return <section className="panel" role="alert"><h2>Page could not load</h2><p>{this.state.error.message||'Unexpected error'}</p><button className="primary" onClick={()=>this.setState({error:null})}>Try again</button></section>;return this.props.children;}
}

function AdminSettings(){
  const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pin,setPin]=useState(''),[success,setSuccess]=useState('');
  async function checkReadiness(){
    setBusy(true);setError('');
    try {const {data,error:rpcError}=await supabase.rpc('pos_reset_preflight');if(rpcError)throw rpcError;setPreview(data);}
    catch(e){setError(e.message||String(e));}finally{setBusy(false);}
  }
  async function executeReset(){
    if(!preview?.ready){setError('Run readiness check and close all cash registers first.');return;}
    if(!/^[0-9]{6}$/.test(pin)){setError('Enter your fresh six-digit admin PIN.');return;}
    if(!window.confirm('Start a NEW financial reporting period for BOTH shops? Historical transactions and inventory will be preserved.'))return;
    setBusy(true);setError('');setSuccess('');
    try{
      const {data,error:rpcError}=await supabase.rpc('pos_reset_financial_period',{p_pin:pin});
      if(rpcError)throw rpcError;
      if(!data?.ok)throw new Error(data?.error||'Reset was not completed.');
      setSuccess('New financial reporting period started. Refresh the dashboard to view current-period totals.');
      setPreview(null);
    }catch(e){setError(e.message||String(e));}finally{setPin('');setBusy(false);}
  }
  return <div className="abb-page"><PageHead title="Settings" desc="Administration and production launch controls"/>
    <section className="panel abb-panel"><h2>Production data reset</h2>
      <p>Option A preserves products, schools, grades, purchase costs, and verified physical stock. Historical financial records and receipts must remain available for audit.</p>
      <p className="premium-warning">This action starts a new reporting period. It does not delete historical receipts or change inventory. Close all shop cash registers first.</p>
      <button className="secondary abb-btn" onClick={checkReadiness} disabled={busy}>{busy?'Checking…':'Check reset readiness (read-only)'}</button>
      <Notice message={error}/>
      {success&&<p className="success" role="status">{success}</p>}
      <div className="abb-field"><label>Fresh admin PIN (required for every reset)</label><input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,6))} placeholder="6-digit admin PIN"/></div>
      <button className="primary abb-btn" disabled={busy||!preview?.ready||pin.length!==6} onClick={executeReset}>Start new financial reporting period</button>
      {preview&&<div className="panel" role="status"><h3>{preview.ready?'Cash registers closed':'Reset blocked: open cash register'}</h3>
        <p>Open registers: {preview.open_registers} | Historical sales: {preview.historical_sales} | Returns: {preview.historical_returns} | Expenses: {preview.historical_expenses}</p>
        <p>Inventory stock rows preserved: {preview.stock_rows_preserved}. Reporting period: {preview.active_period_id}.</p>
        <p>{preview.note}</p></div>}
      <p>Historical receipts remain available. Current-period reporting starts from the reset time; physical inventory does not change.</p>
    </section></div>;
}

function Schools() {
  const [schools,setSchools]=useState([]),[grades,setGrades]=useState([]),[books,setBooks]=useState([]),[products,setProducts]=useState([]);
  const [schoolName,setSchoolName]=useState(''),[newGrade,setNewGrade]=useState({}),[assignment,setAssignment]=useState({});
  const [shops,setShops]=useState([]),[schoolShops,setSchoolShops]=useState([]),[newSchoolShops,setNewSchoolShops]=useState([]);
  const [error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const [schoolQuery,setSchoolQuery]=useState(''),[schoolPage,setSchoolPage]=useState(0);
  const load=useCallback(async()=>{
    const [s,g,b,p,sh,ss]=await Promise.all([
      supabase.from('schools').select('id,name').order('name'),
      supabase.from('grades').select('id,name,school_id').order('name'),
      supabase.from('grade_books').select('id,grade_id,product_id,quantity,products(name)'),
      supabase.from('products').select('id,name').eq('is_active',true).order('name'),
      supabase.from('branches').select('id,name').order('name'),
      supabase.from('school_branches').select('school_id,branch_id')
    ]);
    setSchools(s.data||[]);setGrades(g.data||[]);setBooks(b.data||[]);setProducts(p.data||[]);setShops(sh.data||[]);setSchoolShops(ss.data||[]);
    const err=getError(s,g,b,p,sh,ss);if(err)throw Error(err);
  },[]);
  useEffect(()=>{load().catch(e=>setError(e.message));},[load]);
  async function mutate(action,confirmation){
    if(confirmation&&!window.confirm(confirmation))return false;
    setBusy(true);setError('');setMessage('');
    try{const {error}=await action();if(error)throw error;await load();setMessage('Changes saved.');return true;}
    catch(e){setError(e.message);return false;}finally{setBusy(false);}
  }
  async function addSchool(e){e.preventDefault();const name=schoolName.trim();if(!name)return;if(!newSchoolShops.length){setError('Select at least one shop.');return;}if(await mutate(()=>supabase.rpc('pos_create_school_for_shops',{p_name:name,p_branch_ids:newSchoolShops}))) {setSchoolName('');setNewSchoolShops([]);}}
  async function toggleSchoolShop(schoolId,branchId,enabled){await mutate(()=>supabase.rpc('pos_set_school_shop',{p_school_id:schoolId,p_branch_id:branchId,p_assigned:enabled}));}
  async function rename(table,id,oldName){const value=window.prompt('Enter new name',oldName);if(value===null||!value.trim()||value.trim()===oldName)return;await mutate(()=>supabase.from(table).update({name:value.trim()}).eq('id',id));}
  async function addGrade(e,schoolId){e.preventDefault();const name=(newGrade[schoolId]||'').trim();if(!name)return;if(await mutate(()=>supabase.from('grades').insert({school_id:schoolId,name})))setNewGrade(v=>({...v,[schoolId]:''}));}
  async function assign(e,gradeId){e.preventDefault();const a=assignment[gradeId]||{};const quantity=Number(a.quantity||1);if(!a.product_id||!Number.isSafeInteger(quantity)||quantity<1){setError('Choose a book and a valid quantity.');return;}await mutate(()=>supabase.from('grade_books').upsert({grade_id:gradeId,product_id:a.product_id,quantity},{onConflict:'grade_id,product_id'}));}
  async function editAssignment(row){const answer=window.prompt('Copies required for this grade',String(row.quantity));if(answer===null)return;const quantity=Number(answer);if(!Number.isSafeInteger(quantity)||quantity<1){setError('Quantity must be a positive whole number.');return;}await mutate(()=>supabase.from('grade_books').update({quantity}).eq('id',row.id));}
  const matchingSchools=schools.filter(s=>{
    const q=schoolQuery.trim().toLowerCase();if(!q)return true;
    const related=grades.filter(g=>g.school_id===s.id);
    return s.name.toLowerCase().includes(q)||related.some(g=>g.name.toLowerCase().includes(q)||books.some(b=>b.grade_id===g.id&&(b.products?.name||'').toLowerCase().includes(q)));
  });
  return <div className="abb-page"><PageHead title="Schools & grades" desc="Manage schools, classes and required books"/><Notice message={error}/>{message&&<p className="success">{message}</p>}
    <section className="panel abb-panel"><div className="abb-section-title"><h2>Add a school</h2><span className="abb-hint">Create a school before adding its grades</span></div>
      <form className="abb-form-line" onSubmit={addSchool}><input required placeholder="School name" value={schoolName} onChange={e=>setSchoolName(e.target.value)}/><fieldset className="abb-shop-picker"><legend>Assign to shop(s)</legend>{shops.map(sh=><label key={sh.id}><input type="checkbox" checked={newSchoolShops.includes(sh.id)} onChange={e=>setNewSchoolShops(v=>e.target.checked?[...v,sh.id]:v.filter(id=>id!==sh.id))}/>{sh.name}</label>)}</fieldset><button className="primary abb-btn" disabled={busy||!newSchoolShops.length}><Plus size={16}/>Add school</button></form></section>
    <div className="abb-list-tools"><label>Find school<input placeholder="Search school, grade or assigned book" value={schoolQuery} onChange={e=>{setSchoolQuery(e.target.value);setSchoolPage(0);}} /></label></div>
    <div className="abb-stack">{matchingSchools.slice(schoolPage*15,(schoolPage+1)*15).map(s=><section className="panel abb-panel" key={s.id}>
      <div className="abb-section-title abb-school-header"><div className="abb-heading"><School size={20}/><h2>{s.name}</h2></div><div className="abb-actions"><button className="secondary abb-btn" disabled={busy} onClick={()=>rename('schools',s.id,s.name)}>Edit school</button><button className="secondary abb-btn abb-danger" disabled={busy} onClick={()=>mutate(()=>supabase.from('schools').delete().eq('id',s.id),`Delete ${s.name} and ALL its grades and assignments? This cannot be undone.`)}>Delete school</button></div></div>
      <fieldset className="abb-shop-picker"><legend>Available in shops</legend>{shops.map(sh=><label key={sh.id}><input type="checkbox" disabled={busy} checked={schoolShops.some(x=>x.school_id===s.id&&x.branch_id===sh.id)} onChange={e=>toggleSchoolShop(s.id,sh.id,e.target.checked)}/>{sh.name}</label>)}</fieldset><div className="abb-grade-grid">{grades.filter(g=>g.school_id===s.id).map(g=><div className="abb-grade-card" key={g.id}>
        <div className="abb-grade-heading"><div className="abb-heading"><GraduationCap size={18}/><strong>{g.name}</strong></div><div className="abb-actions"><button className="secondary abb-btn" disabled={busy} onClick={()=>rename('grades',g.id,g.name)}>Edit</button><button className="secondary abb-btn abb-danger" disabled={busy} onClick={()=>mutate(()=>supabase.from('grades').delete().eq('id',g.id),`Delete ${g.name} and its book assignments?`)}>Delete</button></div></div>
        <div className="abb-assigned">{books.filter(b=>b.grade_id===g.id).map(b=><div className="abb-assignment" key={b.id}><span>{b.products?.name||'Unknown book'} <small>× {b.quantity}</small></span><div className="abb-actions"><button className="secondary abb-btn" disabled={busy} onClick={()=>editAssignment(b)}>Edit qty</button><button className="secondary abb-btn abb-danger" disabled={busy} onClick={()=>mutate(()=>supabase.from('grade_books').delete().eq('id',b.id),'Remove this book from this grade?')}>Remove</button></div></div>)}{!books.some(b=>b.grade_id===g.id)&&<p className="abb-hint">No books assigned yet.</p>}</div>
        <form className="abb-assignment-form" onSubmit={e=>assign(e,g.id)}><select required aria-label={'Book for '+g.name} value={assignment[g.id]?.product_id||''} onChange={e=>setAssignment(v=>({...v,[g.id]:{...v[g.id],product_id:e.target.value}}))}><option value="">Select book</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input aria-label="Required copies" type="number" min="1" step="1" value={assignment[g.id]?.quantity??'1'} onChange={e=>setAssignment(v=>({...v,[g.id]:{...v[g.id],quantity:e.target.value}}))}/><button className="secondary abb-btn" disabled={busy}>Assign</button></form>
      </div>)}</div>
      <form className="abb-form-line abb-add-grade" onSubmit={e=>addGrade(e,s.id)}><input required placeholder="New grade or class" value={newGrade[s.id]||''} onChange={e=>setNewGrade(v=>({...v,[s.id]:e.target.value}))}/><button className="secondary abb-btn" disabled={busy}><Plus size={16}/>Add grade</button></form>
    </section>)}</div><div className="abb-pager"><button className="secondary" disabled={schoolPage===0} onClick={()=>setSchoolPage(v=>Math.max(0,v-1))}>Previous</button><span>Page {schoolPage+1}</span><button className="secondary" disabled={(schoolPage+1)*15>=matchingSchools.length} onClick={()=>setSchoolPage(v=>v+1)}>Next</button></div>{!schools.length&&<p className="empty">Start by adding a school.</p>}
  </div>;
}

const PRODUCT_CATEGORIES=['Books & textbooks','School courses','Pens & pencils','Notebooks & registers','Geometry & mathematics','Art & craft','Office stationery','Other products'];

function Products({admin=false}) {
  const [products,setProducts]=useState([]),[shops,setShops]=useState([]),[stock,setStock]=useState([]);
  const [name,setName]=useState(''),[sku,setSku]=useState(''),[price,setPrice]=useState(''),[purchaseCost,setPurchaseCost]=useState(''),[costs,setCosts]=useState({}),[category,setCategory]=useState('Books & textbooks');
  const [opening,setOpening]=useState({}),[branch,setBranch]=useState(''),[quantities,setQuantities]=useState({}),[reason,setReason]=useState('');
  const [categoryFilter,setCategoryFilter]=useState('All categories'),[productQuery,setProductQuery]=useState(''),[productPage,setProductPage]=useState(0),[stockMode,setStockMode]=useState('add'),[showArchived,setShowArchived]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false),[success,setSuccess]=useState('');
  const load=useCallback(async()=>{
    const [p,b,s]=await Promise.all([
      supabase.from('products').select('id,name,sku,price,is_active,category').order('name'),
      supabase.from('branches').select('id,name,enabled').order('name'),
      supabase.from('stock').select('branch_id,product_id,quantity')
    ]);
    const err=getError(p,b,s);if(err)throw Error(err);
    setProducts(p.data||[]);setShops(b.data||[]);setStock(s.data||[]);
    if(admin){const c=await supabase.from('product_costs').select('product_id,purchase_cost');if(c.error)throw c.error;setCosts(Object.fromEntries((c.data||[]).map(x=>[x.product_id,x.purchase_cost])));}
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
    const costInput=purchaseCost.trim();const c=Number(costInput);if(costInput!==''&&(!Number.isFinite(c)||c<0)){setError('Enter a valid purchase cost or leave it blank.');return;}
    if(!n||price===''||!Number.isFinite(p)||p<0){setError('Enter a valid book name and price.');return;}
    for(const shop of shops){const raw=opening[shop.id]??'0';const value=Number(raw);if(raw===''||!Number.isSafeInteger(value)||value<0){setError('Enter a valid whole-number quantity for '+shop.name);return;}}
    setBusy(true);setError('');setSuccess('');
    try{
      const {data:created,error:insertError}=await supabase.from('products').insert({name:n,sku:sku.trim()||null,price:p,category}).select('id').single();
      if(insertError)throw insertError;
      let costSaveError='';
      if(costInput!==''){const r=await supabase.from('product_costs').upsert({product_id:created.id,purchase_cost:c},{onConflict:'product_id'});if(r.error)costSaveError=r.error.message;}
      // Stock is saved through the audited admin-only RPC, never by direct table writes.
      // Separate RPCs are not one transaction: if one fails, keep the book and report partial progress.
      const failed=[];
      for(const shop of shops){
        const value=Number(opening[shop.id]??'0');if(value===0)continue;
        const {error:stockError}=await supabase.rpc('admin_set_stock_quantity',{p_branch_id:shop.id,p_product_id:created.id,p_quantity:value,p_reason:'Opening stock'});
        if(stockError)failed.push(`${shop.name}: ${stockError.message}`);
      }
      setName('');setSku('');setPrice('');setPurchaseCost('');setCategory('Books & textbooks');setOpening({});
      try{await load();}catch(loadError){setError('Book created, but refresh failed: '+loadError.message);return;}
      if(costSaveError)setError('Product created but purchase cost was not saved: '+costSaveError+'. Edit its purchase cost below.');
      else if(failed.length)setError('Book was created, but some opening stock did not save. Do not add the book again. Use Manage stock to correct it. '+failed.join(' | '));
      else setSuccess('Book created and opening stock saved for each shop.');
    }catch(err){setError(err.message);}finally{setBusy(false);}
  }
  async function edit(p){const newCategory=window.prompt('Category: '+PRODUCT_CATEGORIES.join(', '),p.category||'Books & textbooks');if(newCategory===null)return;if(!PRODUCT_CATEGORIES.includes(newCategory.trim())){setError('Choose a category from the listed options.');return;}const n=window.prompt('Book name',p.name);if(n===null)return;const s=window.prompt('SKU / barcode (blank allowed)',p.sku||'');if(s===null)return;const input=window.prompt('Price in PKR',String(p.price));if(input===null)return;const value=Number(input);if(!n.trim()||!input.trim()||!Number.isFinite(value)||value<0){setError('Invalid name or price.');return;}await mutate(()=>supabase.from('products').update({name:n.trim(),sku:s.trim()||null,price:value,category:newCategory.trim()}).eq('id',p.id));}
  async function safeDelete(p){
    if(!window.confirm(`Delete ${p.name}? Only products with no dependent history can be permanently deleted. Otherwise, archive the product.`))return;
    setBusy(true);setError('');setSuccess('');
    try{
      const {error}=await supabase.rpc('pos_safe_delete_product',{p_product_id:p.id});
      if(error)throw error;
      await load();setSuccess('Unused product deleted.');
    }catch(e){setError(e.message.includes('Could not find the function')?'Safe deletion requires the database migration. No product was deleted.':e.message)}finally{setBusy(false)}
  }
  async function saveCost(p){
    const answer=window.prompt('Purchase cost in PKR for '+p.name+' (not selling price)',costs[p.id]===undefined?'':String(costs[p.id]));
    if(answer===null)return;
    if(!answer.trim()){setError('Purchase cost is required. Cancel to keep it unknown.');return;}
    const value=Number(answer);if(!Number.isFinite(value)||value<0){setError('Purchase cost must be a nonnegative number.');return;}
    await mutate(()=>supabase.from('product_costs').upsert({product_id:p.id,purchase_cost:value},{onConflict:'product_id'}));
  }
  async function saveStock(p){
    if(!branch){setError('Choose a shop.');return;}
    const key=`${branch}:${p.id}`,raw=quantities[key]??'',input=Number(raw),current=Number(qty(p.id,branch)),value=stockMode==='add'?current+input:input;
    if(raw===''||!Number.isSafeInteger(input)||input<0||!Number.isSafeInteger(value)||value<0){setError('Enter a valid whole number of copies.');return;}
    if(reason.trim().length<3){setError('Enter a reason of at least 3 characters, e.g. New delivery.');return;}
    const ok=await mutate(async()=>{
      const result=await supabase.rpc('admin_set_stock_quantity',{p_branch_id:branch,p_product_id:p.id,p_quantity:value,p_reason:reason.trim()});
      if(result.error)return result;
      const check=await supabase.from('stock').select('quantity').eq('branch_id',branch).eq('product_id',p.id).maybeSingle();
      if(check.error)return check;
      if(Number(check.data?.quantity??0)!==value)return {error:{message:'Stock verification failed: expected '+value+' copies but database returned '+(check.data?.quantity??'none')+'. Refresh before retrying.'}};
      return {error:null};
    });
    if(ok)setQuantities(v=>{const next={...v};delete next[key];return next;});
  }
  const visible=products.filter(p=>(admin?(showArchived?!p.is_active:p.is_active):p.is_active)&&(categoryFilter==='All categories'||(p.category||'Books & textbooks')===categoryFilter)&&`${p.name} ${p.sku||''} ${p.category||''}`.toLowerCase().includes(productQuery.trim().toLowerCase()));
  return <div className="abb-page"><PageHead title={admin?'Products & inventory':'Book catalog'} desc={admin?'Manage books, stationery and stock across every shop':'Browse products and current stock'}/><Notice message={error}/>{success&&<p className="success">{success}</p>}
    {admin&&<section className="panel abb-panel"><div className="abb-section-title"><h2>Add product</h2><span className="abb-hint">Set opening quantity for each shop</span></div>
      <form className="abb-add-form" onSubmit={add}>
        <div className="abb-field"><label>Product name</label><input required placeholder="e.g. English Grade 5" value={name} onChange={e=>setName(e.target.value)}/></div>
        <div className="abb-field"><label>Category</label><select value={category} onChange={e=>setCategory(e.target.value)}>{PRODUCT_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}</select></div><div className="abb-field"><label>Barcode / SKU</label><input placeholder="Optional" value={sku} onChange={e=>setSku(e.target.value)}/></div>
        <div className="abb-field"><label>Price (PKR)</label><input required type="number" min="0" step="0.01" placeholder="0.00" value={price} onChange={e=>setPrice(e.target.value)}/></div>
        <div className="abb-field"><label>Purchase cost (PKR)</label><input type="number" min="0" step="0.01" placeholder="Unknown, enter later" value={purchaseCost} onChange={e=>setPurchaseCost(e.target.value)}/></div><div className="abb-opening"><strong>Opening stock by shop</strong><div className="abb-opening-grid">{shops.map(shop=><div className="abb-field" key={shop.id}><label htmlFor={'opening-'+shop.id}>{shop.name}</label><input id={'opening-'+shop.id} type="number" min="0" step="1" inputMode="numeric" value={opening[shop.id]??'0'} onChange={e=>setOpening(v=>({...v,[shop.id]:e.target.value}))}/></div>)}</div><p className="abb-hint">Enter actual physical copies. Zero means no stock at that shop.</p></div>
        <button className="primary abb-btn abb-add-submit" disabled={busy||!shops.length}><Plus size={17}/>{busy?'Saving…':'Add product & opening stock'}</button>
      </form></section>}
    {admin&&<section className="panel abb-panel"><div className="abb-section-title"><h2>Manage stock</h2><span className="abb-hint">Changes are recorded in inventory history</span></div>
      <div className="abb-stock-settings"><div className="abb-field"><label>Adjustment mode</label><select value={stockMode} onChange={e=>{setStockMode(e.target.value);setQuantities({});}}><option value="add">Add received copies</option><option value="set">Set exact total copies</option></select></div><div className="abb-field"><label>Shop to update</label><select aria-label="Choose shop" value={branch} onChange={e=>setBranch(e.target.value)}>{shops.map(shop=><option key={shop.id} value={shop.id}>{shop.name}{shop.enabled?'':' (disabled)'}</option>)}</select></div><div className="abb-field"><label>Reason for stock change <span className="abb-required">*</span></label><input aria-label="Stock adjustment reason" placeholder="e.g. New delivery" value={reason} onChange={e=>setReason(e.target.value)}/></div></div>
      <div className="abb-setting-footer"><p className="abb-hint">Select a shop, enter a reason, then update a book below. Other shops are unaffected.</p><div className="abb-actions"><button type="button" className={!showArchived?"primary abb-btn":"secondary abb-btn"} onClick={()=>{setShowArchived(false);setProductPage(0)}}>Active products</button><button type="button" className={showArchived?"primary abb-btn":"secondary abb-btn"} onClick={()=>{setShowArchived(true);setProductPage(0)}}>Archived products</button></div></div>
    </section>}
    <section className="panel abb-panel"><div className="abb-section-title"><h2>{admin&&showArchived?"Archived products":"Products"} <span className="abb-count">{visible.length}</span></h2><span className="abb-hint">Current quantities by shop</span></div>
      <div className="abb-list-tools"><label>Search inventory<input type="search" placeholder="Search product name, SKU or category" value={productQuery} onChange={e=>{setProductQuery(e.target.value);setProductPage(0);}} /></label></div>
      <div className="abb-field" style={{maxWidth:320,marginBottom:16}}><label>Filter products by category</label><select value={categoryFilter} onChange={e=>{setCategoryFilter(e.target.value);setProductPage(0);}}><option>All categories</option>{PRODUCT_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div><div className="abb-books">{visible.slice(productPage*24,(productPage+1)*24).map(p=><article className="abb-book" key={p.id}>
        <div className="abb-book-top"><div className="abb-book-name"><span className="abb-book-icon"><BookOpen size={20}/></span><div><h3>{p.name}</h3><span className="abb-hint">{p.category||'Books & textbooks'} · SKU: {p.sku||'Not set'}{!p.is_active?' · Archived':''}</span></div></div><strong className="abb-price">{money(p.price)}</strong></div>
        <div className="abb-shop-grid">{shops.map(shop=><div key={shop.id} className={'abb-shop-qty '+(shop.id===branch&&admin?'abb-shop-selected':'')}><span>{shop.name}</span><strong>{qty(p.id,shop.id)} <small>copies</small></strong></div>)}</div>
        {admin&&<div className="abb-book-footer"><div className="abb-cost-row"><span>Purchase cost: <strong>{costs[p.id]===undefined?'Not recorded':money(costs[p.id])}</strong></span><button className="secondary abb-btn" disabled={busy} onClick={()=>saveCost(p)}>{costs[p.id]===undefined?'Add purchase cost':'Edit purchase cost'}</button></div><div className="abb-stock-edit"><div className="abb-field"><label>{stockMode==='add'?'Copies to add':'New total copies'} (currently {qty(p.id,branch)})</label><input aria-label={'Copies for '+p.name} type="number" inputMode="numeric" min="0" step="1" value={quantities[`${branch}:${p.id}`]??''} onChange={e=>setQuantities(v=>({...v,[`${branch}:${p.id}`]:e.target.value}))}/></div><button className="primary abb-btn" disabled={busy||!branch} onClick={()=>saveStock(p)}>{stockMode==='add'?'Add copies':'Set stock'}</button></div><div className="abb-actions abb-book-actions"><button className="secondary abb-btn" disabled={busy} onClick={()=>edit(p)}>Edit product</button><button className="secondary abb-btn abb-danger" disabled={busy} onClick={()=>mutate(()=>supabase.from('products').update({is_active:!p.is_active}).eq('id',p.id),p.is_active?'Archive this book? Sales history will remain.':'Restore this book?')}>{p.is_active?'Archive':'Restore'}</button><button className="secondary abb-btn abb-danger" disabled={busy} onClick={()=>safeDelete(p)}>Delete</button></div></div>}
      </article>)}</div>{!visible.length&&<p className="empty">No books to display.</p>}
      <div className="abb-pager"><button className="secondary" disabled={productPage===0} onClick={()=>setProductPage(v=>Math.max(0,v-1))}>Previous</button><span>Page {productPage+1} · {visible.length} matching products</span><button className="secondary" disabled={(productPage+1)*24>=visible.length} onClick={()=>setProductPage(v=>v+1)}>Next</button></div>
    </section>
  </div>;
}

const RECEIPT_CONTACT = Object.freeze({email:'a.fnotebooks12@gmail.com',phone:'03142225364'});
const receiptShopDetails = (name) => {
  const n=(name||'').toLowerCase();
  if(n.includes('jaffer') || n.includes('jafar') || n.includes('tayyar'))return {name:'Jaffer Tayyar',address:'Shop # A-116, Survey No. 640, Aun o Mohammad Chowk, Jaffer Tayyar, Malir, Karachi'};
  if(n.includes('mehran'))return {name:'Indus Mehran Society',address:'Shop No. 2, C-97, Indus Mehran Society, Malir, Karachi'};
  return {name:name||'Shop not identified',address:'Please contact the shop for its address'};
};
const displayReceipt = value => value == null ? 'Pending' : `ABB-${String(value).padStart(6,'0')}`;

// WhatsApp click-to-chat opens a prefilled TEXT receipt; the seller must press Send in WhatsApp.
// The customer's number is used only in the URL and is not stored in the POS database.
const whatsappRecipient = raw => {
  const digits = String(raw||'').replace(/\D/g,'');
  if (/^03\d{9}$/.test(digits)) return '92'+digits.slice(1);
  if (/^923\d{9}$/.test(digits)) return digits;
  if (/^00923\d{9}$/.test(digits)) return digits.slice(2);
  return null;
};
const whatsappReceiptText = (sale,shop) => {
  const total = Number(sale.total||0);
  const lines = [
    'ABBAS BOOK BANK by AF Notebook',
    shop.name,
    shop.address,
    'Phone: '+RECEIPT_CONTACT.phone,
    '',
    'RECEIPT '+displayReceipt(sale.receipt_no),
    'Date: '+sale.date,
    '',
    ...sale.items.map(x=>`${x.name} x ${x.qty} @ ${receiptMoney(x.price)} = ${receiptMoney(Number(x.price)*Number(x.qty))}`),
    '',
    'Grand Total: '+receiptMoney(total),
    'Payment: '+(sale.method==='cash'?'Cash':sale.method==='card'?'Card':sale.method==='bank_transfer'?'Bank transfer':'Other')
  ];
  if(sale.method==='cash'){
    const received=Number(sale.cashReceived??total);
    lines.push('Cash Received: '+receiptMoney(received));
    lines.push('Change: '+receiptMoney(Math.max(0,received-total)));
  }
  lines.push('',"Supporting your Child's Education");
  return lines.join('\n');
};

const receiptMoney = value => 'Rs '+Number(value||0).toLocaleString('en-PK',{minimumFractionDigits:2,maximumFractionDigits:2});
function ThermalReceipt({sale,shop}) {
  if(!sale)return null;
  const itemCount=sale.items.reduce((n,x)=>n+Number(x.qty),0);
  const cashReceived=sale.method==='cash' ? Number(sale.cashReceived) : null;
  return <div className="thermal-receipt" aria-label="58mm invoice">
    <div className="thermal-center thermal-heading">INVOICE</div>
    <img className="thermal-logo" src="/branding/af-notebook.jpg" alt="AF Notebook"/>
    <div className="thermal-center thermal-business">ABBAS BOOK BANK</div>
    <div className="thermal-center thermal-by">By AF Notebook</div>
    <div className="thermal-center thermal-address">{shop.name}<br/>{shop.address}<br/>{RECEIPT_CONTACT.email}<br/>{RECEIPT_CONTACT.phone}</div>
    <div className="thermal-rule"/>
    <div className="thermal-meta"><span>Receipt</span><strong>{displayReceipt(sale.receipt_no)}</strong></div>
    <div className="thermal-meta"><span>Date</span><span>{sale.date}</span></div>
    <div className="thermal-rule"/>
    <div className="thermal-meta"><span>P Mode</span><span>Items</span><span>Units</span><span>Amount</span></div>
    <div className="thermal-meta"><span>{sale.method==='cash'?'Cash':sale.method==='bank_transfer'?'Bank':sale.method==='card'?'Card':'Other'}</span><span>{sale.items.length}</span><span>{itemCount}</span><span>{receiptMoney(sale.total)}</span></div>
    <div className="thermal-rule"/>
    <table className="thermal-items"><thead><tr><th>Name</th><th>Price</th><th>Qty</th><th>Total</th></tr></thead><tbody>{sale.items.map((x,i)=><tr key={x.id||i}><td>{x.name}</td><td>{receiptMoney(x.price)}</td><td>{x.qty}</td><td>{receiptMoney(Number(x.price)*x.qty)}</td></tr>)}</tbody></table>
    <div className="thermal-rule"/>
    <div className="thermal-meta"><span>Subtotal</span><span>{receiptMoney(sale.total)}</span></div>
    <div className="thermal-meta thermal-grand"><span>Grand Total</span><span>{receiptMoney(sale.total)}</span></div>
    {sale.method==='cash'&&<><div className="thermal-rule"/><div className="thermal-meta"><span>Cash Received</span><span>{receiptMoney(cashReceived)}</span></div><div className="thermal-meta"><span>Change Amount</span><span>{receiptMoney(Math.max(0,cashReceived-Number(sale.total)))}</span></div></>}
    <div className="thermal-footer">Supporting your Child's Education</div>
  </div>;
}

function POS({branchId}) {
  const [products,setProducts]=useState([]),[schools,setSchools]=useState([]),[grades,setGrades]=useState([]),[links,setLinks]=useState([]);
  const [shopSchoolIds,setShopSchoolIds]=useState([]);
  const [stock,setStock]=useState(null),[view,setView]=useState('home'),[school,setSchool]=useState(''),[grade,setGrade]=useState('');
  const [query,setQuery]=useState(''),[cart,setCart]=useState([]),[held,setHeld]=useState(null);
  const [error,setError]=useState(''),[success,setSuccess]=useState(null),[busy,setBusy]=useState(false);
  const [method,setMethod]=useState('cash'),[cash,setCash]=useState(''),[requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
  const [cartOpen,setCartOpen]=useState(false),[shopName,setShopName]=useState('');
  const [customerWhatsapp,setCustomerWhatsapp]=useState('');
  const [whatsappError,setWhatsappError]=useState('');
  useEffect(()=>{
    let active=true;
    Promise.all([
      supabase.from('products').select('id,name,price,sku,category').eq('is_active',true).order('name'),
      supabase.from('schools').select('id,name').order('name'),
      supabase.from('grades').select('id,name,school_id').order('name'),
      supabase.from('grade_books').select('grade_id,product_id,quantity'),
      supabase.from('school_branches').select('school_id').eq('branch_id',branchId),
      supabase.from('stock').select('product_id,quantity').eq('branch_id',branchId),
      supabase.from('branches').select('name').eq('id',branchId).single()
    ]).then(([p,s,g,l,sb,st,br])=>{
      if(!active)return;
      setProducts(p.data||[]);setSchools(s.data||[]);setGrades(g.data||[]);setLinks(l.data||[]);setShopSchoolIds((sb.data||[]).map(x=>x.school_id));setShopName(br.data?.name||'');
      if(!st.error)setStock(Object.fromEntries((st.data||[]).map(x=>[x.product_id,Number(x.quantity)])));
      setError(getError(p,s,g,l,sb));
    }).catch(e=>{if(active)setError(e.message)});
    return ()=>{active=false};
  },[branchId]);
  const quantityInCart=id=>cart.find(x=>x.id===id)?.qty||0;
  const available=p=>stock===null?null:(stock[p.id]??0);
  const canAdd=(p,n=1)=>available(p)===null||quantityInCart(p.id)+n<=available(p);
  const changeCart=(next)=>{setRequestKey(crypto.randomUUID());setCart(next);setSuccess(null)};
  const add=(p,n=1)=>{
    if(!canAdd(p,n)){setError(`Not enough stock at this shop for ${p.name}.`);return}
    setError('');
    changeCart(prev=>{const found=prev.find(x=>x.id===p.id);return found?prev.map(x=>x.id===p.id?{...x,qty:x.qty+n}:x):[...prev,{...p,qty:n}]});
  };
  const courseItems=links.filter(x=>x.grade_id===grade).map(x=>({...x,product:products.find(p=>p.id===x.product_id)})).filter(x=>x.product);
  const courseTotal=courseItems.reduce((sum,x)=>sum+Number(x.product.price)*Number(x.quantity||1),0);
  const addCourse=()=>{
    if(!courseItems.length){setError('No books are assigned to this grade.');return}
    const requested=new Map();
    for(const x of courseItems)requested.set(x.product.id,(requested.get(x.product.id)||0)+Number(x.quantity||1));
    for(const [id,n] of requested){const p=products.find(x=>x.id===id);if(!canAdd(p,n)){setError(`Insufficient stock for ${p.name}. Course not added.`);return}}
    changeCart(prev=>{
      const next=prev.map(x=>({...x}));
      for(const x of courseItems){const n=Number(x.quantity||1);const found=next.find(p=>p.id===x.product.id);if(found)found.qty+=n;else next.push({...x.product,qty:n})}
      return next;
    });
    setError('');setCartOpen(true);
  };
  const total=cart.reduce((sum,x)=>sum+Number(x.price)*x.qty,0);
  const changeQty=(id,delta)=>{
    const p=products.find(x=>x.id===id);
    if(delta>0&&p&&!canAdd(p)){setError(`Insufficient stock for ${p.name}.`);return}
    changeCart(prev=>prev.map(x=>x.id===id?{...x,qty:x.qty+delta}:x).filter(x=>x.qty>0));
  };
  const normalize=x=>(x||'').toLowerCase();
  const isStationery=p=>(p.category||'Books & textbooks')!=='Books & textbooks'&&(p.category||'Books & textbooks')!=='School courses';
  const categories=[{id:'schools',icon:'🏫',title:'School courses',detail:'School → grade → books',tone:'school'},{id:'books',icon:'📚',title:'Individual books',detail:'English, Urdu and more',tone:'books'},{id:'stationery',icon:'✏️',title:'Stationery',detail:'Pens, notebooks and supplies',tone:'stationery'},{id:'quick',icon:'▦',title:'Quick sale',detail:'Search or scan barcode',tone:'quick'}];
  const visibleSchools=schools.filter(s=>shopSchoolIds.includes(s.id));
  const visibleGrades=grades.filter(g=>shopSchoolIds.includes(g.school_id));
  const matchingGrades=visibleGrades.filter(g=>normalize(g.name+' '+(visibleSchools.find(s=>s.id===g.school_id)?.name||'')).includes(normalize(query.trim())));
  const matchingSchoolIds=new Set(visibleSchools.filter(s=>normalize(s.name).includes(normalize(query.trim()))).map(s=>s.id));
  const matchingGradeIds=new Set([...matchingGrades.map(g=>g.id),...visibleGrades.filter(g=>matchingSchoolIds.has(g.school_id)).map(g=>g.id)]);
  const courseProductIds=new Set(links.filter(l=>matchingGradeIds.has(l.grade_id)).map(l=>l.product_id));
  const filtered=products.filter(p=>(view!=='stationery'||isStationery(p))&&(view!=='books'||!isStationery(p))&&(!query.trim()||normalize(p.name+' '+(p.sku||'')+' '+(p.category||'')).includes(normalize(query.trim()))||(view==='quick'&&query.trim()&&courseProductIds.has(p.id))));
  const navigate=target=>{setView(target);setQuery('');setError('')};
  const back=()=>navigate(view==='grades'?'schools':view==='course'?'grades':'home');
  async function checkout(){
    if(busy||!cart.length)return;
    if(method==='cash'&&cash!==''&&Number(cash)<total){setError('Cash received is less than the total.');return}
    setBusy(true);setError('');setSuccess(null);
    try{
      const {data,error:checkoutError}=await supabase.rpc('pos_checkout',{p_items:cart.map(x=>({product_id:x.id,quantity:x.qty})),p_request_key:requestKey,p_method:method});
      if(checkoutError)throw checkoutError;
      const {data:receiptRow}=await supabase.from('sales').select('receipt_no').eq('id',data.sale_id).maybeSingle();
      setSuccess({id:data.sale_id,receipt_no:receiptRow?.receipt_no,total:Number(data.total),method,items:cart.map(x=>({...x})),date:new Date().toLocaleString('en-PK'),cashReceived:method==='cash'&&cash!==''?Number(cash):Number(data.total)});
      setCart([]);setCash('');setRequestKey(crypto.randomUUID());setCartOpen(false);
      setCustomerWhatsapp('');setWhatsappError('');
      if(stock!==null)setStock(prev=>{const next={...prev};for(const x of cart)next[x.id]=(next[x.id]??0)-x.qty;return next});
    }catch(e){setError(e.message||'Checkout failed. Please confirm sale status before retrying.')}
    finally{setBusy(false)}
  }
  function sendWhatsAppReceipt(){
    if(!success)return;
    const phone=whatsappRecipient(customerWhatsapp);
    if(!phone){
      setWhatsappError('Enter a valid Pakistani WhatsApp number, e.g. 03130871512.');
      return;
    }
    if(success.receipt_no == null){
      setWhatsappError('Receipt number is not available yet. Please retry after the sale is saved.');
      return;
    }
    setWhatsappError('');
    const message=whatsappReceiptText(success,receiptShopDetails(shopName));
    const url='https://wa.me/'+phone+'?text='+encodeURIComponent(message);
    // Open only in direct response to the seller's click, not automatically after checkout.
    window.open(url,'_blank','noopener,noreferrer');
  }
  function printReceipt(){
    if(!success)return;
    window.print();
  }
  const listCard=p=><button type="button" key={p.id} className="retail-product" onClick={()=>add(p)} disabled={available(p)!==null&&available(p)<=quantityInCart(p.id)}>
    <span className="retail-product-icon">{isStationery(p)?'✏️':'📖'}</span>
    <span className="retail-product-copy"><strong>{p.name}</strong><small>{p.sku||'Book / stationery'}{available(p)!==null?` · ${available(p)} in stock`:''}</small></span>
    <span className="retail-product-action"><b>{money(p.price)}</b><span>+ Add</span></span>
  </button>;
  return <div className="retail-pos">
    <div className="retail-header"><div><span className="retail-eyebrow">SELLER COUNTER</span><h1>New sale</h1><p>Find a course, book or stationery item in seconds.</p></div><div className="retail-header-actions"><button className="retail-outline" onClick={()=>{if(!cart.length)return;setHeld(cart);changeCart([]);setCartOpen(false)}} disabled={!cart.length}>Hold bill</button><button className="retail-outline" onClick={()=>{if(!held)return;changeCart(held);setHeld(null);setCartOpen(true)}} disabled={!held}>Resume{held?` (${held.length})`:''}</button></div></div>
    {error&&<p className="error" role="alert">{error}</p>}
    {success&&<section className="retail-receipt panel"><div><strong>✓ Sale completed</strong><p>Receipt #{displayReceipt(success.receipt_no)} · {money(success.total)}</p><small>{success.date}</small></div><div className="receipt-action-tools" style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
      <button type="button" className="retail-outline" onClick={printReceipt}>Print receipt</button>
      <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:13}}>
        Customer WhatsApp number
        <input type="tel" inputMode="tel" autoComplete="tel" placeholder="03130871512" aria-label="Customer WhatsApp number" value={customerWhatsapp} onChange={e=>{setCustomerWhatsapp(e.target.value);setWhatsappError('')}} style={{padding:'9px 11px',border:'1px solid #cbd5e1',borderRadius:8,minWidth:180,maxWidth:240}}/>
      </label>
      <button type="button" className="retail-outline" onClick={sendWhatsAppReceipt}>Send receipt via WhatsApp</button>
      {whatsappError&&<span role="alert" style={{color:'#b91c1c',fontSize:13}}>{whatsappError}</span>}
      </div><div className="retail-print-only"><ThermalReceipt sale={success} shop={receiptShopDetails(shopName)}/></div></section>}
    <div className="retail-layout"><main className="retail-browse">
      <label className="retail-search"><Search size={20}/><input value={query} onChange={e=>{setQuery(e.target.value);if(e.target.value)setView('quick')}} placeholder="Search product, school, grade, SKU or category" aria-label="Search products, schools, grades or barcode"/></label>
      {view==='home'?<><div className="retail-section-title"><h2>What are you selling?</h2><span>Choose a category</span></div><div className="retail-categories">{categories.map(c=><button type="button" key={c.id} className={'retail-category '+c.tone} onClick={()=>navigate(c.id)}><span className="retail-category-icon">{c.icon}</span><strong>{c.title}</strong><small>{c.detail}</small><span className="retail-category-arrow">Explore →</span></button>)}</div><div className="retail-section-title"><h2>Quick add</h2><span>Available products</span></div><div className="retail-product-grid">{products.slice(0,8).map(listCard)}</div></>:
      <><div className="retail-breadcrumb"><button onClick={back}>← Back</button><span>{view==='schools'?'Select a school':view==='grades'?'Select a grade':view==='course'?'Course books':view==='stationery'?'Stationery':view==='books'?'Individual books':'Quick sale'}</span></div>
      {view==='schools'?<div className="retail-tile-grid">{visibleSchools.map(s=><button className="retail-tile" key={s.id} onClick={()=>{setSchool(s.id);navigate('grades')}}><span>🏫</span><strong>{s.name}</strong><small>View grades →</small></button>)}{!visibleSchools.length&&<p className="empty">No schools assigned to this shop.</p>}</div>:
      view==='grades'?<div className="retail-tile-grid">{visibleGrades.filter(g=>g.school_id===school).map(g=><button className="retail-tile" key={g.id} onClick={()=>{setGrade(g.id);navigate('course')}}><span>🎓</span><strong>{g.name}</strong><small>View course →</small></button>)}{!visibleGrades.some(g=>g.school_id===school)&&<p className="empty">No grades for this school yet.</p>}</div>:
      view==='course'?<><section className="retail-course-banner"><div><small>{schools.find(x=>x.id===school)?.name} / {grades.find(x=>x.id===grade)?.name}</small><h2>Complete course</h2><p>{courseItems.length} assigned titles · {money(courseTotal)}</p></div><button className="primary" disabled={!courseItems.length} onClick={addCourse}>+ Add full course</button></section><div className="retail-product-grid">{courseItems.map(x=>listCard(x.product))}</div>{!courseItems.length&&<p className="empty">No books assigned to this grade.</p>}</>:
      <><div className="retail-section-title"><h2>{view==='stationery'?'Stationery & supplies':view==='books'?'Books':'Search all items'}</h2><span>{filtered.length} items</span></div>{view==='quick'&&query.trim()&&<div className="retail-tile-grid">{visibleSchools.filter(s=>normalize(s.name).includes(normalize(query.trim()))).slice(0,20).map(s=><button className="retail-tile" key={s.id} onClick={()=>{setSchool(s.id);navigate('grades')}}><span>🏫</span><strong>{s.name}</strong><small>Browse school grades →</small></button>)}{matchingGrades.slice(0,30).map(g=><button className="retail-tile" key={g.id} onClick={()=>{setSchool(g.school_id);setGrade(g.id);navigate('course')}}><span>🎓</span><strong>{g.name}</strong><small>{visibleSchools.find(s=>s.id===g.school_id)?.name} · View course →</small></button>)}</div>}<div className="retail-product-grid">{filtered.slice(0,120).map(listCard)}</div>{!filtered.length&&<p className="empty">No matching products. Add them in Admin → Products & Inventory first.</p>}</>}
      </>}
    </main>
    <aside className={'retail-cart '+(cartOpen?'retail-cart-open':'')}><div className="retail-cart-heading"><h2><ShoppingCart size={20}/> Current bill <span>{cart.reduce((n,x)=>n+x.qty,0)}</span></h2><button className="retail-cart-close" onClick={()=>setCartOpen(false)}>Close</button></div>
      {!cart.length?<div className="retail-cart-empty"><span>🛒</span><strong>Your cart is empty</strong><p>Tap any product or complete course to add it.</p></div>:<div className="retail-cart-items">{cart.map(p=><div className="retail-cart-item" key={p.id}><div><strong>{p.name}</strong><small>{money(p.price)} each</small></div><div className="retail-qty"><button aria-label={`Remove one ${p.name}`} onClick={()=>changeQty(p.id,-1)}>−</button><b>{p.qty}</b><button aria-label={`Add one ${p.name}`} onClick={()=>changeQty(p.id,1)}>+</button><button aria-label={`Remove ${p.name}`} className="retail-remove" onClick={()=>changeCart(a=>a.filter(x=>x.id!==p.id))}><Trash2 size={15}/></button></div><strong>{money(p.price*p.qty)}</strong></div>)}</div>}
      <div className="retail-cart-footer"><div className="retail-total"><span>Total payable</span><strong>{money(total)}</strong></div><label>Payment method<select value={method} onChange={e=>{setMethod(e.target.value);setRequestKey(crypto.randomUUID())}}><option value="cash">Cash</option><option value="card">Card (record only)</option><option value="bank_transfer">Bank transfer (record only)</option><option value="other">Other</option></select></label>{method==='cash'&&<label>Cash received (optional)<input type="number" min="0" step=".01" inputMode="decimal" value={cash} onChange={e=>setCash(e.target.value)} placeholder="Enter amount paid"/>{cash!==''&&Number(cash)>=total&&<small>Change: {money(Number(cash)-total)}</small>}</label>}<button className="primary full" disabled={!cart.length||busy} onClick={checkout}><CreditCard size={18}/>{busy?'Processing…':'Complete sale'}</button><p>Stock is deducted from the verified shop. Non-cash methods record payments only.</p></div>
    </aside></div>
    <button className="retail-mobile-bill" onClick={()=>setCartOpen(true)}><ShoppingCart size={18}/> View bill · {cart.reduce((n,x)=>n+x.qty,0)} items <strong>{money(total)}</strong></button>
  </div>;
}

function SalesHistory({admin=false}) {
  const [sales,setSales]=useState([]),[err,setErr]=useState('');
  useEffect(()=>{supabase.from('sales').select('id,receipt_no,total,created_at').order('created_at',{ascending:false}).limit(100).then(({data,error})=>{setSales(data||[]);setErr(error?.message||'');});},[]);
  return <><PageHead title={admin?'All sales':'My sales'} desc="Recent completed transactions"/><Notice message={err}/><section className="panel"><div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Date</th><th>Amount</th></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td>{displayReceipt(s.receipt_no)}</td><td>{new Date(s.created_at).toLocaleString()}</td><td>{money(s.total)}</td></tr>)}</tbody></table></div>{!sales.length&&<p className="empty">No sales recorded</p>}</section></>;
}
export default App;
