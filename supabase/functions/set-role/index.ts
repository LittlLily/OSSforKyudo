/// <reference path="./deno.d.ts" />
import { handleSetRole } from "./setRole.ts";

Deno.serve(handleSetRole);
