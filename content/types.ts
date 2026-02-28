/**
 * Type definitions for Mimamori Landing Page content
 */

export interface Feature {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface FamilyFeature {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface FooterLink {
  label: string;
  href: string;
  disabled?: boolean;
  tooltip?: string;
}


export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export interface FooterProps {
  sections: FooterSection[];
  companyInfo: string;
  medicalDisclaimer: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface NavbarProps {
  links: NavLink[];
}

export interface CTAProps {
  heading: string;
  buttonText: string;
  buttonLink: string;
  description?: string;
}

export interface LandingPageContent {
  navbar: NavbarProps;
  hero: {
    tagline: string;
    subtitle: string;
    badge: string;
    designImage: {
      url: string;
      alt: string;
    };
  };
  
  features: {
    sectionTitle: string;
    sectionSubtitle?: string;
    items: Feature[];
  };
  
  familyFeatures: {
    sectionTitle: string;
    sectionSubtitle?: string;
    items: FamilyFeature[];
  };
  
  cta: CTAProps;
  
  footer: FooterProps;
}
