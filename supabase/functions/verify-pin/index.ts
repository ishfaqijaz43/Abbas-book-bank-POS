import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
serve(async req => {
 const headers = {'Content-Type':'application/json','Cache-Control':'no-store'};
 if(req.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers});
 try{
  const auth=req.headers.get('Authorization')||'';
  if(!auth.startsWith('Bearer '))return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers});
  const client=createClient(url,anon,{global:{headers:{Authorization:auth}}});
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user||!user.is_anonymous)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers});
  const {pin}=await req.json();
  if(typeof pin!=='string'||!/^[0-9]{6}$/.test(pin))return new Response(JSON.stringify({error:'Invalid PIN'}),{status:400,headers});
  const admin=createClient(url,service);
  const {data,error:dbError}=await admin.rpc('verify_pos_pin',{p_user:user.id,p_pin:pin});
  if(dbError)throw dbError;
  return new Response(JSON.stringify(data),{status:data?.ok?200:401,headers});
 }catch(e){console.error('PIN verification failed',e);return new Response(JSON.stringify({error:'Login temporarily unavailable'}),{status:500,headers})}
});
