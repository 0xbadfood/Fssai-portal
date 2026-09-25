// Services shown on the landing page. Add a new service by adding an entry here.
import { BadgeCheck, LifeBuoy, Palette, ShieldCheck } from 'lucide-react'

export const SERVICES = [
  {
    icon: BadgeCheck,
    tone: 'violet',
    title: 'FSSAI Registration & Licences',
    topic: 'application', // Support-page topic (src/lib/supportTopics.js)
    desc: 'Basic Registration, State and Central Licences: new applications, renewals and modifications, prepared with AI and checked by an expert.',
    points: ['Right licence, first time', 'Forms filled for you', 'Filing support on FoSCoS'],
    cta: { label: 'Start free', to: '/signup' },
  },
  {
    icon: Palette,
    tone: 'orange',
    title: 'Label & Artwork Review',
    topic: 'label', // Support-page topic (src/lib/supportTopics.js)
    desc: 'Get your pack label checked against the FSS (Labelling and Display) Regulations before it goes to print, and approved without costly reprints.',
    points: ['Mandatory declarations', 'Nutrition & claims check', 'Logo & licence number placement'],
    cta: { label: 'Talk to an expert', to: '/signup' },
  },
  {
    icon: LifeBuoy,
    tone: 'emerald',
    title: 'FSSAI Problem Solving',
    topic: 'problem', // Support-page topic (src/lib/supportTopics.js)
    desc: 'Stuck with FSSAI? Rejected applications, officer queries, improvement notices or a suspended licence: our experts take it from here.',
    points: ['Rejections & queries', 'Notices & inspections', 'Suspension & appeals'],
    cta: { label: 'Talk to an expert', to: '/signup' },
  },
  {
    icon: ShieldCheck,
    tone: 'sky',
    title: 'Compliance & Food Safety',
    topic: 'compliance', // Support-page topic (src/lib/supportTopics.js)
    desc: 'Stay compliant after you get licensed: annual returns, hygiene and food-safety practices, and audit readiness.',
    points: ['Annual returns', 'Hygiene & safety practices', 'Audit readiness'],
    cta: { label: 'Talk to an expert', to: '/signup' },
  },
]
