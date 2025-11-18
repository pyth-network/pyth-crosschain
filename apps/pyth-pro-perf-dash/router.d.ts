import "react-aria-components";

declare module "react-aria-components" {
  import { useRouter } from "next/navigation";

  export type RouterConfig = {
    routerOptions: NonNullable<
      Parameters<ReturnType<typeof useRouter>["push"]>[1]
    >;
  };
}
