import { makeCreateStyles, makeKeyframes, setSeed } from "simplestyle-js";
import { SimpleStyleRegistry } from "simplestyle-js/simpleStyleRegistry";

setSeed(1);

export const StyleRegistry = new SimpleStyleRegistry();

export const keyframes = makeKeyframes(StyleRegistry);

export const createStyle = makeCreateStyles(StyleRegistry);
