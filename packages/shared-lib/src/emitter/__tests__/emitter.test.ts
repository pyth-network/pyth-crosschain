import { IsomorphicEventEmitter } from "../index.js";

const FOOD_TYPES = ["pasta", "pizza", "rice", "tacos"] as const;
type FoodType = (typeof FOOD_TYPES)[number];

type TestEmitterEvents = {
  emitterTest: (reason: string, awesome: boolean) => void;
  multiple: (food: FoodType) => void;
};

class TestEmitter extends IsomorphicEventEmitter<TestEmitterEvents> {
  public emit<
    K extends keyof TestEmitterEvents,
    CB extends TestEmitterEvents[K],
  >(eventName: K, ...args: Parameters<CB>) {
    for (const cb of this.getListeners(eventName)) {
      // @ts-expect-error - TSC cannot resolve this typing here, even
      // though it is perfectly safe.
      // also, this is a test, so we don't really care too much about typing
      // issues.
      cb(...args);
    }
  }
}

describe("IsomorphicEventEmitter tests", () => {
  it("should emit an event and ensure the args were passed correctly", () => {
    const emitter = new TestEmitter();

    const fnc = jest.fn();
    emitter.on("emitterTest", fnc);

    const reason = "this is just a test";
    const awesome = true;

    emitter.emit("emitterTest", reason, awesome);

    expect(fnc).toHaveBeenNthCalledWith(1, reason, awesome);
    expect(fnc).toHaveBeenCalledTimes(1);
  });
  it("should ensure multiple emissions are captured", () => {
    const emitter = new TestEmitter();

    const errorFnc = jest.fn();
    const multipleFnc = jest.fn();

    const reasons: string[] = [];
    const awesomes: boolean[] = [];
    const foods: string[] = [];

    emitter.on("emitterTest", errorFnc);
    emitter.on("multiple", multipleFnc);

    const count = 10;

    for (let i = 0; i < count; i++) {
      const reason = `reason ${(Math.random() * 10_000).toString()}`;
      const awesome = Boolean(Math.floor(Math.random() * 1));
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const food = FOOD_TYPES.at(
        Math.floor(Math.random() * FOOD_TYPES.length),
      )!;

      reasons.push(reason);
      awesomes.push(awesome);
      foods.push(food);

      emitter.emit("emitterTest", reason, awesome);
      emitter.emit("multiple", food);
    }

    expect(errorFnc).toHaveBeenCalledTimes(reasons.length);
    expect(multipleFnc).toHaveBeenCalledTimes(reasons.length);

    for (let i = 0; i < count; i++) {
      const reason = reasons[i];
      const awesome = awesomes[i];
      const food = foods[i];

      expect(errorFnc).toHaveBeenNthCalledWith(i + 1, reason, awesome);
      expect(multipleFnc).toHaveBeenNthCalledWith(i + 1, food);
    }
  });
  it('should ensure no more event are emitted to a function after "off" has been called', () => {
    const emitter = new TestEmitter();

    const reason = "asdomasoidmoasmoda";
    const awesome = false;

    const fn = jest.fn();

    emitter.on("emitterTest", fn);

    emitter.emit("emitterTest", reason, awesome);
    expect(fn).toHaveBeenNthCalledWith(1, reason, awesome);

    emitter.off("emitterTest", fn);
    emitter.emit("emitterTest", reason, awesome);

    expect(fn).not.toHaveBeenNthCalledWith(2, reason, awesome);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("should ensure only a single event capture should occur when bound with .once()", () => {
    const emitter = new TestEmitter();

    const food: FoodType = "tacos";
    const food2: FoodType = "rice";

    const fn = jest.fn();

    emitter.once("multiple", fn);

    emitter.emit("multiple", food);
    emitter.emit("multiple", food2);

    expect(fn).toHaveBeenCalledTimes(1);
  });
  it("should ensure all event handlers are unbound when no callback is provided to .off()", () => {
    const emitter = new TestEmitter();

    const fn1 = jest.fn();
    const fn2 = jest.fn();

    const food1: FoodType = "pizza";
    const food2: FoodType = "pasta";
    const food3: FoodType = "rice";

    emitter.on("multiple", fn1);
    emitter.on("multiple", fn2);

    emitter.emit("multiple", food1);
    emitter.emit("multiple", food2);

    expect(fn1).toHaveBeenNthCalledWith(1, food1);
    expect(fn1).toHaveBeenNthCalledWith(2, food2);
    expect(fn2).toHaveBeenNthCalledWith(1, food1);
    expect(fn2).toHaveBeenNthCalledWith(2, food2);

    emitter.off("multiple");

    emitter.emit("multiple", food3);

    expect(fn1).toHaveBeenCalledTimes(2);
    expect(fn2).toHaveBeenCalledTimes(2);
  });
});
