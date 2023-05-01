import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { createInterface } from "readline";

// This function lets you write a question to the terminal
// And returns you the response of the user
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

type StateStore<T = any> = {
  [stepId: string]: T;
};
// StateManager helps in getting and setting the state locally
// It manipulates data in-memory and once the consumer has finished manipulating it
// They need to commit the data to permanent storage using the commit method
class StateManager<T> {
  private readonly fileExt = ".json";
  private readonly dirPath = "./tmp";

  private readonly store: StateStore<T>;
  private readonly filePath: string;

  constructor(
    private readonly stageId: string,
    private readonly version: string
  ) {
    // dir check
    if (!existsSync(this.dirPath)) {
      mkdirSync(this.dirPath);
    }

    this.filePath = `${this.dirPath}/${this.stageId}-${this.version}${this.fileExt}`;
    if (existsSync(this.filePath) === false) {
      this.store = {};
      return;
    }
    this.store = JSON.parse(readFileSync(this.filePath).toString());
  }

  // It gets the latest state for the given step
  // the state after the last operation
  getStepState(stepId: string): T | undefined {
    return this.store[stepId];
  }

  // It sets the latest state for the given step
  setSetState(stepId: string, state: T) {
    this.store[stepId] = state;
  }

  // After all the in memory operations one can commit to the local file
  // for permanent storage
  commit() {
    writeFileSync(this.filePath, JSON.stringify(this.store, null, 4));
  }
}

// A step is defined as a method
// it takes in a step id as a parameter to execute that particular step
// Optionally it can take in a method `getResultOfPastStage` as a parameter
// if it wants to access the result of the previous stages
export type Step =
  | ((
      stepId: string,
      // get the result of a past stage using it's id
      // It will return the result for the same step id
      // It will return undefined if the previous stage data has not been stored locally
      // or if a future stage data is being asked
      getResultOfPastStage: <Y>(stageId: string) => Y
    ) => Promise<any>)
  | ((stepId: string) => Promise<any>);

// A step can fail. If the error is not handled it will crash the pipeline
// We would like to store the result or reason locally too
// For that purpose the response from a step is being wrapped in this
type StepResult<T = any> =
  | {
      status: "rejected";
      stepId: string;
      reason: any;
    }
  | {
      status: "fulfilled";
      stepId: string;
      result: T;
    };

// A stage will contain an identifier and a step method
type Stage = {
  stageId: string;
  step: Step;
};

// A pipeline is conists of multiple stages
// A stage contains of multiple steps
// Stages will be run synchronously i.e, in order
// Steps will be run asychronously
// CONSTRAINT: Each stage will have the same number of steps
// See the type definition of `Stage` and `Step` above to know more about them
export class Pipeline {
  private readonly stages: Stage[] = [];
  constructor(
    private readonly version: string,
    private readonly stepIds: string[]
  ) {}

  addStage(stageId: string, step: Step) {
    this.stages.push({ stageId, step });
  }

  // We want to wrap the step provided by the pipeline consumer
  // In order to wrap the response of the step in the StepResult
  // also in this method we inject the `getResultOfPastStage` to the step
  private stepWrapper<T, Y>(step: Step) {
    return async (stepId: string): Promise<StepResult<T>> => {
      // method to inject
      const getResultOfPastStage = <Y>(stageId: string): Y => {
        let stateManager = new StateManager<StepResult<Y>>(
          stageId,
          this.version
        );
        let result = stateManager.getStepState(stepId);
        // pipeline will only proceed to the next stage if the previous one is fulfilled
        if (result !== undefined && result.status === "rejected") {
          throw new Error("previous stage was not fulfilled");
        }
        if (result === undefined) {
          throw new Error(
            `either the previous stage is not fully processed or a future stage is being referred to: ${stageId}`
          );
        }
        return result.result;
      };
      try {
        // wrapping result
        const result = await step(stepId, getResultOfPastStage);
        return {
          status: "fulfilled",
          stepId,
          result,
        };
      } catch (e) {
        return {
          status: "rejected",
          stepId,
          reason: e,
        };
      }
    };
  }

  async processStage(stage: Stage) {
    console.log("processing stage: ", stage.stageId);

    let stateManager = new StateManager<StepResult>(
      stage.stageId,
      this.version
    );

    let areSomeRejected = false;
    await Promise.all(
      this.stepIds.map(async (stepId) => {
        console.log(`processing step: ${stepId} of stage: ${stage.stageId}`);

        const prevResult = stateManager.getStepState(stepId);
        // We are only processing the step if the past result of it was not fulfilled
        if (prevResult === undefined || prevResult.status === "rejected") {
          let stepResult = await this.stepWrapper(stage.step)(stepId);

          if (stepResult.status === "rejected") {
            areSomeRejected = true;
            console.log(
              `step: ${stepId} of stage: ${stage.stageId} was rejected due to the following reason`
            );
            console.log(stepResult.reason);
          }

          // Since javascript is a single threaded language
          // Only one thread will be executing this function at a time
          stateManager.setSetState(stepId, stepResult);
        }
      })
    );

    // We need to commit after all the manipulations
    // so that the result is persisted locally
    stateManager.commit();

    // We are checking if some steps are rejected
    // If they are, we will try them process it again
    if (areSomeRejected) {
      const rerun =
        (await readLineAsync(
          `Some steps of stage: ${stage.stageId} failed. \n Do you want to rerun? (y)`
        )) === "y";

      if (rerun) await this.processStage(stage);
      else process.exit();
    }
  }

  async run() {
    for (let { stageId, step } of this.stages) {
      await this.processStage({ stageId, step });
    }
  }
}
