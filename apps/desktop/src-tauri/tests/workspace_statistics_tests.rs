use brnch_desktop::WorkspaceStatistics;

#[test]
fn it_counts_files_and_changed_lines_without_counting_the_diff_headers() {
    let diff = [
        "diff --git a/a.ts b/a.ts",
        "--- a/a.ts",
        "+++ b/a.ts",
        "@@ -1,2 +1,3 @@",
        " keep",
        "-old",
        "+new",
        "+extra",
        "diff --git a/b.ts b/b.ts",
        "--- a/b.ts",
        "+++ b/b.ts",
        "@@ -1 +1 @@",
        "-x",
        "+y",
    ]
    .join("\n");

    let statistics = WorkspaceStatistics::from_diff("w", &diff);

    assert_eq!(
        (statistics.files, statistics.added, statistics.removed),
        (2, 3, 2)
    );
}
