/* eslint-disable @typescript-eslint/no-explicit-any */
import { VercelRequest, VercelResponse } from "@vercel/node";
import allowCors from "../apiHelpers/allowCors.js";
import { isFiddle } from "../apiHelpers/types.js";

const TEMPORY_ACCESS_TOKEN = process.env.TEMPORY_ACCESS_TOKEN;
if (!TEMPORY_ACCESS_TOKEN) {
    throw new Error("TEMPORY_ACCESS_TOKEN is not set");
}

const SAVE_FIDDLE_PASSCODE = process.env.SAVE_FIDDLE_PASSCODE;
if (!SAVE_FIDDLE_PASSCODE) {
    throw new Error("SAVE_FIDDLE_PASSCODE is not set");
}

export default allowCors(async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }
    const rr = req.body;
    const saveFiddlePasscode = rr.saveFiddlePasscode;
    if (saveFiddlePasscode !== SAVE_FIDDLE_PASSCODE) {
        res.status(400).json({ error: "Invalid passcode" });
        return;
    }
    const fiddle = rr.fiddle;
    if (!fiddle) {
        res.status(400).json({ error: "Invalid request" });
        return;
    }
    if (!isFiddle(fiddle)) {
        res.status(400).json({ error: "Invalid fiddle" });
        return;
    }
    const fiddleId = generateFiddleId();
    const url = 'https://hub.tempory.net/api/uploadFile'
    const fiddleText = JSON.stringify(fiddle);
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${TEMPORY_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
            appName: "jpfiddle",
            filePath: `anon/f/${fiddleId}.jpf`,
            size: fiddleText.length,
            userId: "fiddle",
        }),
    });
    if (!response.ok) {
        res.status(500).json({ error: `Failed to save fiddle *: ${await response.text()}` });
        return;
    }
    const result = await response.json();
    const {uploadUrl, downloadUrl} = result;
    const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: fiddleText,
    });
    if (!uploadResponse.ok) {
        res.status(500).json({ error: `Failed to save fiddle **: ${uploadResponse.statusText}` });
        return;
    }
    res.status(200).json({ success: true, fiddleUri: downloadUrl });
})

const generateFiddleId = () => {
    const choices = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const result: string[] = [];
    for (let i = 0; i < 6; i++) {
        result.push(choices[Math.floor(Math.random() * choices.length)]);
    }
    return result.join("");
}