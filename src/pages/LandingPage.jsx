import React from 'react'
import LandingNavbar from '../components/landing/LandingNavbar.jsx'
import { Hero, Pillars, HowItWorks, Services, FAQ, FinalCta } from '../components/landing/LandingSections.jsx'
import Footer from '../components/landing/Footer.jsx'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNavbar />
      <Hero />
      <Pillars />
      <HowItWorks />
      <Services />
      <FAQ />
      <FinalCta />
      <Footer />
    </div>
  )
}
