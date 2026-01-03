import "./deno.ts";
import { handleSetRole } from "./setRole.ts";

Deno.serve(handleSetRole);
