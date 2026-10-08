import serverless from "serverless-http";
import { app } from "../src/server/server";

const handler = serverless(app);

export const onRequest = async (context: any) => {
    return handler(context.request, {
        ...context.env,
        waitUntil: context.waitUntil?.bind(context),
    });
};