import fs from "fs";
import path from "path";

export const privateKey = fs.readFileSync(path.join( "keys", "private.pem"), "utf8");
export const publicKey = fs.readFileSync(path.join( "keys", "public.pem"), "utf8");
