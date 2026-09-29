import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-server';
import { runWebsiteBuild } from '@/lib/ai/build-engine/runtime';
import { runInvoiceBuild } from '@/lib/ai/build-engine/invoice-runtime';
import { runMoneyEntryBuild, runProductInventoryBuild } from '@/lib/ai/build-engine/operations-runtime';
import { runCustomerBuild } from '@/lib/ai/build-engine/customer-runtime';
import { runConnectorBuild } from '@/lib/ai/build-engine/connector-runtime';
import { runQuoteBuild } from '@/lib/ai/build-engine/quote-runtime';
import { runDualCurrencyBuild, runLoanReadinessBuild, runObligationBuild, runPayrollAdvanceBuild } from '@/lib/ai/build-engine/finance-ops-runtime';
import { runSmsWalletBuild, runAppointmentBuild, runDigitalMenuBuild, runWaiverBuild } from '@/lib/ai/build-engine/customer-experience-runtime';
import { runThriftBuild, runBusinessCreditBuild, runSuccessorAccessBuild, runComplianceBuild } from '@/lib/ai/build-engine/continuity-runtime';
import { runVoiceAgentBuild, runBroadcastBuild, runCarbonReportBuild, runFractionalCfoBuild } from '@/lib/ai/build-engine/intelligence-runtime';
import { runProductPhotoBuild, runMarketplaceListingBuild, runFinanceApiBuild } from '@/lib/ai/build-engine/platform-runtime';
import { runCashSaleBuild } from '@/lib/ai/build-engine/cash-sale-runtime';
import { runSupplierPriceBuild } from '@/lib/ai/build-engine/supplier-price-runtime';
import { runCommissionBuild } from '@/lib/ai/build-engine/commission-runtime';
import { runBusinessDocumentBuild } from '@/lib/ai/build-engine/business-document-runtime';
import type { BuildMode } from '@/lib/ai/build-engine/types';

export async function POST(request: Request) {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return NextResponse.json({error:'Unauthorized'},{status:401});
  const body=await request.json().catch(()=>({}));
  const prompt=typeof body.prompt==='string' ? body.prompt : '';
  const mode=['draft_only','ask_first','auto_execute'].includes(body.mode) ? body.mode as BuildMode : 'ask_first';
  const requestedBusinessId=typeof body.businessId==='string'?body.businessId:null;
  let businessQuery=supabase.from('businesses').select('id').eq('owner_id',user.id);
  if(requestedBusinessId) businessQuery=businessQuery.eq('id',requestedBusinessId);
  else businessQuery=businessQuery.order('created_at',{ascending:true}).limit(1);
  const {data:business,error:businessError}=await businessQuery.maybeSingle();
  if(businessError) return NextResponse.json({error:businessError.message},{status:500});
  if(!business) return NextResponse.json({error:'Business not found'},{status:404});
  try{
    const capabilities=['website','invoice','product_inventory','money_transaction','customer','connector','quote','cash_sale','supplier_price','commission','business_plan','dual_currency','loan_readiness','obligation','payroll_advance','sms_wallet','appointment','digital_menu','waiver','thrift_group','business_credit','successor_access','compliance','voice_agent','broadcast','carbon_report','fractional_cfo','product_photo','marketplace_listing','finance_api'];
    if(typeof body.capability!=='string' || !capabilities.includes(body.capability)) return NextResponse.json({error:'Unsupported build capability. Choose a supported capability explicitly.'},{status:400});
    if(!prompt.trim()) return NextResponse.json({error:'A build prompt is required.'},{status:400});
    const capability=body.capability;
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
              : capability==='quote'
                ? await runQuoteBuild({businessId:business.id,userId:user.id,prompt,mode})
                : capability==='cash_sale'
                  ? await runCashSaleBuild({businessId:business.id,userId:user.id,prompt,mode})
                  : capability==='supplier_price'
                    ? await runSupplierPriceBuild({businessId:business.id,userId:user.id,prompt,mode})
                    : capability==='commission'
                      ? await runCommissionBuild({businessId:business.id,userId:user.id,prompt,mode})
                      : capability==='business_plan'
                        ? await runBusinessDocumentBuild({businessId:business.id,userId:user.id,prompt,mode})
                        : capability==='dual_currency'
                          ? await runDualCurrencyBuild({businessId:business.id,userId:user.id,prompt,mode})
                          : capability==='loan_readiness'
                            ? await runLoanReadinessBuild({businessId:business.id,userId:user.id,prompt,mode})
                            : capability==='obligation'
                              ? await runObligationBuild({businessId:business.id,userId:user.id,prompt,mode})
                              : capability==='payroll_advance'
                                ? await runPayrollAdvanceBuild({businessId:business.id,userId:user.id,prompt,mode})
                                : capability==='sms_wallet'
                                  ? await runSmsWalletBuild({businessId:business.id,userId:user.id,prompt,mode})
                                  : capability==='appointment'
                                    ? await runAppointmentBuild({businessId:business.id,userId:user.id,prompt,mode})
                                    : capability==='digital_menu'
                                      ? await runDigitalMenuBuild({businessId:business.id,userId:user.id,prompt,mode})
                                      : capability==='waiver'
                                        ? await runWaiverBuild({businessId:business.id,userId:user.id,prompt,mode})
                                        : capability==='thrift_group'
                                          ? await runThriftBuild({businessId:business.id,userId:user.id,prompt,mode})
                                          : capability==='business_credit'
                                            ? await runBusinessCreditBuild({businessId:business.id,userId:user.id,prompt,mode})
                                            : capability==='successor_access'
                                              ? await runSuccessorAccessBuild({businessId:business.id,userId:user.id,prompt,mode})
                                              : capability==='compliance'
                                                ? await runComplianceBuild({businessId:business.id,userId:user.id,prompt,mode})
                                                : capability==='voice_agent'
                                                  ? await runVoiceAgentBuild({businessId:business.id,userId:user.id,prompt,mode})
                                                  : capability==='broadcast'
                                                    ? await runBroadcastBuild({businessId:business.id,userId:user.id,prompt,mode})
                                                    : capability==='carbon_report'
                                                      ? await runCarbonReportBuild({businessId:business.id,userId:user.id,prompt,mode})
                                                      : capability==='fractional_cfo'
                                                        ? await runFractionalCfoBuild({businessId:business.id,userId:user.id,prompt,mode})
                                                        : capability==='product_photo'
                                                          ? await runProductPhotoBuild({businessId:business.id,userId:user.id,prompt,mode})
                                                          : capability==='marketplace_listing'
                                                            ? await runMarketplaceListingBuild({businessId:business.id,userId:user.id,prompt,mode})
                                                            : capability==='finance_api'
                                                              ? await runFinanceApiBuild({businessId:business.id,userId:user.id,prompt,mode})
                                                              : await runWebsiteBuild({
          businessId:business.id,
          userId:user.id,
          prompt,
          websiteId:typeof body.websiteId==='string'?body.websiteId:null,
          projectId:typeof body.projectId==='string'?body.projectId:null,
          mode,
          publish:Boolean(body.publish)
        });
    return NextResponse.json(result);
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:'Build failed'},{status:400});
  }
}