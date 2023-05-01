import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { createInterface } from "readline";

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const readLineAsync = (msg: string) => {
  return new Promise((resolve) => {
    readline.question(msg, (userRes) => {
      resolve(userRes);
    });
  });
};

// constraints
// a pipeline can have any number of stages
// every stage has the same number of steps

export type Step =
  | ((
      stepId: string,
      // get the result of a past stage using it's id
      // it will return the result for the same step id
      // it can return undefined if the previous stage data has not been stored locally
      // or if a future stage data is being asked
      getResultOfPastStage: <Y>(stageId: string) => Y
    ) => Promise<any>)
  | ((stepId: string) => Promise<any>);

// a stage is nothing but - stage id, step
type Stage = {
  stageId: string;
  step: Step;
};

// class pipeline
// have stages
// a stage can be any function given by the caller
// or a stage can be created using processStage method for which the caller has to provide what one step should do.
// it should be given stepIds

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

// each stage processes multiple steps
// it stores the result in a file named after the step
// if a file exists previously for this particular version
// it will read previous results. if the previous result is fulfilled
// it will do nothing. else it will reprocess it.
// a common set of stepIds should be used for the whole pipeline

// check if previous stage was fulfilled
// and if result is complete
// it will throw an error if a step was rejected
// or if chains are not in order
// or if some chains are missing from the results
// a common set of stepIds should be used for the whole pipeline

type StateStore<T = any> = {
  [stepId: string]: T;
};
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

  // it gets the latest state for the given step
  // the state after the last operation
  getStepState(stepId: string): T | undefined {
    return this.store[stepId];
  }

  setSetState(stepId: string, state: T) {
    this.store[stepId] = state;
  }

  // after all the in memory operations
  // one can commit to the local file
  // for permanent storage
  commit() {
    writeFileSync(this.filePath, JSON.stringify(this.store, null, 4));
  }
}

// can have many stages
// each stage will have some steps
// each stage will have same number of steps
// a step is a function to which the step id will be passed
// and it will proceed accordingly
export class Pipeline {
  private readonly stages: Stage[] = [];
  constructor(
    private readonly version: string,
    private readonly stepIds: string[]
  ) {}

  addStage(stageId: string, step: Step) {
    this.stages.push({ stageId, step });
  }

  private stepWrapper<T, Y>(step: Step) {
    return async (stepId: string): Promise<StepResult<T>> => {
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

    // create a stage manager
    let stateManager = new StateManager<StepResult>(
      stage.stageId,
      this.version
    );

    let areSomeRejected = false;
    await Promise.all(
      this.stepIds.map(async (stepId) => {
        console.log(`processing step: ${stepId} of stage: ${stage.stageId}`);

        const prevResult = stateManager.getStepState(stepId);
        if (prevResult === undefined || prevResult.status === "rejected") {
          let stepResult = await this.stepWrapper(stage.step)(stepId);

          if (stepResult.status === "rejected") {
            areSomeRejected = true;
            console.log(
              `step: ${stepId} of stage: ${stage.stageId} was rejected due to the following reason`
            );
            console.log(stepResult.reason);
          }

          // since javascript is a single threaded language
          // only one thread will be executing this function at a time
          stateManager.setSetState(stepId, stepResult);
        }
      })
    );

    // commit
    stateManager.commit();

    // check if each step is fulfilled
    // re process
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
