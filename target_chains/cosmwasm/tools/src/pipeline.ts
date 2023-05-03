import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { createInterface } from "readline";
import path from "path";

// This function lets you write a question to the terminal
// And returns the response of the user
function readLineAsync(msg: string) {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    readline.question(msg, (userRes) => {
      resolve(userRes);
    });
  });
}

// The stage executor is where the stage functionality is defined
// Optionally it can take in a method `getResultOfPastStage` as a parameter
// if it wants to access the result of the previous stages
export type StageExecutor =
  | ((
      // get the result of a past stage using it's id
      // It will return the result for the same step id
      // It will return undefined if the previous stage data has not been stored locally
      // or if a future stage data is being asked
      getResultOfPastStage: <Y>(stageId: string) => Y
    ) => Promise<any>)
  | (() => Promise<any>);

export type Stage = {
  id: string;
  executor: StageExecutor;
};

type StageResult<T = any> =
  | {
      status: "rejected";
      reason: any;
    }
  | {
      status: "fulfilled";
      result: T;
    };

export class Pipeline {
  private stages: Stage[] = [];
  private readonly pipelineStore: PipelineStore;

  constructor(
    // osmosis_testnet_4
    readonly id: string,
    readonly version: string,
    // should not end with /
    // "./on-chain/wormhole-stub"
    readonly storageDir: string
  ) {
    const filePath = `${storageDir}/${id}-${version}.json`;
    this.pipelineStore = new PipelineStore(filePath);
  }

  addStage(stage: Stage) {
    this.stages.push(stage);
  }

  private stageExecutorWrapper(executor: StageExecutor) {
    // We want to wrap the executor provided by the pipeline consumer
    // In order to wrap the response of the executor in the StageResult
    // also in this method we inject the `getResultOfPastStage` to the stage executor
    return async (): Promise<StageResult> => {
      // method to inject
      const getResultOfPastStage = <Y>(stageId: string): Y => {
        let result = this.pipelineStore.getStageState<StageResult<Y>>(stageId);

        // This if condition will execute only if the stage executor is
        // trying to reading a stage's state with stage id that doesn't exist
        // past results will all be fulfilled and the pipeline will make sure of that
        if (
          result === undefined ||
          (result !== undefined && result.status === "rejected")
        ) {
          throw new Error(
            `${this.id}: Stage id seems to be invalid: ${stageId}`
          );
        }
        return result.result;
      };
      try {
        // wrapping result
        const result = await executor(getResultOfPastStage);
        return {
          status: "fulfilled",
          result,
        };
      } catch (e) {
        return {
          status: "rejected",
          reason: e,
        };
      }
    };
  }

  private async processStage(stage: Stage): Promise<boolean> {
    // Here we will check if there is a past result that has been fulfilled
    // If yes, we are not going to process any further
    let currentResult = this.pipelineStore.getStageState<StageResult>(stage.id);
    if (currentResult !== undefined && currentResult.status === "fulfilled")
      return true;

    // Else we will process the new stage and store the result
    const newResult = await this.stageExecutorWrapper(stage.executor)();
    this.pipelineStore.setStageState(stage.id, newResult);

    if (newResult.status === "fulfilled") return true;

    // Some steps can fail due to some one time errors like API issues
    // This allows the user to re run this particular stage
    const rerun =
      (await readLineAsync(
        `${this.id}: Some steps of stage: ${stage.id} failed. \n Do you want to rerun? (y) `
      )) === "y";

    if (rerun) return this.processStage(stage);
    else return false;
  }

  async run() {
    console.log("Running pipeline with id: ", this.id);
    for (let stage of this.stages) {
      console.log(`${this.id}: Running stage with id: ${stage.id}`);

      // This method is only going to process stage if all the past ones have been fulfilled
      let fulfilled = await this.processStage(stage);
      if (fulfilled === false) break;
    }

    // store the whole processing locally
    this.pipelineStore.commit();
  }
}

type StoreStructure = {
  [stageId: string]: any;
};
// PipelineStore helps in getting and setting the state locally
// It manipulates data in-memory and once the consumer has finished manipulating it
// They need to commit the data to permanent storage using the commit method
class PipelineStore {
  private readonly store: StoreStructure;

  constructor(private readonly filePath: string) {
    if (!existsSync(this.filePath)) {
      this.store = {};
      return;
    }

    this.store = JSON.parse(readFileSync(this.filePath).toString());
  }

  // It gets the latest state for the given stage
  // the state after the last operation
  // if there is no stage stage, in case it was no process it will return undefined.
  getStageState<T = any>(stageId: string): T | undefined {
    return this.store[stageId];
  }

  // It sets the latest state for the given step
  setStageState(stageId: string, state: any) {
    this.store[stageId] = state;
  }

  // After all the in memory operations one can commit to the local file
  // for permanent storage
  commit() {
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(this.store, null, 4));
  }
}
