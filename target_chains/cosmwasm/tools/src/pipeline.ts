import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

// The stage executor is where the stage functionality is defined
// Optionally it can take in a method `getResultOfPastStage` as a parameter
// if it wants to access the result of the previous stages

// Each stage should have exactly one atomic operation (like sending a transaction),
// The pipeline doesn't enforce atomicity. So if you have 2 atomic operations in
// one stage, then you could end up fulfilling one and failing the other.
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
    private readonly id: string,
    readonly storageFilePath: string
  ) {
    this.pipelineStore = new PipelineStore(storageFilePath);
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

    console.log(`${this.id}: Stage with id: ${stage.id} failed.`);
    console.log(`Please fix the error and re run the pipeline`);
    return false;
  }

  async run() {
    console.log("Running pipeline with id: ", this.id);
    for (let stage of this.stages) {
      console.log(`${this.id}: Running stage with id: ${stage.id}`);

      // This method is only going to process stage if all the past ones have been fulfilled
      let fulfilled = await this.processStage(stage);

      console.log(`${this.id}: Processed stage with id: ${stage.id}`);

      // store the whole processing locally after every stage
      this.pipelineStore.commit();
      if (fulfilled === false) break;
    }
  }
}

// PipelineStore helps in getting and setting the state locally
// It manipulates data in-memory and once the consumer has finished manipulating it
// They need to commit the data to permanent storage using the commit method
class PipelineStore {
  private readonly store: {
    [stageId: string]: any;
  };

  constructor(private readonly filePath: string) {
    if (!existsSync(this.filePath)) {
      this.store = {};
      return;
    }

    this.store = JSON.parse(readFileSync(this.filePath).toString());
  }

  // It gets the latest state for the given stage
  // the state after the last operation
  // if there is no stage state, in case it was no process it will return undefined.
  // the caller can provide the T and this method will cast the result into it.
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
    // The "\n" at the end of the line is to satisfy the formatting rules
    writeFileSync(this.filePath, JSON.stringify(this.store, null, 2) + "\n");
  }
}
