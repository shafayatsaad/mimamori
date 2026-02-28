import { LandingPageContent } from './types';

export const landingPageContent: LandingPageContent = {
  navbar: {
    links: [
      { label: "Features", href: "#features" },
    ]
  },
  hero: {
    badge: "AI-POWERED MONITORING",
    tagline: "Watching over your health, every single day.",
    subtitle: "AI-powered symptom tracking that brings peace of mind to patients and caregivers. Simple voice logs turned into doctor-ready insights.",
    designImage: {
      url: "/images/hero-dashboard.svg",
      alt: "Mimamori health monitoring interface showing daily symptom tracking"
    }
  },
  features: {
    sectionTitle: "How Mimamori Works",
    sectionSubtitle: "From your voice to your doctor's hands in three simple steps. We bridge the gap between daily life and clinical care.",
    items: [
      {
        id: "log",
        title: "Log with Voice",
        description: "Speak naturally about your symptoms. No typing required. Mimamori understands colloquial language and nuances.",
        icon: "microphone"
      },
      {
        id: "analyze",
        title: "AI Synthesizes",
        description: "Our medical-grade AI analyzes your logs to identify trends, severity changes, and potential red flags instantly.",
        icon: "brain"
      },
      {
        id: "report",
        title: "Doctor-Ready Reports",
        description: "Generate comprehensive PDF reports with one click. Share vital data with your care team instantly and securely.",
        icon: "document"
      }
    ]
  },
  familyFeatures: {
    sectionTitle: "Designed for families, Built for care.",
    items: [
      {
        id: "alerts",
        title: "Smart Alerts",
        description: "Get notified immediately when symptoms worsen or vitals go out of normal range. Customizable thresholds for every patient.",
        icon: "bell"
      },
      {
        id: "tracking",
        title: "Long-term Tracking",
        description: "View health progression over months or years. Identify subtle changes that are easy to miss day-to-day.",
        icon: "chart"
      },
      {
        id: "circle",
        title: "Care Circle",
        description: "Invite family members and doctors to the dashboard. Everyone stays on the same page, effortlessly.",
        icon: "users"
      }
    ]
  },
  cta: {
    heading: "Ready to take control of your health monitoring?",
    description: "Join thousands of patients and caregivers using Mimamori today.",
    buttonText: "Get Started Now",
    buttonLink: "/signup"
  },
  footer: {
    sections: [
      {
        title: "Product",
        links: [
          { label: "Features", href: "#features" },
          { label: "Security", href: "#", disabled: true, tooltip: "Coming Soon" }
        ]
      },
      {
        title: "Company",
        links: [
          { label: "About Us", href: "#", disabled: true, tooltip: "Coming Soon" },
          { label: "Careers", href: "#", disabled: true, tooltip: "Coming Soon" },
          { label: "Blog", href: "#", disabled: true, tooltip: "Coming Soon" },
          { label: "Contact", href: "#", disabled: true, tooltip: "Coming Soon" }
        ]
      },
      {
        title: "Legal",
        links: [
          { label: "Privacy Policy", href: "#", disabled: true, tooltip: "Coming Soon" },
          { label: "Terms of Service", href: "#", disabled: true, tooltip: "Coming Soon" },
          { label: "Cookie Policy", href: "#", disabled: true, tooltip: "Coming Soon" }
        ]
      }
    ],
    companyInfo: `© ${new Date().getFullYear()} Mimamori Health Inc. All rights reserved.`,
    medicalDisclaimer: "Medical Disclaimer: Mimamori is not a medical device and does not provide medical advice, diagnosis, or treatment. The content and services provided by Mimamori are for informational purposes only. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read on this website."
  }
};




