import { createBlinkJourney } from "./BlinkJourney.js";
import { createHeadTurnJourney } from "./HeadTurnJourney.js";

const REGISTRY = {
    blink: createBlinkJourney,
    head_turn: createHeadTurnJourney,
};

export function selectJourney(config) {
    let name = config.journey || "blink";
    if (name === "random") {
        const keys = Object.keys(REGISTRY);
        name = keys[Math.floor(Math.random() * keys.length)];
    }
    const factory = REGISTRY[name] ?? REGISTRY.blink;
    return factory(config);
}
