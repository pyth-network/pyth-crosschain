import { MagnifyingGlass, Lifebuoy } from "@phosphor-icons/react/dist/ssr";
import { Button, ButtonLink } from "@pythnetwork/component-library/Button";
import { Link } from "@pythnetwork/component-library/Link";

import Logo from "./logo.svg";
import Orb from "./orb.svg";
import { TabList } from "./tabs";
import { ThemeSwitch } from "./theme-switch";
import { MaxWidth } from "../MaxWidth";

export const Header = () => (
  <header className="sticky top-0 z-10 h-20 w-full bg-white dark:bg-steel-950">
    <MaxWidth className="flex h-full flex-row items-center justify-between">
      <div className="flex flex-none flex-row items-center gap-6">
        <Link href="https://www.pyth.network">
          <Logo className="mt-[0.56456rem] h-[2.81456rem] w-9" />
          <div className="sr-only">Pyth Homepage</div>
        </Link>
        <div className="inline-block h-9 whitespace-nowrap rounded-full bg-beige-100 pr-6 leading-9 dark:bg-steel-900">
          <div className="relative inline-block size-9 align-top">
            <Orb className="h-11 w-9" />
          </div>
          <span className="mx-3 text-sm font-medium">Insights</span>
        </div>
        <TabList />
      </div>
      <div className="flex flex-none flex-row items-center gap-2 lg:-mx-button-padding-sm">
        <Button
          beforeIcon={Lifebuoy}
          variant="ghost"
          size="sm"
          className="hidden lg:inline-block"
        >
          Support
        </Button>
        <Button
          beforeIcon={MagnifyingGlass}
          variant="outline"
          size="sm"
          className="hidden lg:inline-block"
        >
          ⌘ K
        </Button>
        <ButtonLink href="https://www.pyth.network" size="sm" target="_blank">
          Integrate
        </ButtonLink>
        <ThemeSwitch className="ml-1 hidden lg:inline-block" />
      </div>
    </MaxWidth>
  </header>
);
