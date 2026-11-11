import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
serve(async req => {
 const headers={'Content-Type':'application/json','Cache-Control':'no-store'};
 if(req.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers});
 try{
  const auth=req.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer '))return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers});
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const client=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user||!user.is_anonymous)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers});
  const {branch_id,pin}=await req.json();
  if(typeof pin!=='string'||!/^[0-9]{6}$/.test(pin)||typeof branch_id!=='string'||!/^[0-9a-f-]{36}$/i.test(branch_id))return new Response(JSON.stringify({error:'Invalid request'}),{status:400,headers});
  const admin=createClient(url,service);
  const {data,error:dbError}=await admin.rpc('verify_shop_pin',{p_user:user.id,p_branch:branch_id,p_pin:pin});
  if(dbError)throw dbError;
  return new Response(JSON.stringify(data),{status:data?.ok?200:401,headers});
 }catch(e){console.error('Shop PIN verification failed',e);return new Response(JSON.stringify({error:'Shop login temporarily unavailable'}),{status:500,headers})}
});
