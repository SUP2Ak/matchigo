// Public surface — matchigo
export { P } from "./p.ts";
export { match, compile } from "./match.ts";
export { matchWalk, matcherWalk, isMatching } from "./walk.ts";
export { matcher } from "./matcher.ts";
export { silenceWarnings } from "./dev.ts";

export type {
  CompiledFn,
  ExhaustiveError,
  InferPattern,
  Matcher,
  NarrowedBy,
  Pattern,
  Rule,
} from "./types.ts";
