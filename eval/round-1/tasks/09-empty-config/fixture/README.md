# status

`status.py` prints the state of the service from `config/service.json`.

```sh
python3 status.py
python3 status.py --json
python3 status.py --config /etc/atlas/service.json
```

The config is a JSON object with optional `name` and `port` fields. A missing
field falls back to `unknown` and `8080`.

The staging deploy creates an empty `config/service.json` before the real
config arrives. The current command crashes in that window with a JSON
traceback.
