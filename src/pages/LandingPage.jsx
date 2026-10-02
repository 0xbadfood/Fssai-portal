import React from 'react'
import LandingNavbar from '../components/landing/LandingNavbar.jsx'
import { Hero, Pillars, HowItWorks, Services, Guides, FAQ, FAQS, FinalCta } from '../components/landing/LandingSections.jsx'
import Footer from '../components/landing/Footer.jsx'
import { useMeta } from '../seo/useMeta.js'
import { homeMeta } from '../seo/meta.js'

export default function LandingPage() {
  useMeta(homeMeta(FAQS))
  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />
      <Hero />
      <Pillars />
      <HowItWorks />
      <Services />
      <Guides />
      <FAQ />
      <FinalCta />
      <Footer />
    </div>
  )
}
