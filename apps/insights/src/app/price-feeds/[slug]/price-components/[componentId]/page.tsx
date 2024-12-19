type Props = {
  params: Promise<{
    componentId: string;
  }>;
};

const PriceFeedComponent = async ({ params }: Props) => {
  const { componentId } = await params;
  return componentId;
};
export default PriceFeedComponent;
