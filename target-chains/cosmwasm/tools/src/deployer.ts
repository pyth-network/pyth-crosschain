export abstract class Deployer {
  abstract deployArtifact(artifact: string): Promise<number>;

  abstract instantiate(
    codeId: number,
    inst_msg: string | object,
    label: string
  ): Promise<string>;

  abstract migrate(contract: string, codeId: number): Promise<void>;
}
