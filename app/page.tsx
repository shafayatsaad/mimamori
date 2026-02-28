import Navbar from '@/components/Navbar';
import HeroSection from '@/components/HeroSection';
import FeatureExplanationSection from '@/components/FeatureExplanationSection';
import FamilyFeaturesSection from '@/components/FamilyFeaturesSection';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import { landingPageContent } from '@/content/landing-page';

export default function Home() {
  return (
    <>
      <Navbar links={landingPageContent.navbar.links} />
      
      <main id="main-content" className="min-h-screen">
        <HeroSection
          badge={landingPageContent.hero.badge}
          tagline={landingPageContent.hero.tagline}
          subtitle={landingPageContent.hero.subtitle}
          designImageUrl={landingPageContent.hero.designImage.url}
          designImageAlt={landingPageContent.hero.designImage.alt}
        />
        <FeatureExplanationSection
          sectionTitle={landingPageContent.features.sectionTitle}
          sectionSubtitle={landingPageContent.features.sectionSubtitle}
          features={landingPageContent.features.items}
        />
        <FamilyFeaturesSection
          sectionTitle={landingPageContent.familyFeatures.sectionTitle}
          sectionSubtitle={landingPageContent.familyFeatures.sectionSubtitle}
          features={landingPageContent.familyFeatures.items}
        />
        <CTASection
          heading={landingPageContent.cta.heading}
          buttonText={landingPageContent.cta.buttonText}
          buttonLink={landingPageContent.cta.buttonLink}
          description={landingPageContent.cta.description}
        />
        <Footer
          sections={landingPageContent.footer.sections}
          companyInfo={landingPageContent.footer.companyInfo}
          medicalDisclaimer={landingPageContent.footer.medicalDisclaimer}
        />
      </main>
    </>
  );
}

