import type { Meta, StoryObj } from "@storybook/react";

import { CrossfadeTabPanels as CrossfadeTabPanelsComponent } from "./index.jsx";
import styles from "./index.stories.module.scss";
import { TabList } from "../TabList/index.jsx";
import { Tabs } from "../unstyled/Tabs/index.jsx";

const meta = {
  title: "navigation & menus/CrossfadeTabPanels",
  component: CrossfadeTabPanelsComponent,
  parameters: {
    docs: {
      description: {
        component:
          "CrossfadeTabPanels provides animated transitions between tab panels using a crossfade effect. It must be used within a Tabs context.",
      },
    },
  },
  argTypes: {
    items: {
      description:
        "Array of tab panel items with id, optional className, and children",
      table: {
        category: "Props",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CrossfadeTabPanelsComponent>;
export default meta;

type Story = StoryObj<typeof CrossfadeTabPanelsComponent>;

export const Default: Story = {
  render: () => (
    <Tabs defaultSelectedKey="tab1">
      <TabList
        label="Example tabs"
        items={[
          { id: "tab1", children: "Tab 1" },
          { id: "tab2", children: "Tab 2" },
          { id: "tab3", children: "Tab 3" },
        ]}
      />
      <CrossfadeTabPanelsComponent
        items={[
          {
            id: "tab1",
            children: (
              <div className={styles.tabContent}>
                <h2 className={styles.heading}>Tab 1 Content</h2>
                <p>This is the content for the first tab.</p>
              </div>
            ),
          },
          {
            id: "tab2",
            children: (
              <div className={styles.tabContent}>
                <h2 className={styles.heading}>Tab 2 Content</h2>
                <p>This is the content for the second tab.</p>
                <p>Notice how it crossfades when switching tabs.</p>
              </div>
            ),
          },
          {
            id: "tab3",
            children: (
              <div className={styles.tabContent}>
                <h2 className={styles.heading}>Tab 3 Content</h2>
                <p>This is the content for the third tab.</p>
                <ul className={styles.list}>
                  <li>Item 1</li>
                  <li>Item 2</li>
                  <li>Item 3</li>
                </ul>
              </div>
            ),
          },
        ]}
      />
    </Tabs>
  ),
};

export const WithCustomStyling: Story = {
  render: () => (
    <Tabs defaultSelectedKey="home">
      <TabList
        label="Navigation tabs"
        items={[
          { id: "home", children: "Home" },
          { id: "about", children: "About" },
          { id: "contact", children: "Contact" },
        ]}
      />
      <CrossfadeTabPanelsComponent
        items={[
          {
            id: "home",
            children: (
              <div className={styles.homePanel}>
                <h2 className={styles.heading}>Welcome Home</h2>
                <p>This panel has custom styling with a blue theme.</p>
              </div>
            ),
          },
          {
            id: "about",
            children: (
              <div className={styles.aboutPanel}>
                <h2 className={styles.heading}>About Us</h2>
                <p>This panel has custom styling with a green theme.</p>
              </div>
            ),
          },
          {
            id: "contact",
            children: (
              <div className={styles.contactPanel}>
                <h2 className={styles.heading}>Contact Us</h2>
                <p>This panel has custom styling with a yellow theme.</p>
              </div>
            ),
          },
        ]}
      />
    </Tabs>
  ),
};

export const DifferentHeights: Story = {
  render: () => (
    <Tabs defaultSelectedKey="short">
      <TabList
        label="Content tabs"
        items={[
          { id: "short", children: "Short Content" },
          { id: "medium", children: "Medium Content" },
          { id: "long", children: "Long Content" },
        ]}
      />
      <CrossfadeTabPanelsComponent
        items={[
          {
            id: "short",
            children: (
              <div className={styles.tabContent}>
                <h2 className={styles.heading}>Short Content</h2>
                <p>Just a single paragraph here.</p>
              </div>
            ),
          },
          {
            id: "medium",
            children: (
              <div className={styles.tabContent}>
                <h2 className={styles.heading}>Medium Content</h2>
                <p>This tab has more content than the first one.</p>
                <p>
                  It includes multiple paragraphs to show how the crossfade
                  handles different heights.
                </p>
                <p>
                  The animation should smoothly transition between different
                  content sizes.
                </p>
              </div>
            ),
          },
          {
            id: "long",
            children: (
              <div className={styles.tabContent}>
                <h2 className={styles.heading}>Long Content</h2>
                <p>
                  This tab contains the most content to demonstrate height
                  transitions.
                </p>
                <h3>Section 1</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
                <h3>Section 2</h3>
                <p>
                  Sed do eiusmod tempor incididunt ut labore et dolore magna
                  aliqua.
                </p>
                <h3>Section 3</h3>
                <p>
                  Ut enim ad minim veniam, quis nostrud exercitation ullamco
                  laboris.
                </p>
              </div>
            ),
          },
        ]}
      />
    </Tabs>
  ),
};

export const ComplexContent: Story = {
  render: () => (
    <Tabs defaultSelectedKey="dashboard">
      <TabList
        label="Application sections"
        items={[
          { id: "dashboard", children: "Dashboard" },
          { id: "analytics", children: "Analytics" },
          { id: "settings", children: "Settings" },
        ]}
      />
      <CrossfadeTabPanelsComponent
        items={[
          {
            id: "dashboard",
            children: (
              <div className={styles.tabContent}>
                <h2 className={styles.heading}>Dashboard</h2>
                <div className={styles.grid}>
                  <div className={styles.widget}>
                    <h3>Widget 1</h3>
                    <p>Some dashboard content</p>
                  </div>
                  <div className={styles.widget}>
                    <h3>Widget 2</h3>
                    <p>More dashboard content</p>
                  </div>
                </div>
              </div>
            ),
          },
          {
            id: "analytics",
            children: (
              <div className={styles.tabContent}>
                <h2 className={styles.heading}>Analytics</h2>
                <div className={styles.section}>
                  <div className={styles.chartPlaceholder}>
                    <h3>Chart Placeholder</h3>
                    <div className={styles.chart}>Chart would go here</div>
                  </div>
                  <p>
                    Analytics data and insights would be displayed in this
                    panel.
                  </p>
                </div>
              </div>
            ),
          },
          {
            id: "settings",
            children: (
              <div className={styles.tabContent}>
                <h2 className={styles.heading}>Settings</h2>
                <form className={styles.form}>
                  <div className={styles.formField}>
                    <label className={styles.label} htmlFor="setting1">
                      Setting 1
                    </label>
                    <input type="text" className={styles.input} id="setting1" />
                  </div>
                  <div className={styles.formField}>
                    <label className={styles.label} htmlFor="setting2">
                      Setting 2
                    </label>
                    <select className={styles.select} id="setting2">
                      <option>Option 1</option>
                      <option>Option 2</option>
                    </select>
                  </div>
                  <button type="button" className={styles.button}>
                    Save Settings
                  </button>
                </form>
              </div>
            ),
          },
        ]}
      />
    </Tabs>
  ),
};
