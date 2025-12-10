import styles from "./index.module.scss";
import { ProductCard } from "../../ProductCard";
import { SectionTitle } from "../../Shared/section-title";
import { Card, Cards } from "fumadocs-ui/components/card";
import { additionalResources, developerResources, products } from "./home-content-cards";
import { SectionContainer } from "../../Shared/section-container";

export const Homepage = () => (
  <div className={styles.preview}>
    <section className={styles.sectionHero}>
      <SectionContainer>
        <div className={styles.sectionHeroContent}>
          <div className={styles.heroCopy}>
            <h1 className={styles.heroTitle}>Developer Hub</h1>
            <p className={styles.heroSubtitle}>
              Integrate with the global price layer.
            </p>
          </div>
        </div>
      </SectionContainer>
    </section>

    <section>
      <SectionContainer>
        <SectionTitle title="Products" subtitle="Connect to the global market data and randomness layer." />
        <div className={styles.productsGrid}>
          {products.map((product) => (
            <div key={product.title} className={styles.productsCardWrapper}>
              <ProductCard
                title={product.title}
                description={product.description}
                features={product.features}
                quickLinks={product.quickLinks}
                buttonLabel="Get started"
                buttonHref={product.href} />
            </div>
          ))}
        </div>
      </SectionContainer>
    </section>

    <section>
      <SectionContainer>
        <SectionTitle title="Products" subtitle="Connect to the global market data and randomness layer." />
        <div className={styles.productsGrid}>
          <Cards>
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
        </div>
      </SectionContainer>
    </section>

    <section>
      <SectionContainer>
        <SectionTitle title="Products" subtitle="Connect to the global market data and randomness layer." />
        <div className={styles.productsGrid}>
          <Cards>
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
        </div>
      </SectionContainer>
    </section>
  </div>
);


