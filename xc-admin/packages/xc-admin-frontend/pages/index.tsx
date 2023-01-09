import type { NextPage } from "next";
import { useContext, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { PythContextProvider } from "../contexts/PythContext";
import { ClusterContext, DEFAULT_CLUSTER } from "./../contexts/ClusterContext";

const Home: NextPage = () => {
  const { setCluster } = useContext(ClusterContext);

  useEffect(() => {
    setCluster(DEFAULT_CLUSTER);
  }, [setCluster]);

  return (
    <Layout>
      <PythContextProvider>
        
      </PythContextProvider>
    </Layout>
  );
};

export default Home;
