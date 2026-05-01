# S3 index.html Upload Issue

## What's happening

The export pipeline writes CSV files directly from ClickHouse to S3 using
`INSERT INTO FUNCTION s3(...)`. This works perfectly — CSVs land in the bucket
without any issues.

However, after the CSV export finishes, the script tries to generate an
`index.html` manifest (a nice browsable page listing all exported files with
download links) and upload it to S3 using the same ClickHouse mechanism but
with `RawBLOB` format instead of `CSVWithNames`.

This `RawBLOB` upload consistently fails with `Access Denied` on the
`pyth-ch-share-public` bucket, even though the CSV uploads to the same
bucket and prefix succeed fine.

## Why it fails

The ClickHouse IAM role (`Clickhouse-pyth-lazer-FullAccessPublicShareS3`)
can write `CSVWithNames` data to S3 but gets a 403 when writing `RawBLOB`.
These two formats use different S3 API call patterns internally in ClickHouse,
and the IAM policy appears to restrict one but not the other.

We tried:
- Adding `SETTINGS s3_truncate_on_insert = 1` to skip the existence check — still 403
- Removing the `headers('Content-Type'='text/html')` parameter — still 403
- Writing to root-level path (not subfolders) — still 403

The CSV writes work because `CSVWithNames` with a `SELECT FROM table` query
goes through a different ClickHouse code path than `RawBLOB` with a
`SELECT base64Decode(...)` constant expression.

## Why this matters

Without the index.html, the S3 prefix URL returns an `AccessDenied` XML
error because S3 doesn't serve directory listings. The individual CSV files
are still there and downloadable with their direct URLs, but there's no way
for someone to browse and discover the files from a single link. This makes
it hard to share exports with external clients — you'd have to send them
each CSV URL individually.

## Current workaround

Index.html generation is disabled (`GENERATE_INDEX_HTML=0`). The dashboard
shows the S3 prefix URL, but clicking it won't show a file listing. To
share with external users, you need to share the direct CSV file URLs
(visible in the export logs).

## How to fix it

Any one of these would work, roughly ordered by effort:

1. **Fix the IAM policy** (preferred, no code changes) — Ask whoever manages
   the AWS account to allow `s3:PutObject` for the ClickHouse role on all
   keys under `exports/pyth-dump/`, not just CSV files. The role ARN is in
   the `.envrc` config. This is the cleanest fix because ClickHouse handles
   everything and no extra tooling is needed on the server.

2. **Install AWS CLI on the server** — Set `GENERATE_INDEX_HTML=1` and
   `INDEX_CONTENT_TYPE_FIX_WITH_AWSCLI=1` in the export config. The script
   will fall back to `aws s3 cp` for the HTML upload, bypassing ClickHouse
   entirely. Requires `aws` CLI configured with credentials that have
   `PutObject` access to the bucket.

3. **Upload via the Node.js app using @aws-sdk/client-s3** — Instead of
   relying on ClickHouse or the AWS CLI, the Node.js web app could generate
   the index.html and upload it directly to S3 using the AWS SDK after the
   export script finishes. This would require adding `@aws-sdk/client-s3`
   as a dependency and having AWS credentials available on the server (via
   IAM instance profile, env vars, or shared credentials file). The app
   already knows the exported file list from parsing the script output, so
   it has everything needed to generate the manifest.

4. **Use a different bucket** — The original `data_dump` workflow used
   `dourolabs-pyth-data-share` (eu-west-2) where uploads worked. If that
   bucket is still available, switching to it may resolve the issue.

## Re-enabling index.html

Once any of the above is resolved, re-enable by setting
`GENERATE_INDEX_HTML=1` in `src/lib/export-runner.ts` and restoring the
metadata env vars (export name, channel label, feed labels) that were
removed from `buildEnvConfig()` in the same file.
