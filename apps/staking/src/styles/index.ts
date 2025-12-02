import { makeCreateStyle, setSeed } from "simplestyle-js";
import { SimpleStyleRegistry } from "simplestyle-js/simpleStyleRegistry";

setSeed(1);

export const StyleRegistry = new SimpleStyleRegistry();

export const createStyle = makeCreateStyle(StyleRegistry);
