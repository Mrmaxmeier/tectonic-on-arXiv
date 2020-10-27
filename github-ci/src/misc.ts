import { Context } from "probot";

export const PR_RUN_DATASET = "1702"

export interface Job {
    context?: Context,
    head_sha: string,
    head_branch?: string,
    base_sha?: string,
    check_run_id?: number,
}
