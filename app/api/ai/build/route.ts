import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { runWebsiteBuild } from '@/lib/ai/build-engine/runtime';
import { runInvoiceBuild } from '@/lib/ai/build-engine/invoice-runtime';
import { runMoneyEntryBuild, runProductInventoryBuild } from '@/lib/ai/build-engine/operations-runtime';
import { runCustomerBuild } from '@/lib/ai/build-engine/customer-runtime';
import { runConnectorBuild } from '@/lib/ai/build-engine/connector-runtime';
import type { BuildMode } from '@/lib/ai/build-engine/types';

export async function POST(request: Request) {
  const supabase=createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await request.json().catch(()=>({}));
  const prompt=typeof body.prompt==='string' ? body.prompt : '';
  const mode=['draft_only','ask_first','auto_execute'].includes(body.mode) ? body.mode as BuildMode : 'ask_first';
  const {data:business}=await supabase.from('businesses').select('id').eq('owner_id',user.id).single();
  if(!business) return NextResponse.json({error:'Business not found'},{status:404});
  try{
    const capability=['invoice','product_inventory','money_transaction','customer','connector'].includes(body.capability) ? body.capability : 'website';
    const result=capability==='invoice'
      ? await runInvoiceBuild({businessId:business.id,userId:user.id,prompt,mode})
      : capability==='product_inventory'
        ? await runProductInventoryBuild({businessId:business.id,userId:user.id,prompt,mode})
        : capability==='money_transaction'
          ? await runMoneyEntryBuild({businessId:business.id,userId:user.id,prompt,mode})
          : capability==='customer'
            ? await runCustomerBuild({businessId:business.id,userId:user.id,prompt,mode})
            : capability==='connector'
              ? await runConnectorBuild({businessId:business.id,userId:user.id,prompt,mode})
              : await runWebsiteBuild({businessId:business.id,userId:user.id,prompt,websiteId:typeof body.websiteId==='string'?body.websiteId:null,mode,publish:Boolean(body.publish)});
    return NextResponse.json(result);
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Build failed'},{status:400});
  }
}