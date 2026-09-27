import type { BuildContext, WebsitePageSpec, WebsiteSection, WebsiteSpec } from '@/lib/ai/build-engine/types';

const slug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
const has = (text: string, words: string[]) => words.some((word) => text.includes(word));
function section(type: WebsiteSection['type'], heading: string, body: string, extra: Partial<WebsiteSection> = {}): WebsiteSection { return { id: type + '-' + slug(heading), type, heading, body, ...extra }; }
function page(title: string, pageType: WebsitePageSpec['pageType'], description: string, sections: WebsiteSection[]): WebsitePageSpec { return { slug: slug(title) || 'home', title, pageType, seo: { title, description }, sections }; }

export function normalizeLocalWebsiteSpec(prompt: string, context: BuildContext): WebsiteSpec {
  const text = prompt.toLowerCase();
  const businessName = context.business.name || 'Your Business';
  const industry = context.business.industry || 'business';
  const wantsStore = has(text, ['store','shop','ecommerce','e-commerce','products','sell online','checkout']);
  const wantsBooking = has(text, ['booking','book','appointment','reservation','schedule']);
  const wantsBlog = has(text, ['blog','articles','news','resources']);
  const wantsGallery = has(text, ['gallery','portfolio','projects','photos','showcase']);
  const wantsFaq = has(text, ['faq','frequently asked','questions']);
  const wantsPricing = has(text, ['pricing','plans','packages','rates']);
  const wantsAbout = has(text, ['about','story','team','company']);
  const wantsServices = has(text, ['services','solutions','what we do','offer']);
  const wantsWhatsApp = has(text, ['whatsapp','chat','message us']);
  const wantsLeadForm = has(text, ['lead','quote','quote request','inquiry','contact form','enquiry']);
  const dark = has(text, ['dark','black','midnight','night']);
  const luxury = has(text, ['luxury','premium','elegant','high-end']);
  const bold = has(text, ['bold','vibrant','energetic','colorful']);
  const minimal = has(text, ['minimal','simple','clean','minimalist']);

  const features = [
    'Responsive mobile-first website', 'Structured editable page content', 'SEO metadata per page', 'Business-connected contact workflow',
    wantsStore && 'Product/store-ready architecture', wantsBooking && 'Booking-ready architecture', wantsBlog && 'Content/blog-ready architecture',
    wantsGallery && 'Gallery/portfolio content model', wantsFaq && 'FAQ content model', wantsPricing && 'Pricing/packages content model', wantsWhatsApp && 'WhatsApp CTA surface'
  ].filter(Boolean) as string[];

  const forms = wantsLeadForm || true ? [{ key: 'contact', name: 'Contact / enquiry form', fields: ['name','email','phone','message'], destination: 'crm' as const }] : [];
  const integrations = [
    ...(wantsWhatsApp ? [{ key: 'whatsapp', provider: 'WhatsApp Business', required: true, status: 'credential_required' as const }] : []),
    ...(wantsBooking ? [{ key: 'booking', provider: 'BizStack Booking Engine', required: false, status: 'ready' as const }] : []),
    ...(wantsStore ? [{ key: 'commerce', provider: 'BizStack Commerce', required: false, status: 'ready' as const }] : [])
  ];

  const pages: WebsitePageSpec[] = [];
  pages.push(page('Home','home',businessName + ' — ' + industry + ' website', [
    section('hero','Welcome to ' + businessName,'A clear, credible place to understand ' + businessName + ', what it offers, and how customers can take the next step.', { button: wantsBooking ? 'Book an appointment' : wantsStore ? 'Shop now' : 'Contact us', url: wantsBooking ? '/booking' : wantsStore ? '/store' : '/contact' }),
    ...(wantsServices ? [section('services','What we do','Present the core services, outcomes, delivery options and next actions customers need to make a decision.')] : []),
    ...(wantsStore ? [section('products','Featured products','Products can later be connected directly to BizStack Commerce, inventory and payment workflows.')] : []),
    ...(wantsGallery ? [section('gallery','Selected work','Showcase products, projects, spaces or visual proof without hardcoding fake customer data.')] : []),
    ...(wantsPricing ? [section('features','Plans and packages','Use this section for transparent packages, inclusions and calls to action.')] : []),
    ...(wantsFaq ? [section('faq','Frequently asked questions','Answer the questions that normally block a purchase, booking or enquiry.')] : []),
    section('cta','Ready for the next step?','Give visitors one obvious action and connect it to a real BizStack workflow.', { button: wantsBooking ? 'Book now' : wantsStore ? 'View store' : 'Send an enquiry', url: wantsBooking ? '/booking' : wantsStore ? '/store' : '/contact' })
  ]));
  if (wantsAbout) pages.push(page('About','standard','About ' + businessName,[section('text','About ' + businessName,businessName + ' can use this page to tell its story, operating values, team information and proof without forcing everything into the homepage.'),section('features','Why customers choose us','Explain measurable differentiators, service standards and evidence.')]));
  if (wantsServices || !wantsStore) pages.push(page('Services','standard','Services and solutions from ' + businessName,[section('services','Services and solutions','Describe the actual service catalogue, delivery model, customer outcomes and next actions.')]));
  if (wantsStore) pages.push(page('Store','commerce','Products from ' + businessName,[section('products','Shop products','This catalogue can later bind to BizStack products, inventory, orders, checkout and payments.')]));
  if (wantsPricing) pages.push(page('Pricing','standard','Pricing from ' + businessName,[section('features','Plans and pricing','Keep pricing structured so future billing rules, taxes and subscription logic can be connected.')]));
  if (wantsBooking) pages.push(page('Booking','booking','Book with ' + businessName,[section('booking','Book an appointment','Booking flow is designed to connect later to real availability, deposits, reminders and customer records.')]));
  if (wantsGallery) pages.push(page('Gallery','standard','Gallery from ' + businessName,[section('gallery','Gallery and portfolio','Use this space for real uploaded assets and published work.')]));
  if (wantsBlog) pages.push(page('Blog','standard','Articles from ' + businessName,[section('text','Latest articles','A structured publishing surface for posts, resources and business updates.')]));
  if (wantsFaq) pages.push(page('FAQ','standard','Frequently asked questions about ' + businessName,[section('faq','Frequently asked questions','Answer common objections and operational questions.')]));
  pages.push(page('Contact','contact','Contact ' + businessName,[section('contact',"Let's talk",'Capture enquiries into the customer workflow instead of displaying a dead form.',{ button: wantsWhatsApp ? 'Chat on WhatsApp' : 'Send enquiry', url: wantsWhatsApp ? 'whatsapp://' : '#contact-form' })]));

  const style = dark ? 'dark' : luxury ? 'luxury' : bold ? 'bold' : minimal ? 'minimal' : 'modern';
  return {
    name: businessName + ' Website', subdomain: slug(businessName) || context.business.id,
    theme: { style, primary: dark ? '#f4f1e8' : luxury ? '#171717' : bold ? '#111827' : '#143b33', accent: luxury ? '#b99550' : bold ? '#e15d2d' : '#9a7b42', surface: dark ? '#111111' : '#fbfaf7', typography: luxury ? 'editorial' : 'clean' },
    navigation: pages.map((item) => item.slug), features, pages, forms, integrations,
    seo: { siteTitle: businessName, description: businessName + ' — ' + industry + ' business website.', keywords: [businessName, industry].concat(features.slice(0,4)) }
  };
}