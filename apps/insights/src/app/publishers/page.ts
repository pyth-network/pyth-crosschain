import type { Metadata } from "next";

export { Publishers as default } from "../../components/Publishers";

export const metadata: Metadata = {
  title: "Publishers",
};

export const dynamic = "error";
export const revalidate = 3600;
