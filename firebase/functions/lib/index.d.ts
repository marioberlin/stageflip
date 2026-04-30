export declare const setActiveOrg: import("firebase-functions/https").CallableFunction<{
    orgId: string;
}, Promise<import("./auth/set-active-org.js").SetActiveOrgOutput>, unknown>;
export declare const createApiKey: import("firebase-functions/https").CallableFunction<any, Promise<import("./auth/create-api-key.js").CreateApiKeyOutput>, unknown>;
export declare const revokeApiKey: import("firebase-functions/https").CallableFunction<any, Promise<import("./auth/revoke-api-key.js").RevokeApiKeyOutput>, unknown>;
export declare const inviteMember: import("firebase-functions/https").CallableFunction<any, Promise<import("./auth/invite-member.js").InviteMemberOutput>, unknown>;
export declare const acceptInvite: import("firebase-functions/https").CallableFunction<any, Promise<import("./auth/accept-invite.js").AcceptInviteOutput>, unknown>;
export declare const removeMember: import("firebase-functions/https").CallableFunction<any, Promise<import("./auth/remove-member.js").RemoveMemberOutput>, unknown>;
export declare const changeMemberRole: import("firebase-functions/https").CallableFunction<any, Promise<import("./auth/change-member-role.js").ChangeMemberRoleOutput>, unknown>;
/** T-272 AC #1: daily Firestore export at 02:00 UTC. */
export declare const backupFirestore: import("firebase-functions/scheduler").ScheduleFunction;
/** T-272 AC #2: daily Storage backup at 02:00 UTC. */
export declare const backupStorage: import("firebase-functions/scheduler").ScheduleFunction;
/** T-272 AC #5: daily verification at 03:00 UTC (1h after backup). */
export declare const verifyBackup: import("firebase-functions/scheduler").ScheduleFunction;
export declare const submitBakeJob: import("firebase-functions/https").CallableFunction<{
    clipDescriptor: unknown;
}, Promise<import("@stageflip/runtimes-blender").SubmitOutput>, unknown>;
//# sourceMappingURL=index.d.ts.map