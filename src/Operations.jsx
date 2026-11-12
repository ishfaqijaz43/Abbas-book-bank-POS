import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import './operations.css';
const cash = n => `Rs. ${Number(n||0).toLocaleString('en-PK')}`;
const empty = {suppliers:[],products:[],branches:[],orders:[],transfers:[]};
export function Operations(){
 const [data,setData]=useState(empty),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [tab,setTab]=useState('suppliers');
 const [supplier,setSupplier]=useState({name:'',contact_name:'',phone:'',email:''});
 const [supplierId,setSupplierId]=useState(''),[branchId,setBranchId]=useState(''),[fromId,setFromId]=useState(''),[toId,setToId]=useState('');
 const [productId,setProductId]=useState(''),[qty,setQty]=useState('1'),[cost,setCost]=useState('0'),[reference,setReference]=useState('');
 const [items,setItems]=useState([]);
 async function refresh(){
   const {data:result,error:err}=await supabase.rpc('pos_admin_overview');
   if(err) throw err;
   setData({...empty,...result});
 }
 useEffect(()=>{refresh().catch(e=>setError(e.message));},[]);
 async function action(name,params,confirmation){
   if(confirmation && !window.confirm(confirmation))return;
   setBusy(true);setError('');setNotice('');
   try {const {data:result,error:err}=await supabase.rpc(name,params);if(err)throw err;
     setNotice(`Saved successfully. ${typeof result==='string'?result:JSON.stringify(result)}`);
     await refresh();return true;
   }catch(e){setError(e.message||'Operation failed');return false;}
   finally{setBusy(false);}
 }
 const addItem=()=>{
   if(!productId || !Number.isInteger(Number(qty)) || Number(qty)<1 || Number(qty)>1000000 || (tab==='purchases'&&(!Number.isFinite(Number(cost))||Number(cost)<0))) {setError('Select a product and enter a valid quantity and cost.');return;}
   if(items.some(x=>x.product_id===productId)){setError('Product already added.');return;}
   setError('');setItems(x=>[...x,{product_id:productId,quantity:Number(qty),...(tab==='purchases'?{unit_cost:Number(cost)}:{})}]);
 };
 const productName=id=>data.products.find(x=>x.id===id)?.name||id.slice(0,8);
 const branchName=id=>data.branches.find(x=>x.id===id)?.name||id?.slice(0,8);
 const submitItems=async()=>{
   if(!items.length){setError('Add at least one product.');return;}
   const isPurchase=tab==='purchases';
   if(isPurchase && (!supplierId||!branchId)){setError('Select supplier and receiving shop.');return;}
   if(!isPurchase && (!fromId||!toId||fromId===toId)){setError('Select two different shops.');return;}
   const ok=await action(isPurchase?'pos_create_purchase_order':'pos_create_stock_transfer',isPurchase?
    {p_supplier_id:supplierId,p_branch_id:branchId,p_items:items,p_reference:reference||null,p_notes:null}:
    {p_from_branch_id:fromId,p_to_branch_id:toId,p_items:items,p_notes:reference||null});
   if(ok)setItems([]);
 };
 return <div className="operations"><h1>Purchasing & stock transfers</h1><p className="op-muted">Admin-only operations. Purchases and transfers change stock only when explicitly received or dispatched.</p>
  {error&&<div className="op-alert" role="alert">{error}</div>}{notice&&<div className="op-ok" role="status">{notice}</div>}
  <div className="op-tabs">{[['suppliers','Suppliers'],['purchases','Purchase orders'],['transfers','Stock transfers']].map(([id,label])=><button key={id} className={tab===id?'selected':''} onClick={()=>{setTab(id);setItems([]);setError('');}}>{label}</button>)}<button onClick={()=>refresh().catch(e=>setError(e.message))} disabled={busy}>Refresh</button></div>
  {tab==='suppliers'&&<section className="op-panel"><h2>Add supplier</h2><div className="op-grid">{[['name','Supplier name *'],['contact_name','Contact person'],['phone','Phone'],['email','Email']].map(([k,label])=><label key={k}>{label}<input value={supplier[k]} onChange={e=>setSupplier(s=>({...s,[k]:e.target.value}))}/></label>)}</div><button className="op-primary" disabled={busy||supplier.name.trim().length<2} onClick={async()=>{const ok=await action('pos_save_supplier',{p_id:null,p_name:supplier.name,p_contact_name:supplier.contact_name||null,p_phone:supplier.phone||null,p_email:supplier.email||null,p_address:null,p_notes:null,p_enabled:true});if(ok)setSupplier({name:'',contact_name:'',phone:'',email:''});}}>Save supplier</button><h2>Supplier directory</h2><div className="op-table"><table><thead><tr><th>Name</th><th>Contact</th><th>Phone</th><th>Status</th></tr></thead><tbody>{data.suppliers.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.contact_name||'—'}</td><td>{x.phone||'—'}</td><td>{x.enabled?'Active':'Disabled'}</td></tr>)}</tbody></table></div></section>}
  {tab!=='suppliers'&&<><section className="op-panel"><h2>{tab==='purchases'?'New purchase order':'New transfer request'}</h2><div className="op-grid">{tab==='purchases'?<><label>Supplier<select value={supplierId} onChange={e=>setSupplierId(e.target.value)}><option value="">Choose supplier</option>{data.suppliers.filter(x=>x.enabled).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Receiving shop<select value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">Choose shop</option>{data.branches.filter(x=>x.enabled).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></>:<><label>From shop<select value={fromId} onChange={e=>setFromId(e.target.value)}><option value="">Choose shop</option>{data.branches.filter(x=>x.enabled).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>To shop<select value={toId} onChange={e=>setToId(e.target.value)}><option value="">Choose shop</option>{data.branches.filter(x=>x.enabled).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></>}
  <label>Reference / notes<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Optional"/></label></div><h3>Products</h3><div className="op-grid"><label>Product<select value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Choose product</option>{data.products.filter(x=>x.is_active).map(x=><option key={x.id} value={x.id}>{x.name} · {cash(x.price)}</option>)}</select></label><label>Quantity<input type="number" min="1" max="1000000" step="1" value={qty} onChange={e=>setQty(e.target.value)}/></label>{tab==='purchases'&&<label>Unit cost (Rs.)<input type="number" min="0" step="0.01" value={cost} onChange={e=>setCost(e.target.value)}/></label>}</div><button disabled={busy} onClick={addItem}>Add item</button><div className="op-table"><table><thead><tr><th>Product</th><th>Qty</th>{tab==='purchases'&&<th>Cost</th>}<th></th></tr></thead><tbody>{items.map(x=><tr key={x.product_id}><td>{productName(x.product_id)}</td><td>{x.quantity}</td>{tab==='purchases'&&<td>{cash(x.unit_cost)}</td>}<td><button onClick={()=>setItems(a=>a.filter(i=>i.product_id!==x.product_id))}>Remove</button></td></tr>)}</tbody></table></div><button className="op-primary" disabled={busy||!items.length} onClick={submitItems}>Create {tab==='purchases'?'purchase order':'transfer'}</button></section>
  <section className="op-panel"><h2>{tab==='purchases'?'Purchase orders':'Transfers'}</h2><div className="op-table"><table><thead><tr><th>Reference</th><th>Shop</th><th>Status</th><th>Created</th><th>Action</th></tr></thead><tbody>{(tab==='purchases'?data.orders:data.transfers).map(x=><tr key={x.id}><td>{x.reference||x.id.slice(0,8)}</td><td>{tab==='purchases'?branchName(x.branch_id):`${branchName(x.from_branch_id)} → ${branchName(x.to_branch_id)}`}</td><td>{x.status}</td><td>{new Date(x.created_at).toLocaleDateString()}</td><td>{tab==='purchases'?(x.status==='draft'||x.status==='ordered')?<button disabled={busy} onClick={()=>action('pos_receive_purchase_order',{p_order_id:x.id},'Receive ALL outstanding items? This will increase stock.')}>Receive stock</button>:null:x.status==='draft'?<button disabled={busy} onClick={()=>action('pos_dispatch_stock_transfer',{p_transfer_id:x.id},'Dispatch this transfer? Stock will be deducted from the source shop.')}>Dispatch</button>:x.status==='dispatched'?<button disabled={busy} onClick={()=>action('pos_receive_stock_transfer',{p_transfer_id:x.id},'Confirm all items arrived? Destination stock will increase.')}>Confirm receipt</button>:null}</td></tr>)}</tbody></table></div></section></>}
 </div>;
}
