# @pythnetwork/component-library

A comprehensive React component library built for the Pyth Network ecosystem, featuring accessibility-first components, and integration with Next.js applications.

## 🎯 Quick Start

### Basic Usage

```tsx
import { Button, Card, TableGrid } from '@pythnetwork/component-library';

function MyApp() {
  return (
    <Card title="Welcome" variant="primary">
      <Button variant="primary" size="md">
        Get Started
      </Button>
    </Card>
  );
}
```

### App Shell Setup

For full application setup with routing, theming, and analytics:

```tsx
import { AppShell } from '@pythnetwork/component-library';

function App() {
  return (
    <AppShell
      enableAccessibilityReporting={true}
      amplitudeApiKey="your-key"
      googleAnalyticsId="your-id"
      appName="My App"
      tabs={[
        { label: 'Dashboard', href: '/dashboard', children: <Dashboard /> },
        { label: 'Analytics', href: '/analytics', children: <Analytics /> },
      ]}
    />
  );
}
```

### Breakpoints

```tsx
import { breakpoints } from '@pythnetwork/component-library/theme/index';

// Use in your components
const isMobile = useMediaQuery(`(max-width: ${breakpoints.md})`);
```

### Hooks and Utilities

```tsx
import { 
  useData, 
  useQueryParamsPagination,
  useAlert,
  useDrawer 
} from '@pythnetwork/component-library';

// Data fetching with SWR
const { data, error, isLoading } = useData('/api/data');

// URL-based pagination
const { page, setPage, pageSize, setPageSize } = useQueryParamsPagination();

// Alert
const { showAlert } = useAlert();
showAlert({ title: 'Success!', message: 'Data saved' });

// Drawer
const { openDrawer } = useDrawer();
openDrawer({ title: 'Settings', children: <SettingsForm /> });
```



Built with ❤️ by the Pyth Network team