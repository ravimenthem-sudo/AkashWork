/**
 * Task Module Service
 * Consolidates all task-related operations.
 */
import * as query from './queries';
import * as mutation from './mutations';
import * as workflow from './workflow';

export const taskService = {
    ...query,
    ...mutation,
    ...workflow
};
