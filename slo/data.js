window.BENCHMARK_DATA = {
  "lastUpdate": 1792367382178,
  "repoUrl": "https://github.com/codehruv/dev-best-practices-ts",
  "entries": {
    "SLO latency": [
      {
        "commit": {
          "author": {
            "email": "codehruv@users.noreply.github.com",
            "name": "codehruv",
            "username": "codehruv"
          },
          "committer": {
            "email": "codehruv@users.noreply.github.com",
            "name": "codehruv",
            "username": "codehruv"
          },
          "distinct": true,
          "id": "eed7494b2377fe794cc8af3f4b829911869d5360",
          "message": "fix(ci): create gh-pages before recording SLO history\n\ngithub-action-benchmark fails to fetch a missing gh-pages branch, so the first push to main on a new repository always failed.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-18T19:48:58-04:00",
          "tree_id": "5865687990c4b11d21f54d68713ddccd66da0d95",
          "url": "https://github.com/codehruv/dev-best-practices-ts/commit/eed7494b2377fe794cc8af3f4b829911869d5360"
        },
        "date": 1792367379585,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "retry-delay-latency: p99 delay computation",
            "value": 90.6600000000708,
            "unit": "ns",
            "extra": "p99, 12099 samples, rme ±0.05%"
          },
          {
            "name": "retry-run-overhead: median overhead",
            "value": 0.1331949999985227,
            "unit": "us",
            "extra": "p50, 66074 samples, rme ±0.63%"
          },
          {
            "name": "retry-run-overhead: p99 overhead",
            "value": 0.9012200000006487,
            "unit": "us",
            "extra": "p99, 66074 samples, rme ±0.63%"
          },
          {
            "name": "retry-scheduling-overhead: p99 overhead for 3 retries",
            "value": 9.50054999999793,
            "unit": "us",
            "extra": "p99, 2423 samples, rme ±1.22%"
          }
        ]
      }
    ],
    "SLO throughput": [
      {
        "commit": {
          "author": {
            "email": "codehruv@users.noreply.github.com",
            "name": "codehruv",
            "username": "codehruv"
          },
          "committer": {
            "email": "codehruv@users.noreply.github.com",
            "name": "codehruv",
            "username": "codehruv"
          },
          "distinct": true,
          "id": "eed7494b2377fe794cc8af3f4b829911869d5360",
          "message": "fix(ci): create gh-pages before recording SLO history\n\ngithub-action-benchmark fails to fetch a missing gh-pages branch, so the first push to main on a new repository always failed.\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>",
          "timestamp": "2026-10-18T19:48:58-04:00",
          "tree_id": "5865687990c4b11d21f54d68713ddccd66da0d95",
          "url": "https://github.com/codehruv/dev-best-practices-ts/commit/eed7494b2377fe794cc8af3f4b829911869d5360"
        },
        "date": 1792367381603,
        "tool": "customBiggerIsBetter",
        "benches": [
          {
            "name": "retry-delay-throughput: median throughput",
            "value": 12180713.058946015,
            "unit": "ops/s",
            "extra": "p50, 12099 samples, rme ±0.05%"
          }
        ]
      }
    ]
  }
}