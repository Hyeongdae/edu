import { app } from "@azure/functions";
import { createRecordHandlers } from "./handlers";
import { createPlayerRepositoryFromEnvironment } from "./playerRepository";
import type { PlayerRepository } from "./playerRepository";

// Resolve secrets only after authentication, not during registration or an unauthorized request.
let repository: PlayerRepository | undefined;
const getRepository = () => repository ??= createPlayerRepositoryFromEnvironment();
const handlers = createRecordHandlers({
  repository: {
    getProfile: (actor) => getRepository().getProfile(actor),
    listTopScores: () => getRepository().listTopScores(),
    listTopInfiniteScores: () => getRepository().listTopInfiniteScores(),
    submit: (actor, input) => getRepository().submit(actor, input),
    submitInfiniteScore: (actor, input) => getRepository().submitInfiniteScore(actor, input),
    saveAppearance: (actor, appearance) => getRepository().saveAppearance(actor, appearance),
  },
});

app.http("profile", { methods: ["GET"], authLevel: "anonymous", route: "profile", handler: handlers.profile });
app.http("leaderboard", { methods: ["GET"], authLevel: "anonymous", route: "leaderboard", handler: handlers.leaderboard });
app.http("infinite-leaderboard", { methods: ["GET"], authLevel: "anonymous", route: "infinite-leaderboard", handler: handlers.infiniteLeaderboard });
app.http("results", { methods: ["POST"], authLevel: "anonymous", route: "results", handler: handlers.results });
app.http("infinite-results", { methods: ["POST"], authLevel: "anonymous", route: "infinite-results", handler: handlers.infiniteResults });
app.http("appearance", { methods: ["POST"], authLevel: "anonymous", route: "appearance", handler: handlers.appearance });
