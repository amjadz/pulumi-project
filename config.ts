import { Config } from "@pulumi/pulumi";

const config = new Config();

export const helloWorldMessage = config.require("newServerMessage");
export const serverPort = config.require("serverPort");
export const serverHost = config.require("serverHost");
