import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "../../../utils";

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return redirect("/auth");
  }

  return <div>hello, I am the dashboard page</div>;
}
