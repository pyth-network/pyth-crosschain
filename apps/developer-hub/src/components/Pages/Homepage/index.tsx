import styles from "./index.module.scss";
import { ProductCard } from "../../ProductCard";
import { SectionTitle } from "../../Shared/section-title";
import { Card, Cards } from "fumadocs-ui/components/card";
import { additionalResources, developerResources, products } from "./home-content-cards";
import { SectionContainer } from "../../Shared/section-container";
import { BoxSVG } from "./BoxSVG";

export const Homepage = () => (
  <>
    <section className="border-b pt-24 pb-24">
      <SectionContainer>
        <div className={styles.heroCopy}>
          <h1 className={styles.heroTitle}>Developer Hub</h1>
          <p className={styles.heroSubtitle}>
            Integrate with the global price layer.
          </p>
        </div>
      </SectionContainer>
    </section>

    <section className="pt-24 pb-24">
      <SectionContainer>
        <SectionTitle title="Products" subtitle="Connect to the global market data and randomness layer." />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.title}
              title={product.title}
              description={product.description}
              features={product.features}
              quickLinks={product.quickLinks}
              badge={product.badge}
              buttonLabel="Get started"
              href={product.href} />
          ))}
        </div>
      </SectionContainer>
    </section>

    <section className="pt-24 pb-24 bg-fd-card flex flex-col justify-end bg-gradient-to-bl  from-fd-background to-fd-card border-t border-b overflow-hidden">
      <SectionContainer>
        <SectionTitle title="Additional Resources" subtitle="Explore the Pyth Network">
          <BoxSVG className="w-64 aspect-square absolute md:relative -right-24 -bottom-48 md:top-0 md:right-0 pointer-events-none" />
        </SectionTitle>
        <Cards className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 z-10">
          {additionalResources.map(({ title, description, href, icon }, index) => (
            <Card
              key={`resource-${index}`}
              icon={icon}
              href={href}
              title={title}
            >
              {description}
            </Card>
          ))}
        </Cards>
      </SectionContainer>
    </section>

    <section className="pt-24 pb-24">
      <SectionContainer>
        <SectionTitle title="Developer Resources" subtitle="Resources for developers." />
        <Cards className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {developerResources.map(({ title, description, href, icon }, index) => (
            <Card
              key={`resource-${index}`}
              icon={icon}
              href={href}
              title={title}
            >
              {description}
            </Card>
          ))}
        </Cards>
      </SectionContainer>
    </section>
  </>
);


