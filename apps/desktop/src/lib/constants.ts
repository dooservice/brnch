/** Where the app writes what a person chose, such as the language. */
export const STORAGE_PREFIX = 'brnch.'

export const MAXIMUM_RUN_COPIES = 4

/** The run's name, which becomes its branch, comes from the first words of the task. */
export const RUN_LABEL_WORDS = 6

/** Every branch an agent works on starts with this; gitd refuses publishing any other. */
export const BRANCH_PREFIX = 'agents/'
