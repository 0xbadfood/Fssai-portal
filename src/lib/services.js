// Services shown on the landing page. Add a new service by adding an entry here.
import { BadgeCheck, LifeBuoy, Palette, ShieldCheck } from 'lucide-react'

export const SERVICES = [
  {
    icon: BadgeCheck,
    tone: 'violet',
    title: 'FSSAI Registration & Licences',
    topic: 'application', // Support-page topic (src/lib/supportTopics.js)
    head: 'licensing-approvals', // heading on /services (config/services.json)
    desc: 'Basic Registration, State and Central Licences: new applications, renewals and modifications, prepared with AI and checked by an expert.',
    points: ['Right licence, first time', 'Forms filled for you', 'Filing support on FoSCoS'],
    cta: { label: 'Start free', to: '/signup' },
  },
  {
    icon: Palette,
    tone: 'orange',
    title: 'Label & Artwork Review',
    topic: 'label', // Support-page topic (src/lib/supportTopics.js)
    head: 'labels-claims',
    desc: 'Get your pack label checked against the FSS (Labelling and Display) Regulations before it goes to print, and approved without costly reprints.',
    points: ['Mandatory declarations', 'Nutrition & claims check', 'Logo & licence number placement'],
    cta: { label: 'See label & claims services', to: '/services?head=labels-claims' },
  },
  {
    icon: LifeBuoy,
    tone: 'emerald',
    title: 'FSSAI Problem Solving',
    topic: 'problem', // Support-page topic (src/lib/supportTopics.js)
    head: 'compliance',
    desc: 'Stuck with FSSAI? Rejected applications, officer queries, improvement notices or a suspended licence: our experts take it from here.',
    points: ['Rejections & queries', 'Notices & inspections', 'Suspension & appeals'],
    cta: { label: 'See notice & compliance services', to: '/services?head=compliance' },
  },
  {
    icon: ShieldCheck,
    tone: 'sky',
    title: 'Compliance & Food Safety',
    topic: 'compliance', // Support-page topic (src/lib/supportTopics.js)
    head: 'compliance',
    desc: 'Stay compliant after you get licensed: annual returns, hygiene and food-safety practices, and audit readiness.',
    points: ['Annual returns', 'Hygiene & safety practices', 'Audit readiness'],
    cta: { label: 'See compliance services', to: '/services?head=compliance' },
  },
]
