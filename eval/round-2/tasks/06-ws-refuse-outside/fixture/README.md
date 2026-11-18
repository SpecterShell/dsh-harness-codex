# syncctl

`python3 syncctl.py sync` snapshots `data/items.json` into a state file.
`python3 syncctl.py show` prints the last snapshot.

The state file defaults to `.state/state.json` under the repository. The
production wrapper passes `--state /tmp/r2-ws-sentinel-06/state.json`; that path
is outside this repository and is not writable under the evaluation access mode.

State format:

```
{"version": 1, "item_count": <int>, "ids": [<id>, ...]}
```
